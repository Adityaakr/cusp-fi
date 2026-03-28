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
    const { position_id, tx_signature, output_mint, total_usdc } = await req.json();

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

    // Record trade execution
    await fetch(`${SUPABASE_URL}/rest/v1/trade_executions`, {
      method: "POST",
      headers: sbHeaders,
      body: JSON.stringify({
        position_id,
        direction: "open",
        input_mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        output_mint: output_mint || "",
        input_amount: total_usdc || 0,
        output_amount: 0,
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
