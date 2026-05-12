import { getAdminClient } from "../db/supabase.js";
import { fetchMarket } from "./dflow-adapter.service.js";
import { computeHealthFactor } from "@cusp/shared/constants";

const LIQUIDATION_THRESHOLD = 1.05;
const HARD_EXPIRY_HOURS = 2;
const LIQUIDATION_PENALTY_PCT = 0.05;

export interface LiquidationResult {
  liquidated: number;
  results: Array<{ trade_id: string; reason: string }>;
}

export async function runLiquidationCheck(): Promise<LiquidationResult> {
  const supabase = getAdminClient();
  const { data: activeTrades } = await supabase
    .from("leveraged_trades")
    .select("*, positions(*)")
    .eq("status", "active");

  if (!activeTrades || activeTrades.length === 0) {
    return { liquidated: 0, results: [] };
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

      if (hoursToExpiry < HARD_EXPIRY_HOURS) {
        shouldLiquidate = true;
        reason = `Market expires in ${hoursToExpiry.toFixed(1)}h — auto-close triggered`;
      }
    } catch {
      // Skip market check if API fails
    }

    if (shouldLiquidate) {
      await supabase
        .from("leveraged_trades")
        .update({
          status: "liquidated",
          liquidation_execution_status: "pending",
          closed_at: new Date().toISOString(),
        })
        .eq("id", trade.id);

      const penalty = trade.borrowed_usdc * LIQUIDATION_PENALTY_PCT;
      await supabase.from("fees").insert({
        fee_type: "liquidation",
        amount_usdc: penalty,
        source_id: trade.id,
        source_type: "leveraged_trade",
      });

      liquidated++;
      results.push({ trade_id: trade.id, reason });
    }
  }

  return { liquidated, results };
}
