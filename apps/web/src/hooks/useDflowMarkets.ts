import { useMemo } from "react";
import { keepPreviousData, useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import {
  fetchMarkets,
  fetchMarket,
  fetchEvent,
  fetchEvents,
  fetchTagsByCategories,
  fetchCandlesticks,
  fetchOrderbook,
  fetchScopedMarkets,
  fetchAllActiveMarketsViaEvents,
  searchMarkets,
  dflowMarketToCusp,
  fetchTotalActiveMarketsCount,
  fetchCategoryNestedMarketCounts,
  fetchMarketCategoryIndex,
  fetchLiveDataByEvent,
  type CuspMarket,
  type DFlowTagsResponse,
} from "@/lib/dflow-api";

const QUERY_KEYS = {
  markets: ["dflow", "markets"] as const,
  searchMarkets: ["dflow", "searchMarkets"] as const,
  market: ["dflow", "market"] as const,
  event: ["dflow", "event"] as const,
  events: ["dflow", "events"] as const,
  liveDataByEvent: ["dflow", "liveDataByEvent"] as const,
  tags: ["dflow", "tags"] as const,
  scopedMarkets: ["dflow", "scopedMarkets"] as const,
  candlesticks: ["dflow", "candlesticks"] as const,
  orderbook: ["dflow", "orderbook"] as const,
};

const COUNTS_STALE_MS = 5 * 60_000;
const MARKETS_STALE_MS = 5 * 60_000;

/** Paginated total of active markets from DFlow (authoritative “All” count). */
export function useDflowActiveMarketsTotal(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...QUERY_KEYS.markets, "activeTotal"] as const,
    queryFn: () => fetchTotalActiveMarketsCount(),
    enabled: options?.enabled !== false,
    staleTime: COUNTS_STALE_MS,
    refetchOnWindowFocus: false,
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
    refetchOnWindowFocus: false,
  });
}

export function useDflowMarketCategoryIndex(
  tagsData: DFlowTagsResponse | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [...QUERY_KEYS.tags, "marketCategoryIndex", tagsData] as const,
    queryFn: () => fetchMarketCategoryIndex(tagsData!),
    enabled:
      options?.enabled !== false &&
      !!tagsData?.tagsByCategories &&
      Object.keys(tagsData.tagsByCategories).length > 0,
    staleTime: COUNTS_STALE_MS,
    refetchOnWindowFocus: false,
  });
}

