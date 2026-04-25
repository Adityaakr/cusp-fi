/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "testnet" or "production" — controls DFlow endpoints, Solana network, and USDC mint */
  readonly VITE_PHASE?: "testnet" | "production";
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SOLANA_RPC_URL?: string;
  readonly VITE_SOLANA_NETWORK?: string;
  readonly VITE_CUSDC_MINT?: string;
  readonly VITE_VAULT_USDC_ACCOUNT?: string;
  readonly VITE_VAULT_PUBLIC_KEY?: string;
  readonly VITE_PHANTOM_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
