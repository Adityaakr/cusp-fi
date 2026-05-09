import type { VercelRequest, VercelResponse } from "@vercel/node";

const DFLOW_API_KEY = process.env.DFLOW_API_KEY;
const DFLOW_TRADE_BASE = "https://quote-api.dflow.net";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    return res.status(204).end();
  }

  if (!DFLOW_API_KEY) {
    return res.status(500).json({ error: "DFLOW_API_KEY not configured" });
  }

  const downstream = (req.query.path as string) || "";
  const qs = new URLSearchParams(
    Object.entries(req.query).filter(([k]) => k !== "path") as [string, string][]
  ).toString();
  const target = `${DFLOW_TRADE_BASE}/${downstream}${qs ? `?${qs}` : ""}`;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": DFLOW_API_KEY,
      },
      ...(req.method !== "GET" && req.body ? { body: JSON.stringify(req.body) } : {}),
    });

    const contentType = upstream.headers.get("content-type") ?? "application/json";
    const body = await upstream.text();

    res.setHeader("Content-Type", contentType);
    return res.status(upstream.status).send(body);
  } catch (err) {
    return res.status(502).json({ error: "Failed to reach DFlow Trade API" });
  }
}
