import { useQuery } from "@tanstack/react-query";
import {
  fetchMarkets,
  fetchMarket,
  fetchEvents,
  fetchTagsByCategories,
  fetchCandlesticks,
  fetchOrderbook,
  searchMarkets,
  dflowMarketToCusp,
  type CuspMarket,
} from "@/lib/dflow-api";

const QUERY_KEYS = {
  markets: ["dflow", "markets"] as const,
  searchMarkets: ["dflow", "searchMarkets"] as const,
  market: ["dflow", "market"] as const,
  events: ["dflow", "events"] as const,
  tags: ["dflow", "tags"] as const,
  candlesticks: ["dflow", "candlesticks"] as const,
  orderbook: ["dflow", "orderbook"] as const,
};

export function useDflowMarkets(params?: {
  status?: string;
  limit?: number;
  eventTicker?: string;
  refetchInterval?: number;
}) {
  return useQuery({
    queryKey: [...QUERY_KEYS.markets, params ?? {}],
    queryFn: async () => {
      const res = await fetchMarkets({
        status: params?.status ?? "active",
        limit: params?.limit ?? 50,
        eventTicker: params?.eventTicker,
      });
      return res.markets.map((m) => dflowMarketToCusp(m));
    },
    staleTime: 20_000,
    refetchInterval: params?.refetchInterval,
  });
}

export function useDflowSearchMarkets(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: [...QUERY_KEYS.searchMarkets, trimmed],
    queryFn: () => searchMarkets(trimmed, 100),
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
  });
}

export function useDflowEvents(limit = 20) {
  return useQuery({
    queryKey: [...QUERY_KEYS.events, limit],
    queryFn: async () => {
      const res = await fetchEvents({ limit });
      return res.events;
    },
    staleTime: 60_000,
  });
}

export function useDflowTags() {
  return useQuery({
    queryKey: QUERY_KEYS.tags,
    queryFn: () => fetchTagsByCategories(),
    staleTime: 5 * 60_000,
  });
}

export function useDflowMarket(ticker: string | undefined, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: [...QUERY_KEYS.market, ticker ?? ""],
    queryFn: async () => {
      if (!ticker) throw new Error("No ticker");
      const m = await fetchMarket(ticker);
      return dflowMarketToCusp(m);
    },
    enabled: !!ticker,
    staleTime: 15_000,
    refetchInterval: options?.refetchInterval,
  });
}

export type CandlestickTimeframe = "1D" | "1W" | "1M" | "3M" | "1Y";

const TIMEFRAME_CONFIG: Record<
  CandlestickTimeframe,
  { days: number; periodInterval: 1 | 60 | 1440 }
> = {
  "1D": { days: 1, periodInterval: 60 },
  "1W": { days: 7, periodInterval: 1440 },
  "1M": { days: 30, periodInterval: 1440 },
  "3M": { days: 90, periodInterval: 1440 },
  "1Y": { days: 365, periodInterval: 1440 },
};

export function useDflowCandlesticks(
  ticker: string | undefined,
  timeframe: CandlestickTimeframe = "1Y",
  options?: { refetchInterval?: number }
) {
  return useQuery({
    queryKey: [...QUERY_KEYS.candlesticks, ticker ?? "", timeframe],
    queryFn: async () => {
      if (!ticker) throw new Error("No ticker");
      const now = Math.floor(Date.now() / 1000);
      const { days, periodInterval } = TIMEFRAME_CONFIG[timeframe];
      const startTs = now - days * 24 * 60 * 60;
      return fetchCandlesticks(ticker, {
        startTs,
        endTs: now,
        periodInterval,
      });
    },
    enabled: !!ticker,
    staleTime: 30_000,
    refetchInterval: options?.refetchInterval,
  });
}

export function useDflowOrderbook(ticker: string | undefined, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: [...QUERY_KEYS.orderbook, ticker ?? ""],
    queryFn: async () => {
      if (!ticker) throw new Error("No ticker");
      return fetchOrderbook(ticker);
    },
    enabled: !!ticker,
    staleTime: 2_000,
    refetchInterval: options?.refetchInterval,
    refetchOnWindowFocus: true,
  });
}

export function useDflowMarketStats() {
  const marketsQuery = useDflowMarkets({ status: "active", limit: 500 });
  const eventsQuery = useDflowEvents(100);

  const stats = {
    activeMarketsCount: marketsQuery.data?.length ?? 0,
    totalVolume: marketsQuery.data?.reduce((sum, m) => sum + m.volume, 0) ?? 0,
    totalVolume24h: marketsQuery.data?.reduce((sum, m) => sum + (m.volume24h ?? 0), 0) ?? 0,
    eventsCount: eventsQuery.data?.length ?? 0,
  };

  return {
    ...marketsQuery,
    stats,
    events: eventsQuery.data,
  };
}
