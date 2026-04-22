export const EARLY_CLOSURE_WINDOW_SECONDS = 7 * 24 * 60 * 60;
export const MIN_RESERVE_BPS = 2_500;
export const BPS_DENOMINATOR = 10_000;

export type RiskTier = "conservative" | "moderate" | "growth";
export type EligibleRiskTier = RiskTier;
export type MarketEligibility = RiskTier | "ineligible";

export interface FundConfig {
  tier: RiskTier;
  label: string;
  shortLabel: "C" | "M" | "G";
  cusdcSymbol: "cUSDC-C" | "cUSDC-M" | "cUSDC-G";
  interestCapBps: number;
  targetApyRange: [number, number];
  minReserveBps: number;
  description: string;
  marketRule: string;
}

export interface MarketConfig {
  ticker: string;
  yesMint?: string;
  noMint?: string;
  settlementMint?: string;
  fundTier: MarketEligibility;
  earlyClosureEnabled: boolean;
  baseLiquidationThresholdBps: number;
  resolutionTime: number;
}

export interface EarlyClosureState {
  enabled: boolean;
  active: boolean;
  resolutionTime: number;
  secondsRemaining: number;
  windowSeconds: number;
  baseLiquidationThresholdBps: number;
  effectiveLiquidationThresholdBps: number;
  progressPct: number;
  warningLevel: "none" | "t7" | "t3" | "t1" | "resolved";
}

export interface DFlowMergeRequest {
  userPublicKey: string;
  marketId: string;
  yesMint: string;
  noMint: string;
  amount: number;
}

export interface DFlowRedeemRequest {
  userPublicKey: string;
  marketId: string;
  amount: number;
  settlementMint?: string;
}

export interface DFlowLiquidationPlan {
  marketId: string;
  collateralMint: string;
  oppositeMint: string;
  collateralAmount: number;
  side: "YES" | "NO";
  fundTier: RiskTier;
}

export const RISK_TIER_CONFIGS: Record<RiskTier, FundConfig> = {
  conservative: {
    tier: "conservative",
    label: "Conservative",
    shortLabel: "C",
    cusdcSymbol: "cUSDC-C",
    interestCapBps: 1_000,
    targetApyRange: [8, 12],
    minReserveBps: MIN_RESERVE_BPS,
    description: "Near-certain, short-duration markets with isolated downside.",
    marketRule: ">85% probability, usually <7 days to resolution",
  },
  moderate: {
    tier: "moderate",
    label: "Moderate",
    shortLabel: "M",
    cusdcSymbol: "cUSDC-M",
    interestCapBps: 2_000,
    targetApyRange: [12, 18],
    minReserveBps: MIN_RESERVE_BPS,
    description: "Medium-confidence markets with balanced yield and duration.",
    marketRule: "65-85% probability, usually 7-30 days",
  },
  growth: {
    tier: "growth",
    label: "Growth",
    shortLabel: "G",
    cusdcSymbol: "cUSDC-G",
    interestCapBps: 3_000,
    targetApyRange: [18, 28],
    minReserveBps: MIN_RESERVE_BPS,
    description: "Highest-yield market set with larger variance and full isolation.",
    marketRule: "50-65% probability, any duration",
  },
};

export const RISK_TIER_ORDER: RiskTier[] = ["conservative", "moderate", "growth"];

export const DEFAULT_BASE_LIQUIDATION_THRESHOLD_BPS = 7_700;

export function isRiskTier(value: unknown): value is RiskTier {
  return value === "conservative" || value === "moderate" || value === "growth";
}

export function getRiskTierForProbability(probabilityPct: number): MarketEligibility {
  if (!Number.isFinite(probabilityPct)) return "ineligible";
  if (probabilityPct > 85) return "conservative";
  if (probabilityPct >= 65) return "moderate";
  if (probabilityPct >= 50) return "growth";
  return "ineligible";
}

export function getRiskTierSeed(tier: RiskTier): number {
  switch (tier) {
    case "conservative": return 0;
    case "moderate": return 1;
    case "growth": return 2;
  }
}

export function riskTierFromSeed(seed: number): RiskTier | null {
  switch (seed) {
    case 0: return "conservative";
    case 1: return "moderate";
    case 2: return "growth";
    default: return null;
  }
}

export function formatRiskTier(tier: MarketEligibility): string {
  return tier === "ineligible" ? "Ineligible" : RISK_TIER_CONFIGS[tier].label;
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

export function getEarlyClosureState(params: {
  resolutionTime: number;
  baseThresholdBps?: number;
  currentTime?: number;
  enabled?: boolean;
}): EarlyClosureState {
  const currentTime = params.currentTime ?? Math.floor(Date.now() / 1000);
  const resolutionTime = params.resolutionTime;
  const enabled = params.enabled ?? true;
  const baseLiquidationThresholdBps = params.baseThresholdBps ?? DEFAULT_BASE_LIQUIDATION_THRESHOLD_BPS;
  const secondsRemaining = Math.floor(resolutionTime - currentTime);
  const active = enabled && secondsRemaining > 0 && secondsRemaining < EARLY_CLOSURE_WINDOW_SECONDS;
  const effective = effectiveLiquidationThresholdBps({
    baseThresholdBps: baseLiquidationThresholdBps,
    resolutionTime,
    currentTime,
    earlyClosureEnabled: enabled,
  });
  const elapsedInWindow = Math.min(
    EARLY_CLOSURE_WINDOW_SECONDS,
    Math.max(0, EARLY_CLOSURE_WINDOW_SECONDS - secondsRemaining)
  );
  const progressPct = enabled
    ? Math.round((elapsedInWindow / EARLY_CLOSURE_WINDOW_SECONDS) * 100)
    : 0;

  let warningLevel: EarlyClosureState["warningLevel"] = "none";
  if (enabled && secondsRemaining <= 0) warningLevel = "resolved";
  else if (active && secondsRemaining <= 24 * 60 * 60) warningLevel = "t1";
  else if (active && secondsRemaining <= 3 * 24 * 60 * 60) warningLevel = "t3";
  else if (active) warningLevel = "t7";

  return {
    enabled,
    active,
    resolutionTime,
    secondsRemaining: Math.max(0, secondsRemaining),
    windowSeconds: EARLY_CLOSURE_WINDOW_SECONDS,
    baseLiquidationThresholdBps,
    effectiveLiquidationThresholdBps: effective,
    progressPct,
    warningLevel,
  };
}

export function bpsToPct(bps: number): number {
  return bps / 100;
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
