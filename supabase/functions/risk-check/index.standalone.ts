/**
 * Standalone bundle for MCP / dashboard deploy (no ../_shared imports).
 * Logic must match index.ts + _shared/protocol + cors + supabase client + fetchMarket.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MIN_MARGIN_USDC = 1;
const MAX_LEVERAGE = 3;
const _MAX_POS_RATIO = 0.08;
const MIN_TVL_DENOMINATOR_USDC = 500;
const MIN_RESERVE_RATIO = 0.2;
const HARD_EXPIRY_HOURS = 2;
const KALSHI_MAINTENANCE_DAY = 4;
const KALSHI_MAINTENANCE_START = 3;
const KALSHI_MAINTENANCE_END = 5;

const METADATA_API =
  Deno.env.get("DFLOW_METADATA_API") ||
  "https://dev-prediction-markets-api.dflow.net";

function maxAllowedPositionUsdc(totalTvlRaw: unknown): number {
  const tvl = Number(totalTvlRaw);
  const denom = Math.max(Number.isFinite(tvl) ? tvl : 0, MIN_TVL_DENOMINATOR_USDC);
  return denom * _MAX_POS_RATIO;
}

function parseMarginUsdc(input: unknown):
  | { ok: true; margin: number }
  | { ok: false; error: string } {
  if (input === null || input === undefined) {
    return { ok: false, error: "margin_usdc is required" };
  }
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) {
    return { ok: false, error: "margin_usdc must be a finite number" };
  }
  if (n < MIN_MARGIN_USDC) {
    return { ok: false, error: `Minimum margin is ${MIN_MARGIN_USDC} USDC` };
  }
  if (n > 1_000_000) {
    return { ok: false, error: "margin_usdc exceeds maximum allowed" };
  }
  return { ok: true, margin: n };
}

function effectiveLeverage(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_LEVERAGE);
}

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

async function fetchMarket(ticker: string) {
  const res = await fetch(`${METADATA_API}/api/v1/market/${ticker}`);
  if (!res.ok) throw new Error(`Market fetch failed: ${res.status}`);
  return res.json();
}

function isKalshiMaintenance(): boolean {
  const now = new Date();
  const et = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  return (
    et.getDay() === KALSHI_MAINTENANCE_DAY &&
    et.getHours() >= KALSHI_MAINTENANCE_START &&
    et.getHours() < KALSHI_MAINTENANCE_END
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { market_ticker, margin_usdc, leverage } = await req.json();

    if (!market_ticker || typeof market_ticker !== "string") {
      return new Response(
        JSON.stringify({
          approved: false,
          errors: ["market_ticker is required"],
          market_status: null,
          effective_leverage: 1,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const errors: string[] = [];

    if (isKalshiMaintenance()) {
      errors.push("Trading paused during Kalshi maintenance (Thu 3-5 AM ET)");
    }

    const marginParsed = parseMarginUsdc(margin_usdc);
    if (!marginParsed.ok) errors.push(marginParsed.error);

    const levRaw = Number(leverage);
    if (!Number.isFinite(levRaw) || levRaw < 1) {
      errors.push("leverage must be a number >= 1");
    } else if (levRaw > MAX_LEVERAGE) {
      errors.push(`Maximum leverage is ${MAX_LEVERAGE}x`);
    }

    const effLev = effectiveLeverage(leverage);
    const market = await fetchMarket(market_ticker);

    if (market.status !== "active") {
      errors.push(`Market is ${market.status}, not active`);
    }

    const expirationMs = market.expirationTime * 1000;
    const hoursToExpiry = (expirationMs - Date.now()) / (1000 * 60 * 60);
    if (hoursToExpiry < HARD_EXPIRY_HOURS) {
      errors.push(
        `Market expires in ${hoursToExpiry.toFixed(1)}h, minimum ${HARD_EXPIRY_HOURS}h required`
      );
    }

    const supabase = getServiceClient();
    const { data: state } = await supabase
      .from("protocol_state")
      .select("*")
      .eq("id", 1)
      .single();

    if (state && marginParsed.ok) {
      const margin = marginParsed.margin;
      const totalUsdc = margin * effLev;
      const borrowedUsdc = margin * (effLev - 1);
      const maxNotional = maxAllowedPositionUsdc(state.total_tvl);
      if (totalUsdc > maxNotional) {
        errors.push(
          `Position size ($${totalUsdc.toFixed(2)}) exceeds protocol limit ($${maxNotional.toFixed(2)}) for the current pool`
        );
      }
      const reserveAfterBorrow = state.reserve_usdc - borrowedUsdc;
      const ratioAfter =
        state.total_tvl > 0 ? reserveAfterBorrow / state.total_tvl : 0;
      if (ratioAfter < MIN_RESERVE_RATIO) {
        errors.push("Insufficient pool liquidity");
      }
    }

    const approved = errors.length === 0;

    return new Response(
      JSON.stringify({
        approved,
        errors,
        market_status: market.status,
        effective_leverage: effLev,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Risk check error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
