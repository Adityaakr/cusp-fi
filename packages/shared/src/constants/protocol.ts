export const MIN_TRADE_USDC = 1;
export const MAX_PROTOCOL_LEVERAGE = 3;
export const EARLY_CLOSURE_WINDOW_SECONDS = 7 * 24 * 60 * 60;
export const MIN_RESERVE_BPS = 2_500;
export const BPS_DENOMINATOR = 10_000;
export const DEFAULT_BASE_LIQUIDATION_THRESHOLD_BPS = 7_700;

export const USDC_MINT_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDT_MINT_MAINNET = "Es9vMFrzaCERn2QytQkwT4NSr8F3rzA4XB9vNehqWj6q";
export const USDC_MINT_DEVNET = "wt1s1m9T9U4au8XW1J9EqtouHCTaeFKBMRFHYP7axGN";
export const USDT_MINT_DEVNET = "9aN7YJoSn2XSnjjkYHu1GM7gDn7YuD4EumCbPEaYveGh";

export const DFLOW_METADATA_BASE = "https://prediction-markets-api.dflow.net";
export const DFLOW_TRADE_BASE = "https://quote-api.dflow.net";
export const DFLOW_WS_URL = "wss://prediction-markets-api.dflow.net/api/v1/ws";

export const RISK_TIER_CONFIGS = {
  conservative: {
    tier: "conservative" as const,
    label: "Conservative",
    shortLabel: "C" as const,
    cusdcSymbol: "cUSDT-C" as const,
    interestCapBps: 1_000,
    targetApyRange: [8, 12] as [number, number],
    minReserveBps: MIN_RESERVE_BPS,
    description: "Near-certain, short-duration markets with isolated downside.",
    marketRule: ">85% probability, usually <7 days to resolution",
  },
  moderate: {
    tier: "moderate" as const,
    label: "Moderate",
    shortLabel: "M" as const,
    cusdcSymbol: "cUSDT-M" as const,
    interestCapBps: 2_000,
    targetApyRange: [12, 18] as [number, number],
    minReserveBps: MIN_RESERVE_BPS,
    description: "Medium-confidence markets with balanced yield and duration.",
    marketRule: "65-85% probability, usually 7-30 days",
  },
  growth: {
    tier: "growth" as const,
    label: "Growth",
    shortLabel: "G" as const,
    cusdcSymbol: "cUSDT-G" as const,
    interestCapBps: 3_000,
    targetApyRange: [18, 28] as [number, number],
    minReserveBps: MIN_RESERVE_BPS,
    description: "Highest-yield market set with larger variance and full isolation.",
    marketRule: "50-65% probability, any duration",
  },
};

export const RISK_TIER_ORDER = ["conservative", "moderate", "growth"] as const;

export function isRiskTier(value: unknown): value is "conservative" | "moderate" | "growth" {
  return value === "conservative" || value === "moderate" || value === "growth";
}

export function getRiskTierForProbability(probabilityPct: number): "conservative" | "moderate" | "growth" | "ineligible" {
  if (!Number.isFinite(probabilityPct)) return "ineligible";
  if (probabilityPct > 85) return "conservative";
  if (probabilityPct >= 65) return "moderate";
  if (probabilityPct >= 50) return "growth";
  return "ineligible";
}

export function effectiveLiquidationThresholdBps(params: {
  baseThresholdBps: number;
  resolutionTime: number;
  currentTime?: number;
  earlyClosureEnabled?: boolean;
}): number {
  const currentTime = params.currentTime ?? Math.floor(Date.now() / 1000);
  const base = Math.max(0, Math.floor(params.baseThresholdBps));

  if (params.earlyClosureEnabled === false) return base;
  if (!Number.isFinite(params.resolutionTime) || params.resolutionTime <= 0) return base;

  const secondsRemaining = Math.floor(params.resolutionTime - currentTime);
  if (secondsRemaining <= 0) return 0;
  if (secondsRemaining >= EARLY_CLOSURE_WINDOW_SECONDS) return base;

  return Math.floor((base * secondsRemaining) / EARLY_CLOSURE_WINDOW_SECONDS);
}

export function computeHealthFactor(params: {
  collateralValue: number;
  borrowedAmount: number;
  effectiveThresholdBps: number;
}): number {
  if (params.borrowedAmount <= 0) return Number.POSITIVE_INFINITY;
  const maxBorrowAtThreshold = params.collateralValue * (params.effectiveThresholdBps / BPS_DENOMINATOR);
  return maxBorrowAtThreshold / params.borrowedAmount;
}
