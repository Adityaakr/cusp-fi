export const EARLY_CLOSURE_WINDOW_SECONDS = 7 * 24 * 60 * 60;
export const MIN_RESERVE_BPS = 2_500;
export const DEFAULT_BASE_LIQUIDATION_THRESHOLD_BPS = 7_700;

export type RiskTier = "conservative" | "moderate" | "growth";
export type MarketEligibility = RiskTier | "ineligible";

export function getRiskTierForProbability(probabilityPct: number): MarketEligibility {
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

export function earlyClosureWarningLevel(secondsRemaining: number): "none" | "t7" | "t3" | "t1" | "resolved" {
  if (secondsRemaining <= 0) return "resolved";
  if (secondsRemaining <= 24 * 60 * 60) return "t1";
  if (secondsRemaining <= 3 * 24 * 60 * 60) return "t3";
  if (secondsRemaining < EARLY_CLOSURE_WINDOW_SECONDS) return "t7";
  return "none";
}
