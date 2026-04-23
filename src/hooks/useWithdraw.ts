import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePhantom, useSolana } from "@phantom/react-sdk";
import { getConnection, USDC_MINT } from "@/lib/solana";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
} from "@solana/web3.js";
import { SOLANA_NETWORK } from "@/lib/network-config";
import { supabase } from "@/lib/supabase";

const VAULT_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_VAULT_PROGRAM_ID || "EtGTQ9pmcnkYtTdorACENJPBmYVeWo8vrDzH7kU1K7DQ"
);

// Anchor discriminator for "withdraw"
const WITHDRAW_DISCRIMINATOR = Buffer.from([183, 18, 70, 156, 148, 109, 161, 34]);

const [VAULT_STATE] = PublicKey.findProgramAddressSync([Buffer.from("vault")], VAULT_PROGRAM_ID);
const [CUSDC_MINT] = PublicKey.findProgramAddressSync([Buffer.from("cusdc-mint")], VAULT_PROGRAM_ID);
const [VAULT_USDC_ACCOUNT] = PublicKey.findProgramAddressSync([Buffer.from("vault-usdc")], VAULT_PROGRAM_ID);

export type WithdrawStatus =
  | "idle"
  | "building"
  | "signing"
  | "confirming"
  | "success"
  | "error";

export function useWithdraw() {
  const [status, setStatus] = useState<WithdrawStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const { addresses } = usePhantom();
  const { solana } = useSolana();
  const queryClient = useQueryClient();

  const solanaAddress = addresses?.find((a) =>
    String(a.addressType || "").toLowerCase().includes("solana")
  )?.address;

  async function withdraw(cusdcAmount: number) {
    setError(null);
    setTxSignature(null);

    if (!solanaAddress || !solana) {
      setError("Connect your wallet first");
      return;
    }

    try {
      setStatus("building");

      const connection = getConnection();
      const userPubkey = new PublicKey(solanaAddress);
      const amountAtomic = Math.round(cusdcAmount * 1e6);

      const userUsdcAta = await getAssociatedTokenAddress(
        USDC_MINT, userPubkey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const userCusdcAta = await getAssociatedTokenAddress(
        CUSDC_MINT, userPubkey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Build withdraw instruction
      // Data: discriminator (8 bytes) + cusdc_amount (u64 LE, 8 bytes)
      const data = Buffer.alloc(16);
      WITHDRAW_DISCRIMINATOR.copy(data, 0);
      data.writeBigUInt64LE(BigInt(amountAtomic), 8);

      const instruction = new TransactionInstruction({
        programId: VAULT_PROGRAM_ID,
        keys: [
          { pubkey: userPubkey, isSigner: true, isWritable: true },       // user
          { pubkey: VAULT_STATE, isSigner: false, isWritable: true },     // vault_state
          { pubkey: CUSDC_MINT, isSigner: false, isWritable: true },      // cusdc_mint
          { pubkey: VAULT_USDC_ACCOUNT, isSigner: false, isWritable: true }, // vault_usdc_account
          { pubkey: userUsdcAta, isSigner: false, isWritable: true },     // user_usdc_account
          { pubkey: userCusdcAta, isSigner: false, isWritable: true },    // user_cusdc_account
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
        ],
        data,
      });

      const { blockhash } = await connection.getLatestBlockhash();
      const messageV0 = new TransactionMessage({
        payerKey: userPubkey,
        recentBlockhash: blockhash,
        instructions: [instruction],
      }).compileToV0Message();

      const tx = new VersionedTransaction(messageV0);

      setStatus("signing");
      const signResult = await solana.signAndSendTransaction(tx);
      const signature =
        typeof signResult === "string"
          ? signResult
          : signResult?.signature ?? "";

      setTxSignature(signature);
      setStatus("confirming");

      await connection.confirmTransaction(signature, "confirmed");

      // Record withdrawal in Supabase
      if (supabase && solanaAddress) {
        try {
          const { data: userId } = await supabase.rpc("get_or_create_user", {
            p_wallet_address: solanaAddress,
          });

          if (userId) {
            const usdcReceived = cusdcAmount; // 1:1 at launch
            await supabase.from("withdrawals").insert({
              user_id: userId,
              cusdc_amount: cusdcAmount,
              usdc_amount: usdcReceived,
              exchange_rate: 1,
              withdrawal_type: "vault",
              status: "completed",
              tx_signature: signature,
              completed_at: new Date().toISOString(),
            });
            console.log("[withdraw] Recorded in Supabase:", { userId, cusdcAmount, signature });
          }
        } catch (dbErr) {
          console.warn("[withdraw] Supabase recording failed (non-fatal):", dbErr);
        }
      }

      setStatus("success");

      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["protocolState"] }),
        queryClient.invalidateQueries({ queryKey: ["userPortfolio"] }),
        queryClient.refetchQueries({ queryKey: ["protocolState"] }),
        queryClient.refetchQueries({ queryKey: ["userPortfolio"] }),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Withdrawal failed";
      console.error("[withdraw] Failed:", msg);
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
