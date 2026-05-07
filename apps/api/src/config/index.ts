import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(configDir, "../..");
const repoRoot = path.resolve(configDir, "../../../..");

dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config({ path: path.join(apiRoot, ".env"), override: true });
dotenv.config({ path: path.join(apiRoot, ".env.local"), override: true });

const env = process.env;

export const PORT = parseInt(env.PORT || "4000", 10);

export const DFLOW_API_KEY = env.DFLOW_API_KEY || "";
export const DFLOW_METADATA_BASE =
  env.DFLOW_METADATA_BASE || "https://prediction-markets-api.dflow.net";
export const DFLOW_TRADE_BASE =
  env.DFLOW_TRADE_BASE || "https://quote-api.dflow.net";
export const DFLOW_WS_URL =
  env.DFLOW_WS_URL || "wss://prediction-markets-api.dflow.net/api/v1/ws";

export const KALSHI_TRADE_BASE =
  env.KALSHI_TRADE_BASE || "https://external-api.kalshi.com/trade-api/v2";
export const KALSHI_SHARED_BASE =
  env.KALSHI_SHARED_BASE || "https://api.elections.kalshi.com";

export const SOLANA_RPC_URL =
  env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export const SUPABASE_URL = env.SUPABASE_URL || "";
export const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || "";
export const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || "";

export const VAULT_KEYPAIR_RAW = env.VAULT_KEYPAIR || "";
export const CUSDC_MINT = env.CUSDC_MINT || "";
export const CUSDT_MINT = env.CUSDT_MINT || "";

export const INVITE_SECRET = env.INVITE_SECRET || "";
