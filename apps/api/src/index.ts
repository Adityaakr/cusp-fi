import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { PORT } from "./config/index.js";
import { corsMiddleware } from "./middleware/auth.js";
import routes from "./routes/index.js";
import { setupDflowWebSocket } from "./ws/dflow-ws.js";

const app = express();
app.use(express.json());
app.use(corsMiddleware);
app.use(routes);

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/ws/dflow") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

setupDflowWebSocket(wss);

server.listen(PORT, () => {
  console.log(`CUSP API server running on port ${PORT}`);
  console.log(`  DFlow proxy: ${DFLOW_API_KEY_CONFIGURED ? "configured" : "NOT configured"}`);
  console.log(`  QVAC endpoint: POST /api/qvac`);
});

const DFLOW_API_KEY_CONFIGURED = !!process.env.DFLOW_API_KEY;
