import { defineConfig, loadEnv, type HttpProxy } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig(({ mode }) => {
  const repoRoot = path.resolve(__dirname, "../..");
  const env = {
    ...loadEnv(mode, repoRoot, ""),
    ...loadEnv(mode, process.cwd(), ""),
    ...process.env,
  };
  console.log(`DFlow Vite proxy: ${env.DFLOW_API_KEY ? "configured" : "NOT configured"}`);
  const dflowProxy = {
    "/api/dflow-trade": {
      target: "https://quote-api.dflow.net",
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/api\/dflow-trade/, ""),
      configure: (proxy: HttpProxy.Server) => {
        proxy.on("proxyReq", (proxyReq) => {
          if (env.DFLOW_API_KEY) proxyReq.setHeader("x-api-key", env.DFLOW_API_KEY);
        });
      },
    },
    "/api/dflow": {
      target: "https://prediction-markets-api.dflow.net",
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/api\/dflow/, ""),
      configure: (proxy: HttpProxy.Server) => {
        proxy.on("proxyReq", (proxyReq) => {
          if (env.DFLOW_API_KEY) proxyReq.setHeader("x-api-key", env.DFLOW_API_KEY);
        });
      },
    },
    "/ws/dflow": {
      target: "wss://prediction-markets-api.dflow.net",
      ws: true,
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/ws\/dflow/, "/api/v1/ws"),
      configure: (proxy: HttpProxy.Server) => {
        proxy.on("proxyReqWs", (proxyReq) => {
          if (env.DFLOW_API_KEY) proxyReq.setHeader("x-api-key", env.DFLOW_API_KEY);
        });
      },
    },
  };

  const kaminoProxy = {
    "/api/kamino": {
      target: "https://api.kamino.finance",
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/api\/kamino/, ""),
    },
  };

  const jupiterProxy = {
    "/api/jupiter": {
      target: "https://quote-api.jup.ag",
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/api\/jupiter/, ""),
    },
  };

  const kalshiProxy = {
    "/api/kalshi": {
      target: env.CUSP_API_BASE || "http://localhost:4000",
      changeOrigin: true,
    },
  };

  const cuspApiProxy = {
    "/api/qvac": {
      target: env.CUSP_API_BASE || "http://localhost:4000",
      changeOrigin: true,
    },
    "/api/vault": {
      target: env.CUSP_API_BASE || "http://localhost:4000",
      changeOrigin: true,
    },
    "/api/lend": {
      target: env.CUSP_API_BASE || "http://localhost:4000",
      changeOrigin: true,
    },
    "/api/borrow": {
      target: env.CUSP_API_BASE || "http://localhost:4000",
      changeOrigin: true,
    },
    "/api/trade": {
      target: env.CUSP_API_BASE || "http://localhost:4000",
      changeOrigin: true,
    },
    "/api/risk-check": {
      target: env.CUSP_API_BASE || "http://localhost:4000",
      changeOrigin: true,
    },
  };

  return {
    envDir: repoRoot,
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: { ...dflowProxy, ...kaminoProxy, ...jupiterProxy, ...kalshiProxy, ...cuspApiProxy },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      nodePolyfills({
        include: ["buffer", "crypto", "stream", "util"],
        globals: { Buffer: true, global: true, process: true },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
