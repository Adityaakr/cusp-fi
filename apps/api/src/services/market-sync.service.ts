import { getAdminClient } from "../db/supabase.js";
import { fetchMarkets } from "./dflow-adapter.service.js";

export interface SyncResult {
  synced: number;
  errors: number;
}

export async function syncMarkets(): Promise<SyncResult> {
  const supabase = getAdminClient();
  let synced = 0;
  let errors = 0;

  let cursor: number | undefined;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await fetchMarkets({
        status: "active",
        limit: 100,
        cursor,
      });

      const markets = response.markets || [];
      if (markets.length === 0) {
        hasMore = false;
        break;
      }

      for (const market of markets) {
        try {
          await supabase.from("markets_cache").upsert({
            ticker: market.ticker,
            event_ticker: market.eventTicker,
            title: market.title,
            subtitle: market.subtitle,
            status: market.status,
            volume: market.volume,
            open_interest: market.openInterest,
            yes_bid: market.yesBid,
            yes_ask: market.yesAsk,
            no_bid: market.noBid,
            no_ask: market.noAsk,
            expiration_time: market.expirationTime,
            can_close_early: market.canCloseEarly,
            updated_at: new Date().toISOString(),
          }, { onConflict: "ticker" });
          synced++;
        } catch {
          errors++;
        }
      }

      cursor = response.cursor;
      hasMore = !!cursor && markets.length === 100;
    } catch {
      hasMore = false;
      errors++;
    }
  }

  return { synced, errors };
}
