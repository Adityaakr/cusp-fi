import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { SOLANA_RPC_URL, VAULT_KEYPAIR_RAW, CUSDC_MINT, CUSDT_MINT } from "../config/index.js";
import {
  getAssociatedTokenAddress,
} from "@solana/spl-token";

let _connection: Connection | null = null;
let _vaultKeypair: Keypair | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(SOLANA_RPC_URL, "confirmed");
  }
  return _connection;
}

export function getVaultKeypair(): Keypair {
  if (!_vaultKeypair) {
    if (!VAULT_KEYPAIR_RAW) throw new Error("VAULT_KEYPAIR not configured");
    const bytes = JSON.parse(VAULT_KEYPAIR_RAW) as number[];
    _vaultKeypair = Keypair.fromSecretKey(Uint8Array.from(bytes));
  }
  return _vaultKeypair;
}

export function getCusdcMint(): PublicKey {
  if (!CUSDC_MINT) throw new Error("CUSDC_MINT not configured");
  return new PublicKey(CUSDC_MINT);
}

export function getCusdtMint(): PublicKey {
  if (!CUSDT_MINT) throw new Error("CUSDT_MINT not configured");
  return new PublicKey(CUSDT_MINT);
}

export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);
export const USDT_MINT = new PublicKey(
  "Es9vMFrzaCERn2QytQkwT4NSr8F3rzA4XB9vNehqWj6q"
);

export async function confirmTransaction(
  signature: string,
  maxRetries = 30
): Promise<boolean> {
  const connection = getConnection();
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
  signature: string,
  expectedRecipient: PublicKey,
  expectedAmountUsdc: number
): Promise<boolean> {
  const connection = getConnection();
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
      if (Math.abs(diff - expectedAmountUsdc) < 0.01) return true;
    }
  }
  return false;
}

export async function getVaultUsdcBalance(): Promise<number> {
  const connection = getConnection();
  const vault = getVaultKeypair();
  const vaultAta = await getAssociatedTokenAddress(USDC_MINT, vault.publicKey);
  try {
    const balance = await connection.getTokenAccountBalance(vaultAta);
    return balance.value.uiAmount ?? 0;
  } catch {
    return 0;
  }
}
