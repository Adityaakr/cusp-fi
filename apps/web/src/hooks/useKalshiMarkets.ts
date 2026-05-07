import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  applyKalshiTaxonomy,
  buildKalshiTagMarketCounts,
  fetchAllKalshiSearchSeries,
  fetchKalshiMarkets,
  fetchKalshiMarket,
  fetchKalshiSportsFilters,
  fetchKalshiTagsByCategories,
  kalshiSearchItemsToMarkets,
  kalshiMarketToCusp,
  type KalshiSearchSeriesVariant,
} from "@/lib/kalshi-api";

const QUERY_KEYS = {
  markets: ["kalshi", "markets"] as const,
  market: ["kalshi", "market"] as const,
  tags: ["kalshi", "tagsByCategories"] as const,
  categorySeries: ["kalshi", "categorySeries"] as const,
  scopedSeries: ["kalshi", "scopedSeries"] as const,
  sportsFilters: ["kalshi", "sportsFilters"] as const,
};

const KALSHI_MARKETS_STALE_MS = 5 * 60_000;

export function useKalshiMarkets(params?: {
  status?: "unopened" | "open" | "paused" | "closed" | "settled";
  limit?: number;
  enabled?: boolean;
  variant?: KalshiSearchSeriesVariant;
}) {
  const status = params?.status ?? "open";
  const limit = Math.min(params?.limit ?? 1000, 1000);

  const tagsQuery = useKalshiTagsByCategories();

  const marketsQuery = useQuery({
    queryKey: [...QUERY_KEYS.markets, "markets", status, limit, tagsQuery.data] as const,
    queryFn: async () => {
      const res = await fetchKalshiMarkets({
        status: status === "paused" ? "open" : status,
        limit,
      });

      return res.markets
        .filter((market) => market.status !== "closed" && market.status !== "settled")
        .map((market) => applyKalshiTaxonomy(kalshiMarketToCusp(market), tagsQuery.data));
    },
    enabled: params?.enabled !== false,
    staleTime: KALSHI_MARKETS_STALE_MS,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const data = useMemo(
    () => marketsQuery.data,
    [marketsQuery.data]
  );

  return { ...marketsQuery, data };
}

export function useKalshiMarket(ticker: string | undefined) {
  const tagsQuery = useKalshiTagsByCategories();

  const marketQuery = useQuery({
    queryKey: [...QUERY_KEYS.market, ticker ?? ""] as const,
    queryFn: async () => {
      if (!ticker) throw new Error("No ticker");
      return kalshiMarketToCusp(await fetchKalshiMarket(ticker));
    },
    enabled: !!ticker,
    staleTime: KALSHI_MARKETS_STALE_MS,
    refetchOnWindowFocus: false,
  });

  const data = useMemo(
    () => marketQuery.data ? applyKalshiTaxonomy(marketQuery.data, tagsQuery.data) : undefined,
    [marketQuery.data, tagsQuery.data]
  );

  return { ...marketQuery, data };
}

export function useKalshiTagsByCategories() {
  return useQuery({
    queryKey: QUERY_KEYS.tags,
    queryFn: async () => {
      const res = await fetchKalshiTagsByCategories();
      return res.tags_by_categories;
    },
    staleTime: KALSHI_MARKETS_STALE_MS,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });
}

export function useKalshiSportsFilters() {
  return useQuery({
    queryKey: QUERY_KEYS.sportsFilters,
    queryFn: fetchKalshiSportsFilters,
    staleTime: KALSHI_MARKETS_STALE_MS,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });
}

export function useKalshiCategorySeries(
  category: string | undefined,
  enabled = true,
  variant: KalshiSearchSeriesVariant = "hydrated_open_unopened"
) {
  const normalizedCategory = category?.trim() ?? "";

  const query = useQuery({
    queryKey: [...QUERY_KEYS.categorySeries, normalizedCategory, variant] as const,
    queryFn: () =>
      fetchAllKalshiSearchSeries({
        category: normalizedCategory,
        status: variant === "trending_open" ? "open" : "open,unopened",
        pageSize: variant === "trending_open" ? 25 : 24,
        variant,
      }),
    enabled: enabled && normalizedCategory.length > 0,
    staleTime: KALSHI_MARKETS_STALE_MS,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const tagCounts = useMemo(
    () => (normalizedCategory ? buildKalshiTagMarketCounts(query.data ?? [], normalizedCategory) : {}),
    [query.data, normalizedCategory]
  );

  return {
    ...query,
    items: query.data ?? [],
    tagCounts,
  };
}

export function useKalshiScopedMarkets(params?: {
  category?: string;
  tag?: string | null;
  competition?: string | null;
  scope?: string | null;
  enabled?: boolean;
  variant?: KalshiSearchSeriesVariant;
}) {
  const category = params?.category?.trim() ?? "";
  const tag = params?.tag?.trim() ?? "";
  const competition = params?.competition?.trim() ?? "";
  const scope = params?.scope?.trim() ?? "";
  const variant = params?.variant ?? "hydrated_open_unopened";

  const query = useQuery({
    queryKey: [...QUERY_KEYS.scopedSeries, category, tag, competition, scope, variant] as const,
    queryFn: async () => {
      const items = await fetchAllKalshiSearchSeries({
        category,
        status: variant === "trending_open" ? "open" : "open,unopened",
        tag: tag || undefined,
        competition: competition || undefined,
        scope: scope || undefined,
        pageSize: variant === "trending_open" ? 25 : 24,
        variant,
      });
      return {
        items,
        markets: kalshiSearchItemsToMarkets(items, { primaryTag: tag || undefined }),
      };
    },
    enabled: params?.enabled !== false && category.length > 0 && tag.length > 0,
    staleTime: KALSHI_MARKETS_STALE_MS,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    items: query.data?.items ?? [],
    data: query.data?.markets ?? [],
  };
}
