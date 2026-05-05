import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import MarketsTable, { type MarketsSortKey } from "@/components/MarketsTable";
import MarketsCategorySidebar, {
  type MarketsSidebarChild,
  type MarketsSidebarItem,
  tagDisplayLabel,
} from "@/components/MarketsCategorySidebar";
import { MarketsCategorySidebarSkeleton } from "@/components/loading";
import {
  useDflowMarketsInfinite,
  useDflowSearchMarkets,
  useDflowTags,
  useDflowActiveMarketsTotal,
  useDflowCategoryMarketCounts,
} from "@/hooks/useDflowMarkets";
import {
  buildCategoryTabList,
  resolveMarketCategory,
  eventTickerMatchesTag,
  getTagsListForCategoryLabel,
  isTagsCategoryDisplayLabel,
  type CuspMarket,
  type DFlowTagsResponse,
} from "@/lib/dflow-api";

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

function buildSidebarItems(
  markets: CuspMarket[],
  categoryTabs: string[],
  tagsData: DFlowTagsResponse | undefined,
  options: {
    isSearching: boolean;
    totalActive: number | undefined;
    nestedByCategory:
      | Record<string, { totalActive: number; byTag: Record<string, number> }>
      | undefined;
  }
): MarketsSidebarItem[] {
  const { isSearching, totalActive, nestedByCategory } = options;
  const useDfAll = !isSearching && totalActive !== undefined;
  const useDfNested = !isSearching && nestedByCategory !== undefined;

  const rows: MarketsSidebarItem[] = [
    { label: "All", count: useDfAll ? totalActive : markets.length },
  ];
  for (const label of categoryTabs) {
    if (label === "All") continue;
    const tagList = getTagsListForCategoryLabel(tagsData, label);
    const apiBacked = isTagsCategoryDisplayLabel(label, tagsData);

    let count: number;
    if (useDfNested && apiBacked && nestedByCategory[label]) {
      count = nestedByCategory[label].totalActive;
    } else {
      count = markets.filter((m) => m.category === label).length;
    }

    let children: MarketsSidebarChild[] | undefined;
    if (tagList && tagList.length > 1) {
      children = tagList.map((tag) => ({
        tag,
        label: tagDisplayLabel(tag),
        count:
          useDfNested && apiBacked && nestedByCategory[label]
            ? (nestedByCategory[label].byTag[tag] ?? 0)
            : markets.filter(
                (m) => m.category === label && eventTickerMatchesTag(m.eventTicker, tag)
              ).length,
      }));
    }
    rows.push({ label, count, children });
  }
  return rows;
}

