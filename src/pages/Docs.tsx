import docSource from "../docs/cusp-technical-docs.html?raw";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const DOCS_PAGE_TITLE = "CUSP - Technical Documentation";

function parseDoc(html: string) {
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
  const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/i);
  const style = styleMatch?.[1] ?? "";
  let body = bodyMatch?.[1] ?? "";
  body = body.replace(/<script>[\s\S]*?<\/script>/gi, "");
  return { style, body };
}

const Docs = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let shadow = host.shadowRoot;
    if (!shadow) {
      const { style, body } = parseDoc(docSource);
      shadow = host.attachShadow({ mode: "open" });
      const styleEl = document.createElement("style");
      styleEl.textContent = style;
      const content = document.createElement("div");
      content.innerHTML = body;
      shadow.append(styleEl, content);
    }

    shadowRef.current = shadow;

    const scrollToId = (id: string) => {
      if (!id) return;
      const el = shadow.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const onClick = (e: Event) => {
      const t = (e as MouseEvent).composedPath?.()[0] as Element | undefined;
      const a = t?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href) return;
      if (href.startsWith("#") && href.length > 1) {
        const id = decodeURIComponent(href.slice(1));
        if (shadow.getElementById(id)) {
          e.preventDefault();
          scrollToId(id);
          const { pathname, search } = window.location;
          const next = `${pathname}${search}#${id}`;
          if (window.history.replaceState) window.history.replaceState(null, "", next);
        }
        return;
      }
      if (href === "/" || (href.startsWith("/") && !href.startsWith("//"))) {
        e.preventDefault();
        navigate(href);
      }
    };

    shadow.addEventListener("click", onClick);
    return () => {
      shadow.removeEventListener("click", onClick);
      shadowRef.current = null;
    };
  }, [navigate]);

  useEffect(() => {
    if (location.pathname !== "/docs") return;
    const id = location.hash.length > 1 ? decodeURIComponent(location.hash.slice(1)) : "";
    if (!id) return;
    const shadow = shadowRef.current;
    if (!shadow) return;
    requestAnimationFrame(() => {
      const el = shadow.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const previous = document.title;
    document.title = DOCS_PAGE_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

  return <div ref={hostRef} className="fixed inset-0 z-0 h-full w-full" aria-label="Technical documentation" />;
};

export default Docs;
