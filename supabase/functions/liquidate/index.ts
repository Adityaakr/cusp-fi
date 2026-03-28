import { serve } from "https://deno.land/std/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { fetchMarket, USDC_MINT } from "../_shared/dflow.ts";

const LIQUIDATION_THRESHOLD = 1.05;
const HARD_EXPIRY_HOURS = 2;
const LIQUIDATION_PENALTY_PCT = 0.05;

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const supabase = getServiceClient();

    const { data: activeTrades } = await supabase
      .from("leveraged_trades")
      .select("*, positions(*)")
      .eq("status", "active");

    if (!activeTrades || activeTrades.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active leveraged trades", liquidated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let liquidated = 0;
    const results: Array<{ trade_id: string; reason: string }> = [];

    for (const trade of activeTrades) {
      const position = trade.positions;
      if (!position) continue;

      let shouldLiquidate = false;
      let reason = "";

      if (trade.health_factor < LIQUIDATION_THRESHOLD) {
        shouldLiquidate = true;
        reason = `Health factor ${trade.health_factor} below threshold ${LIQUIDATION_THRESHOLD}`;
      }

      try {
        const market = await fetchMarket(position.market_ticker);
        const expirationMs = market.expirationTime * 1000;
        const hoursToExpiry = (expirationMs - Date.now()) / (1000 * 60 * 60);

        if (hoursToExpiry < HARD_EXPIRY_HOURS && hoursToExpiry > 0) {
          shouldLiquidate = true;
          reason = `Hard expiry: ${hoursToExpiry.toFixed(1)}h remaining`;
        }

        if (market.status !== "active" && market.status !== "closed") {
          shouldLiquidate = true;
          reason = `Market status: ${market.status}`;
        }
      } catch {
        // If we can't fetch market data, skip
      }

      if (shouldLiquidate) {
        const penaltyAmount = trade.margin_usdc * LIQUIDATION_PENALTY_PCT;

        await supabase
          .from("leveraged_trades")
          .update({ status: "liquidated", closed_at: new Date().toISOString() })
          .eq("id", trade.id);

        await supabase
          .from("positions")
          .update({ status: "liquidated" })
          .eq("id", position.id);

        await supabase.from("fees").insert({
          fee_type: "liquidation",
          amount_usdc: penaltyAmount,
          source_id: trade.id,
          source_type: "leveraged_trade",
        });

        liquidated++;
        results.push({ trade_id: trade.id, reason });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: activeTrades.length,
        liquidated,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Liquidation error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
