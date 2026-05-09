import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePhantom, useSolana } from "@/lib/wallet";
import { cuspApiFetch } from "@/lib/cusp-api";
import { supabase } from "@/lib/supabase";
import { fetchOrderQuote } from "@/lib/dflow-api";
import { getMainnetConnection } from "@/lib/solana";
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

type RiskCheckResponse = {
  approved: boolean;
  errors?: string[];
  market_status?: string | null;
  effective_leverage?: number;
};

type OpenLeveragePositionResponse = {
  success: boolean;
  position_id?: string;
  total_usdc?: number;
  borrowed_usdc?: number;
  leverage?: number;
  lend_signature?: string;
  lend_warning?: string;
  health_factor?: number;
  error?: string;
};

export function useLeveragedTrade() {
  const [status, setStatus] = useState<LeveragedTradeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    position_id: string | null;
    tx_signature: string;
    leverage: number;
    total_usdc: number;
    borrowed_usdc: number;
    health_factor: number | null;
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

    if (!Number.isFinite(params.marginUsdc) || params.marginUsdc < MIN_TRADE_USDC) {
      setError(`Minimum margin is $${MIN_TRADE_USDC} USDT`);
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

      const riskRes = await cuspApiFetch<RiskCheckResponse>("/api/risk-check", {
        method: "POST",
        body: JSON.stringify({
          market_ticker: params.marketTicker,
          margin_usdc: params.marginUsdc,
          leverage: params.leverage,
          side: params.side,
        }),
      });

      if (!riskRes.approved) {
        const allErrors = riskRes.errors ?? [];
        const actionable = allErrors.length > 0 ? allErrors.join("; ") : "Risk check rejected the trade";
        throw new Error(actionable);
      }

      // 2. Mainnet LP pool lends borrowed USDC to user's wallet (server-side)
      setStatus("lending");

      const posRes = await cuspApiFetch<OpenLeveragePositionResponse>("/api/trade/leverage", {
        method: "POST",
        body: JSON.stringify({
          wallet_address: solanaAddress,
          market_query: params.marketTicker,
          side: params.side.toLowerCase(),
          margin_amount_ui: params.marginUsdc,
          leverage: params.leverage,
          max_slippage_bps: 100,
        }),
      });

      if (!posRes.success) {
        throw new Error(posRes.error || "Failed to open position");
      }

      const {
        position_id,
        total_usdc,
        borrowed_usdc,
        leverage: effLev,
        lend_warning,
        lend_signature,
        health_factor,
      } = posRes;

      // If vault lending was skipped/failed, user trades with just their margin
      const lendingSucceeded = !!lend_signature && !lend_warning;
      const tradeUsdc = lendingSucceeded ? (total_usdc ?? params.marginUsdc) : params.marginUsdc;

      if (lend_warning) {
        console.warn("[leveragedTrade] LP pool lending skipped:", lend_warning);
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
      const { transaction, outputAmount } = await fetchOrderQuote({
        userPublicKey: solanaAddress,
        inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        outputMint: params.outputMint,
        amount: totalAtomic,
        slippageBps: "auto",
      });

      const txBytes = Uint8Array.from(atob(transaction), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(txBytes);
      const sig = await solana.signAndSendTransaction(tx, getMainnetConnection());

      // 4. Record trade execution
      setStatus("confirming");

      if (position_id && sig && supabase) {
        const outputQuantity = Number(outputAmount ?? 0) / 1e6;
        const entryPrice = outputQuantity > 0 ? tradeUsdc / outputQuantity : tradeUsdc;
        await supabase.functions.invoke("record-trade", {
          body: {
            position_id,
            tx_signature: sig,
            output_mint: params.outputMint,
            total_usdc: tradeUsdc,
            output_amount: outputQuantity,
            entry_price: entryPrice,
          },
        }).catch(() => {
          // Non-critical: if record-trade fails, trade still happened on-chain
          console.warn("Failed to record trade execution, position still tracked");
        });
      }

      const tradeResult = {
        position_id: position_id ?? null,
        tx_signature: sig,
        leverage: lendingSucceeded ? (effLev ?? 1) : 1,
        total_usdc: tradeUsdc,
        borrowed_usdc: lendingSucceeded ? (borrowed_usdc ?? 0) : 0,
        health_factor: health_factor ?? null,
      };

      setResult(tradeResult);
      setStatus("success");
      queryClient.invalidateQueries({ queryKey: ["protocolState"] });
      queryClient.invalidateQueries({ queryKey: ["userPortfolio"] });
      queryClient.invalidateQueries({ queryKey: ["outcomeTokenHoldings"] });
      queryClient.invalidateQueries({ queryKey: ["lendingPool"] });

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
