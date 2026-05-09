/**
 * record-trade — Updates a pending position after the user's DFlow trade completes.
 * Called by the frontend after the user signs and sends the DFlow transaction.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { position_id, tx_signature, output_mint, total_usdc, output_amount, entry_price } = await req.json();

    if (!position_id || !tx_signature) {
      return new Response(
        JSON.stringify({ error: "position_id and tx_signature required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const sbHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: "return=representation",
    };

    const resolvedOutputAmount =
      typeof output_amount === "number" && Number.isFinite(output_amount) ? output_amount : 0;
    const resolvedTotalUsdc =
      typeof total_usdc === "number" && Number.isFinite(total_usdc) ? total_usdc : 0;
    const resolvedEntryPrice =
      typeof entry_price === "number" && Number.isFinite(entry_price)
        ? entry_price
        : resolvedOutputAmount > 0 && resolvedTotalUsdc > 0
          ? resolvedTotalUsdc / resolvedOutputAmount
          : 0;

    // Update the pending position with the real filled quantity and entry price.
    await fetch(`${SUPABASE_URL}/rest/v1/positions?id=eq.${position_id}`, {
      method: "PATCH",
      headers: sbHeaders,
      body: JSON.stringify({
        quantity: resolvedOutputAmount,
        entry_price: resolvedEntryPrice,
        outcome_mint: output_mint || null,
        status: "open",
      }),
    });

    // Record trade execution
    await fetch(`${SUPABASE_URL}/rest/v1/trade_executions`, {
      method: "POST",
      headers: sbHeaders,
      body: JSON.stringify({
        position_id,
        direction: "open",
        input_mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        output_mint: output_mint || "",
        input_amount: resolvedTotalUsdc,
        output_amount: resolvedOutputAmount,
        tx_signature,
        status: "submitted",
      }),
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Record trade error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
