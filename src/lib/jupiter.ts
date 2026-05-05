import { JUPITER_API_BASE, MAINNET_USDT_MINT, MAINNET_USDC_MINT } from "./network-config";
import { VersionedTransaction } from "@solana/web3.js";

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: unknown[];
}

export interface JupiterSwapResult {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
  computeUnitLimit: number;
}

export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps: number = 50,
): Promise<JupiterQuote> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: String(amountLamports),
    slippageBps: String(slippageBps),
    onlyDirectRoutes: "false",
    asLegacyTransaction: "false",
  });

  const url = `${JUPITER_API_BASE}/v6/quote?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `Jupiter quote failed: ${res.status}`);
  }
  return res.json();
}

export async function getJupiterSwapTx(
  quoteResponse: JupiterQuote,
  userPublicKey: string,
): Promise<VersionedTransaction> {
  const url = `${JUPITER_API_BASE}/v6/swap`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `Jupiter swap failed: ${res.status}`);
  }

  const { swapTransaction } = await res.json();
  const txBuffer = Buffer.from(swapTransaction, "base64");
  return VersionedTransaction.deserialize(txBuffer);
}

export function usdtToUsdcQuote(amountUsdt: number): Promise<JupiterQuote> {
  const lamports = Math.round(amountUsdt * 1e6);
  return getJupiterQuote(MAINNET_USDT_MINT, MAINNET_USDC_MINT, lamports);
}

export function usdcToUsdtQuote(amountUsdc: number): Promise<JupiterQuote> {
  const lamports = Math.round(amountUsdc * 1e6);
  return getJupiterQuote(MAINNET_USDC_MINT, MAINNET_USDT_MINT, lamports);
}