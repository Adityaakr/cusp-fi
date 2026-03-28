import { serve } from "https://deno.land/std/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";

const METADATA_API =
  Deno.env.get("DFLOW_METADATA_API") ||
  "https://dev-prediction-markets-api.dflow.net";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const supabase = getServiceClient();

    const res = await fetch(
      `${METADATA_API}/api/v1/markets?status=active&limit=200`
    );
    if (!res.ok) throw new Error(`DFlow API error: ${res.status}`);
    const { markets } = await res.json();

    let synced = 0;
    for (const m of markets) {
      const accounts = m.accounts?.[USDC_MINT];
      const yesAsk = m.yesAsk ? parseFloat(m.yesAsk) : null;
      const noAsk = m.noAsk ? parseFloat(m.noAsk) : null;

      await supabase.from("markets_cache").upsert(
        {
          ticker: m.ticker,
          event_ticker: m.eventTicker,
          title: m.title,
          status: m.status,
          yes_mint: accounts?.yesMint ?? null,
          no_mint: accounts?.noMint ?? null,
          yes_price: yesAsk,
          no_price: noAsk,
          volume: m.volume ?? 0,
          expiration_time: m.expirationTime,
          data_json: m,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "ticker" }
      );
      synced++;
    }

    return new Response(
      JSON.stringify({ success: true, synced, total: markets.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Sync markets error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
