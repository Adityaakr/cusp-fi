import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from "https://esm.sh/@solana/web3.js@1";
import {
  getAssociatedTokenAddress,
  createMintToInstruction,
  createBurnInstruction,
  TOKEN_PROGRAM_ID,
} from "https://esm.sh/@solana/spl-token@0.4";
import { decode as decodeBase58 } from "https://deno.land/std/encoding/base58.ts";

const RPC_URL =
  Deno.env.get("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";

export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

export function getConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

export function getVaultKeypair(): Keypair {
  const raw = Deno.env.get("VAULT_KEYPAIR");
  if (!raw) throw new Error("VAULT_KEYPAIR not set");
  const bytes = JSON.parse(raw) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

export function getCusdcMint(): PublicKey {
  const mint = Deno.env.get("CUSDC_MINT");
  if (!mint) throw new Error("CUSDC_MINT not set");
  return new PublicKey(mint);
}

export async function confirmTransaction(
  connection: Connection,
  signature: string,
  maxRetries = 30
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const status = await connection.getSignatureStatus(signature);
    if (
      status?.value?.confirmationStatus === "confirmed" ||
      status?.value?.confirmationStatus === "finalized"
    ) {
      return !status.value.err;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

export async function verifyUsdcTransfer(
  connection: Connection,
  signature: string,
  expectedRecipient: PublicKey,
  expectedAmountUsdc: number
): Promise<boolean> {
  const tx = await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  });
  if (!tx || tx.meta?.err) return false;

  const preBalances = tx.meta?.preTokenBalances ?? [];
  const postBalances = tx.meta?.postTokenBalances ?? [];

  for (const post of postBalances) {
    if (
      post.mint === USDC_MINT.toBase58() &&
      post.owner === expectedRecipient.toBase58()
    ) {
      const pre = preBalances.find(
        (p) => p.accountIndex === post.accountIndex
      );
      const preAmount = pre?.uiTokenAmount?.uiAmount ?? 0;
      const postAmount = post.uiTokenAmount?.uiAmount ?? 0;
      const diff = postAmount - preAmount;
      if (Math.abs(diff - expectedAmountUsdc) < 0.01) {
        return true;
      }
    }
  }
  return false;
}
