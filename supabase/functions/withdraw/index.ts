import { serve } from "https://deno.land/std/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import {
  getConnection,
  getVaultKeypair,
  getCusdcMint,
  USDC_MINT,
} from "../_shared/solana.ts";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createBurnInstruction,
  TOKEN_PROGRAM_ID,
} from "https://esm.sh/@solana/spl-token@0.4";
import {
  Transaction,
  PublicKey,
  sendAndConfirmTransaction,
} from "https://esm.sh/@solana/web3.js@1";

const MIN_RESERVE_RATIO = 0.2;

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const { wallet_address, cusdc_amount } = await req.json();

    if (!wallet_address || !cusdc_amount || cusdc_amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid withdrawal request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getServiceClient();
    const connection = getConnection();
    const vaultKeypair = getVaultKeypair();
    const cusdcMint = getCusdcMint();

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

    const userId = await supabase.rpc("get_or_create_user", {
      p_wallet_address: wallet_address,
    });

    const { data: withdrawal, error: wErr } = await supabase
      .from("withdrawals")
      .insert({
        user_id: userId.data,
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
      return new Response(
        JSON.stringify({
          success: true,
          withdrawal_id: withdrawal.id,
          type: "queued",
          usdc_amount: usdcAmount,
          message:
            "Withdrawal queued. Will be processed when reserve liquidity is available.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPubkey = new PublicKey(wallet_address);
    const vaultUsdcAta = await getAssociatedTokenAddress(
      USDC_MINT,
      vaultKeypair.publicKey
    );
    const userUsdcAta = await getAssociatedTokenAddress(USDC_MINT, userPubkey);

    const usdcAtomic = Math.round(usdcAmount * 1e6);
    const tx = new Transaction();
    tx.add(
      createTransferInstruction(
        vaultUsdcAta,
        userUsdcAta,
        vaultKeypair.publicKey,
        usdcAtomic,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const sig = await sendAndConfirmTransaction(connection, tx, [
      vaultKeypair,
    ]);

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

    return new Response(
      JSON.stringify({
        success: true,
        withdrawal_id: withdrawal.id,
        type: "instant",
        usdc_amount: usdcAmount,
        tx_signature: sig,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Withdraw error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
