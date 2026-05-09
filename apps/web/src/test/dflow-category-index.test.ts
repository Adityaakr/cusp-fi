import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAllActiveMarketsViaEvents,
  fetchMarketCategoryIndex,
  fetchScopedMarkets,
  type DFlowMarket,
} from "@/lib/dflow-api";

vi.mock("@/lib/network-config", () => ({
  DFLOW_METADATA_API: "",
  DFLOW_TRADE_API: "",
  USDC_MINT_ADDRESS: "USDC",
}));

function market(overrides: Partial<DFlowMarket> & Pick<DFlowMarket, "ticker" | "eventTicker" | "title">): DFlowMarket {
  return {
    ticker: overrides.ticker,
    eventTicker: overrides.eventTicker,
    marketType: "binary",
    title: overrides.title,
    subtitle: overrides.subtitle ?? "",
    yesSubTitle: overrides.yesSubTitle ?? "YES",
    noSubTitle: overrides.noSubTitle ?? "NO",
    openTime: 1,
    closeTime: 2,
    expirationTime: 3,
    status: overrides.status ?? "active",
    volume: overrides.volume ?? 0,
    volume24h: overrides.volume24h ?? 0,
    openInterest: overrides.openInterest ?? 0,
    yesBid: overrides.yesBid ?? "0.49",
    yesAsk: overrides.yesAsk ?? "0.51",
    noBid: overrides.noBid ?? "0.49",
    noAsk: overrides.noAsk ?? "0.51",
    fractionalTradingEnabled: true,
    canCloseEarly: true,
    accounts: overrides.accounts ?? {},
  };
}

