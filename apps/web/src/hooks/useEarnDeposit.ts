import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { buildEarnVaultDepositTx } from "@/lib/earn-vault";
import { usdtToUsdcQuote, getJupiterSwapTx } from "@/lib/jupiter";
import { getEarnVaultConnection, getMainnetConnection } from "@/lib/solana";
import { usePhantom } from "@/lib/wallet";
import { supabase } from "@/lib/supabase";

export type EarnDepositStatus =
  | "idle"
  | "quoting"
  | "swapping"
  | "depositing"
  | "signing"
  | "confirming"
  | "success"
  | "error";

export function useEarnDeposit() {
  const [status, setStatus] = useState<EarnDepositStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [swapQuote, setSwapQuote] = useState<{ inAmount: number; outAmount: number; priceImpact: number } | null>(null);
  const { addresses } = usePhantom();
  const wallet = useWallet();
  const queryClient = useQueryClient();

  const solanaAddress = addresses?.find((a) =>
    String(a.addressType || "").toLowerCase().includes("solana")
  )?.address;

  async function deposit(amountUsdt: number) {
    setError(null);
    setTxSignature(null);
    setSwapQuote(null);

    if (!solanaAddress) {
      setError("Connect your wallet first");
      setStatus("error");
      return;
    }

    if (!wallet.signTransaction || !wallet.publicKey) {
      setError("Wallet does not support signing");
      setStatus("error");
      return;
    }

    if (!Number.isFinite(amountUsdt) || amountUsdt <= 0) {
      setError("Enter a valid amount");
      setStatus("error");
      return;
    }

    try {
      const mainnetConnection = getMainnetConnection();
      const earnVaultConnection = getEarnVaultConnection();

      // Step 1: Get Jupiter swap quote (USDT → USDC)
      setStatus("quoting");
      const quote = await usdtToUsdcQuote(amountUsdt);
      const outAmountUsdc = parseInt(quote.outAmount) / 1e6;
      const priceImpact = parseFloat(quote.priceImpactPct) || 0;

      if (outAmountUsdc < 0.1) {
        throw new Error("Swap output too small — minimum 0.1 USDC required by Kamino vault");
      }

      setSwapQuote({
        inAmount: amountUsdt,
        outAmount: outAmountUsdc,
        priceImpact,
      });

      // Step 2: Get swap transaction from Jupiter, sign and send
      setStatus("swapping");
      const swapTx = await getJupiterSwapTx(quote, solanaAddress);
      const signedSwapTx = await wallet.signTransaction(swapTx);
      const rawSwapTx = signedSwapTx.serialize();
      const swapSignature = await mainnetConnection.sendRawTransaction(rawSwapTx, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      await mainnetConnection.confirmTransaction(swapSignature, "confirmed");

      // Step 3: Deposit swapped USDC into the Cusp earn vault and mint cUSDT.
      setStatus("depositing");
      const { tx: depositTx, estimatedCusdtUi, state } = await buildEarnVaultDepositTx(
        solanaAddress,
        outAmountUsdc,
      );

      setStatus("signing");
      const signedDepositTx = await wallet.signTransaction(depositTx);
      const rawDepositTx = signedDepositTx.serialize();
      const depositSignature = await earnVaultConnection.sendRawTransaction(rawDepositTx, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      setStatus("confirming");
      await earnVaultConnection.confirmTransaction(depositSignature, "confirmed");

      setTxSignature(depositSignature);

      // Record in Supabase
      if (supabase) {
        try {
          const { data: userId } = await supabase.rpc("get_or_create_user", {
            p_wallet_address: solanaAddress,
          });
          if (userId) {
            await supabase.from("deposits").insert({
              user_id: userId,
              amount_usdc: outAmountUsdc,
              cusdc_minted: estimatedCusdtUi,
              exchange_rate: state.exchangeRate,
              tx_signature: depositSignature,
              status: "confirmed",
              deposit_type: "earn_vault",
            });
          }
        } catch (dbErr) {
          console.warn("[earnDeposit] Supabase recording failed (non-fatal):", dbErr);
        }
      }

      setStatus("success");

      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["earnVaultState"] }),
        queryClient.invalidateQueries({ queryKey: ["earnVaultPosition"] }),
        queryClient.invalidateQueries({ queryKey: ["kaminoVault"] }),
        queryClient.invalidateQueries({ queryKey: ["protocolState"] }),
        queryClient.invalidateQueries({ queryKey: ["userPortfolio"] }),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Earn deposit failed";
      setError(msg);
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setError(null);
    setTxSignature(null);
    setSwapQuote(null);
  }

  return { deposit, status, error, txSignature, swapQuote, reset };
}
