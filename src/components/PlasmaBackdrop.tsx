import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";

/**
 * Full-bleed flowing-plasma backdrop, hand-rolled WebGL (domain-warped fbm noise).
 * Colors are sampled from the brand CSS tokens so it works in light + dark.
 * Falls back to a static CSS mesh gradient when reduced-motion is on or WebGL is
 * unavailable.
 */

const FRAG = `
precision highp float;
uniform float u_time;
uniform vec2  u_res;
uniform vec3  u_bg;
uniform vec3  u_c1;
uniform vec3  u_c2;
uniform vec3  u_c3;
uniform vec2  u_mouse;     // normalized cursor (0..1, y-up), -1 when absent
uniform float u_mouseGlow; // 0..1, ramps up while the pointer holds still

vec2 hash(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                 dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
             mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                 dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  float aspect = u_res.x / u_res.y;

  // aspect-corrected distance from the cursor (skipped when u_mouse is offscreen)
  vec2 av = vec2(uv.x * aspect, uv.y);
  vec2 am = vec2(u_mouse.x * aspect, u_mouse.y);
  float md = distance(av, am);
  float present = step(0.0, u_mouse.x);
  // localized pull: domain warps toward the cursor with a soft falloff
  float pull = present * exp(-md * 4.5);

  vec2 p = uv * 3.0;
  p.x *= aspect;
  p += (am - av) * pull * 0.9;
  float t = u_time * 0.05;

  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 1.3),
                fbm(p + 4.0 * q + vec2(8.3, 2.8) - t * 1.1));
  float f = clamp(fbm(p + 4.0 * r) * 0.5 + 0.5, 0.0, 1.0);

  vec3 col = u_bg;
  col = mix(col, u_c1, smoothstep(0.25, 0.75, f));
  col = mix(col, u_c3, smoothstep(0.45, 0.95, length(r) * 0.6));
  col = mix(col, u_c2, smoothstep(0.78, 1.0, f) * (0.35 + 0.65 * r.x));

  float vig = smoothstep(1.15, 0.25, distance(uv, vec2(0.5)));
  col = mix(u_bg, col, vig * 0.88 + 0.12);

  // cursor bloom: a soft green halo that grows when the pointer holds still
  float bloom = present * u_mouseGlow * smoothstep(0.32, 0.0, md);
  col += u_c2 * bloom * 0.55;
  col += u_c3 * bloom * bloom * 0.25;

  gl_FragColor = vec4(col, 1.0);
}
`;

