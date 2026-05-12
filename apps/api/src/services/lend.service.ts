import { getAdminClient } from "../db/supabase.js";

export interface LendDepositResult {
  success: boolean;
  position_id?: string;
  cusdc_locked?: number;
  pool?: string;
  error?: string;
}

export async function processLendDeposit(params: {
  wallet_address: string;
  input_asset: string;
  amount_ui: number;
  pool: string;
}): Promise<LendDepositResult> {
  const { wallet_address, input_asset, amount_ui, pool } = params;
  const supabase = getAdminClient();

  const { data: userId } = await supabase.rpc("get_or_create_user", {
    p_wallet_address: wallet_address,
  });

  const { data: position, error } = await supabase
    .from("positions")
    .insert({
      position_type: "lending",
      user_id: userId,
      market_ticker: pool,
      side: "lend",
      entry_price: 1.0,
      quantity: amount_ui,
      usdc_cost: amount_ui,
      status: "open",
    })
    .select()
    .single();

  if (error) throw error;

  return {
    success: true,
    position_id: position.id,
    cusdc_locked: amount_ui,
    pool,
  };
}

export interface LendWithdrawResult {
  success: boolean;
  position_id?: string;
  cusdc_unlocked?: number;
  error?: string;
}

export async function processLendWithdrawal(params: {
  wallet_address: string;
  input_asset: string;
  amount_ui: number;
  pool: string;
}): Promise<LendWithdrawResult> {
  const { wallet_address, amount_ui } = params;
  const supabase = getAdminClient();

  const { data: userId } = await supabase.rpc("get_or_create_user", {
    p_wallet_address: wallet_address,
  });

  const { data: position, error } = await supabase
    .from("positions")
    .update({
      status: "closed",
      settled_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("position_type", "lending")
    .eq("status", "open")
    .select()
    .single();

  if (error || !position) {
    return { success: false, error: "No active lending position found" };
  }

  return {
    success: true,
    position_id: position.id,
    cusdc_unlocked: amount_ui,
  };
}
