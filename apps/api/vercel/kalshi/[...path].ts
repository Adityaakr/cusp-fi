import type { VercelRequest, VercelResponse } from "@vercel/node";

const KALSHI_TRADE_BASE =
  process.env.KALSHI_TRADE_BASE || "https://external-api.kalshi.com/trade-api/v2";
const KALSHI_SHARED_BASE =
  process.env.KALSHI_SHARED_BASE || "https://api.elections.kalshi.com";

function appendQueryValue(search: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    for (const item of value) appendQueryValue(search, key, item);
    return;
  }
  if (typeof value === "object") return;
  search.append(key, String(value));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    return res.status(204).end();
  }

  const downstream = ((req.query.path as string) || "").replace(/^\/+/, "");
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "path") continue;
    appendQueryValue(search, key, value);
  }

  const qs = search.toString();
  const base = downstream.startsWith("v1/") ? KALSHI_SHARED_BASE : KALSHI_TRADE_BASE;
  const target = `${base}/${downstream}${qs ? `?${qs}` : ""}`;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      ...(req.method !== "GET" && req.method !== "HEAD" && req.body
        ? { body: JSON.stringify(req.body) }
        : {}),
    });

    const contentType = upstream.headers.get("content-type") ?? "application/json";
    const body = await upstream.text();

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
    return res.status(upstream.status).send(body);
  } catch {
    return res.status(502).json({ error: "Failed to reach Kalshi API" });
  }
}
