import { DFLOW_API_KEY, DFLOW_METADATA_BASE, DFLOW_TRADE_BASE } from "../config/index.js";

function dflowHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (DFLOW_API_KEY) headers["x-api-key"] = DFLOW_API_KEY;
  return headers;
}

const DFLOW_MARKETS_MAX_PAGE_LIMIT = 255;

function normalizeMarketsPageLimit(limit: number): number {
  if (!Number.isFinite(limit)) return DFLOW_MARKETS_MAX_PAGE_LIMIT;
  return Math.max(1, Math.min(DFLOW_MARKETS_MAX_PAGE_LIMIT, Math.floor(limit)));
}

export interface OrderQuoteResult {
  transaction: string;
  inputAmount: number;
  outputAmount: number;
}

export async function fetchOrderQuote(params: {
  userPublicKey: string;
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number | "auto";
  predictionMarketSlippageBps?: number | "auto";
}): Promise<OrderQuoteResult> {
  const search = new URLSearchParams({
    userPublicKey: params.userPublicKey,
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: String(params.amount),
    slippageBps: String(params.slippageBps ?? "auto"),
  });
  if (params.predictionMarketSlippageBps !== undefined) {
    search.set(
      "predictionMarketSlippageBps",
      String(params.predictionMarketSlippageBps)
    );
  }

  const res = await fetch(`${DFLOW_TRADE_BASE}/order?${search}`, {
    headers: dflowHeaders(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DFlow order failed (${res.status}): ${body}`);
  }
  const data: any = await res.json();
  const tx =
    data.transaction ?? data.transactionBase64 ?? data.transaction_base64;
  if (!tx) throw new Error("No transaction in DFlow order response");

  return {
    transaction: tx,
    inputAmount: data.inputAmount ?? data.inAmount ?? params.amount,
    outputAmount: data.outputAmount ?? data.outAmount ?? 0,
  };
}

export async function checkOrderStatus(
  signature: string
): Promise<{ status: string; fills?: unknown[] }> {
  const res = await fetch(
    `${DFLOW_TRADE_BASE}/order-status?signature=${signature}`,
    { headers: dflowHeaders() }
  );
  if (!res.ok) throw new Error(`Order status check failed: ${res.status}`);
  const result: any = await res.json();
  return result;
}

export async function fetchMarket(ticker: string): Promise<any> {
  const res = await fetch(`${DFLOW_METADATA_BASE}/api/v1/market/${ticker}`, {
    headers: dflowHeaders(),
  });
  if (!res.ok) throw new Error(`Market fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchMarketByMint(mint: string): Promise<any> {
  const res = await fetch(
    `${DFLOW_METADATA_BASE}/api/v1/market/by-mint/${mint}`,
    { headers: dflowHeaders() }
  );
  if (!res.ok) throw new Error(`Market by mint fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchMarkets(params?: {
  status?: string;
  limit?: number;
  cursor?: number;
}): Promise<any> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.limit) search.set("limit", String(normalizeMarketsPageLimit(params.limit)));
  if (params?.cursor) search.set("cursor", String(params.cursor));
  const qs = search.toString();
  const res = await fetch(
    `${DFLOW_METADATA_BASE}/api/v1/markets${qs ? `?${qs}` : ""}`,
    { headers: dflowHeaders() }
  );
  if (!res.ok) throw new Error(`Markets fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchEvents(params?: {
  limit?: number;
  cursor?: number;
  seriesTickers?: string | string[];
  withNestedMarkets?: boolean;
  status?: string;
}): Promise<any> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.cursor !== undefined) search.set("cursor", String(params.cursor));
  if (params?.withNestedMarkets === true) search.set("withNestedMarkets", "true");
  if (params?.seriesTickers !== undefined) {
    const s =
      typeof params.seriesTickers === "string"
        ? params.seriesTickers
        : params.seriesTickers.join(",");
    search.set("seriesTickers", s);
  }
  if (params?.status) search.set("status", params.status);
  const qs = search.toString();
  const res = await fetch(
    `${DFLOW_METADATA_BASE}/api/v1/events${qs ? `?${qs}` : ""}`,
    { headers: dflowHeaders() }
  );
  if (!res.ok) throw new Error(`Events fetch failed: ${res.status}`);
  return res.json();
}