const MarketsPage = () => {
  const navigate = useNavigate();
  const [category, setCategory] = useState("All");
  const [subTag, setSubTag] = useState<string | null>(null);
  const [expandedLabels, setExpandedLabels] = useState<Set<string>>(() => new Set());
  const [sortKey, setSortKey] = useState<MarketsSortKey>("volume24h");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebouncedValue(search, 350);

  const tagsQuery = useDflowTags();
  const countsEnabled = debouncedSearch.length < 2;
  const tagsData = tagsQuery.data;
  const totalActiveQuery = useDflowActiveMarketsTotal({ enabled: countsEnabled });
  const nestedCountsQuery = useDflowCategoryMarketCounts(tagsData, { enabled: countsEnabled });

  const {
    markets: rawMarkets,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: listLoading,
    isError: listError,
    error: listErr,
  } = useDflowMarketsInfinite({
    status: "active",
    pageLimit: 200,
    refetchInterval: 30_000,
    enabled: debouncedSearch.length < 2,
  });

  const searchQuery = useDflowSearchMarkets(debouncedSearch);

  const isSearching = debouncedSearch.length >= 2;

  const categoryTabs = useMemo(() => buildCategoryTabList(tagsData), [tagsData]);

  const sourceMarkets = useMemo(
    () => (isSearching ? (searchQuery.data ?? []) : rawMarkets),
    [isSearching, searchQuery.data, rawMarkets]
  );

  const markets = useMemo(
    () =>
      sourceMarkets.map((m) => ({
        ...m,
        category: resolveMarketCategory(m.eventTicker, m.name, tagsData),
      })),
    [sourceMarkets, tagsData]
  );

  const sidebarItems = useMemo(
    () =>
      buildSidebarItems(markets, categoryTabs, tagsData, {
        isSearching,
        totalActive: totalActiveQuery.data,
        nestedByCategory: nestedCountsQuery.data,
      }),
    [
      markets,
      categoryTabs,
      tagsData,
      isSearching,
      totalActiveQuery.data,
      nestedCountsQuery.data,
    ]
  );

  const isLoading = isSearching ? searchQuery.isLoading : listLoading;
  const error = isSearching ? searchQuery.error : listErr;
  const isError = isSearching ? searchQuery.isError : listError;

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
    let list = markets;
    if (category !== "All") {
      list = list.filter((m) => m.category === category);
      if (subTag) {
        list = list.filter((m) => eventTickerMatchesTag(m.eventTicker, subTag));
      }
    }
    return [...list].sort((a, b) => compareMarkets(a, b, sortKey, sortDir));
  }, [markets, category, subTag, sortKey, sortDir]);

  const categoryCounts = useMemo(() => {
    if (isSearching) {
      const counts: Record<string, number> = { All: markets.length };
      markets.forEach((m) => {
        counts[m.category] = (counts[m.category] ?? 0) + 1;
      });
      return counts;
    }

    const counts: Record<string, number> = {};
    counts.All = totalActiveQuery.data ?? markets.length;

    for (const cat of categoryTabs) {
      if (cat === "All") continue;
      if (
        tagsData &&
        isTagsCategoryDisplayLabel(cat, tagsData) &&
        nestedCountsQuery.data?.[cat]
      ) {
        counts[cat] = nestedCountsQuery.data[cat].totalActive;
      } else {
        counts[cat] = markets.filter((m) => m.category === cat).length;
      }
    }
    return counts;
  }, [
    isSearching,
    markets,
    categoryTabs,
    tagsData,
    totalActiveQuery.data,
    nestedCountsQuery.data,
  ]);

  const selectCategoryPill = useCallback((cat: string) => {
    setCategory(cat);
    setSubTag(null);
  }, []);

  const onSelectAll = useCallback(() => {
    setCategory("All");
    setSubTag(null);
  }, []);

  const onSelectCategory = useCallback((label: string) => {
    setCategory(label);
    setSubTag(null);
  }, []);

  const onSelectChild = useCallback((parentLabel: string, tag: string) => {
    setCategory(parentLabel);
    setSubTag(tag);
    setExpandedLabels((prev) => new Set(prev).add(parentLabel));
  }, []);

  const onToggleExpand = useCallback((parentLabel: string) => {
    setExpandedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(parentLabel)) next.delete(parentLabel);
      else next.add(parentLabel);
      return next;
    });
  }, []);

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

  const showSidebarSkeleton =
    !isSearching && (tagsQuery.isPending || (listLoading && rawMarkets.length === 0));

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
              {categoryCounts[cat] != null && <span className="ml-1 opacity-60 tabular-nums">({categoryCounts[cat]})</span>}
            </button>
          ))}
        </div>
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
            {error instanceof Error ? error.message : "Failed to load markets. Please try again."}
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
                loadingMore={!isSearching && isFetchingNextPage}
              />

              {!isSearching && hasNextPage && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="rounded-md border border-border bg-bg-1 px-4 py-2 text-sm font-medium text-foreground hover:bg-bg-2 disabled:opacity-50 transition-colors"
                  >
                    {isFetchingNextPage ? "Loading…" : "Load more markets"}
                  </button>
                </div>
              )}
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
            Live Kalshi-linked markets on DFlow — trade or use leverage up to on-chain limits.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-6">
          <aside className="hidden lg:block w-[240px] shrink-0 lg:sticky lg:top-[4.5rem] self-start z-10">
            {showSidebarSkeleton ? (
              <MarketsCategorySidebarSkeleton rows={12} />
            ) : (
              <MarketsCategorySidebar
                items={sidebarItems}
                selectedCategory={category}
                selectedSubTag={subTag}
                expandedLabels={expandedLabels}
                onSelectAll={onSelectAll}
                onSelectCategory={onSelectCategory}
                onSelectChild={onSelectChild}
                onToggleExpand={onToggleExpand}
              />
            )}
          </aside>

          <div className="min-w-0 flex-1">{mainColumn}</div>
        </div>
      </div>
    </Layout>
  );
};

export default MarketsPage;
