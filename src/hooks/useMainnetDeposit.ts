import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePhantom, useSolana } from "@phantom/react-sdk";
import {
  getMainnetConnection,
  MAINNET_USDC,
  getVaultPublicKey,
} from "@/lib/solana";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, VersionedTransaction, TransactionMessage, TransactionInstruction } from "@solana/web3.js";

export type MainnetDepositStatus =
  | "idle"
  | "building"
  | "signing"
  | "confirming"
  | "success"
  | "error";

export function useMainnetDeposit() {
  const [status, setStatus] = useState<MainnetDepositStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const { addresses } = usePhantom();
  const { solana } = useSolana();
  const queryClient = useQueryClient();

  const solanaAddress = addresses?.find((a) =>
    String(a.addressType || "").toLowerCase().includes("solana")
  )?.address;

  async function deposit(amountUsdc: number) {
    setError(null);
    setTxSignature(null);

    if (!solanaAddress || !solana) {
      setError("Connect your wallet first");
      return;
    }

    const vaultPubkey = getVaultPublicKey();
    if (!vaultPubkey) {
      setError("Vault not configured");
      return;
    }

    if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
      setError("Enter a valid amount");
      setStatus("error");
      return;
    }

    try {
      setStatus("building");

      const connection = getMainnetConnection();
      const userPubkey = new PublicKey(solanaAddress);
      const amountAtomic = Math.round(amountUsdc * 1e6);

      const userUsdcAta = await getAssociatedTokenAddress(
        MAINNET_USDC, userPubkey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const vaultUsdcAta = await getAssociatedTokenAddress(
        MAINNET_USDC, vaultPubkey, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const instructions: TransactionInstruction[] = [];

      // Create vault's mainnet USDC ATA if it doesn't exist yet
      const vaultAtaInfo = await connection.getAccountInfo(vaultUsdcAta);
      if (!vaultAtaInfo) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            userPubkey,      // payer
            vaultUsdcAta,    // ATA to create
            vaultPubkey,     // owner of the ATA
            MAINNET_USDC,    // mint
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      instructions.push(
        createTransferInstruction(
          userUsdcAta,
          vaultUsdcAta,
          userPubkey,
          amountAtomic,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const { blockhash } = await connection.getLatestBlockhash();
      const messageV0 = new TransactionMessage({
        payerKey: userPubkey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const tx = new VersionedTransaction(messageV0);

      setStatus("signing");
      const signResult = await solana.signAndSendTransaction(tx);
      const signature =
        typeof signResult === "string"
          ? signResult
          : signResult?.signature ?? signResult?.hash ?? "";

      setTxSignature(signature);
      setStatus("confirming");

      await connection.confirmTransaction(signature, "confirmed");

      setStatus("success");
      queryClient.invalidateQueries({ queryKey: ["protocolState"] });
      queryClient.invalidateQueries({ queryKey: ["userPortfolio"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mainnet deposit failed");
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
