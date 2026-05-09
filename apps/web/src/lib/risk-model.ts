export {
  type RiskTier,
  type MarketEligibility,
  type FundConfig,
  type EarlyClosureState,
  RISK_TIER_CONFIGS,
  RISK_TIER_ORDER,
  DEFAULT_BASE_LIQUIDATION_THRESHOLD_BPS,
  EARLY_CLOSURE_WINDOW_SECONDS,
  BPS_DENOMINATOR,
  MIN_RESERVE_BPS,
  isRiskTier,
  getRiskTierForProbability,
  effectiveLiquidationThresholdBps,
  computeHealthFactor,
} from "@cusp/shared";

export type { DFlowMergeRequest, DFlowRedeemRequest, DFlowLiquidationPlan, MarketConfig } from "./risk-model-local";

import {
  DEFAULT_BASE_LIQUIDATION_THRESHOLD_BPS as BASE_LIQ,
  EARLY_CLOSURE_WINDOW_SECONDS as WINDOW_S,
  effectiveLiquidationThresholdBps as effLiq,
  type EarlyClosureState,
} from "@cusp/shared";

export function getEarlyClosureState(params: {
  resolutionTime: number;
  baseThresholdBps?: number;
  currentTime?: number;
  enabled?: boolean;
}): EarlyClosureState {
  const currentTime = params.currentTime ?? Math.floor(Date.now() / 1000);
  const resolutionTime = params.resolutionTime;
  const enabled = params.enabled ?? true;
  const baseLiquidationThresholdBps = params.baseThresholdBps ?? BASE_LIQ;
  const secondsRemaining = Math.floor(resolutionTime - currentTime);
  const active = enabled && secondsRemaining > 0 && secondsRemaining < WINDOW_S;
  const effective = effLiq({
    baseThresholdBps: baseLiquidationThresholdBps,
    resolutionTime,
    currentTime,
    earlyClosureEnabled: enabled,
  });
  const elapsedInWindow = Math.min(
    WINDOW_S,
    Math.max(0, WINDOW_S - secondsRemaining)
  );
  const progressPct = enabled
    ? Math.round((elapsedInWindow / WINDOW_S) * 100)
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
    windowSeconds: WINDOW_S,
    baseLiquidationThresholdBps,
    effectiveLiquidationThresholdBps: effective,
    progressPct,
    warningLevel,
  };
}
