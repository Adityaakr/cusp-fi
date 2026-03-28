import { serve } from "https://deno.land/std/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";

const LOSS_RESERVE_PCT = 0.10;
const PROTOCOL_FEE_PCT = 0.05;

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const supabase = getServiceClient();

    const { data: state } = await supabase
      .from("protocol_state")
      .select("*")
      .eq("id", 1)
      .single();

    if (!state) throw new Error("Protocol state not found");
    if (state.total_cusdc_supply <= 0) {
      return new Response(
        JSON.stringify({ message: "No cUSDC supply, skipping yield distribution" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const periodEnd = new Date();
    const periodStart = new Date(state.updated_at);

    const { data: fees } = await supabase
      .from("fees")
      .select("amount_usdc")
      .gte("created_at", periodStart.toISOString())
      .lte("created_at", periodEnd.toISOString());

    const grossRevenue = (fees ?? []).reduce(
      (sum, f) => sum + Number(f.amount_usdc),
      0
    );

    const { data: settledPositions } = await supabase
      .from("positions")
      .select("usdc_cost, settlement_payout")
      .eq("position_type", "vault")
      .eq("status", "settled")
      .gte("settled_at", periodStart.toISOString());

    const positionPnl = (settledPositions ?? []).reduce(
      (sum, p) => sum + (Number(p.settlement_payout ?? 0) - Number(p.usdc_cost)),
      0
    );

    const totalRevenue = grossRevenue + Math.max(positionPnl, 0);

    if (totalRevenue <= 0) {
      return new Response(
        JSON.stringify({
          message: "No revenue in period",
          gross_revenue: grossRevenue,
          position_pnl: positionPnl,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lossReserveContribution = totalRevenue * LOSS_RESERVE_PCT;
    const protocolFee = totalRevenue * PROTOCOL_FEE_PCT;
    const netLpYield = totalRevenue - lossReserveContribution - protocolFee;

    const oldRate = Number(state.cusdc_exchange_rate);
    const totalPool = Number(state.total_tvl);
    const newRate =
      totalPool > 0 ? oldRate * (1 + netLpYield / totalPool) : oldRate;

    await supabase.from("yield_distributions").insert({
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      gross_revenue: totalRevenue,
      loss_reserve_contribution: lossReserveContribution,
      protocol_fee: protocolFee,
      net_lp_yield: netLpYield,
      exchange_rate_before: oldRate,
      exchange_rate_after: newRate,
    });

    await supabase
      .from("protocol_state")
      .update({
        cusdc_exchange_rate: newRate,
        loss_reserve: Number(state.loss_reserve) + lossReserveContribution,
        protocol_treasury: Number(state.protocol_treasury) + protocolFee,
        total_tvl: totalPool + netLpYield,
        reserve_usdc: Number(state.reserve_usdc) + netLpYield,
        updated_at: periodEnd.toISOString(),
      })
      .eq("id", 1);

    return new Response(
      JSON.stringify({
        success: true,
        gross_revenue: totalRevenue,
        loss_reserve_contribution: lossReserveContribution,
        protocol_fee: protocolFee,
        net_lp_yield: netLpYield,
        exchange_rate_before: oldRate,
        exchange_rate_after: newRate,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Yield update error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
