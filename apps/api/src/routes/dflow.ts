import { Router, type Request, type Response } from "express";
import { DFLOW_API_KEY, DFLOW_METADATA_BASE, DFLOW_TRADE_BASE } from "../config/index.js";

const router = Router();

const DFLOW_MARKETS_MAX_PAGE_LIMIT = 255;

function appendQueryValue(search: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    for (const item of value) appendQueryValue(search, key, item);
    return;
  }
  if (typeof value === "object") return;
  search.append(key, String(value));
}

function clampDflowMarketsLimit(search: URLSearchParams) {
  const rawLimit = search.get("limit");
  if (rawLimit === null) return false;

  const parsedLimit = Number(rawLimit);
  if (!Number.isFinite(parsedLimit)) return false;

  const normalizedLimit = Math.floor(parsedLimit);
  if (normalizedLimit > DFLOW_MARKETS_MAX_PAGE_LIMIT) {
    search.set("limit", String(DFLOW_MARKETS_MAX_PAGE_LIMIT));
    return true;
  }

  if (normalizedLimit !== parsedLimit) {
    search.set("limit", String(normalizedLimit));
  }
  return false;
}

function buildDflowQuery(downstream: string, query: Request["query"]) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    appendQueryValue(search, key, value);
  }

  const limitClamped =
    downstream === "api/v1/markets" ? clampDflowMarketsLimit(search) : false;

  return { queryString: search.toString(), limitClamped };
}

async function proxyDflow(req: Request, res: Response, baseUrl: string) {
  if (!DFLOW_API_KEY) {
    res.status(500).json({ error: "DFLOW_API_KEY not configured" });
    return;
  }

  const downstream = req.params[0] || "";
  const { queryString, limitClamped } = buildDflowQuery(downstream, req.query);
  const target = `${baseUrl}/${downstream}${queryString ? `?${queryString}` : ""}`;

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

    if (!upstream.ok) {
      console.error(`DFlow ${upstream.status} for ${target.split("?")[0]}:`, body.slice(0, 500));
    }

    res.setHeader("Content-Type", contentType);
    if (baseUrl === DFLOW_METADATA_BASE) {
      res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=10");
    }
    if (limitClamped) {
      res.setHeader("X-Cusp-Dflow-Limit-Clamped", String(DFLOW_MARKETS_MAX_PAGE_LIMIT));
    }
    res.status(upstream.status).send(body);
  } catch (err) {
    console.error(`DFlow proxy error (${baseUrl}):`, err instanceof Error ? err.message : err);
    res.status(502).json({ error: "Failed to reach DFlow API" });
  }
}

router.all("/api/dflow/*", (req, res) => proxyDflow(req, res, DFLOW_METADATA_BASE));
router.all("/api/dflow-trade/*", (req, res) => proxyDflow(req, res, DFLOW_TRADE_BASE));

export default router;
