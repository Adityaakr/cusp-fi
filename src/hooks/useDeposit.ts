import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePhantom, useSolana } from "@phantom/react-sdk";
import { getConnection, USDC_MINT } from "@/lib/solana";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { SOLANA_NETWORK } from "@/lib/network-config";

const VAULT_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_VAULT_PROGRAM_ID || "EtGTQ9pmcnkYtTdorACENJPBmYVeWo8vrDzH7kU1K7DQ"
);

// Anchor discriminator for "deposit"
const DEPOSIT_DISCRIMINATOR = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);

// Derive vault PDAs
const [VAULT_STATE] = PublicKey.findProgramAddressSync([Buffer.from("vault")], VAULT_PROGRAM_ID);
const [CUSDC_MINT] = PublicKey.findProgramAddressSync([Buffer.from("cusdc-mint")], VAULT_PROGRAM_ID);
const [VAULT_USDC_ACCOUNT] = PublicKey.findProgramAddressSync([Buffer.from("vault-usdc")], VAULT_PROGRAM_ID);

export type DepositStatus =
  | "idle"
  | "building"
  | "signing"
  | "confirming"
  | "success"
  | "error";

export function useDeposit() {
  const [status, setStatus] = useState<DepositStatus>("idle");
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

    try {
      setStatus("building");

      const connection = getConnection();
      const userPubkey = new PublicKey(solanaAddress);
      const amountAtomic = Math.round(amountUsdc * 1e6);

      // Get user's USDC and cUSDC token accounts
      const userUsdcAta = await getAssociatedTokenAddress(
        USDC_MINT, userPubkey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const userCusdcAta = await getAssociatedTokenAddress(
        CUSDC_MINT, userPubkey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const instructions: TransactionInstruction[] = [];

      // Create cUSDC ATA if it doesn't exist
      const cusdcAccount = await connection.getAccountInfo(userCusdcAta);
      if (!cusdcAccount) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            userPubkey, userCusdcAta, userPubkey, CUSDC_MINT,
            TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      // Build deposit instruction
      // Data: discriminator (8 bytes) + usdc_amount (u64 LE, 8 bytes)
      const data = Buffer.alloc(16);
      DEPOSIT_DISCRIMINATOR.copy(data, 0);
      data.writeBigUInt64LE(BigInt(amountAtomic), 8);

      instructions.push(
        new TransactionInstruction({
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
        })
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

      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");

      setStatus("success");
      queryClient.invalidateQueries({ queryKey: ["protocolState"] });
      queryClient.invalidateQueries({ queryKey: ["userPortfolio"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setError(null);
    setTxSignature(null);
  }

  const explorerBase = SOLANA_NETWORK === "devnet"
    ? "https://solscan.io/tx/{sig}?cluster=devnet"
    : "https://solscan.io/tx/{sig}";

  return { deposit, status, error, txSignature, reset, explorerBase };
}
