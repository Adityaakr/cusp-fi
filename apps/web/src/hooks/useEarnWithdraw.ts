import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { buildEarnVaultWithdrawTx } from "@/lib/earn-vault";
import { getJupiterSwapTx, usdcToUsdtQuote } from "@/lib/jupiter";
import { getEarnVaultConnection, getMainnetConnection } from "@/lib/solana";
import { usePhantom } from "@/lib/wallet";
import { supabase } from "@/lib/supabase";

export type EarnWithdrawStatus =
  | "idle"
  | "building"
  | "withdrawing"
  | "quoting"
  | "swapping"
  | "signing"
  | "confirming"
  | "success"
  | "error";

export function useEarnWithdraw() {
  const [status, setStatus] = useState<EarnWithdrawStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const { addresses } = usePhantom();
  const wallet = useWallet();
  const queryClient = useQueryClient();

  const solanaAddress = addresses?.find((a) =>
    String(a.addressType || "").toLowerCase().includes("solana")
  )?.address;

  async function withdraw(cusdtAmountUi: number) {
    setError(null);
    setTxSignature(null);

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

    if (!Number.isFinite(cusdtAmountUi) || cusdtAmountUi <= 0) {
      setError("Enter a valid amount");
      setStatus("error");
      return;
    }

    try {
      const earnVaultConnection = getEarnVaultConnection();
      const mainnetConnection = getMainnetConnection();

      setStatus("building");
      const { tx: withdrawTx, estimatedUsdcUi, state } = await buildEarnVaultWithdrawTx(
        solanaAddress,
        cusdtAmountUi,
      );

      setStatus("signing");
      const signedWithdrawTx = await wallet.signTransaction(withdrawTx);

      setStatus("withdrawing");
      const withdrawSignature = await earnVaultConnection.sendRawTransaction(
        signedWithdrawTx.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        },
      );

      setStatus("confirming");
      await earnVaultConnection.confirmTransaction(withdrawSignature, "confirmed");

      setStatus("quoting");
      const quote = await usdcToUsdtQuote(estimatedUsdcUi);

      setStatus("swapping");
      const swapTx = await getJupiterSwapTx(quote, solanaAddress);
      const signedSwapTx = await wallet.signTransaction(swapTx);
      const swapSignature = await mainnetConnection.sendRawTransaction(
        signedSwapTx.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        },
      );

      setStatus("confirming");
      await mainnetConnection.confirmTransaction(swapSignature, "confirmed");

      setTxSignature(swapSignature);

      if (supabase) {
        try {
          const { data: userId } = await supabase.rpc("get_or_create_user", {
            p_wallet_address: solanaAddress,
          });

          if (userId) {
            await supabase.from("withdrawals").insert({
              user_id: userId,
              cusdc_amount: cusdtAmountUi,
              usdc_amount: estimatedUsdcUi,
              exchange_rate: state.exchangeRate,
              withdrawal_type: "vault",
              status: "completed",
              tx_signature: swapSignature,
              completed_at: new Date().toISOString(),
            });
          }
        } catch (dbErr) {
          console.warn("[earnWithdraw] Supabase recording failed (non-fatal):", dbErr);
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
      const msg = err instanceof Error ? err.message : "Earn withdrawal failed";
      setError(msg);
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setError(null);
    setTxSignature(null);
  }

  return { withdraw, status, error, txSignature, reset };
}
