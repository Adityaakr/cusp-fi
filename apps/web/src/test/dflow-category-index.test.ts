import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMarketCategoryIndex, fetchScopedMarkets, type DFlowMarket } from "@/lib/dflow-api";

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
    expect(calls).toContain("/api/v1/series?category=Sports&tags=Basketball");
    expect(calls).toContain(
      "/api/v1/events?limit=200&withNestedMarkets=true&seriesTickers=KXNBA&status=active"
    );
    expect(calls.some((call) => call.startsWith("/api/v1/markets"))).toBe(false);
    expect(calls.some((call) => call.includes("cursor="))).toBe(false);
  });
});
