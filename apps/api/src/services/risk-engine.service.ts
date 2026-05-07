import { fetchMarket } from "./dflow-adapter.service.js";
import { getAdminClient } from "../db/supabase.js";
import { getVaultUsdcBalance } from "../solana/connection.js";
import { MIN_TRADE_USDC, MAX_PROTOCOL_LEVERAGE, computeHealthFactor, DEFAULT_BASE_LIQUIDATION_THRESHOLD_BPS } from "@cusp/shared/constants";

export interface RiskCheckResult {
  approved: boolean;
  errors: string[];
  market_status: string | null;
  effective_leverage: number;
}

const MAX_POS_RATIO = 0.08;
const MIN_TVL_DENOMINATOR_USDC = 500;
const MIN_RESERVE_RATIO = 0.2;
const HARD_EXPIRY_HOURS = 2;
const KALSHI_MAINTENANCE_DAY = 4;
const KALSHI_MAINTENANCE_START = 3;
const KALSHI_MAINTENANCE_END = 5;

function isKalshiMaintenance(): boolean {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return (
    et.getDay() === KALSHI_MAINTENANCE_DAY &&
    et.getHours() >= KALSHI_MAINTENANCE_START &&
    et.getHours() < KALSHI_MAINTENANCE_END
  );
}

export async function performRiskCheck(params: {
  market_ticker: string;
  margin_usdc?: number;
  leverage?: number;
}): Promise<RiskCheckResult> {
  const { market_ticker } = params;
  const errors: string[] = [];

  if (isKalshiMaintenance()) {
    errors.push("Trading paused during Kalshi maintenance (Thu 3-5 AM ET)");
  }

  if (params.margin_usdc !== undefined) {
    if (!Number.isFinite(params.margin_usdc) || params.margin_usdc < MIN_TRADE_USDC) {
      errors.push(`Minimum margin is ${MIN_TRADE_USDC} USDC`);
    }
    if (params.margin_usdc > 1_000_000) {
      errors.push("margin_usdc exceeds maximum allowed");
    }
  }

  const effLev = Math.min(
    Number.isFinite(Number(params.leverage)) && Number(params.leverage) >= 1
      ? Number(params.leverage)
      : 1,
    MAX_PROTOCOL_LEVERAGE
  );

  if (params.leverage !== undefined) {
    const levRaw = Number(params.leverage);
    if (!Number.isFinite(levRaw) || levRaw < 1) {
      errors.push("leverage must be a number >= 1");
    } else if (levRaw > MAX_PROTOCOL_LEVERAGE) {
      errors.push(`Maximum leverage is ${MAX_PROTOCOL_LEVERAGE}x`);
    }
  }

  let marketStatus: string | null = null;

  try {
    const market = await fetchMarket(market_ticker);
    marketStatus = market.status ?? "unknown";

    if (market.status !== "active") {
      errors.push(`Market is ${market.status}, not active`);
    }

    const expirationMs = (market.expirationTime ?? 0) * 1000;
    const hoursToExpiry = (expirationMs - Date.now()) / (1000 * 60 * 60);
    if (hoursToExpiry < HARD_EXPIRY_HOURS) {
      errors.push(`Market expires in ${hoursToExpiry.toFixed(1)}h, minimum ${HARD_EXPIRY_HOURS}h required`);
    }
  } catch {
    errors.push("Market data unavailable (DFlow API unreachable)");
  }

  if (params.margin_usdc !== undefined && Number.isFinite(params.margin_usdc)) {
    const margin = params.margin_usdc;
    const totalUsdc = margin * effLev;
    const borrowedUsdc = margin * (effLev - 1);

    let vaultBalance = await getVaultUsdcBalance();
    if (vaultBalance <= 0) {
      const supabase = getAdminClient();
      const { data: state } = await supabase
        .from("protocol_state")
        .select("reserve_usdc")
        .eq("id", 1)
        .single();
      vaultBalance = Number(state?.reserve_usdc) || 0;
    }

    if (vaultBalance <= 0) {
      errors.push("Vault balance unavailable — please try again shortly");
    } else {
      const maxNotional = Math.max(vaultBalance, MIN_TVL_DENOMINATOR_USDC) * MAX_POS_RATIO;
      if (totalUsdc > maxNotional) {
        errors.push(`Position size ($${totalUsdc.toFixed(2)}) exceeds protocol limit ($${maxNotional.toFixed(2)})`);
      }

      const ratioAfter = (vaultBalance - borrowedUsdc) / vaultBalance;
      if (ratioAfter < MIN_RESERVE_RATIO) {
        errors.push(`Insufficient pool liquidity (pool: $${vaultBalance.toFixed(2)}, need to borrow: $${borrowedUsdc.toFixed(2)})`);
      }
    }
  }

  return {
    approved: errors.length === 0,
    errors,
    market_status: marketStatus,
    effective_leverage: effLev,
  };
}
