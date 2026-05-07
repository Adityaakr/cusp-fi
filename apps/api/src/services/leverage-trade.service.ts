import { getAdminClient } from "../db/supabase.js";
import { getVaultUsdcBalance } from "../solana/connection.js";
import { lendUsdcToUser } from "../solana/token-ops.js";
import { fetchMarket } from "./dflow-adapter.service.js";
import { computeHealthFactor, DEFAULT_BASE_LIQUIDATION_THRESHOLD_BPS, MIN_TRADE_USDC, MAX_PROTOCOL_LEVERAGE } from "@cusp/shared/constants";

export interface LeverageTradeOpenResult {
  success: boolean;
  position_id?: string;
  total_usdc?: number;
  borrowed_usdc?: number;
  leverage?: number;
  lend_signature?: string;
  lend_warning?: string;
  health_factor?: number;
  error?: string;
}

const MAX_POS_RATIO = 0.08;
const MIN_TVL_DENOMINATOR_USDC = 500;

function maxAllowedPositionUsdc(tvl: number): number {
  const denom = Math.max(tvl, MIN_TVL_DENOMINATOR_USDC);
  return denom * MAX_POS_RATIO;
}

function parseMarginUsdc(input: unknown):
  | { ok: true; margin: number }
  | { ok: false; error: string } {
  if (input === null || input === undefined) return { ok: false, error: "margin_usdc is required" };
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return { ok: false, error: "margin_usdc must be a finite number" };
  if (n < MIN_TRADE_USDC) return { ok: false, error: `Minimum margin is ${MIN_TRADE_USDC} USDC` };
  if (n > 1_000_000) return { ok: false, error: "margin_usdc exceeds maximum allowed" };
  return { ok: true, margin: n };
}

function effectiveLeverage(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_PROTOCOL_LEVERAGE);
}