function mockDflowFetch(responses: {
  activeMarkets: DFlowMarket[];
  seriesByTag?: Record<string, string[]>;
  seriesByCategory?: Record<string, string[]>;
  marketsBySeries?: Record<string, DFlowMarket[]>;
}) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input), "http://localhost");
      calls.push(`${url.pathname}${url.search}`);

      if (url.pathname.endsWith("/api/v1/markets")) {
        return Response.json({ markets: responses.activeMarkets });
      }

      if (url.pathname.endsWith("/api/v1/series")) {
        const tag = url.searchParams.get("tags") ?? "";
        const category = url.searchParams.get("category") ?? "";
        const seriesTickers = tag
          ? (responses.seriesByTag?.[tag] ?? [])
          : (responses.seriesByCategory?.[category] ?? []);
        return Response.json({
          series: seriesTickers.map((ticker) => ({ ticker })),
        });
      }

      if (url.pathname.endsWith("/api/v1/events")) {
        const seriesTickers = (url.searchParams.get("seriesTickers") ?? "")
          .split(",")
          .filter(Boolean);
        return Response.json({
          events: seriesTickers.map((ticker) => ({
            ticker: `${ticker}-EVENT`,
            seriesTicker: ticker,
            title: ticker,
            subtitle: "",
            volume: 0,
            volume24h: 0,
            liquidity: 0,
            openInterest: 0,
            markets: responses.marketsBySeries?.[ticker] ?? [],
          })),
        });
      }

      return new Response("not found", { status: 404 });
    })
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchMarketCategoryIndex", () => {
  it("builds Sports child counts from DFlow tags and nested markets", async () => {
    const soccer = market({
      ticker: "KXSOC-REALMAN",
      eventTicker: "KXSOC-REALMAN",
      title: "Real Madrid vs Man City Winner",
    });
    const nba = market({
      ticker: "KXNBA-LALBOS",
      eventTicker: "KXNBA-LALBOS",
      title: "Lakers vs Celtics Winner",
    });

    mockDflowFetch({
      activeMarkets: [soccer, nba],
      seriesByTag: {
        KXSOC: ["KXSOC"],
        KXNBA: ["KXNBA"],
      },
      marketsBySeries: {
        KXSOC: [soccer],
        KXNBA: [nba],
      },
    });

    const index = await fetchMarketCategoryIndex({
      tagsByCategories: { sports: ["KXSOC", "KXNBA"] },
    });

    expect(index.countsByCategory.Sports).toBe(2);
    expect(index.countsBySubCategory.Sports.KXSOC).toBe(1);
    expect(index.countsBySubCategory.Sports.KXNBA).toBe(1);
    expect(index.marketsBySubCategory.Sports.KXSOC[0]).toMatchObject({
      ticker: "KXSOC-REALMAN",
      category: "Sports",
      subCategory: "KXSOC",
      sourceTag: "KXSOC",
    });
  });

  it("dedupes markets that appear in both all-markets and child segments", async () => {
    const soccer = market({
      ticker: "KXSOC-REALMAN",
      eventTicker: "KXSOC-REALMAN",
      title: "Real Madrid vs Man City Winner",
    });

    mockDflowFetch({
      activeMarkets: [soccer],
      seriesByTag: { KXSOC: ["KXSOC"] },
      marketsBySeries: { KXSOC: [soccer] },
    });

    const index = await fetchMarketCategoryIndex({
      tagsByCategories: { sports: ["KXSOC"] },
    });

    expect(index.markets).toHaveLength(1);
    expect(index.marketsByCategory.Sports).toHaveLength(1);
    expect(index.marketsBySubCategory.Sports.KXSOC).toHaveLength(1);
  });

  it("keeps heuristic fallback categories when DFlow tags are missing", async () => {
    const btc = market({
      ticker: "KXBTC-100K",
      eventTicker: "KXBTC-100K",
      title: "Bitcoin above $100K?",
    });

    mockDflowFetch({ activeMarkets: [btc] });

    const index = await fetchMarketCategoryIndex({ tagsByCategories: {} });

    expect(index.countsByCategory.Crypto).toBe(1);
    expect(index.marketsByCategory.Crypto[0].ticker).toBe("KXBTC-100K");
  });

  it("fetches scoped subcategory markets without paginating all markets", async () => {
    const nba = market({
      ticker: "KXNBA-LALBOS",
      eventTicker: "KXNBA-LALBOS",
      title: "Lakers vs Celtics Winner",
    });
    const calls = mockDflowFetch({
      activeMarkets: [],
      seriesByTag: { Basketball: ["KXNBA"] },
      marketsBySeries: { KXNBA: [nba] },
    });

    const markets = await fetchScopedMarkets({
      categoryLabel: "Sports",
      tag: "Basketball",
      limit: 200,
    });

    expect(markets).toHaveLength(1);
    expect(markets[0]).toMatchObject({
      ticker: "KXNBA-LALBOS",
      category: "Sports",
      subCategory: "Basketball",
      sourceTag: "Basketball",
    });
    expect(calls.some((c) => c.startsWith("/api/v1/series") && c.includes("category=Sports") && c.includes("tags=Basketball"))).toBe(
      true
    );
    expect(calls).toContain(
      "/api/v1/events?limit=200&withNestedMarkets=true&seriesTickers=KXNBA&status=active"
    );
    expect(calls.some((call) => call.startsWith("/api/v1/markets"))).toBe(false);
    expect(calls.some((call) => call.includes("cursor="))).toBe(false);
  });

  it("fetches all active markets from events instead of the markets endpoint", async () => {
    const soccer = market({
      ticker: "KXSOC-REALMAN",
      eventTicker: "KXSOC-REALMAN",
      title: "Real Madrid vs Man City Winner",
    });
    const baseball = market({
      ticker: "KXMLB-YANRED",
      eventTicker: "KXMLB-YANRED",
      title: "Yankees vs Red Sox Winner",
    });

    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input), "http://localhost");
        calls.push(`${url.pathname}${url.search}`);

        if (url.pathname.endsWith("/api/v1/events") && !url.searchParams.get("cursor")) {
          return Response.json({
            events: [
              {
                ticker: "EVT-1",
                seriesTicker: "KXSOC",
                title: "Soccer event",
                subtitle: "",
                volume: 0,
                volume24h: 0,
                liquidity: 0,
                openInterest: 0,
                markets: [soccer],
              },
            ],
            cursor: 1,
          });
        }

        if (url.pathname.endsWith("/api/v1/events") && url.searchParams.get("cursor") === "1") {
          return Response.json({
            events: [
              {
                ticker: "EVT-2",
                seriesTicker: "KXMLB",
                title: "Baseball event",
                subtitle: "",
                volume: 0,
                volume24h: 0,
                liquidity: 0,
                openInterest: 0,
                markets: [baseball],
              },
            ],
            cursor: null,
          });
        }

        return new Response("not found", { status: 404 });
      })
    );

    const markets = await fetchAllActiveMarketsViaEvents({ pageLimit: 1 });

    expect(markets).toHaveLength(2);
    expect(markets.map((m) => m.ticker)).toEqual(["KXSOC-REALMAN", "KXMLB-YANRED"]);
    expect(calls).toEqual([
      "/api/v1/events?limit=1&withNestedMarkets=true&status=active",
      "/api/v1/events?limit=1&cursor=1&withNestedMarkets=true&status=active",
    ]);
    expect(calls.some((call) => call.startsWith("/api/v1/markets"))).toBe(false);
  });

  it("single-page mode calls /events once and truncates by volume signal", async () => {
    const low = market({
      ticker: "LOW",
      eventTicker: "EVT1",
      title: "Low",
      volume24h: 10,
      volume: 10,
    });
    const mid = market({
      ticker: "MID",
      eventTicker: "EVT1",
      title: "Mid",
      volume24h: 50,
      volume: 50,
    });
    const high = market({
      ticker: "HIGH",
      eventTicker: "EVT1",
      title: "High",
      volume24h: 100,
      volume: 100,
    });

    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input), "http://localhost");
        calls.push(`${url.pathname}${url.search}`);

        if (url.pathname.endsWith("/api/v1/events")) {
          expect(url.searchParams.get("cursor")).toBeNull();
          return Response.json({
            events: [
              {
                ticker: "EVT1",
                seriesTicker: "KX",
                title: "One event",
                subtitle: "",
                volume: 0,
                volume24h: 0,
                liquidity: 0,
                openInterest: 0,
                markets: [low, mid, high],
              },
            ],
            cursor: 99,
          });
        }

        return new Response("not found", { status: 404 });
      })
    );

    const markets = await fetchAllActiveMarketsViaEvents({
      pageLimit: 50,
      maxPages: 1,
      maxMarkets: 2,
    });

    expect(markets.map((m) => m.ticker)).toEqual(["HIGH", "MID"]);
    expect(calls).toEqual(["/api/v1/events?limit=50&withNestedMarkets=true&status=active"]);
  });

  it("merges event-level competition when flattening nested markets", async () => {
    const m = market({
      ticker: "KX-ONE",
      eventTicker: "KX-E",
      title: "Outcome market",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input), "http://localhost");
        if (url.pathname.endsWith("/api/v1/events")) {
          return Response.json({
            events: [
              {
                ticker: "KX-E",
                seriesTicker: "KX",
                title: "Event",
                subtitle: "",
                volume: 0,
                volume24h: 0,
                liquidity: 0,
                openInterest: 0,
                competition: "NFL",
                markets: [m],
              },
            ],
          });
        }
        return new Response("not found", { status: 404 });
      })
    );

    const markets = await fetchAllActiveMarketsViaEvents({
      pageLimit: 10,
      maxPages: 1,
      maxMarkets: 10,
    });

    expect(markets).toHaveLength(1);
    expect(markets[0].competition).toBe("NFL");
  });
});
