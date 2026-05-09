import { getAdminClient } from "../db/supabase.js";
import { computeHealthFactor, BPS_DENOMINATOR, DEFAULT_BASE_LIQUIDATION_THRESHOLD_BPS } from "@cusp/shared/constants";

export interface BorrowOpenResult {
  success: boolean;
  position_id?: string;
  collateral_locked?: number;
  borrowed_amount?: number;
  health_factor?: number;
  liquidation_threshold?: string;
  error?: string;
}

export async function processBorrowOpen(params: {
  wallet_address: string;
  collateral_asset: string;
  borrow_asset: string;
  borrow_amount_ui: number;
  risk_mode: string;
  amount_ui: number;
}): Promise<BorrowOpenResult> {
  const { wallet_address, borrow_amount_ui, amount_ui, risk_mode } = params;
  const supabase = getAdminClient();

  const { data: userId } = await supabase.rpc("get_or_create_user", {
    p_wallet_address: wallet_address,
  });

  const effectiveThresholdBps = DEFAULT_BASE_LIQUIDATION_THRESHOLD_BPS;
  const healthFactor = computeHealthFactor({
    collateralValue: amount_ui,
    borrowedAmount: borrow_amount_ui,
    effectiveThresholdBps,
  });

  if (healthFactor < 1.0) {
    return {
      success: false,
      error: `Health factor ${healthFactor.toFixed(2)} below 1.0. Reduce borrow amount or increase collateral.`,
    };
  }

  const { data: position, error } = await supabase
    .from("positions")
    .insert({
      position_type: "borrow",
      user_id: userId,
      side: "borrow",
      entry_price: 1.0,
      quantity: borrow_amount_ui,
      usdc_cost: borrow_amount_ui,
      status: "open",
    })
    .select()
    .single();

  if (error) throw error;

  const ltvPct = ((borrow_amount_ui / amount_ui) * 100).toFixed(1);
  const liqThresholdPct = (effectiveThresholdBps / 100).toFixed(1);

  return {
    success: true,
    position_id: position.id,
    collateral_locked: amount_ui,
    borrowed_amount: borrow_amount_ui,
    health_factor: healthFactor,
    liquidation_threshold: `${liqThresholdPct}% (LTV ${ltvPct}%)`,
  };
}

export interface BorrowCloseResult {
  success: boolean;
  position_id?: string;
  repaid_amount?: number;
  error?: string;
}

export async function processBorrowClose(params: {
  wallet_address: string;
  repay_asset: string;
  repay_amount_ui: number;
}): Promise<BorrowCloseResult> {
  const { wallet_address, repay_amount_ui } = params;
  const supabase = getAdminClient();

  const { data: userId } = await supabase.rpc("get_or_create_user", {
    p_wallet_address: wallet_address,
  });

  const { data: position, error } = await supabase
    .from("positions")
    .update({
      status: "settled",
      settled_at: new Date().toISOString(),
      settlement_payout: repay_amount_ui,
    })
    .eq("user_id", userId)
    .eq("position_type", "borrow")
    .eq("status", "open")
    .select()
    .single();

  if (error || !position) {
    return { success: false, error: "No active borrow position found" };
  }

  return {
    success: true,
    position_id: position.id,
    repaid_amount: repay_amount_ui,
  };
}
