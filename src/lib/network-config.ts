/**
 * Central network configuration driven by VITE_PHASE.
 *
 * VITE_PHASE = "testnet"    → DFlow dev endpoints + Solana devnet
 * VITE_PHASE = "production" → DFlow prod endpoints + Solana mainnet (proxied with API key)
 *
 * Defaults to "testnet" so new contributors don't accidentally hit production.
 */

export type Phase = "testnet" | "production";

export const PHASE: Phase =
  (import.meta.env.VITE_PHASE as Phase) || "testnet";

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
    usdcMint: import.meta.env.VITE_TEST_USDC_MINT || "wt1s1m9T9U4au8XW1J9EqtouHCTaeFKBMRFHYP7axGN", // Cusp Test USDC
  },
  production: {
    network: "mainnet-beta" as const,
    rpcUrl: import.meta.env.VITE_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Mainnet USDC
  },
} as const;

export const SOLANA_NETWORK = SOLANA_CONFIG[PHASE].network;
export const SOLANA_RPC_URL = SOLANA_CONFIG[PHASE].rpcUrl;
export const USDC_MINT_ADDRESS = SOLANA_CONFIG[PHASE].usdcMint;

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
