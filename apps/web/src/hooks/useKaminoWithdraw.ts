import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { buildKaminoWithdrawTx } from "@/lib/kamino";
import { usePhantom } from "@/lib/wallet";

export type KaminoWithdrawStatus =
  | "idle"
  | "building"
  | "signing"
  | "confirming"
  | "success"
  | "error";

export function useKaminoWithdraw() {
  const [status, setStatus] = useState<KaminoWithdrawStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const { addresses } = usePhantom();
  const wallet = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();

  const solanaAddress = addresses?.find((a) =>
    String(a.addressType || "").toLowerCase().includes("solana")
  )?.address;

  async function withdraw(sharesAmount: number) {
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

    if (!Number.isFinite(sharesAmount) || sharesAmount <= 0) {
      setError("Enter a valid amount");
      setStatus("error");
      return;
    }

    try {
      setStatus("building");

      const tx = await buildKaminoWithdrawTx(solanaAddress, sharesAmount);

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
      setStatus("success");

      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["kaminoPosition"] }),
        queryClient.invalidateQueries({ queryKey: ["kaminoVault"] }),
        queryClient.invalidateQueries({ queryKey: ["protocolState"] }),
        queryClient.invalidateQueries({ queryKey: ["userPortfolio"] }),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kamino withdraw failed";
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