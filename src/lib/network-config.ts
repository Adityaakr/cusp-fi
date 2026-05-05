import { PublicKey } from "@solana/web3.js";

/**
 * Central network configuration driven by VITE_PHASE.
 *
 * VITE_PHASE = "testnet"    → DFlow dev endpoints + Solana devnet
 * VITE_PHASE = "production" → DFlow prod endpoints + Solana mainnet (proxied with API key)
 *
 * Defaults to "production" (mainnet). Set VITE_PHASE=testnet in .env.local for devnet.
 */

export type Phase = "testnet" | "production";

export const PHASE: Phase =
  (import.meta.env.VITE_PHASE as Phase) || "production";

export const isTestnet = PHASE === "testnet";
export const isProduction = PHASE === "production";

// ── DFlow endpoints ──────────────────────────────────────────────────────────

// DFlow API requires an API key.  In dev the Vite proxy injects it;
// in production builds the Vercel serverless routes (/api/dflow/*) inject it.
// The frontend always hits the relative proxy paths so the key never leaks.
const isDev = import.meta.env.DEV;

// In both dev and prod the frontend uses the same relative proxy paths.
// Vite dev server proxies /api/dflow → prediction-markets-api.dflow.net (with key)
// Vercel rewrites   /api/dflow → serverless functions (with key)
export const DFLOW_METADATA_API = "/api/dflow";
export const DFLOW_TRADE_API = "/api/dflow-trade";
export const DFLOW_WS_URL = isDev
  ? `ws://${window.location.host}/ws/dflow`
  : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/dflow`;

// ── Solana network ───────────────────────────────────────────────────────────

const SOLANA_CONFIG = {
  testnet: {
    network: "devnet" as const,
    rpcUrl: import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com",
    usdcMint: import.meta.env.VITE_TEST_USDC_MINT || "wt1s1m9T9U4au8XW1J9EqtouHCTaeFKBMRFHYP7axGN",
    usdtMint: import.meta.env.VITE_TEST_USDT_MINT || "9aN7YJoSn2XSnjjkYHu1GM7gDn7YuD4EumCbPEaYveGh",
  },
  production: {
    network: "mainnet-beta" as const,
    rpcUrl: import.meta.env.VITE_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    usdtMint: "Es9vMFrzaCERn2QytQkwT4NSr8F3rzA4XB9vNehqWj6q",
  },
} as const;

export const SOLANA_NETWORK = SOLANA_CONFIG[PHASE].network;
export const SOLANA_RPC_URL = SOLANA_CONFIG[PHASE].rpcUrl;
export const USDC_MINT_ADDRESS = SOLANA_CONFIG[PHASE].usdcMint;
export const USDT_MINT_ADDRESS = SOLANA_CONFIG[PHASE].usdtMint;

// Mainnet constants — always available regardless of phase.
// DFlow trades and leveraged positions execute on mainnet.
// Derive mainnet RPC from devnet Helius key if no explicit mainnet URL is set.
function resolveMainnetRpc(): string {
  if (import.meta.env.VITE_MAINNET_RPC_URL) return import.meta.env.VITE_MAINNET_RPC_URL;
  // If using Helius devnet, swap subdomain to mainnet
  const devnetRpc = import.meta.env.VITE_SOLANA_RPC_URL || "";
  const heliusMatch = devnetRpc.match(/https:\/\/devnet\.helius-rpc\.com\/\?api-key=(.+)/);
  if (heliusMatch) return `https://mainnet.helius-rpc.com/?api-key=${heliusMatch[1]}`;
  return "https://api.mainnet-beta.solana.com";
}
export const MAINNET_RPC_URL = resolveMainnetRpc();
export const MAINNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const MAINNET_USDT_MINT = "Es9vMFrzaCERn2QytQkwT4NSr8F3rzA4XB9vNehqWj6q";

// ── Cusp Earn Vault (mainnet) ───────────────────────────────────────────────

export const EARN_VAULT_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_EARN_VAULT_PROGRAM_ID || "Bs53nqkzB4x81giq2Vc8SC6NLK7euxWThkcuj3UVZZcp"
);

export const EARN_VAULT_USDC_MINT = MAINNET_USDC_MINT;
export const EARN_VAULT_USDT_MINT = MAINNET_USDT_MINT;

// PDA derivations — must match on-chain seeds
const [EARN_VAULT_STATE] = PublicKey.findProgramAddressSync(
  [Buffer.from("earn-vault")],
  EARN_VAULT_PROGRAM_ID
);
const [CUSDT_MINT] = PublicKey.findProgramAddressSync(
  [Buffer.from("cusdt-mint")],
  EARN_VAULT_PROGRAM_ID
);
const [EARN_VAULT_USDC_ATA] = PublicKey.findProgramAddressSync(
  [Buffer.from("earn-vault-usdc")],
  EARN_VAULT_PROGRAM_ID
);

export { EARN_VAULT_STATE, CUSDT_MINT, EARN_VAULT_USDC_ATA };

// ── Jupiter swap ──────────────────────────────────────────────────────────────
export const JUPITER_API_BASE = "/api/jupiter";

// ── Kamino vaults ────────────────────────────────────────────────────────────
// Uses REST API (no SDK dependency) — see src/lib/kamino.ts

export const KAMINO_API_BASE = "/api/kamino";

export const KAMINO_VAULTS = {
  steakhouseUsdc: {
    address: "HDsayqAsDWy3QvANGqh2yNraqcD8Fnjgh73Mhb3WRS5E",
    tokenMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    sharesMint: "7D8C5pDFxug58L9zkwK7bCiDg4kD4AygzbcZUmf5usHS", // kUSDC
    name: "Kamino Steakhouse USDC",
    decimals: 6,
  },
} as const;

export type KaminoVaultId = keyof typeof KAMINO_VAULTS;