export function useDflowMarkets(params?: {
  status?: string;
  limit?: number;
  eventTicker?: string;
  refetchInterval?: number | false;
  enabled?: boolean;
  /** One GET /events page + optional maxMarkets cap (see `/markets` All tab). */
  activeMarketsSinglePage?: boolean;
}) {
  const { enabled = true, ...queryParams } = params ?? {};
  return useQuery({
    queryKey: [...QUERY_KEYS.markets, queryParams],
    queryFn: async () => {
      if ((queryParams.status ?? "active") !== "active" || queryParams.eventTicker) {
        const res = await fetchMarkets({
          status: queryParams.status ?? "active",
          limit: queryParams.limit ?? 200,
          eventTicker: queryParams.eventTicker,
        });
        return res.markets.map((m) => dflowMarketToCusp(m));
      }

      const pageLimit = queryParams.limit ?? 200;
      if (queryParams.activeMarketsSinglePage) {
        return fetchAllActiveMarketsViaEvents({
          pageLimit,
          maxPages: 1,
          maxMarkets: pageLimit,
        });
      }

      return fetchAllActiveMarketsViaEvents({
        pageLimit,
      });
    },
    staleTime: MARKETS_STALE_MS,
    refetchInterval: queryParams.refetchInterval,
    refetchOnWindowFocus: false,
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
    staleTime: MARKETS_STALE_MS,
    refetchInterval: options?.refetchInterval,
    refetchOnWindowFocus: false,
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

export function useDflowScopedMarkets(params?: {
  categoryLabel?: string;
  tag?: string | null;
  limit?: number;
  enabled?: boolean;
}) {
  const categoryLabel = params?.categoryLabel?.trim() ?? "";
  const tag = params?.tag?.trim() || null;
  const limit = params?.limit ?? 200;

  return useQuery({
    queryKey: [...QUERY_KEYS.scopedMarkets, categoryLabel, tag, limit] as const,
    queryFn: () => fetchScopedMarkets({ categoryLabel, tag, limit }),
    enabled: params?.enabled !== false && categoryLabel.length > 0,
    staleTime: MARKETS_STALE_MS,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });
}

export function useDflowSearchMarkets(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: [...QUERY_KEYS.searchMarkets, trimmed],
    queryFn: () => searchMarkets(trimmed, 200),
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
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
    refetchOnWindowFocus: false,
  });
}

export function useDflowTags() {
  return useQuery({
    queryKey: QUERY_KEYS.tags,
    queryFn: () => fetchTagsByCategories(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
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
    /** Avoid dropping event scope while the active outcome ticker changes (sibling markets). */
    placeholderData: keepPreviousData,
  });
}

/**
 * Parallel GET /market/:ticker for each ticker (e.g. all outcomes after GET /event with nested markets).
 * Shares query cache with `useDflowMarket`. Enable only once you have the ticker list (e.g. `eventQuery.isSuccess`).
 */
export function useDflowMarketPrefetchQueries(
  tickers: string[],
  options?: { enabled?: boolean; refetchInterval?: number | false }
) {
  const deduped = useMemo(
    () => Array.from(new Set(tickers.map((t) => t.trim()).filter((t) => t.length > 0))),
    [tickers.join("\0")]
  );

  const enabled = options?.enabled !== false && deduped.length > 0;

  const queries = useQueries({
    queries: deduped.map((ticker) => ({
      queryKey: [...QUERY_KEYS.market, ticker] as const,
      queryFn: async () => {
        const m = await fetchMarket(ticker);
        return dflowMarketToCusp(m);
      },
      enabled,
      staleTime: 15_000,
      refetchInterval: options?.refetchInterval ?? false,
      refetchOnWindowFocus: false,
    })),
  });

  const byTickerLower = useMemo(() => {
    const map = new Map<string, CuspMarket>();
    deduped.forEach((ticker, i) => {
      const data = queries[i]?.data;
      if (data) map.set(ticker.toLowerCase(), data);
    });
    return map;
  }, [deduped, queries]);

  return { byTickerLower, queries };
}

export function useDflowEvent(
  eventTicker: string | undefined,
  options?: { refetchInterval?: number | false; withNestedMarkets?: boolean }
) {
  return useQuery({
    queryKey: [...QUERY_KEYS.event, eventTicker ?? "", options?.withNestedMarkets ?? true],
    queryFn: async () => {
      if (!eventTicker) throw new Error("No event ticker");
      return fetchEvent(eventTicker, {
        withNestedMarkets: options?.withNestedMarkets ?? true,
      });
    },
    enabled: !!eventTicker,
    staleTime: 15_000,
    refetchInterval: options?.refetchInterval,
  });
}

export function useDflowLiveDataByEvent(
  eventTicker: string | undefined,
  options?: { enabled?: boolean; refetchInterval?: number | false }
) {
  return useQuery({
    queryKey: [...QUERY_KEYS.liveDataByEvent, eventTicker ?? ""] as const,
    queryFn: async () => {
      if (!eventTicker) throw new Error("No event ticker");
      return fetchLiveDataByEvent(eventTicker);
    },
    enabled: options?.enabled !== false && !!eventTicker,
    staleTime: 15_000,
    refetchInterval: options?.refetchInterval,
    refetchOnWindowFocus: false,
    retry: false,
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
  options?: { refetchInterval?: number | false; enabled?: boolean }
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
    enabled: options?.enabled !== false && !!ticker,
    staleTime: 30_000,
    refetchInterval: options?.refetchInterval,
  });
}

export function useDflowOrderbook(ticker: string | undefined, options?: { refetchInterval?: number | false; enabled?: boolean }) {
  return useQuery({
    queryKey: [...QUERY_KEYS.orderbook, ticker ?? ""],
    queryFn: async () => {
      if (!ticker) throw new Error("No ticker");
      return fetchOrderbook(ticker);
    },
    enabled: options?.enabled !== false && !!ticker,
    staleTime: 2_000,
    retry: false,
    refetchInterval: (query) => (query.state.error ? false : options?.refetchInterval ?? false),
    refetchOnWindowFocus: false,
  });
}

export function useDflowMarketStats() {
  const marketsQuery = useDflowMarkets({ status: "active", limit: 200 });
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
