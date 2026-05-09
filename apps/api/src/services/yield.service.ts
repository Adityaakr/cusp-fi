import { getAdminClient } from "../db/supabase.js";

export interface YieldUpdateResult {
  exchange_rate: number;
  yield_distributed: number;
}

export async function updateYield(): Promise<YieldUpdateResult> {
  const supabase = getAdminClient();

  const { data: state } = await supabase
    .from("protocol_state")
    .select("*")
    .eq("id", 1)
    .single();

  if (!state) throw new Error("Protocol state not found");

  const totalFees = await getTotalFeesSinceLastUpdate(supabase);
  const totalPnl = await getTotalPnlSinceLastUpdate(supabase);
  const netYield = totalFees + totalPnl;

  if (netYield <= 0) {
    return { exchange_rate: state.cusdc_exchange_rate, yield_distributed: 0 };
  }

  const performanceFeeBps = 500;
  const protocolFee = netYield * (performanceFeeBps / 10_000);
  const distributeToLps = netYield - protocolFee;

  const newExchangeRate =
    state.total_cusdc_supply > 0
      ? (state.total_tvl + distributeToLps) / state.total_cusdc_supply
      : state.cusdc_exchange_rate;

  await supabase
    .from("protocol_state")
    .update({
      cusdc_exchange_rate: newExchangeRate,
      total_yield_distributed: (state.total_yield_distributed || 0) + distributeToLps,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (protocolFee > 0) {
    await supabase.from("fees").insert({
      fee_type: "performance",
      amount_usdc: protocolFee,
      source_type: "yield_crank",
    });
  }

  return { exchange_rate: newExchangeRate, yield_distributed: distributeToLps };
}

async function getTotalFeesSinceLastUpdate(supabase: any): Promise<number> {
  const { data } = await supabase
    .from("fees")
    .select("amount_usdc")
    .eq("fee_type", "borrow");
  return (data || []).reduce((sum: number, f: any) => sum + (f.amount_usdc || 0), 0);
}

async function getTotalPnlSinceLastUpdate(supabase: any): Promise<number> {
  const { data } = await supabase
    .from("positions")
    .select("settlement_payout, usdc_cost")
    .eq("status", "settled");
  return (data || []).reduce((sum: number, p: any) => {
    const pnl = (p.settlement_payout || 0) - (p.usdc_cost || 0);
    return sum + Math.max(0, pnl);
  }, 0);
}