const VERT = `
attribute vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

type Palette = {
  bg: [number, number, number];
  c1: [number, number, number];
  c2: [number, number, number];
  c3: [number, number, number];
};

/** Dark-theme defaults, used if a `--plasma-*` token is missing/unreadable. */
const PLASMA_FALLBACK: Palette = {
  bg: [0.013, 0.020, 0.016],
  c1: [0.05, 0.38, 0.25],
  c2: [0.10, 0.62, 0.40],
  c3: [0.06, 0.30, 0.32],
};

/**
 * Parse a `--plasma-*` token: a space-separated linear 0..1 RGB triple
 * (e.g. `"0.56 0.82 0.69"`), the shader's working space.
 */
function rgbVarToRgb(value: string, fallback: [number, number, number]): [number, number, number] {
  const p = value.trim().split(/\s+/).map(Number);
  if (p.length !== 3 || p.some((n) => Number.isNaN(n))) return fallback;
  return [p[0], p[1], p[2]];
}

/**
 * Read the plasma palette from the page's dedicated `--plasma-*` CSS tokens
 * (defined per-theme in index.css). These are the single source of truth: the
 * canvas stays in sync with the active theme and survives rebrand deploys,
 * while keeping the plasma's own tuned colors separate from the brand
 * `--cusp-*` accents used for text/buttons.
 */
function readPaletteFromCSS(): Palette {
  if (typeof document === "undefined") return PLASMA_FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  return {
    bg: rgbVarToRgb(cs.getPropertyValue("--plasma-bg"), PLASMA_FALLBACK.bg),
    c1: rgbVarToRgb(cs.getPropertyValue("--plasma-c1"), PLASMA_FALLBACK.c1),
    c2: rgbVarToRgb(cs.getPropertyValue("--plasma-c2"), PLASMA_FALLBACK.c2),
    c3: rgbVarToRgb(cs.getPropertyValue("--plasma-c3"), PLASMA_FALLBACK.c3),
  };
}

const PlasmaBackdrop = ({
  className = "",
  interactive = false,
}: {
  className?: string;
  interactive?: boolean;
}) => {
  const reduce = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [useFallback, setUseFallback] = useState(false);
  // Only hold a live WebGL context while the backdrop is near the viewport, so a
  // tall page never keeps ~7-8 contexts alive at once (browser cap → reclaim).
  const [inView, setInView] = useState(false);
  // Dev/debug escape hatch to preview the CSS fallback in any browser without
  // breaking WebGL: `?plasma=css` in the URL, or localStorage "plasma-fallback"
  // (dev only). Computed once so the render guard and the GL effect agree.
  const [forceFallback] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get("plasma") === "css") return true;
    return import.meta.env.DEV && typeof localStorage !== "undefined" && localStorage.getItem("plasma-fallback") === "1";
  });
  // `target` is the palette we want; `display` is what's currently rendered and is
  // eased toward `target` each frame so theme swaps cross-fade smoothly. The
  // pre-paint script in index.html applies the correct `.dark` class before first
  // paint, so this initial CSS read is already on-theme.
  const targetRef = useRef<Palette>(readPaletteFromCSS());
  const displayRef = useRef<Palette>({
    bg: [...targetRef.current.bg] as [number, number, number],
    c1: [...targetRef.current.c1] as [number, number, number],
    c2: [...targetRef.current.c2] as [number, number, number],
    c3: [...targetRef.current.c3] as [number, number, number],
  });

  // Keep the palette locked to the page theme. We re-read the CSS tokens on any
  // change to the <html> class (the signal every theme path flips: next-themes,
  // the pre-paint script, cross-tab `storage` sync). resolvedTheme is kept as a
  // belt-and-suspenders trigger. The per-frame easing cross-fades to the result.
  useEffect(() => {
    targetRef.current = readPaletteFromCSS();
    if (typeof MutationObserver === "undefined") return;
    const obs = new MutationObserver(() => {
      targetRef.current = readPaletteFromCSS();
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [resolvedTheme]);

  // Mount/unmount the canvas based on proximity to the viewport. `rootMargin`
  // mounts it slightly before it scrolls into view so there's no visible pop-in;
  // unmounting frees the GL context (see effect cleanup) to stay under the cap.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof IntersectionObserver === "undefined") {
      setInView(true); // no IO support → just keep it mounted
      return;
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: "200px",
      threshold: 0,
    });
    io.observe(wrap);
    return () => io.disconnect();
  }, []);

  // Cursor bloom for the CSS fallback — parity with the WebGL `interactive`
  // bloom. Mirrors the shader's input model: listen on `window` (not the element)
  // so the glow tracks the cursor even over the centered hero text, and swell it
  // when the pointer holds still. Only wired when the fallback is actually shown
  // and motion is allowed.
  useEffect(() => {
    if (!interactive || reduce || !(forceFallback || useFallback)) return;
    const el = fallbackRef.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
      el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
      el.dataset.hover = "1";
      el.dataset.idle = "0";
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        el.dataset.idle = "1"; // swell when the pointer holds still
      }, 160);
    };
    const onLeave = (e: PointerEvent) => {
      if (e.relatedTarget) return; // ignore element-to-element crossings; only the window exit
      clearTimeout(idleTimer.current);
      el.dataset.hover = "0";
      el.dataset.idle = "0";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onLeave, { passive: true });
    return () => {
      clearTimeout(idleTimer.current);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onLeave);
    };
  }, [interactive, reduce, forceFallback, useFallback]);

  useEffect(() => {
    if (reduce || forceFallback) {
      setUseFallback(true);
      return;
    }
    // Canvas only exists while near the viewport (Part F). When it isn't mounted
    // there's no GL work to do — and this effect's cleanup has freed any prior
    // context.
    if (!inView) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Prefer WebGL2 (better-supported / more robust on modern GPUs); fall back to
    // WebGL1, then to the CSS gradient. The shaders are GLSL ES 1.00 with no
    // `#version` directive, so they compile unchanged on either context.
    const ctxOpts: WebGLContextAttributes = { antialias: false, alpha: false, powerPreference: "low-power" };
    const gl = (canvas.getContext("webgl2", ctxOpts) || canvas.getContext("webgl", ctxOpts)) as
      | WebGL2RenderingContext
      | WebGLRenderingContext
      | null;
    if (!gl) {
      setUseFallback(true);
      return;
    }

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn("[PlasmaBackdrop] shader error:", gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };

    // GL resources are held in mutable closure vars so `initGL()` can rebuild
    // them after a context-restore (see webglcontextrestored handler below).
    let prog: WebGLProgram | null = null;
    let vs: WebGLShader | null = null;
    let fs: WebGLShader | null = null;
    let buf: WebGLBuffer | null = null;
    let uTime: WebGLUniformLocation | null = null;
    let uRes: WebGLUniformLocation | null = null;
    let uBg: WebGLUniformLocation | null = null;
    let uC1: WebGLUniformLocation | null = null;
    let uC2: WebGLUniformLocation | null = null;
    let uC3: WebGLUniformLocation | null = null;
    let uMouse: WebGLUniformLocation | null = null;
    let uMouseGlow: WebGLUniformLocation | null = null;
    let lost = false;

    // Build (or rebuild) the program, buffer, and uniform locations. Returns
    // false on any compile/link failure so the caller can drop to CSS fallback.
    const initGL = (): boolean => {
      vs = compile(gl.VERTEX_SHADER, VERT);
      fs = compile(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return false;
      prog = gl.createProgram()!;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
      gl.useProgram(prog);

      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      uTime = gl.getUniformLocation(prog, "u_time");
      uRes = gl.getUniformLocation(prog, "u_res");
      uBg = gl.getUniformLocation(prog, "u_bg");
      uC1 = gl.getUniformLocation(prog, "u_c1");
      uC2 = gl.getUniformLocation(prog, "u_c2");
      uC3 = gl.getUniformLocation(prog, "u_c3");
      uMouse = gl.getUniformLocation(prog, "u_mouse");
      uMouseGlow = gl.getUniformLocation(prog, "u_mouseGlow");
      return true;
    };

    if (!initGL()) {
      setUseFallback(true);
      return;
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    let rafId = 0; // 0 = no animation frame scheduled
    let pageVisible = !document.hidden;
    let last = performance.now();
    const start = last;
    let lossTimer: ReturnType<typeof setTimeout> | undefined;

    // cursor reactivity (interactive hero only): normalized target/display in
    // 0..1 with y-up to match gl_FragCoord; `present` flags pointer over canvas.
    const mTarget = { x: 0.5, y: 0.5 };
    const mDisplay = { x: 0.5, y: 0.5 };
    let present = false;
    let glow = 0;
    let lastMoveMs = start;
    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
      present = inside;
      if (inside) {
        mTarget.x = x;
        mTarget.y = 1 - y; // flip to y-up
        lastMoveMs = performance.now();
      }
    };
    const onPointerLeaveWin = () => (present = false);
    if (interactive) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerout", onPointerLeaveWin, { passive: true });
    }

    // ease each color channel toward the target; framerate-independent smoothing.
    const easeChannel = (cur: number, tgt: number, k: number) => cur + (tgt - cur) * k;
    const easeColor = (cur: [number, number, number], tgt: [number, number, number], k: number) => {
      cur[0] = easeChannel(cur[0], tgt[0], k);
      cur[1] = easeChannel(cur[1], tgt[1], k);
      cur[2] = easeChannel(cur[2], tgt[2], k);
    };

    // Single source of run-state, derived from flags so no two handlers can
    // race on a boolean (the bug that left the canvas frozen after a defocus
    // restore). `rafId === 0` means no frame is scheduled.
    const wantRun = () => pageVisible && !lost;

    const tick = (now: number) => {
      if (!wantRun()) {
        rafId = 0;
        return;
      }
      resize();
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      // ~0.45s cross-fade: k = 1 - e^(-dt/tau)
      const k = 1 - Math.exp(-dt / 0.15);
      const d = displayRef.current;
      const t = targetRef.current;
      easeColor(d.bg, t.bg, k);
      easeColor(d.c1, t.c1, k);
      easeColor(d.c2, t.c2, k);
      easeColor(d.c3, t.c3, k);

      // ease cursor position + glow (glow floors while moving, swells when idle)
      mDisplay.x = easeChannel(mDisplay.x, mTarget.x, 1 - Math.exp(-dt / 0.08));
      mDisplay.y = easeChannel(mDisplay.y, mTarget.y, 1 - Math.exp(-dt / 0.08));
      const idle = (now - lastMoveMs) / 1000;
      const idleRamp = Math.max(0, Math.min(1, (idle - 0.12) / 0.6));
      const glowTarget = present ? 0.4 + 0.6 * idleRamp : 0;
      glow = easeChannel(glow, glowTarget, 1 - Math.exp(-dt / 0.18));

      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform3f(uBg, d.bg[0], d.bg[1], d.bg[2]);
      gl.uniform3f(uC1, d.c1[0], d.c1[1], d.c1[2]);
      gl.uniform3f(uC2, d.c2[0], d.c2[1], d.c2[2]);
      gl.uniform3f(uC3, d.c3[0], d.c3[1], d.c3[2]);
      gl.uniform2f(uMouse, interactive ? mDisplay.x : -1, interactive ? mDisplay.y : -1);
      gl.uniform1f(uMouseGlow, interactive ? glow : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      rafId = requestAnimationFrame(tick);
    };

    // Start/stop the loop to match wantRun(). Idempotent — safe to call from any
    // handler; resets `last` on (re)start so a long pause never spikes dt.
    const sync = () => {
      if (wantRun()) {
        if (!rafId) {
          last = performance.now();
          rafId = requestAnimationFrame(tick);
        }
      } else if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    // Pause on tab visibility only — proximity to the viewport is handled by the
    // mount/unmount IntersectionObserver (Part F), so a mounted canvas is always
    // near the viewport.
    const onVis = () => {
      pageVisible = !document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);

    // Context loss/restore. A backgrounded/idle tab — or simply too many live
    // contexts — can have its GPU context reclaimed. preventDefault() is
    // mandatory or the context is never restorable. On restore we rebuild GL
    // state and re-seed the palette from the live theme (snapping display→target
    // so it doesn't fade up from a stale color), then sync() restarts the loop.
    // If the browser never restores it (GPU reset / cap exceeded), the watchdog
    // drops us to the CSS fallback so the user never sees a blank backdrop.
    const onContextLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      sync();
      lossTimer = setTimeout(() => setUseFallback(true), 3000);
    };
    const onContextRestored = () => {
      clearTimeout(lossTimer);
      if (!initGL()) {
        setUseFallback(true);
        return;
      }
      const p = readPaletteFromCSS();
      targetRef.current = p;
      displayRef.current = {
        bg: [...p.bg] as [number, number, number],
        c1: [...p.c1] as [number, number, number],
        c2: [...p.c2] as [number, number, number],
        c3: [...p.c3] as [number, number, number],
      };
      lost = false;
      canvas.width = 0; // force resize() to reapply viewport after restore
      sync();
    };
    canvas.addEventListener("webglcontextlost", onContextLost, false);
    canvas.addEventListener("webglcontextrestored", onContextRestored, false);

    sync(); // start the loop

    return () => {
      clearTimeout(lossTimer);
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      if (interactive) {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerout", onPointerLeaveWin);
      }
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
      // Deterministically free the GPU context now (don't wait for GC) so a
      // scrolled-away / unmounted backdrop stops counting toward the cap.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [reduce, interactive, inView, forceFallback]);

  // Terminal CSS fallback: reduced-motion, the dev force-toggle, or a WebGL
  // failure / permanent context loss. The canvas never mounts in these cases.
  // All styling lives in `.plasma-css-fallback` (index.css) — a baked-SVG-noise
  // approximation of the hero shader. Reduced-motion freezes it via CSS.
  if (reduce || forceFallback || useFallback) {
    return (
      <div ref={fallbackRef} aria-hidden className={`plasma-css-fallback ${className}`}>
        {interactive && !reduce && <div className="plasma-cursor-glow" />}
      </div>
    );
  }

  // Always-present wrapper so the IntersectionObserver has a stable target; the
  // canvas (and its GL context) only mounts while near the viewport (Part F).
  return (
    <div ref={wrapRef} aria-hidden className={`absolute inset-0 ${className}`}>
      {inView && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />}
    </div>
  );
};

export default PlasmaBackdrop;
