import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SOLANA_RPC_URL, USDC_MINT_ADDRESS, MAINNET_RPC_URL, MAINNET_USDC_MINT } from "./network-config";

const RPC_URL = SOLANA_RPC_URL;

let _connection: Connection | null = null;
let _mainnetConnection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(RPC_URL, "confirmed");
  }
  return _connection;
}

/** Mainnet connection — used for DFlow trades and mainnet vault balance */
export function getMainnetConnection(): Connection {
  if (!_mainnetConnection) {
    console.log("[solana] Creating mainnet connection:", MAINNET_RPC_URL.replace(/api-key=.*/, "api-key=***"));
    _mainnetConnection = new Connection(MAINNET_RPC_URL, "confirmed");
  }
  return _mainnetConnection;
}

export const USDC_MINT = new PublicKey(USDC_MINT_ADDRESS);
export const MAINNET_USDC = new PublicKey(MAINNET_USDC_MINT);

export function getCusdcMint(): PublicKey | null {
  const mint = import.meta.env.VITE_CUSDC_MINT;
  return mint ? new PublicKey(mint) : null;
}

export function getVaultPublicKey(): PublicKey | null {
  const key = import.meta.env.VITE_VAULT_PUBLIC_KEY;
  return key ? new PublicKey(key) : null;
}

export function getVaultUsdcAccount(): PublicKey | null {
  const key = import.meta.env.VITE_VAULT_USDC_ACCOUNT;
  return key ? new PublicKey(key) : null;
}

export async function getTokenBalance(
  owner: PublicKey,
  mint: PublicKey
): Promise<number> {
  const connection = getConnection();
  try {
    const ata = await getAssociatedTokenAddress(
      mint,
      owner,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const account = await getAccount(connection, ata);
    return Number(account.amount) / 1e6;
  } catch {
    return 0;
  }
}

export async function getUsdcBalance(owner: PublicKey): Promise<number> {
  return getTokenBalance(owner, USDC_MINT);
}

export async function getCusdcBalance(owner: PublicKey): Promise<number> {
  const mint = getCusdcMint();
  if (!mint) return 0;
  return getTokenBalance(owner, mint);
}

export async function getSolBalance(owner: PublicKey): Promise<number> {
  const connection = getConnection();
  const lamports = await connection.getBalance(owner);
  return lamports / LAMPORTS_PER_SOL;
}

export function buildUsdcTransferInstruction(
  from: PublicKey,
  toTokenAccount: PublicKey,
  amount: number
) {
  const amountAtomic = Math.round(amount * 1e6);
  return createTransferInstruction(from, toTokenAccount, from, amountAtomic);
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

/** Fetch the vault keypair's mainnet USDC balance (the real lending pool for leverage) */
export async function getMainnetVaultUsdcBalance(): Promise<number> {
  const vaultPubkey = getVaultPublicKey();
  if (!vaultPubkey) return 0;
  const connection = getMainnetConnection();
  try {
    const ata = await getAssociatedTokenAddress(
      MAINNET_USDC,
      vaultPubkey,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const account = await getAccount(connection, ata);
    const balance = Number(account.amount) / 1e6;
    console.log("[solana] Mainnet vault USDC balance:", balance);
    return balance;
  } catch (err) {
    console.warn("[solana] Failed to fetch mainnet vault USDC balance:", err);
    return 0;
  }
}
