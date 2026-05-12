import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  SOLANA_RPC_URL,
  VAULT_KEYPAIR_RAW,
  CUSDC_MINT,
  CUSDT_MINT,
  MAINNET_POOL_KEYPAIR_RAW,
  MAINNET_POOL_PUBLIC_KEY,
} from "../config/index.js";
import {
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

let _connection: Connection | null = null;
let _vaultKeypair: Keypair | null = null;
let _mainnetPoolKeypair: Keypair | null = null;

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

export function getMainnetPoolKeypair(): Keypair {
  if (!_mainnetPoolKeypair) {
    if (!MAINNET_POOL_KEYPAIR_RAW) throw new Error("MAINNET_POOL_KEYPAIR not configured");
    const bytes = JSON.parse(MAINNET_POOL_KEYPAIR_RAW) as number[];
    _mainnetPoolKeypair = Keypair.fromSecretKey(Uint8Array.from(bytes));
  }
  return _mainnetPoolKeypair;
}

export function getMainnetPoolPublicKey(): PublicKey {
  if (MAINNET_POOL_PUBLIC_KEY) {
    return new PublicKey(MAINNET_POOL_PUBLIC_KEY);
  }
  return getMainnetPoolKeypair().publicKey;
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
export const TOKEN_2022 = TOKEN_2022_PROGRAM_ID;
export const TOKEN_LEGACY = TOKEN_PROGRAM_ID;

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

export async function verifySplTokenTransfer(params: {
  signature: string;
  mint: PublicKey;
  expectedRecipient: PublicKey;
  expectedAmountUi: number;
}): Promise<boolean> {
  const connection = getConnection();
  const tx = await connection.getTransaction(params.signature, {
    maxSupportedTransactionVersion: 0,
  });
  if (!tx || tx.meta?.err) return false;

  const preBalances = tx.meta?.preTokenBalances ?? [];
  const postBalances = tx.meta?.postTokenBalances ?? [];

  for (const post of postBalances) {
    if (
      post.mint === params.mint.toBase58() &&
      post.owner === params.expectedRecipient.toBase58()
    ) {
      const pre = preBalances.find((balance) => balance.accountIndex === post.accountIndex);
      const preAmount = pre?.uiTokenAmount?.uiAmount ?? 0;
      const postAmount = post.uiTokenAmount?.uiAmount ?? 0;
      const diff = postAmount - preAmount;
      if (Math.abs(diff - params.expectedAmountUi) < 0.000001) return true;
    }
  }

  return false;
}

export async function getTokenProgramForMint(mint: PublicKey): Promise<PublicKey> {
  const accountInfo = await getConnection().getAccountInfo(mint);
  if (!accountInfo) {
    throw new Error(`Mint account not found: ${mint.toBase58()}`);
  }
  if (accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) return TOKEN_2022_PROGRAM_ID;
  return TOKEN_PROGRAM_ID;
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

export async function getMainnetPoolUsdcBalance(): Promise<number> {
  const connection = getConnection();
  const pool = getMainnetPoolPublicKey();
  const poolAta = await getAssociatedTokenAddress(USDC_MINT, pool);
  try {
    const balance = await connection.getTokenAccountBalance(poolAta);
    return balance.value.uiAmount ?? 0;
  } catch {
    return 0;
  }
}
