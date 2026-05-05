import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePhantom, useSolana } from "@/lib/wallet";
import { supabase } from "@/lib/supabase";
import { fetchOrderQuote } from "@/lib/dflow-api";
import { VersionedTransaction } from "@solana/web3.js";
import { MIN_TRADE_USDC, MAX_PROTOCOL_LEVERAGE } from "@/lib/protocol-constants";

export type LeveragedTradeStatus =
  | "idle"
  | "risk_check"
  | "lending"
  | "signing"
  | "confirming"
  | "success"
  | "error";

/**
 * Extract the actual error message from a Supabase edge function response.
 * When an edge function returns non-2xx, the Supabase client sets:
 *   - error.message = "Edge Function returned a non-2xx status code" (unhelpful)
 *   - data = the JSON body (if parseable) OR null
 *   - error.context = the raw Response (in some client versions)
 */
async function extractEdgeFunctionError(
  res: { data: unknown; error: { message: string; context?: Response } | null },
  fallback: string
): Promise<string> {
  // data?.error is the most reliable path (our edge functions always return { error: "..." })
  const dataErr = (res.data as Record<string, unknown>)?.error;
  if (typeof dataErr === "string" && dataErr.length > 0) return dataErr;

  // Some Supabase client versions expose the raw Response on error.context
  if (res.error?.context instanceof Response) {
    try {
      const body = await res.error.context.json();
      if (body?.error) return body.error;
    } catch { /* ignore parse failure */ }
  }

  // Last resort: the generic client error message
  return res.error?.message || fallback;
}

export function useLeveragedTrade() {
  const [status, setStatus] = useState<LeveragedTradeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    position_id: string;
    tx_signature: string;
    leverage: number;
    total_usdc: number;
  } | null>(null);
  const { addresses } = usePhantom();
  const { solana } = useSolana();
  const queryClient = useQueryClient();

  const solanaAddress = addresses?.find((a) =>
    String(a.addressType || "").toLowerCase().includes("solana")
  )?.address;

  async function openPosition(params: {
    marketTicker: string;
    side: "YES" | "NO";
    marginUsdc: number;
    leverage: number;
    outputMint: string;
  }) {
    setError(null);
    setResult(null);

    if (!solanaAddress || !solana) {
      setError("Connect your wallet first");
      return;
    }

    if (!supabase) {
      setError("Supabase not configured");
      return;
    }

    if (!Number.isFinite(params.marginUsdc) || params.marginUsdc < MIN_TRADE_USDC) {
      setError(`Minimum margin is $${MIN_TRADE_USDC} USDC`);
      setStatus("error");
      return;
    }

    if (
      !Number.isFinite(params.leverage) ||
      params.leverage < 1 ||
      params.leverage > MAX_PROTOCOL_LEVERAGE
    ) {
      setError(`Leverage must be between 1 and ${MAX_PROTOCOL_LEVERAGE}x`);
      setStatus("error");
      return;
    }

    try {
      console.log("[leveragedTrade] Wallet:", solanaAddress);
      console.log("[leveragedTrade] Params:", JSON.stringify(params));

      // 1. Risk check
      setStatus("risk_check");

      const riskRes = await supabase.functions.invoke("risk-check", {
        body: {
          market_ticker: params.marketTicker,
          margin_usdc: params.marginUsdc,
          leverage: params.leverage,
          side: params.side,
        },
      });

      if (riskRes.error) {
        const detail = await extractEdgeFunctionError(riskRes, "Risk check unavailable");
        throw new Error(`Risk check failed: ${detail}`);
      }
      if (!riskRes.data?.approved) {
        const allErrors = (riskRes.data?.errors as string[]) ?? [];
        const actionable = allErrors.length > 0 ? allErrors.join("; ") : "Risk check rejected the trade";
        throw new Error(actionable);
      }

      // 2. Vault lends borrowed USDC to user's wallet (server-side)
      setStatus("lending");

      const posRes = await supabase.functions.invoke("open-position", {
        body: {
          wallet_address: solanaAddress,
          market_ticker: params.marketTicker,
          side: params.side,
          margin_usdc: params.marginUsdc,
          leverage: params.leverage,
          output_mint: params.outputMint,
        },
      });

      if (posRes.error) {
        const errMsg = await extractEdgeFunctionError(posRes, "Failed to open position");
        throw new Error(errMsg);
      }
      if (!posRes.data?.success && posRes.data?.error) {
        throw new Error(posRes.data.error as string);
      }

      const { position_id, total_usdc, borrowed_usdc, leverage: effLev, lend_warning, lend_signature } = posRes.data;

      // If vault lending was skipped/failed, user trades with just their margin
      const lendingSucceeded = !!lend_signature && !lend_warning;
      const tradeUsdc = lendingSucceeded ? total_usdc : params.marginUsdc;

      if (lend_warning) {
        console.warn("[leveragedTrade] Vault lending skipped:", lend_warning);
      }

      // 3. User places DFlow trade from their own verified wallet
      setStatus("signing");

      const totalAtomic = Math.round(tradeUsdc * 1e6);
      console.log("[leveragedTrade] DFlow order:", {
        wallet: solanaAddress,
        inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        outputMint: params.outputMint,
        amount: totalAtomic,
        tradeUsdc,
      });
      const { transaction } = await fetchOrderQuote({
        userPublicKey: solanaAddress,
        inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        outputMint: params.outputMint,
        amount: totalAtomic,
        slippageBps: "auto",
      });

      const txBytes = Uint8Array.from(atob(transaction), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(txBytes);
      const sig = await solana.signAndSendTransaction(tx);

      // 4. Record trade execution
      setStatus("confirming");

      if (position_id && sig) {
        await supabase.functions.invoke("record-trade", {
          body: {
            position_id,
            tx_signature: sig,
            output_mint: params.outputMint,
            total_usdc: total_usdc,
          },
        }).catch(() => {
          // Non-critical: if record-trade fails, trade still happened on-chain
          console.warn("Failed to record trade execution, position still tracked");
        });
      }

      const tradeResult = {
        position_id,
        tx_signature: sig,
        leverage: lendingSucceeded ? effLev : 1,
        total_usdc: tradeUsdc,
      };

      setResult(tradeResult);
      setStatus("success");
      queryClient.invalidateQueries({ queryKey: ["protocolState"] });
      queryClient.invalidateQueries({ queryKey: ["userPortfolio"] });

      return tradeResult;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trade failed");
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setError(null);
    setResult(null);
  }

  return { openPosition, status, error, result, reset };
}
