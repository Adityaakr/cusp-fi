import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DFLOW_API_KEY = process.env.DFLOW_API_KEY;
const DFLOW_BASE = "https://prediction-markets-api.dflow.net";
const DFLOW_TRADE_BASE = "https://quote-api.dflow.net";

app.use(express.json());

async function proxyDflow(req, res, baseUrl) {
  if (!DFLOW_API_KEY) {
    return res.status(500).json({ error: "DFLOW_API_KEY not configured" });
  }

  const downstream = req.params[0] || "";
  const qs = new URLSearchParams(req.query).toString();
  const target = `${baseUrl}/${downstream}${qs ? `?${qs}` : ""}`;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": DFLOW_API_KEY,
      },
      ...(req.method !== "GET" && req.method !== "HEAD" && req.body
        ? { body: JSON.stringify(req.body) }
        : {}),
    });

    const contentType = upstream.headers.get("content-type") ?? "application/json";
    const body = await upstream.text();

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=10");
    return res.status(upstream.status).send(body);
  } catch (err) {
    console.error(`DFlow proxy error (${baseUrl}):`, err.message);
    return res.status(502).json({ error: "Failed to reach DFlow API" });
  }
}

app.all("/api/dflow-trade/*", (req, res) => proxyDflow(req, res, DFLOW_TRADE_BASE));
app.all("/api/dflow/*", (req, res) => proxyDflow(req, res, DFLOW_BASE));

app.use(express.static(join(__dirname, "dist")));

app.get("*", (_req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Cusp server running on port ${PORT}`);
});
