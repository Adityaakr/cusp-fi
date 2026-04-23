import { defineConfig, loadEnv, type HttpProxy } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL env vars (including non-VITE_ ones) for the dev proxy
  const env = loadEnv(mode, process.cwd(), "");
  // Proxy DFlow requests through Vite dev server to inject API key (required for all phases)
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

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: dflowProxy,
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
