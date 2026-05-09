import { WebSocket, WebSocketServer } from "ws";
import { DFLOW_API_KEY, DFLOW_WS_URL } from "../config/index.js";

export function setupDflowWebSocket(wss: WebSocketServer) {
  wss.on("connection", (clientWs, req) => {
    if (req.url !== "/ws/dflow") {
      clientWs.close();
      return;
    }

    const headers: Record<string, string> = {};
    if (DFLOW_API_KEY) headers["x-api-key"] = DFLOW_API_KEY;

    const upstream = new WebSocket(DFLOW_WS_URL, { headers });

    upstream.on("open", () => {
      console.log("[ws] Connected to DFlow WebSocket");
    });

    upstream.on("message", (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    });

    upstream.on("close", () => {
      clientWs.close();
    });

    upstream.on("error", (err) => {
      console.error("[ws] DFlow upstream error:", err.message);
      clientWs.close();
    });

    clientWs.on("message", (data) => {
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(data);
      }
    });

    clientWs.on("close", () => {
      upstream.close();
    });

    clientWs.on("error", () => {
      upstream.close();
    });
  });
}
