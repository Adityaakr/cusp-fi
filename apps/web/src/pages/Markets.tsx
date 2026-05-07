import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import MarketsTable, { type MarketsSortKey } from "@/components/MarketsTable";
import { useDflowMarkets } from "@/hooks/useDflowMarkets";
import { type CuspMarket } from "@/lib/dflow-api";

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

function marketMatchesSearch(market: CuspMarket, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    market.name,
    market.subtitle,
    market.ticker,
    market.eventTicker,
    market.category,
    market.subCategory,
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(q));
}

const MarketsPage = () => {
  const navigate = useNavigate();
  const [category, setCategory] = useState("All");
  const [sortKey, setSortKey] = useState<MarketsSortKey>("volume24h");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebouncedValue(search, 350);
  const marketsQuery = useDflowMarkets({
    status: "active",
    limit: 200,
    refetchInterval: 30_000,
  });
  const isSearching = debouncedSearch.length >= 2;

  const allMarkets = useMemo(() => marketsQuery.data ?? [], [marketsQuery.data]);
  const categoryTabs = useMemo(() => {
    const categories = [...new Set(allMarkets.map((m) => m.category).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
    return ["All", ...categories];
  }, [allMarkets]);

  useEffect(() => {
    if (category !== "All" && categoryTabs.length > 0 && !categoryTabs.includes(category)) {
      setCategory("All");
    }
  }, [category, categoryTabs]);

  const markets = useMemo(() => {
    let list = category === "All" ? allMarkets : allMarkets.filter((m) => m.category === category);

    if (isSearching) {
      list = list.filter((m) => marketMatchesSearch(m, debouncedSearch));
    }

    return list;
  }, [allMarkets, category, isSearching, debouncedSearch]);

  const isLoading = marketsQuery.isLoading;
  const isError = marketsQuery.isError;
  const activeError = marketsQuery.error;

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
    setCategory(cat);
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

        <div className="hidden lg:flex gap-2 overflow-x-auto pb-3 mb-4">
          {categoryTabs.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => selectCategoryPill(cat)}
              className={`px-3 py-2 text-sm rounded-md whitespace-nowrap shrink-0 transition-colors border ${
                category === cat
                  ? "bg-bg-2 text-cusp-teal border-active"
                  : "text-muted-foreground hover:text-foreground bg-bg-1 border-border"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="min-w-0">{mainColumn}</div>
      </div>
    </Layout>
  );
};

export default MarketsPage;
