/**
 * Cusp protocol limits shared by open-position, risk-check, and the app.
 * Keep in sync with src/lib/protocol-constants.ts (same numeric values).
 */

export const MIN_MARGIN_USDC = 1;
export const MAX_LEVERAGE = 3;
export const MAX_POSITION_TVL_RATIO = 0.08;

/**
 * When real TVL is tiny, 8% of TVL blocks normal retail sizes. Use this floor as the
 * denominator for the max-position check so small pools still allow small leveraged trades.
 */
export const MIN_TVL_DENOMINATOR_USDC = 500;

export function maxAllowedPositionUsdc(totalTvlRaw: unknown): number {
  const tvl = Number(totalTvlRaw);
  const denom = Math.max(Number.isFinite(tvl) ? tvl : 0, MIN_TVL_DENOMINATOR_USDC);
  return denom * MAX_POSITION_TVL_RATIO;
}

export type ParseMarginResult =
  | { ok: true; margin: number }
  | { ok: false; error: string };

/**
 * Validates user-supplied margin (USDC). Rejects missing, non-numeric, non-finite,
 * below minimum, or unreasonably large values (protects amountAtomic math).
 */
export function parseMarginUsdc(input: unknown): ParseMarginResult {
  if (input === null || input === undefined) {
    return { ok: false, error: "margin_usdc is required" };
  }
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) {
    return { ok: false, error: "margin_usdc must be a finite number" };
  }
  if (n < MIN_MARGIN_USDC) {
    return {
      ok: false,
      error: `Minimum margin is ${MIN_MARGIN_USDC} USDC`,
    };
  }
  if (n > 1_000_000) {
    return { ok: false, error: "margin_usdc exceeds maximum allowed" };
  }
  return { ok: true, margin: n };
}

/** Caps leverage to protocol max; non-finite or < 1 treated as 1. */
export function effectiveLeverage(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_LEVERAGE);
}
