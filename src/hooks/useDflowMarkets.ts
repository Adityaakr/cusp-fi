import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  fetchMarkets,
  fetchMarket,
  fetchEvents,
  fetchTagsByCategories,
  fetchCandlesticks,
  fetchOrderbook,
  searchMarkets,
  dflowMarketToCusp,
  fetchTotalActiveMarketsCount,
  fetchCategoryNestedMarketCounts,
  type DFlowTagsResponse,
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

const COUNTS_STALE_MS = 5 * 60_000;

/** Paginated total of active markets from DFlow (authoritative “All” count). */
export function useDflowActiveMarketsTotal(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...QUERY_KEYS.markets, "activeTotal"] as const,
    queryFn: () => fetchTotalActiveMarketsCount(),
    enabled: options?.enabled !== false,
    staleTime: COUNTS_STALE_MS,
  });
}

/**
 * Per-category and per-tag active market counts via series → events (nested markets).
 * Depends on tags from `useDflowTags`; expensive — long stale time.
 */
export function useDflowCategoryMarketCounts(
  tagsData: DFlowTagsResponse | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [...QUERY_KEYS.tags, "nestedCounts", tagsData] as const,
    queryFn: () => fetchCategoryNestedMarketCounts(tagsData!),
    enabled:
      options?.enabled !== false &&
      !!tagsData?.tagsByCategories &&
      Object.keys(tagsData.tagsByCategories).length > 0,
    staleTime: COUNTS_STALE_MS,
  });
}

export function useDflowMarkets(params?: {
  status?: string;
  limit?: number;
  eventTicker?: string;
  refetchInterval?: number | false;
  enabled?: boolean;
}) {
  const { enabled = true, ...queryParams } = params ?? {};
  return useQuery({
    queryKey: [...QUERY_KEYS.markets, queryParams],
    queryFn: async () => {
      const res = await fetchMarkets({
        status: queryParams.status ?? "active",
        limit: queryParams.limit ?? 200,
        eventTicker: queryParams.eventTicker,
      });
      return res.markets.map((m) => dflowMarketToCusp(m));
    },
    staleTime: 20_000,
    refetchInterval: queryParams.refetchInterval,
    enabled:
      enabled !== false &&
      (queryParams.eventTicker !== undefined
        ? Boolean(queryParams.eventTicker)
        : true),
  });
}

/** Paginated active markets via DFlow cursor (flattened `markets` + load-more helpers). */
export function useDflowMarketsInfinite(options?: {
  status?: string;
  pageLimit?: number;
  refetchInterval?: number | false;
  enabled?: boolean;
}) {
  const pageLimit = options?.pageLimit ?? 100;
  const status = options?.status ?? "active";
  const q = useInfiniteQuery({
    queryKey: [...QUERY_KEYS.markets, "infinite", status, pageLimit] as const,
    enabled: options?.enabled !== false,
    queryFn: async ({ pageParam }: { pageParam: number | undefined }) => {
      const res = await fetchMarkets({
        status,
        limit: pageLimit,
        cursor: pageParam,
      });
      return {
        markets: res.markets.map((m) => dflowMarketToCusp(m)),
        cursor: res.cursor,
      };
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => {
      if (last.markets.length === 0) return undefined;
      if (last.cursor === undefined || last.cursor === null) return undefined;
      return last.cursor as number;
    },
    staleTime: 20_000,
    refetchInterval: options?.refetchInterval,
  });

  const markets = useMemo(() => q.data?.pages.flatMap((p) => p.markets) ?? [], [q.data?.pages]);

  return {
    markets,
    fetchNextPage: q.fetchNextPage,
    hasNextPage: q.hasNextPage,
    isFetchingNextPage: q.isFetchingNextPage,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    isError: q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}

export function useDflowSearchMarkets(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: [...QUERY_KEYS.searchMarkets, trimmed],
    queryFn: () => searchMarkets(trimmed, 200),
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

export function useDflowMarket(ticker: string | undefined, options?: { refetchInterval?: number | false }) {
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
  options?: { refetchInterval?: number | false }
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

export function useDflowOrderbook(ticker: string | undefined, options?: { refetchInterval?: number | false }) {
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
  const marketsQuery = useDflowMarkets({ status: "active", limit: 200 });
  const eventsQuery = useDflowEvents(100);
  const totalQuery = useDflowActiveMarketsTotal({ enabled: true });

  const stats = {
    activeMarketsCount: totalQuery.data ?? marketsQuery.data?.length ?? 0,
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
