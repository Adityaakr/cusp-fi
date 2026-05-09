import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildKalshiTagMarketCounts,
  fetchAllKalshiSearchSeries,
  kalshiSearchItemsToMarkets,
  type KalshiSearchSeriesItem,
} from "@/lib/kalshi-api";

vi.mock("@/lib/network-config", () => ({
  DFLOW_METADATA_API: "",
  DFLOW_TRADE_API: "",
  KALSHI_TRADE_API: "",
  USDC_MINT_ADDRESS: "USDC",
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Kalshi search series", () => {
  it("follows next_cursor pagination for v1/search/series", async () => {
    const seenUrls: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input), "http://localhost");
        seenUrls.push(`${url.pathname}${url.search}`);
        const cursor = url.searchParams.get("cursor");

        if (!cursor) {
          return Response.json({
            total_results_count: 2,
            current_page: [{ series_ticker: "KXBTC1" }],
            next_cursor: "CURSOR-2",
          });
        }

        return Response.json({
          total_results_count: 2,
          current_page: [{ series_ticker: "KXBTC2" }],
          next_cursor: null,
        });
      })
    );

    const items = await fetchAllKalshiSearchSeries({
      category: "Crypto",
      pageSize: 1,
    });

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.series_ticker)).toEqual(["KXBTC1", "KXBTC2"]);
    expect(seenUrls[0]).toContain("/v1/search/series?");
    expect(seenUrls[1]).toContain("cursor=CURSOR-2");
  });

  it("builds subcategory counts and scoped markets from search series items", () => {
    const items: KalshiSearchSeriesItem[] = [
      {
        type: "contract",
        series_ticker: "KXBTCD",
        series_title: "Bitcoin price Above/below",
        event_ticker: "KXBTCD-26MAY0717",
        event_title: "Bitcoin price today at 5pm EDT?",
        event_subtitle: "On May 7, 2026 at 5pm EDT",
        category: "Crypto",
        active_market_count: 2,
        product_metadata: {
          subcategories: {
            Crypto: ["Hourly", "BTC"],
          },
        },
        markets: [
          {
            ticker: "KXBTCD-1",
            yes_subtitle: "$81,500 or above",
            yes_bid_dollars: "0.44",
            yes_ask_dollars: "0.60",
            last_price_dollars: "0.50",
            close_ts: "2026-05-07T21:00:00Z",
            volume: 10,
          },
          {
            ticker: "KXBTCD-2",
            yes_subtitle: "$81,250 or above",
            yes_bid_dollars: "0.40",
            yes_ask_dollars: "0.55",
            last_price_dollars: "0.47",
            close_ts: "2026-05-07T21:00:00Z",
            volume: 12,
          },
        ],
      },
    ];

    expect(buildKalshiTagMarketCounts(items, "Crypto")).toEqual({
      BTC: 2,
      Hourly: 2,
    });

    const markets = kalshiSearchItemsToMarkets(items, { primaryTag: "BTC" });

    expect(markets).toHaveLength(2);
    expect(markets[0]).toMatchObject({
      ticker: "KXBTCD-1",
      category: "Crypto",
      subCategory: "BTC",
      sourceTag: "BTC",
      yesBestBid: 0.44,
      yesBestAsk: 0.6,
    });
  });
});
