import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import MarketsTable, { type MarketsSortKey } from "@/components/MarketsTable";
import { useDflowMarkets, useDflowScopedMarkets, useDflowTags } from "@/hooks/useDflowMarkets";
import {
  getTagsListForCategoryLabel,
  toTitleCaseCategory,
  type CuspMarket,
} from "@/lib/dflow-api";

type GroupedMarketRow = CuspMarket & {
  outcomeMarkets?: CuspMarket[];
};

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function compareMarkets(a: CuspMarket, b: CuspMarket, key: MarketsSortKey, dir: "asc" | "desc"): number {
  const mult = dir === "desc" ? -1 : 1;
  switch (key) {
    case "title":
      return mult * a.name.localeCompare(b.name);
    case "probability":
      return mult * (a.probability - b.probability);
    case "yesBid":
      return mult * (a.yesBestBid - b.yesBestBid);
    case "yesAsk":
      return mult * (a.yesBestAsk - b.yesBestAsk);
    case "spread": {
      const sa = a.yesSpread;
      const sb = b.yesSpread;
      if (sa == null && sb == null) return 0;
      if (sa == null) return 1;
      if (sb == null) return -1;
      return mult * (sa - sb);
    }
    case "volume24h":
      return mult * ((a.volume24h ?? 0) - (b.volume24h ?? 0));
    case "openInterest":
      return mult * ((a.openInterest ?? 0) - (b.openInterest ?? 0));
    case "close":
      return mult * (new Date(a.resolutionDate).getTime() - new Date(b.resolutionDate).getTime());
    case "yield":
      return mult * (a.estimatedYield - b.estimatedYield);
    case "volume":
      return mult * (a.volume - b.volume);
    default:
      return 0;
  }
}

function marketMatchesSearch(market: GroupedMarketRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const baseFields = [
    market.name,
    market.subtitle,
    market.ticker,
    market.eventTicker,
    market.category,
    market.subCategory,
  ];
  const siblingFields =
    "outcomeMarkets" in market
      ? (market.outcomeMarkets ?? []).flatMap((m) => [
          m.name,
          m.subtitle,
          m.ticker,
          m.eventTicker,
          m.yesLabel,
          m.noLabel,
        ])
      : [];

  return [...baseFields, ...siblingFields]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(q));
}

function groupMarketsForListing(markets: CuspMarket[]): GroupedMarketRow[] {
  const groups = new Map<string, CuspMarket[]>();

  for (const market of markets) {
    const key = market.eventTicker?.trim() || market.ticker;
    const list = groups.get(key);
    if (list) {
      list.push(market);
    } else {
      groups.set(key, [market]);
    }
  }

  return Array.from(groups.values()).map((group) => {
    const uniqueByTicker = Array.from(
      new Map(group.map((market) => [market.ticker.toLowerCase(), market])).values()
    );
    const representative = [...uniqueByTicker].sort((a, b) => {
      const bScore = (b.volume24h ?? 0) || b.volume || 0;
      const aScore = (a.volume24h ?? 0) || a.volume || 0;
      return bScore - aScore;
    })[0];

    if (uniqueByTicker.length <= 1) {
      return { ...representative };
    }

    return {
      ...representative,
      subtitle: `${uniqueByTicker.length} options available`,
      outcomeMarkets: uniqueByTicker.sort((a, b) => {
        const bScore = (b.volume24h ?? 0) || b.volume || 0;
        const aScore = (a.volume24h ?? 0) || a.volume || 0;
        return bScore - aScore;
      }),
    };
  });
}

const MarketsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "All";
  const subCategory = searchParams.get("subCategory") || "All";
  const [sortKey, setSortKey] = useState<MarketsSortKey>("volume24h");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebouncedValue(search, 350);
  const tagsQuery = useDflowTags();
  const tagsByCategories = tagsQuery.data?.tagsByCategories ?? {};
  const hasApiCategories = Object.values(tagsByCategories).some((tags) => (tags?.length ?? 0) > 0);
  const marketsQuery = useDflowMarkets({
    status: "active",
    limit: 200,
    refetchInterval: 30_000,
  });
  const scopedMarketsQuery = useDflowScopedMarkets({
    categoryLabel: category === "All" ? undefined : category,
    tag: subCategory === "All" ? null : subCategory,
    limit: 200,
    enabled: hasApiCategories && category !== "All",
  });
  const isSearching = debouncedSearch.length >= 2;

  const allMarkets = useMemo(() => marketsQuery.data ?? [], [marketsQuery.data]);
  const categoryTabs = useMemo(() => {
    const apiCategories = Object.entries(tagsByCategories)
      .filter(([, tags]) => (tags?.length ?? 0) > 0)
      .map(([key]) => toTitleCaseCategory(key))
      .sort((a, b) => a.localeCompare(b));

    if (apiCategories.length > 0) {
      return ["All", ...apiCategories];
    }

    const categories = [...new Set(allMarkets.map((m) => m.category).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
    return ["All", ...categories];
  }, [allMarkets, tagsByCategories]);

  const subCategoryTabs = useMemo(() => {
    if (!hasApiCategories || category === "All") return [];
    return getTagsListForCategoryLabel(tagsQuery.data, category) ?? [];
  }, [category, hasApiCategories, tagsQuery.data]);

  useEffect(() => {
    if (category !== "All" && categoryTabs.length > 0 && !categoryTabs.includes(category)) {
      setSearchParams(prev => { prev.delete("category"); prev.delete("subCategory"); return prev; }, { replace: true });
    }
  }, [category, categoryTabs, setSearchParams]);

  useEffect(() => {
    if (subCategory !== "All" && !subCategoryTabs.includes(subCategory)) {
      setSearchParams(prev => { prev.delete("subCategory"); return prev; }, { replace: true });
    }
  }, [subCategory, subCategoryTabs, setSearchParams]);

  const markets = useMemo(() => {
    let list =
      category === "All"
        ? allMarkets
        : hasApiCategories
          ? scopedMarketsQuery.data ?? []
          : allMarkets.filter((m) => m.category === category);

    if (isSearching) {
      list = list.filter((m) => marketMatchesSearch(m, debouncedSearch));
    }

    return groupMarketsForListing(list);
  }, [allMarkets, category, hasApiCategories, scopedMarketsQuery.data, isSearching, debouncedSearch]);

  const isLoading =
    category === "All" || !hasApiCategories ? marketsQuery.isLoading : scopedMarketsQuery.isLoading;
  const isError =
    category === "All" || !hasApiCategories ? marketsQuery.isError : scopedMarketsQuery.isError;
  const activeError =
    category === "All" || !hasApiCategories ? marketsQuery.error : scopedMarketsQuery.error;

  const handleSort = useCallback((key: MarketsSortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir(key === "title" || key === "close" ? "asc" : "desc");
      return key;
    });
  }, []);

  const filtered = useMemo(() => {
    return [...markets].sort((a, b) => compareMarkets(a, b, sortKey, sortDir));
  }, [markets, sortKey, sortDir]);

  const selectCategoryPill = useCallback((cat: string) => {
    setSearchParams(prev => {
      if (cat === "All") prev.delete("category");
      else prev.set("category", cat);
      prev.delete("subCategory");
      return prev;
    });
  }, [setSearchParams]);

  const selectSubCategoryPill = useCallback((tag: string) => {
    setSearchParams(prev => {
      if (tag === "All") prev.delete("subCategory");
      else prev.set("subCategory", tag);
      return prev;
    });
  }, [setSearchParams]);

  const onOpenMarket = useCallback(
    (ticker: string) => {
      navigate(`/markets/${encodeURIComponent(ticker)}`);
    },
    [navigate]
  );

  const onOpenLeveraged = useCallback(
    (ticker: string, e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(`/markets/${encodeURIComponent(ticker)}?leverage=2`);
    },
    [navigate]
  );

  const mainColumn = (
    <>
      <div className="flex flex-col gap-3 mb-4">
        <input
          type="search"
          placeholder="Search events and markets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-bg-1 border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-active transition-colors font-medium"
          autoComplete="off"
        />
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 lg:hidden">
          {categoryTabs.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => selectCategoryPill(cat)}
              className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap shrink-0 transition-colors border ${
                category === cat
                  ? "bg-bg-2 text-cusp-teal border-active"
                  : "text-muted-foreground hover:text-foreground bg-bg-1 border-border"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        {category !== "All" && subCategoryTabs.length > 0 && (
          <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 lg:hidden">
            <button
              type="button"
              onClick={() => selectSubCategoryPill("All")}
              className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap shrink-0 transition-colors border ${
                subCategory === "All"
                  ? "bg-bg-2 text-cusp-teal border-active"
                  : "text-muted-foreground hover:text-foreground bg-bg-1 border-border"
              }`}
            >
              All
            </button>
            {subCategoryTabs.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => selectSubCategoryPill(tag)}
                className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap shrink-0 transition-colors border ${
                  subCategory === tag
                    ? "bg-bg-2 text-cusp-teal border-active"
                    : "text-muted-foreground hover:text-foreground bg-bg-1 border-border"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <MarketsTable
          markets={[]}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onOpenMarket={onOpenMarket}
          onOpenLeveraged={onOpenLeveraged}
          loading
        />
      )}

      {isError && !isLoading && (
        <div className="text-center py-16 rounded-lg border border-border bg-bg-1">
          <p className="text-sm text-cusp-red">
            {activeError instanceof Error ? activeError.message : "Failed to load markets. Please try again."}
          </p>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {filtered.length > 0 ? (
            <>
              <MarketsTable
                markets={filtered}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                onOpenMarket={onOpenMarket}
                onOpenLeveraged={onOpenLeveraged}
              />
            </>
          ) : (
            <div className="text-center py-14 border border-dashed border-border rounded-lg">
              <p className="text-sm text-muted-foreground">
                {isSearching
                  ? `No markets found for "${debouncedSearch}". Try a different search.`
                  : "No markets match this category."}
              </p>
            </div>
          )}
        </>
      )}
    </>
  );

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">Markets</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live DFlow markets — loading the first 200 active markets for now so the UI stays fast.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] xl:grid-cols-[240px_1fr] gap-6">
          <div className="hidden lg:block">
            <nav className="flex flex-col gap-1 pr-4 min-h-[500px]">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">Categories</h2>
              {tagsQuery.isLoading ? (
                <div className="space-y-3 mt-2 px-3">
                  <div className="h-6 bg-bg-2 rounded-md animate-pulse" />
                  <div className="h-6 bg-bg-2 rounded-md animate-pulse w-[80%]" />
                  <div className="h-6 bg-bg-2 rounded-md animate-pulse w-[90%]" />
                  <div className="h-6 bg-bg-2 rounded-md animate-pulse w-[70%]" />
                  <div className="h-6 bg-bg-2 rounded-md animate-pulse" />
                  <div className="h-6 bg-bg-2 rounded-md animate-pulse w-[85%]" />
                  <div className="h-6 bg-bg-2 rounded-md animate-pulse w-[60%]" />
                  <div className="h-6 bg-bg-2 rounded-md animate-pulse w-[75%]" />
                </div>
              ) : (
                categoryTabs.map((cat) => {
                  const isActiveCategory = cat === category;
                  const subs = isActiveCategory ? subCategoryTabs : [];
                  return (
                    <div key={cat} className="flex flex-col mb-1">
                    <button
                      type="button"
                      onClick={() => selectCategoryPill(cat)}
                      className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        isActiveCategory
                          ? "bg-bg-2 text-foreground font-medium"
                          : "text-muted-foreground hover:bg-bg-2/50 hover:text-foreground font-medium"
                      }`}
                    >
                      {cat}
                    </button>
                    {isActiveCategory && subs.length > 0 && (
                      <div className="flex flex-col pl-4 mt-1 space-y-0.5 border-l-2 border-border/50 ml-4">
                        <button
                          type="button"
                          onClick={() => selectSubCategoryPill("All")}
                          className={`text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
                            subCategory === "All"
                              ? "text-cusp-teal font-medium"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          All {cat}
                        </button>
                        {subs.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => selectSubCategoryPill(tag)}
                            className={`text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
                              subCategory === tag
                                ? "text-cusp-teal font-medium"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                    </div>
                  );
                })
              )}
            </nav>
          </div>
          <div className="min-w-0">{mainColumn}</div>
        </div>
      </div>
    </Layout>
  );
};

export default MarketsPage;
