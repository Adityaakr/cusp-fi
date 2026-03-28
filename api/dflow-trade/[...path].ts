import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Vercel Serverless proxy for DFlow Quote (Trade) API.
 * Keeps the API key server-side — never exposed to the browser.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.DFLOW_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "DFLOW_API_KEY not configured" });
  }

  const pathSegments = req.query.path;
  const downstream = Array.isArray(pathSegments)
    ? pathSegments.join("/")
    : pathSegments ?? "";

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "path") continue;
    if (Array.isArray(value)) {
      value.forEach((v) => query.append(key, v));
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }
  const qs = query.toString();
  const target = `https://quote-api.dflow.net/${downstream}${qs ? `?${qs}` : ""}`;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
      },
    });

    const contentType = upstream.headers.get("content-type") ?? "application/json";
    const body = await upstream.text();

    res.setHeader("Content-Type", contentType);
    return res.status(upstream.status).send(body);
  } catch (err) {
    console.error("DFlow trade proxy error:", err);
    return res.status(502).json({ error: "Failed to reach DFlow Trade API" });
  }
}
