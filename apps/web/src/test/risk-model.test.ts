import { describe, expect, it } from "vitest";
import {
  DEFAULT_BASE_LIQUIDATION_THRESHOLD_BPS,
  EARLY_CLOSURE_WINDOW_SECONDS,
  effectiveLiquidationThresholdBps,
  computeHealthFactor,
  getEarlyClosureState,
  getRiskTierForProbability,
} from "@/lib/risk-model";

describe("risk tier assignment", () => {
  it.each([
    [85, "moderate"],
    [85.01, "conservative"],
    [65, "moderate"],
    [64.99, "growth"],
    [50, "growth"],
    [49.99, "ineligible"],
  ] as const)("assigns %s%% to %s", (probability, tier) => {
    expect(getRiskTierForProbability(probability)).toBe(tier);
  });
});

describe("liquidation accounting math", () => {
  it("drops health factor below 1 when borrowed exceeds threshold-adjusted collateral", () => {
    expect(computeHealthFactor({
      collateralValue: 100,
      borrowedAmount: 80,
      effectiveThresholdBps: 7_700,
    })).toBeCloseTo(0.9625);
  });

  it("keeps health factor above 1 when collateral covers threshold-adjusted borrow", () => {
    expect(computeHealthFactor({
      collateralValue: 100,
      borrowedAmount: 70,
      effectiveThresholdBps: 7_700,
    })).toBeCloseTo(1.1);
  });
});

describe("linear early closure", () => {
  const now = 1_000_000;
  const base = DEFAULT_BASE_LIQUIDATION_THRESHOLD_BPS;

  it("keeps the base threshold outside the 7-day window", () => {
    expect(effectiveLiquidationThresholdBps({
      baseThresholdBps: base,
      resolutionTime: now + EARLY_CLOSURE_WINDOW_SECONDS + 60,
      currentTime: now,
    })).toBe(base);
  });

  it("keeps the base threshold exactly at T-7d", () => {
    expect(effectiveLiquidationThresholdBps({
      baseThresholdBps: base,
      resolutionTime: now + EARLY_CLOSURE_WINDOW_SECONDS,
      currentTime: now,
    })).toBe(base);
  });

  it("decays linearly halfway through the window", () => {
    expect(effectiveLiquidationThresholdBps({
      baseThresholdBps: base,
      resolutionTime: now + EARLY_CLOSURE_WINDOW_SECONDS / 2,
      currentTime: now,
    })).toBe(Math.floor(base / 2));
  });

  it("decays to one seventh at T-1d", () => {
    expect(effectiveLiquidationThresholdBps({
      baseThresholdBps: base,
      resolutionTime: now + 24 * 60 * 60,
      currentTime: now,
    })).toBe(Math.floor(base / 7));
  });

  it("is zero at and past resolution", () => {
    expect(effectiveLiquidationThresholdBps({ baseThresholdBps: base, resolutionTime: now, currentTime: now })).toBe(0);
    expect(effectiveLiquidationThresholdBps({ baseThresholdBps: base, resolutionTime: now - 1, currentTime: now })).toBe(0);
  });

  it("reports in-app warning levels", () => {
    expect(getEarlyClosureState({ resolutionTime: now + 7 * 24 * 60 * 60 - 1, currentTime: now }).warningLevel).toBe("t7");
    expect(getEarlyClosureState({ resolutionTime: now + 3 * 24 * 60 * 60, currentTime: now }).warningLevel).toBe("t3");
    expect(getEarlyClosureState({ resolutionTime: now + 24 * 60 * 60, currentTime: now }).warningLevel).toBe("t1");
    expect(getEarlyClosureState({ resolutionTime: now, currentTime: now }).warningLevel).toBe("resolved");
  });
});
