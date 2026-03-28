const METADATA_API =
  Deno.env.get("DFLOW_METADATA_API") ||
  "https://prediction-markets-api.dflow.net";
const TRADE_API =
  Deno.env.get("DFLOW_TRADE_API") || "https://quote-api.dflow.net";

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export async function fetchOrderQuote(params: {
  userPublicKey: string;
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number | "auto";
  predictionMarketSlippageBps?: number | "auto";
}): Promise<{ transaction: string; inputAmount: number; outputAmount: number }> {
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

  const apiKey = Deno.env.get("DFLOW_API_KEY");
  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;

  const res = await fetch(`${TRADE_API}/order?${search}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DFlow order failed (${res.status}): ${body}`);
  }
  const data = await res.json();
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
  const apiKey = Deno.env.get("DFLOW_API_KEY");
  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;

  const res = await fetch(
    `${TRADE_API}/order-status?signature=${signature}`,
    { headers }
  );
  if (!res.ok) throw new Error(`Order status check failed: ${res.status}`);
  return res.json();
}

export async function fetchMarket(ticker: string) {
  const apiKey = Deno.env.get("DFLOW_API_KEY");
  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;

  const res = await fetch(`${METADATA_API}/api/v1/market/${ticker}`, { headers });
  if (!res.ok) throw new Error(`Market fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchMarketByMint(mint: string) {
  const apiKey = Deno.env.get("DFLOW_API_KEY");
  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;

  const res = await fetch(`${METADATA_API}/api/v1/market/by-mint/${mint}`, { headers });
  if (!res.ok) throw new Error(`Market by mint fetch failed: ${res.status}`);
  return res.json();
}
