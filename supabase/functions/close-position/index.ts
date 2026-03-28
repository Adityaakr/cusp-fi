import { serve } from "https://deno.land/std/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { getConnection, getVaultKeypair } from "../_shared/solana.ts";
import {
  fetchOrderQuote,
  fetchMarketByMint,
  USDC_MINT,
} from "../_shared/dflow.ts";
import { VersionedTransaction } from "https://esm.sh/@solana/web3.js@1";

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const { position_id, wallet_address } = await req.json();

    if (!position_id || !wallet_address) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getServiceClient();

    const { data: position } = await supabase
      .from("positions")
      .select("*, leveraged_trades(*)")
      .eq("id", position_id)
      .single();

    if (!position || position.status !== "open") {
      return new Response(
        JSON.stringify({ error: "Position not found or not open" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!position.outcome_mint) {
      return new Response(
        JSON.stringify({ error: "Position has no outcome mint" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const market = await fetchMarketByMint(position.outcome_mint);
    const isRedemption =
      (market.status === "determined" || market.status === "finalized") &&
      market.accounts?.[USDC_MINT]?.redemptionStatus === "open";

    const connection = getConnection();
    const vaultKeypair = getVaultKeypair();
    const amountAtomic = Math.round(position.quantity * 1e6);

    const quote = await fetchOrderQuote({
      userPublicKey: vaultKeypair.publicKey.toBase58(),
      inputMint: position.outcome_mint,
      outputMint: USDC_MINT,
      amount: amountAtomic,
      slippageBps: "auto",
    });

    const txBuffer = Uint8Array.from(atob(quote.transaction), (c) =>
      c.charCodeAt(0)
    );
    const transaction = VersionedTransaction.deserialize(txBuffer);
    transaction.sign([vaultKeypair]);
    const signature = await connection.sendTransaction(transaction);

    const usdcReturned = quote.outputAmount / 1e6;

    await supabase
      .from("positions")
      .update({
        status: "settled",
        settled_at: new Date().toISOString(),
        settlement_payout: usdcReturned,
      })
      .eq("id", position_id);

    await supabase.from("trade_executions").insert({
      position_id,
      direction: isRedemption ? "redeem" : "close",
      input_mint: position.outcome_mint,
      output_mint: USDC_MINT,
      input_amount: position.quantity,
      output_amount: usdcReturned,
      tx_signature: signature,
      status: "submitted",
    });

    const pnl = usdcReturned - position.usdc_cost;

    if (position.leveraged_trades?.length > 0) {
      const lt = position.leveraged_trades[0];
      const repayAmount = lt.borrowed_usdc + lt.accrued_interest;
      const traderReturn = usdcReturned - repayAmount;

      await supabase
        .from("leveraged_trades")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
        })
        .eq("id", lt.id);

      if (lt.accrued_interest > 0) {
        await supabase.from("fees").insert({
          fee_type: "borrow",
          amount_usdc: lt.accrued_interest,
          source_id: lt.id,
          source_type: "leveraged_trade",
        });
      }
    }

    if (pnl > 0) {
      const closeFee = pnl * 0.01;
      await supabase.from("fees").insert({
        fee_type: "close",
        amount_usdc: closeFee,
        source_id: position_id,
        source_type: "position",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        position_id,
        usdc_returned: usdcReturned,
        pnl,
        tx_signature: signature,
        type: isRedemption ? "redemption" : "close",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Close position error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
