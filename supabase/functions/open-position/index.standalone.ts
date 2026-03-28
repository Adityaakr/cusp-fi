/**
 * Standalone bundle for MCP deploy. Matches open-position + protocol + cors + minimal Solana/DFlow.
 */
import {
  Connection,
  Keypair,
  VersionedTransaction,
} from "https://esm.sh/@solana/web3.js@1";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      wallet_address,
      market_ticker,
      side,
      margin_usdc,
      leverage,
      output_mint,
    } = body;

    if (!wallet_address || !market_ticker || !side || !output_mint) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const marginParsed = parseMarginUsdc(margin_usdc);
    if (!marginParsed.ok) {
      return new Response(
        JSON.stringify({ error: marginParsed.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const margin = marginParsed.margin;
    const effectiveLev = effectiveLeverage(leverage);
    const borrowedUsdc = margin * (effectiveLev - 1);
    const totalUsdc = margin + borrowedUsdc;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RPC_URL = Deno.env.get("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";
    const VAULT_KEYPAIR_RAW = Deno.env.get("VAULT_KEYPAIR")!;
    const TRADE_API = Deno.env.get("DFLOW_TRADE_API") || "https://dev-quote-api.dflow.net";

    const sbHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: "return=representation",
    };

    const stateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/protocol_state?id=eq.1&select=*`,
      { headers: sbHeaders }
    );
    const states = await stateRes.json();
    const state = states?.[0];
    if (!state) throw new Error("Protocol state not found");

    const maxNotional = maxAllowedPositionUsdc(state.total_tvl);
    if (totalUsdc > maxNotional) {
      return new Response(
        JSON.stringify({
          error: `Position notional $${totalUsdc.toFixed(2)} exceeds protocol limit $${maxNotional.toFixed(2)} for the current pool`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (borrowedUsdc > Number(state.reserve_usdc) * 0.5) {
      return new Response(
        JSON.stringify({ error: "Insufficient pool liquidity for this leverage" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const vaultKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(VAULT_KEYPAIR_RAW))
    );

    const amountAtomic = Math.round(totalUsdc * 1e6);
    if (amountAtomic < 1) {
      return new Response(
        JSON.stringify({ error: "Order size too small after rounding" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const search = new URLSearchParams({
      userPublicKey: vaultKeypair.publicKey.toBase58(),
      inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      outputMint: output_mint,
      amount: String(amountAtomic),
      slippageBps: "auto",
      predictionMarketSlippageBps: "auto",
    });
    const apiKey = Deno.env.get("DFLOW_API_KEY");
    const dflowHeaders: Record<string, string> = {};
    if (apiKey) dflowHeaders["x-api-key"] = apiKey;

    const quoteRes = await fetch(`${TRADE_API}/order?${search}`, {
      headers: dflowHeaders,
    });
    if (!quoteRes.ok) {
      throw new Error(`DFlow order failed (${quoteRes.status}): ${await quoteRes.text()}`);
    }
    const quoteData = await quoteRes.json();
    const quoteTx =
      quoteData.transaction ?? quoteData.transactionBase64 ?? quoteData.transaction_base64;
    if (!quoteTx) throw new Error("No transaction in DFlow response");
    const outputAmount = quoteData.outputAmount ?? quoteData.outAmount ?? 0;

    const txBuf = Uint8Array.from(atob(quoteTx), (c) => c.charCodeAt(0));
    const transaction = VersionedTransaction.deserialize(txBuf);
    transaction.sign([vaultKeypair]);
    const signature = await connection.sendTransaction(transaction);

    const userIdRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_or_create_user`, {
      method: "POST",
      headers: sbHeaders,
      body: JSON.stringify({ p_wallet_address: wallet_address }),
    });
    const userId = await userIdRes.json();

    const entryPrice = totalUsdc / (outputAmount / 1e6 || totalUsdc);

    const posRes = await fetch(`${SUPABASE_URL}/rest/v1/positions`, {
      method: "POST",
      headers: sbHeaders,
      body: JSON.stringify({
        position_type: effectiveLev > 1 ? "leveraged" : "direct",
        user_id: userId,
        market_ticker,
        side,
        entry_price: entryPrice,
        quantity: outputAmount / 1e6,
        usdc_cost: totalUsdc,
        outcome_mint: output_mint,
        status: "open",
      }),
    });
    const position = (await posRes.json())?.[0];

    await fetch(`${SUPABASE_URL}/rest/v1/trade_executions`, {
      method: "POST",
      headers: sbHeaders,
      body: JSON.stringify({
        position_id: position.id,
        direction: "open",
        input_mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        output_mint,
        input_amount: totalUsdc,
        output_amount: outputAmount / 1e6,
        tx_signature: signature,
        status: "submitted",
      }),
    });

    if (effectiveLev > 1) {
      await fetch(`${SUPABASE_URL}/rest/v1/leveraged_trades`, {
        method: "POST",
        headers: sbHeaders,
        body: JSON.stringify({
          user_id: userId,
          position_id: position.id,
          margin_usdc: margin,
          borrowed_usdc: borrowedUsdc,
          leverage: effectiveLev,
          health_factor: 2.0,
          borrow_rate_bps: 500,
        }),
      });
    }

    await fetch(`${SUPABASE_URL}/rest/v1/protocol_state?id=eq.1`, {
      method: "PATCH",
      headers: sbHeaders,
      body: JSON.stringify({
        deployed_usdc: Number(state.deployed_usdc) + totalUsdc,
        reserve_usdc: Number(state.reserve_usdc) - borrowedUsdc,
        updated_at: new Date().toISOString(),
      }),
    });

    return new Response(
      JSON.stringify({
        success: true,
        position_id: position.id,
        tx_signature: signature,
        total_usdc: totalUsdc,
        leverage: effectiveLev,
        estimated_quantity: outputAmount / 1e6,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Open position error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
