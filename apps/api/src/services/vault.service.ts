import { getAdminClient } from "../db/supabase.js";
import { getConnection, getVaultKeypair, getCusdcMint, confirmTransaction, verifyUsdcTransfer, USDC_MINT, getVaultUsdcBalance } from "../solana/connection.js";
import { mintCusdcToUser, transferUsdcFromVault } from "../solana/token-ops.js";
import { USDC_MINT_MAINNET } from "@cusp/shared/constants";

export interface DepositResult {
  success: boolean;
  deposit_id?: string;
  cusdc_minted?: number;
  exchange_rate?: number;
  mint_tx_signature?: string;
  error?: string;
}

export async function processDeposit(params: {
  wallet_address: string;
  tx_signature: string;
  amount_usdc: number;
}): Promise<DepositResult> {
  const { wallet_address, tx_signature, amount_usdc } = params;

  const connection = getConnection();
  const vaultKeypair = getVaultKeypair();

  const confirmed = await confirmTransaction(tx_signature);
  if (!confirmed) {
    return { success: false, error: "Transaction not confirmed" };
  }

  const validTransfer = await verifyUsdcTransfer(
    tx_signature,
    vaultKeypair.publicKey,
    amount_usdc
  );
  if (!validTransfer) {
    return { success: false, error: "USDC transfer verification failed" };
  }

  const supabase = getAdminClient();
  const { data: stateData } = await supabase
    .from("protocol_state")
    .select("cusdc_exchange_rate")
    .eq("id", 1)
    .single();

  const exchangeRate = stateData?.cusdc_exchange_rate ?? 1.0;
  const cusdcToMint = amount_usdc / exchangeRate;

  const { data: userId } = await supabase.rpc("get_or_create_user", {
    p_wallet_address: wallet_address,
  });

  const { data: deposit, error: depositError } = await supabase
    .from("deposits")
    .insert({
      user_id: userId,
      amount_usdc,
      cusdc_minted: cusdcToMint,
      exchange_rate: exchangeRate,
      tx_signature,
      status: "confirmed",
    })
    .select()
    .single();

  if (depositError) throw depositError;

  const mintSig = await mintCusdcToUser(wallet_address, cusdcToMint);

  await supabase
    .from("deposits")
    .update({ mint_tx_signature: mintSig })
    .eq("id", deposit.id);

  await supabase.rpc("update_protocol_after_deposit", {
    p_amount_usdc: amount_usdc,
    p_cusdc_minted: cusdcToMint,
  });

  return {
    success: true,
    deposit_id: deposit.id,
    cusdc_minted: cusdcToMint,
    exchange_rate: exchangeRate,
    mint_tx_signature: mintSig,
  };
}

export interface WithdrawResult {
  success: boolean;
  withdrawal_id?: string;
  type?: "instant" | "queued";
  usdc_amount?: number;
  tx_signature?: string;
  message?: string;
  error?: string;
}

const MIN_RESERVE_RATIO = 0.2;

export async function processWithdrawal(params: {
  wallet_address: string;
  cusdc_amount: number;
}): Promise<WithdrawResult> {
  const { wallet_address, cusdc_amount } = params;

  if (!wallet_address || !cusdc_amount || cusdc_amount <= 0) {
    return { success: false, error: "Invalid withdrawal request" };
  }

  const supabase = getAdminClient();
  const { data: state } = await supabase
    .from("protocol_state")
    .select("*")
    .eq("id", 1)
    .single();

  if (!state) throw new Error("Protocol state not found");

  const exchangeRate = state.cusdc_exchange_rate;
  const usdcAmount = cusdc_amount * exchangeRate;

  const reserveAfter = state.reserve_usdc - usdcAmount;
  const tvlAfter = state.total_tvl - usdcAmount;
  const reserveRatioAfter = tvlAfter > 0 ? reserveAfter / tvlAfter : 0;

  let withdrawalType: "instant" | "queued" = "instant";
  if (reserveAfter < 0 || reserveRatioAfter < MIN_RESERVE_RATIO) {
    withdrawalType = "queued";
  }

  const { data: userId } = await supabase.rpc("get_or_create_user", {
    p_wallet_address: wallet_address,
  });

  const { data: withdrawal, error: wErr } = await supabase
    .from("withdrawals")
    .insert({
      user_id: userId,
      cusdc_amount,
      usdc_amount: usdcAmount,
      exchange_rate: exchangeRate,
      withdrawal_type: withdrawalType,
      status: withdrawalType === "instant" ? "processing" : "pending",
    })
    .select()
    .single();

  if (wErr) throw wErr;

  if (withdrawalType === "queued") {
    return {
      success: true,
      withdrawal_id: withdrawal.id,
      type: "queued",
      usdc_amount: usdcAmount,
      message: "Withdrawal queued. Will be processed when reserve liquidity is available.",
    };
  }

  const sig = await transferUsdcFromVault(wallet_address, usdcAmount);

  await supabase
    .from("withdrawals")
    .update({
      status: "completed",
      tx_signature: sig,
      completed_at: new Date().toISOString(),
    })
    .eq("id", withdrawal.id);

  await supabase
    .from("protocol_state")
    .update({
      total_tvl: state.total_tvl - usdcAmount,
      reserve_usdc: state.reserve_usdc - usdcAmount,
      total_cusdc_supply: state.total_cusdc_supply - cusdc_amount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  return {
    success: true,
    withdrawal_id: withdrawal.id,
    type: "instant",
    usdc_amount: usdcAmount,
    tx_signature: sig,
  };
}
