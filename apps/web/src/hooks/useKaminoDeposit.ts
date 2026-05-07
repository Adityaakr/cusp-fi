import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { buildKaminoDepositTx, signAndSendKaminoTx } from "@/lib/kamino";
import { usePhantom } from "@/lib/wallet";
import { supabase } from "@/lib/supabase";

export type KaminoDepositStatus =
  | "idle"
  | "building"
  | "signing"
  | "confirming"
  | "success"
  | "error";

export function useKaminoDeposit() {
  const [status, setStatus] = useState<KaminoDepositStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const { addresses } = usePhantom();
  const wallet = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();

  const solanaAddress = addresses?.find((a) =>
    String(a.addressType || "").toLowerCase().includes("solana")
  )?.address;

  async function deposit(amountUsdc: number) {
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

    if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
      setError("Enter a valid amount");
      setStatus("error");
      return;
    }

    try {
      setStatus("building");

      const tx = await buildKaminoDepositTx(solanaAddress, amountUsdc);

      setStatus("signing");

      const signedTx = await wallet.signTransaction(tx);

      setStatus("confirming");

      const rawTx = signedTx.serialize();
      const signature = await connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      await connection.confirmTransaction(signature, "confirmed");

      setTxSignature(signature);

      if (supabase) {
        try {
          const { data: userId } = await supabase.rpc("get_or_create_user", {
            p_wallet_address: solanaAddress,
          });
          if (userId) {
            await supabase.from("deposits").insert({
              user_id: userId,
              amount_usdc: amountUsdc,
              cusdc_minted: 0,
              exchange_rate: 1,
              tx_signature: signature,
              status: "confirmed",
              deposit_type: "kamino_earn",
            });
          }
        } catch (dbErr) {
          console.warn("[kaminoDeposit] Supabase recording failed (non-fatal):", dbErr);
        }
      }

      setStatus("success");

      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["kaminoPosition"] }),
        queryClient.invalidateQueries({ queryKey: ["kaminoVault"] }),
        queryClient.invalidateQueries({ queryKey: ["protocolState"] }),
        queryClient.invalidateQueries({ queryKey: ["userPortfolio"] }),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kamino deposit failed";
      setError(msg);
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setError(null);
    setTxSignature(null);
  }

  return { deposit, status, error, txSignature, reset };
}