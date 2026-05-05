import { PublicKey } from "@solana/web3.js";

export type StablecoinId = "USDT";

export interface StablecoinInfo {
  id: StablecoinId;
  symbol: string;
  name: string;
  decimals: number;
  devnetMint: string;
  mainnetMint: string;
  logoUri: string;
}

export const STABLECOINS: Record<StablecoinId, StablecoinInfo> = {
  USDT: {
    id: "USDT",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    devnetMint:
      import.meta.env.VITE_TEST_USDT_MINT ||
      "9aN7YJoSn2XSnjjkYHu1GM7gDn7YuD4EumCbPEaYveGh",
    mainnetMint: "Es9vMFrzaCERn2QytQkwT4NSr8F3rzA4XB9vNehqWj6q",
    logoUri:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERn2QytQkwT4NSr8F3rzA4XB9vNehqWj6q/logo.svg",
  },
  USDC: {
    id: "USDC",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    devnetMint:
      import.meta.env.VITE_TEST_USDC_MINT ||
      "wt1s1m9T9U4au8XW1J9EqtouHCTaeFKBMRFHYP7axGN",
    mainnetMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    logoUri:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
};

export const DEFAULT_STABLECOIN: StablecoinId = "USDT";

export function getStablecoinMint(
  id: StablecoinId,
  network: "devnet" | "mainnet-beta"
): PublicKey {
  const info = STABLECOINS[id];
  const address = network === "devnet" ? info.devnetMint : info.mainnetMint;
  return new PublicKey(address);
}

export function getStablecoinDecimals(id: StablecoinId): number {
  return STABLECOINS[id].decimals;
}

export function getStablecoinInfo(id: StablecoinId): StablecoinInfo {
  return STABLECOINS[id];
}

export function allStablecoinIds(): StablecoinId[] {
  return Object.keys(STABLECOINS) as StablecoinId[];
}