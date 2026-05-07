import { Router, type Request, type Response } from "express";
import { KALSHI_SHARED_BASE, KALSHI_TRADE_BASE } from "../config/index.js";

const router = Router();

function appendQueryValue(search: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    for (const item of value) appendQueryValue(search, key, item);
    return;
  }
  if (typeof value === "object") return;
  search.append(key, String(value));
}

async function proxyKalshi(req: Request, res: Response) {
  const downstream = (req.params[0] || "").replace(/^\/+/, "");
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
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

    if (!upstream.ok) {
      console.error(`Kalshi ${upstream.status} for ${target.split("?")[0]}:`, body.slice(0, 500));
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
    res.status(upstream.status).send(body);
  } catch (err) {
    console.error("Kalshi proxy error:", err instanceof Error ? err.message : err);
    res.status(502).json({ error: "Failed to reach Kalshi API" });
  }
}

router.all("/api/kalshi/*", (req, res) => proxyKalshi(req, res));

export default router;
