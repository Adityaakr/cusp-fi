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
  vec2 p = uv * 3.0;
  p.x *= u_res.x / u_res.y;
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

function readColors(isDark: boolean): Palette {
  if (isDark) {
    // Dark theme: deep greens glowing on a near-black field. Kept rich (not bright)
    // so the plasma reads as dark-green, never a washed white-green.
    return {
      bg: [0.013, 0.020, 0.016] as [number, number, number],
      c1: [0.05, 0.38, 0.25] as [number, number, number],
      c2: [0.10, 0.62, 0.40] as [number, number, number],
      c3: [0.06, 0.30, 0.32] as [number, number, number],
    };
  }
  // Light theme: soft light greens on near-white.
  return {
    bg: [0.985, 0.992, 0.988] as [number, number, number],
    c1: [0.56, 0.82, 0.69] as [number, number, number],
    c2: [0.40, 0.74, 0.58] as [number, number, number],
    c3: [0.72, 0.90, 0.81] as [number, number, number],
  };
}

/** Resolve dark/light from next-themes' value, falling back to the DOM class. */
function isDarkTheme(resolvedTheme: string | undefined): boolean {
  if (resolvedTheme === "dark") return true;
  if (resolvedTheme === "light") return false;
  if (typeof document !== "undefined") return document.documentElement.classList.contains("dark");
  return true;
}

const PlasmaBackdrop = ({ className = "" }: { className?: string }) => {
  const reduce = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [useFallback, setUseFallback] = useState(false);
  // `target` is the palette we want; `display` is what's currently rendered and is
  // eased toward `target` each frame so theme swaps cross-fade smoothly.
  const targetRef = useRef<Palette>(readColors(isDarkTheme(resolvedTheme)));
  const displayRef = useRef<Palette>({
    bg: [...targetRef.current.bg] as [number, number, number],
    c1: [...targetRef.current.c1] as [number, number, number],
    c2: [...targetRef.current.c2] as [number, number, number],
    c3: [...targetRef.current.c3] as [number, number, number],
  });

  // drive the target palette off React's resolved theme (not the DOM class), so the
  // swap fires reliably the moment next-themes updates — no class-timing race.
  useEffect(() => {
    targetRef.current = readColors(isDarkTheme(resolvedTheme));
  }, [resolvedTheme]);

  useEffect(() => {
    if (reduce) {
      setUseFallback(true);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
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

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      setUseFallback(true);
      return;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setUseFallback(true);
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "u_time");
    const uRes = gl.getUniformLocation(prog, "u_res");
    const uBg = gl.getUniformLocation(prog, "u_bg");
    const uC1 = gl.getUniformLocation(prog, "u_c1");
    const uC2 = gl.getUniformLocation(prog, "u_c2");
    const uC3 = gl.getUniformLocation(prog, "u_c3");

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

    let raf = 0;
    let running = true;
    let last = performance.now();
    const start = last;

    // ease each color channel toward the target; framerate-independent smoothing.
    const easeChannel = (cur: number, tgt: number, k: number) => cur + (tgt - cur) * k;
    const easeColor = (cur: [number, number, number], tgt: [number, number, number], k: number) => {
      cur[0] = easeChannel(cur[0], tgt[0], k);
      cur[1] = easeChannel(cur[1], tgt[1], k);
      cur[2] = easeChannel(cur[2], tgt[2], k);
    };

    const render = (now: number) => {
      if (!running) return;
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

      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform3f(uBg, d.bg[0], d.bg[1], d.bg[2]);
      gl.uniform3f(uC1, d.c1[0], d.c1[1], d.c1[2]);
      gl.uniform3f(uC2, d.c2[0], d.c2[1], d.c2[2]);
      gl.uniform3f(uC3, d.c3[0], d.c3[1], d.c3[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(render);
    };

    const play = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(render);
      }
    };
    const pause = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    // pause when offscreen or tab hidden
    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting && !document.hidden ? play() : pause()),
      { threshold: 0 },
    );
    io.observe(canvas);
    const onVis = () => (document.hidden ? pause() : play());
    document.addEventListener("visibilitychange", onVis);

    raf = requestAnimationFrame(render);

    return () => {
      pause();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [reduce]);

  if (useFallback) {
    return (
      <div
        aria-hidden
        className={`absolute inset-0 ${className}`}
        style={{
          background:
            "radial-gradient(42% 52% at 24% 28%, hsl(var(--cusp-green) / 0.30), transparent 70%)," +
            "radial-gradient(46% 56% at 78% 64%, hsl(var(--cusp-green-bright) / 0.22), transparent 70%)," +
            "radial-gradient(52% 60% at 62% 18%, hsl(var(--cusp-teal) / 0.18), transparent 70%)," +
            "hsl(var(--background))",
        }}
      />
    );
  }

  return <canvas ref={canvasRef} aria-hidden className={`absolute inset-0 h-full w-full ${className}`} />;
};

export default PlasmaBackdrop;