export async function processLeverageTradeOpen(params: {
  wallet_address: string;
  margin_amount_ui: number;
  leverage: number;
  market_query: string;
  side: "yes" | "no";
  max_slippage_bps: number;
}): Promise<LeverageTradeOpenResult> {
  const { wallet_address, market_query, side } = params;

  const marginParsed = parseMarginUsdc(params.margin_amount_ui);
  if (!marginParsed.ok) return { success: false, error: (marginParsed as { ok: false; error: string }).error };

  const margin = marginParsed.margin;
  const effectiveLev = effectiveLeverage(params.leverage);
  const borrowedUsdc = margin * (effectiveLev - 1);
  const totalUsdc = margin + borrowedUsdc;

  let market: any;
  try {
    market = await fetchMarket(market_query);
  } catch {
    return { success: false, error: `Market not found: ${market_query}` };
  }

  if (market.status !== "active") {
    return { success: false, error: `Market is ${market.status}, not active` };
  }

  const supabase = getAdminClient();

  let vaultReserve = await getVaultUsdcBalance();
  if (vaultReserve <= 0) {
    const { data: state } = await supabase
      .from("protocol_state")
      .select("reserve_usdc, total_tvl")
      .eq("id", 1)
      .single();
    vaultReserve = Number(state?.reserve_usdc) || 0;
  }

  const maxNotional = maxAllowedPositionUsdc(vaultReserve);
  if (totalUsdc > maxNotional) {
    return {
      success: false,
      error: `Position notional $${totalUsdc.toFixed(2)} exceeds protocol limit $${maxNotional.toFixed(2)}`,
    };
  }

  const availableForBorrow = vaultReserve * 0.8;
  if (borrowedUsdc > availableForBorrow) {
    return {
      success: false,
      error: `Insufficient pool liquidity (pool: $${vaultReserve.toFixed(2)}, max borrow: $${availableForBorrow.toFixed(2)}, requested: $${borrowedUsdc.toFixed(2)})`,
    };
  }

  const { data: userId } = await supabase.rpc("get_or_create_user", {
    p_wallet_address: wallet_address,
  });

  const ltAccounts: any[] = Object.values(market.accounts || {});
  const firstAccount = ltAccounts[0] || {};
  const outputMint = side === "yes" ? firstAccount.yesMint : firstAccount.noMint;

  const { data: position, error: posErr } = await supabase
    .from("positions")
    .insert({
      position_type: effectiveLev > 1 ? "leveraged" : "direct",
      user_id: userId,
      market_ticker: market_query,
      side,
      entry_price: 0,
      quantity: 0,
      usdc_cost: totalUsdc,
      outcome_mint: outputMint || null,
      status: "open",
    })
    .select()
    .single();

  if (posErr) throw posErr;

  if (effectiveLev > 1 && position) {
    const healthFactor = computeHealthFactor({
      collateralValue: margin,
      borrowedAmount: borrowedUsdc,
      effectiveThresholdBps: DEFAULT_BASE_LIQUIDATION_THRESHOLD_BPS,
    });

    await supabase.from("leveraged_trades").insert({
      user_id: userId,
      position_id: position.id,
      margin_usdc: margin,
      borrowed_usdc: borrowedUsdc,
      leverage: effectiveLev,
      health_factor: healthFactor,
      borrow_rate_bps: 500,
    });
  }

  let lendSignature = "";
  let lendWarning = "";

  if (borrowedUsdc > 0) {
    try {
      const result = await lendUsdcToUser(wallet_address, borrowedUsdc);
      lendSignature = result.signature;
      lendWarning = result.warning;
    } catch (txErr) {
      lendWarning = `Vault lending failed: ${txErr instanceof Error ? txErr.message : txErr}. Position recorded.`;
    }
  }

  const actualBorrowed = lendSignature ? borrowedUsdc : 0;
  if (actualBorrowed > 0) {
    const { data: currentState } = await supabase
      .from("protocol_state")
      .select("deployed_usdc, reserve_usdc, total_tvl")
      .eq("id", 1)
      .single();

    if (currentState) {
      const newReserve = Math.max(0, Number(currentState.reserve_usdc) - actualBorrowed);
      await supabase
        .from("protocol_state")
        .update({
          deployed_usdc: Number(currentState.deployed_usdc) + actualBorrowed,
          reserve_usdc: newReserve,
          total_tvl: newReserve + Number(currentState.deployed_usdc) + actualBorrowed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
    }
  }

  const healthFactor = computeHealthFactor({
    collateralValue: margin,
    borrowedAmount: borrowedUsdc,
    effectiveThresholdBps: DEFAULT_BASE_LIQUIDATION_THRESHOLD_BPS,
  });

  return {
    success: true,
    position_id: position?.id,
    total_usdc: totalUsdc,
    borrowed_usdc: borrowedUsdc,
    leverage: effectiveLev,
    lend_signature: lendSignature || undefined,
    lend_warning: lendWarning || undefined,
    health_factor: healthFactor,
  };
}

export interface LeverageTradeCloseResult {
  success: boolean;
  position_id?: string;
  usdc_returned?: number;
  pnl?: number;
  tx_signature?: string;
  error?: string;
}

export async function processLeverageTradeClose(params: {
  position_id: string;
  wallet_address: string;
}): Promise<LeverageTradeCloseResult> {
  const { position_id, wallet_address } = params;
  const supabase = getAdminClient();

  const { data: position } = await supabase
    .from("positions")
    .select("*, leveraged_trades(*)")
    .eq("id", position_id)
    .single();

  if (!position || position.status !== "open") {
    return { success: false, error: "Position not found or not open" };
  }

  await supabase
    .from("positions")
    .update({
      status: "settled",
      settled_at: new Date().toISOString(),
    })
    .eq("id", position_id);

  if (position.leveraged_trades?.length > 0) {
    const lt = position.leveraged_trades[0];
    await supabase
      .from("leveraged_trades")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
      })
      .eq("id", lt.id);

    if (lt.accrued_interest > 0) {
      await supabase.from("fees").insert({
        fee_type: "borrow",
        amount_usdc: lt.accrued_interest,
        source_id: lt.id,
        source_type: "leveraged_trade",
      });
    }
  }

  return {
    success: true,
    position_id,
  };
}
