import type { AnyQvacCommand } from "@cusp/shared";
import { USDC_MINT_MAINNET, USDT_MINT_MAINNET } from "@cusp/shared/constants";
import { getAdminClient } from "../db/supabase.js";

export interface AssetResolution {
  cUSDT_balance: number;
  USDT_backing: number;
  needs_unwrap: boolean;
  unwrap_amount: number;
  needs_borrow: boolean;
  borrow_amount: number;
}

export async function resolveAssetState(
  cmd: AnyQvacCommand
): Promise<AssetResolution> {
  const supabase = getAdminClient();

  const { data: userId } = await supabase.rpc("get_or_create_user", {
    p_wallet_address: cmd.user_wallet,
  });

  const { data: deposits } = await supabase
    .from("deposits")
    .select("cusdc_minted")
    .eq("user_id", userId)
    .eq("status", "confirmed");

  const { data: withdrawals } = await supabase
    .from("withdrawals")
    .select("cusdc_amount")
    .eq("user_id", userId)
    .in("status", ["completed", "processing"]);

  const totalMinted = (deposits || []).reduce((s: number, d: any) => s + (d.cusdc_minted || 0), 0);
  const totalWithdrawn = (withdrawals || []).reduce((s: number, w: any) => s + (w.cusdc_amount || 0), 0);
  const cusdtBalance = totalMinted - totalWithdrawn;

  const { data: state } = await supabase
    .from("protocol_state")
    .select("cusdc_exchange_rate, reserve_usdc")
    .eq("id", 1)
    .single();

  const exchangeRate = state?.cusdc_exchange_rate ?? 1.0;
  const usdtBacking = cusdtBalance * exchangeRate;

  const needsUnwrap = cmd.service === "direct_trade" || cmd.service === "leverage_trade";
  const needsBorrow = cmd.service === "borrow" && cmd.action === "open";

  const unwrapAmount = needsUnwrap
    ? cmd.service === "direct_trade"
      ? cmd.input_amount_ui
      : cmd.margin_amount_ui
    : 0;

  const borrowAmount = needsBorrow
    ? cmd.borrow_amount_ui
    : cmd.service === "leverage_trade" && cmd.action === "open"
      ? cmd.margin_amount_ui * (cmd.leverage - 1)
      : 0;

  return {
    cUSDT_balance: cusdtBalance,
    USDT_backing: usdtBacking,
    needs_unwrap: needsUnwrap,
    unwrap_amount: unwrapAmount,
    needs_borrow: needsBorrow || (cmd.service === "leverage_trade" && cmd.action === "open"),
    borrow_amount: borrowAmount,
  };
}
