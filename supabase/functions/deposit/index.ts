import { serve } from "https://deno.land/std/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import {
  getConnection,
  getVaultKeypair,
  getCusdcMint,
  confirmTransaction,
  verifyUsdcTransfer,
} from "../_shared/solana.ts";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "https://esm.sh/@solana/spl-token@0.4";
import {
  Transaction,
  sendAndConfirmTransaction,
} from "https://esm.sh/@solana/web3.js@1";

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const { wallet_address, tx_signature, amount_usdc } = await req.json();

    if (!wallet_address || !tx_signature || !amount_usdc) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getServiceClient();
    const connection = getConnection();
    const vaultKeypair = getVaultKeypair();
    const cusdcMint = getCusdcMint();

    const confirmed = await confirmTransaction(connection, tx_signature);
    if (!confirmed) {
      return new Response(
        JSON.stringify({ error: "Transaction not confirmed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vaultUsdcAta = await getAssociatedTokenAddress(
      new (await import("https://esm.sh/@solana/web3.js@1")).PublicKey(
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
      ),
      vaultKeypair.publicKey
    );

    const validTransfer = await verifyUsdcTransfer(
      connection,
      tx_signature,
      vaultKeypair.publicKey,
      amount_usdc
    );
    if (!validTransfer) {
      return new Response(
        JSON.stringify({ error: "USDC transfer verification failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: stateData } = await supabase
      .from("protocol_state")
      .select("cusdc_exchange_rate")
      .eq("id", 1)
      .single();

    const exchangeRate = stateData?.cusdc_exchange_rate ?? 1.0;
    const cusdcToMint = amount_usdc / exchangeRate;

    const userId = await supabase.rpc("get_or_create_user", {
      p_wallet_address: wallet_address,
    });

    const { data: deposit, error: depositError } = await supabase
      .from("deposits")
      .insert({
        user_id: userId.data,
        amount_usdc,
        cusdc_minted: cusdcToMint,
        exchange_rate: exchangeRate,
        tx_signature,
        status: "confirmed",
      })
      .select()
      .single();

    if (depositError) throw depositError;

    const userPubkey = new (
      await import("https://esm.sh/@solana/web3.js@1")
    ).PublicKey(wallet_address);
    const userCusdcAta = await getAssociatedTokenAddress(
      cusdcMint,
      userPubkey
    );

    const tx = new Transaction();

    const accountInfo = await connection.getAccountInfo(userCusdcAta);
    if (!accountInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          vaultKeypair.publicKey,
          userCusdcAta,
          userPubkey,
          cusdcMint
        )
      );
    }

    const cusdcAtomicAmount = Math.round(cusdcToMint * 1e6);
    tx.add(
      createMintToInstruction(
        cusdcMint,
        userCusdcAta,
        vaultKeypair.publicKey,
        cusdcAtomicAmount
      )
    );

    const mintSig = await sendAndConfirmTransaction(connection, tx, [
      vaultKeypair,
    ]);

    await supabase
      .from("deposits")
      .update({ mint_tx_signature: mintSig })
      .eq("id", deposit.id);

    await supabase.rpc("update_protocol_after_deposit", {
      p_amount_usdc: amount_usdc,
      p_cusdc_minted: cusdcToMint,
    });

    return new Response(
      JSON.stringify({
        success: true,
        deposit_id: deposit.id,
        cusdc_minted: cusdcToMint,
        exchange_rate: exchangeRate,
        mint_tx_signature: mintSig,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Deposit error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
