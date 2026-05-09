import { describe, expect, it, vi } from "vitest";
import {
  applyKalshiTaxonomy,
  kalshiEventMarketToCusp,
  type KalshiEvent,
  type KalshiMarket,
} from "@/lib/kalshi-api";
import type { CuspMarket } from "@/lib/dflow-api";

vi.mock("@/lib/network-config", () => ({
  DFLOW_METADATA_API: "",
  DFLOW_TRADE_API: "",
  KALSHI_TRADE_API: "",
  USDC_MINT_ADDRESS: "USDC",
}));

function cuspMarket(overrides: Partial<CuspMarket>): CuspMarket {
  return {
    id: "KXTEST",
    ticker: "KXTEST",
    name: "Will Congress override the veto?",
    category: "Politics",
    yesPrice: 0.5,
    noPrice: 0.5,
    probability: 50,
    volume: 0,
    resolutionDate: new Date(0).toISOString(),
    status: "open",
    eventTicker: "KXVETOOVERRIDE",
    estimatedYield: 0,
    yesLabel: "YES",
    noLabel: "NO",
    yesBestBid: 0.49,
    yesBestAsk: 0.51,
    noBestAsk: 0.51,
    yesSpread: 0.02,
    ...overrides,
  };
}

function kalshiMarket(overrides: Partial<KalshiMarket>): KalshiMarket {
  return {
    ticker: "KXTEST",
    event_ticker: "KXTEST",
    market_type: "binary",
    status: "open",
    title: "Will Congress override the veto?",
    yes_bid_dollars: "0.49",
    yes_ask_dollars: "0.51",
    no_bid_dollars: "0.49",
    no_ask_dollars: "0.51",
    expiration_time: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("Kalshi taxonomy", () => {
  it("does not classify random 'whether' text as ETH", () => {
    const market = applyKalshiTaxonomy(
      cuspMarket({ name: "Whether Congress overrides the veto" }),
      { Crypto: ["Ethereum"] }
    );

    expect(market.category).toBe("Politics");
    expect(market.subCategory).toBeUndefined();
  });

  it("classifies exact ETH/KXETH ticker tokens as Ethereum", () => {
    const market = applyKalshiTaxonomy(
      cuspMarket({
        ticker: "KXETH-5000-DEC31",
        eventTicker: "KXETH-5000",
        name: "Will Ethereum be above $5,000?",
      }),
      { Crypto: ["Ethereum"] }
    );

    expect(market.category).toBe("Crypto");
    expect(market.subCategory).toBe("Ethereum");
  });

  it("keeps Kalshi event category authoritative for nested event markets", () => {
    const event: KalshiEvent = {
      event_ticker: "KXVETOOVERRIDE-29JAN20",
      series_ticker: "KXVETOOVERRIDE",
      title: "Whether Congress overrides the veto",
      category: "Politics",
      markets: [],
    };

    const market = kalshiEventMarketToCusp(
      event,
      kalshiMarket({
        ticker: "KXVETOOVERRIDE-29JAN20-26MAR",
        event_ticker: event.event_ticker,
        title: "Whether Congress overrides the veto by Mar 26?",
      }),
      { Crypto: ["Ethereum"], Politics: ["Congress"] }
    );

    expect(market.category).toBe("Politics");
    expect(market.subCategory).not.toBe("Ethereum");
  });
});
