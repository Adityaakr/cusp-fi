import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ChevronDown, Search } from "lucide-react";
import Layout from "@/components/Layout";
import { useDflowMarkets, useDflowScopedMarkets, useDflowTags } from "@/hooks/useDflowMarkets";
import {
  getTagsListForCategoryLabel,
  toTitleCaseCategory,
  type CuspMarket,
} from "@/lib/dflow-api";
import { cn } from "@/lib/utils";

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
    case "volume24h":
      return mult * ((a.volume24h ?? 0) - (b.volume24h ?? 0));
    case "openInterest":
      return mult * ((a.openInterest ?? 0) - (b.openInterest ?? 0));
    case "close":
      return mult * (new Date(a.resolutionDate).getTime() - new Date(b.resolutionDate).getTime());
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
    if (list) list.push(market);
    else groups.set(key, [market]);
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

    if (uniqueByTicker.length <= 1) return { ...representative };

    return {
      ...representative,
      subtitle: `${uniqueByTicker.length} markets`,
      outcomeMarkets: uniqueByTicker.sort((a, b) => {
        const bScore = (b.volume24h ?? 0) || b.volume || 0;
        const aScore = (a.volume24h ?? 0) || a.volume || 0;
        return bScore - aScore;
      }),
    };
  });
}

type MarketsSortKey = "title" | "probability" | "volume24h" | "openInterest" | "close";

const SORT_OPTIONS: Array<{ key: MarketsSortKey; label: string; dir: "asc" | "desc" }> = [
  { key: "volume24h", label: "Trending", dir: "desc" },
  { key: "probability", label: "Probability", dir: "desc" },
  { key: "close", label: "Closing Soon", dir: "asc" },
  { key: "openInterest", label: "Open Interest", dir: "desc" },
  { key: "title", label: "Alphabetical", dir: "asc" },
];

function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function formatMultiple(probability: number): string {
  if (!Number.isFinite(probability) || probability <= 0) return "--";
  const p = probability / 100;
  return `${(1 / p).toFixed(p >= 0.9 ? 2 : p >= 0.5 ? 2 : 1)}x`;
}

function formatResolutionLabel(dateIso: string): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "TBD";
  return `Before ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function initialsFromText(text: string): string {
  const cleaned = text.replace(/[^A-Za-z0-9 ]/g, " ").trim();
  if (!cleaned) return "MK";
  const words = cleaned.split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() ?? "").join("") || cleaned.slice(0, 2).toUpperCase();
}

function imageFallbackClass(category: string): string {
  const key = category.toLowerCase();
  if (key.includes("polit")) return "from-sky-600 to-slate-700";
  if (key.includes("climate") || key.includes("weather")) return "from-emerald-500 to-cyan-600";
  if (key.includes("crypto")) return "from-amber-500 to-orange-600";
  if (key.includes("sport")) return "from-rose-500 to-orange-500";
  if (key.includes("econom")) return "from-violet-500 to-indigo-600";
  return "from-slate-500 to-slate-700";
}

function MarketAvatar({ market }: { market: GroupedMarketRow }) {
  const label = market.competition || market.subCategory || market.category || market.name;
  if (market.imageUrl) {
    return (
      <img
        src={market.imageUrl}
        alt={label}
        className="h-11 w-11 rounded-xl object-cover ring-1 ring-black/5"
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-sm ring-1 ring-black/5",
        imageFallbackClass(market.category)
      )}
    >
      {initialsFromText(label)}
    </div>
  );
}

function OutcomeRow({ market, accent = "green" }: { market: CuspMarket; accent?: "green" | "blue" | "red" }) {
  const accentClasses = {
    green: "bg-emerald-400",
    blue: "bg-blue-500",
    red: "bg-red-500",
  } as const;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_72px_86px] items-center gap-4">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{market.yesLabel || market.name}</div>
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-bg-3">
          <div
            className={cn("h-full rounded-full", accentClasses[accent])}
            style={{ width: `${Math.max(4, Math.min(100, market.probability))}%` }}
          />
        </div>
      </div>
      <div className="text-right text-sm font-semibold tabular-nums text-muted-foreground">
        {formatMultiple(market.probability)}
      </div>
      <div className="justify-self-end rounded-full border border-active bg-bg-0 px-3 py-1.5 text-base font-bold tabular-nums text-foreground sm:px-4 sm:py-2 sm:text-lg">
        {market.probability}%
      </div>
    </div>
  );
}

function MarketEventCard({ market, onOpenMarket }: { market: GroupedMarketRow; onOpenMarket: (ticker: string) => void }) {
  const outcomes = (market.outcomeMarkets?.length ? market.outcomeMarkets : [market]).slice(0, 2);
  const metadataLabel = market.competition || market.subCategory || market.category;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpenMarket(market.ticker)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpenMarket(market.ticker)}
      className="group rounded-[28px] border border-border bg-bg-1 p-6 transition duration-200 hover:-translate-y-0.5 hover:border-active hover:bg-bg-2/80"
    >
      <div className="mb-5 flex items-center gap-3">
        <MarketAvatar market={market} />
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {metadataLabel}
          </div>
          {market.subtitle && (
            <div className="truncate text-xs text-muted-foreground/70">{market.subtitle}</div>
          )}
        </div>
      </div>

      <h3 className="mb-7 text-base font-semibold leading-snug text-foreground sm:text-lg">
        {market.name}
      </h3>

      <div className="space-y-5">
        {outcomes.map((outcome, index) => (
          <OutcomeRow
            key={outcome.ticker}
            market={outcome}
            accent={index === 0 ? "green" : outcomes.length === 2 ? "blue" : "green"}
          />
        ))}
      </div>

      <div className="mt-8 flex items-end justify-between gap-4 text-muted-foreground">
        <div>
          <div className="text-sm font-medium">{formatUsd(market.volume24h ?? market.volume)} vol</div>
          <div className="mt-1 text-xs text-muted-foreground/70">{formatResolutionLabel(market.resolutionDate)}</div>
        </div>
        <div className="text-right text-sm font-medium text-muted-foreground">
          {(market.outcomeMarkets?.length ?? 1)} {(market.outcomeMarkets?.length ?? 1) === 1 ? "market" : "markets"}
        </div>
      </div>
    </article>
  );
}

function MarketCardSkeleton() {
  return (
    <div className="rounded-[28px] border border-border bg-bg-1 p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="h-11 w-11 animate-pulse rounded-xl bg-bg-3" />
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-bg-3" />
          <div className="h-2.5 w-20 animate-pulse rounded bg-bg-2" />
        </div>
      </div>
      <div className="mb-7 h-10 w-5/6 animate-pulse rounded-xl bg-bg-2 sm:h-11" />
      <div className="space-y-5">
        {[0, 1].map((i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_72px_86px] items-center gap-4">
            <div>
              <div className="mb-2 h-5 w-40 animate-pulse rounded bg-bg-2" />
              <div className="h-[3px] w-full animate-pulse rounded-full bg-bg-3" />
            </div>
            <div className="h-5 w-14 animate-pulse rounded bg-bg-2" />
            <div className="h-10 w-[4.5rem] animate-pulse rounded-full bg-bg-2 sm:h-11 sm:w-20" />
          </div>
        ))}
      </div>
      <div className="mt-8 flex justify-between">
        <div className="space-y-2">
          <div className="h-4 w-20 animate-pulse rounded bg-bg-2" />
          <div className="h-3 w-28 animate-pulse rounded bg-bg-2" />
        </div>
        <div className="h-4 w-16 animate-pulse rounded bg-bg-2" />
      </div>
    </div>
  );
}

const MarketsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "All";
  const subCategory = searchParams.get("subCategory") || "All";
  const [sortKey, setSortKey] = useState<MarketsSortKey>("volume24h");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebouncedValue(search, 250);
  const tagsQuery = useDflowTags();
  const tagsByCategories = tagsQuery.data?.tagsByCategories ?? {};
  const hasApiCategories = Object.values(tagsByCategories).some((tags) => (tags?.length ?? 0) > 0);

  const marketsQuery = useDflowMarkets({
    status: "active",
    limit: 50,
    refetchInterval: 30_000,
  });
  const scopedMarketsQuery = useDflowScopedMarkets({
    categoryLabel: category === "All" ? undefined : category,
    tag: subCategory === "All" ? null : subCategory,
    limit: 50,
    enabled: hasApiCategories && category !== "All",
  });

  const isSearching = debouncedSearch.length >= 2;
  const allMarkets = useMemo(() => marketsQuery.data ?? [], [marketsQuery.data]);

  const categoryTabs = useMemo(() => {
    const apiCategories = Object.entries(tagsByCategories)
      .filter(([, tags]) => (tags?.length ?? 0) > 0)
      .map(([key]) => toTitleCaseCategory(key))
      .sort((a, b) => a.localeCompare(b));

    if (apiCategories.length > 0) return ["All", ...apiCategories];

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
      setSearchParams((prev) => {
        prev.delete("category");
        prev.delete("subCategory");
        return prev;
      }, { replace: true });
    }
  }, [category, categoryTabs, setSearchParams]);

  useEffect(() => {
    if (subCategory !== "All" && !subCategoryTabs.includes(subCategory)) {
      setSearchParams((prev) => {
        prev.delete("subCategory");
        return prev;
      }, { replace: true });
    }
  }, [subCategory, subCategoryTabs, setSearchParams]);

  const markets = useMemo(() => {
    let list =
      category === "All"
        ? allMarkets
        : hasApiCategories
          ? scopedMarketsQuery.data ?? []
          : allMarkets.filter((m) => m.category === category);

    const grouped = groupMarketsForListing(list);
    if (!isSearching) return grouped;
    return grouped.filter((m) => marketMatchesSearch(m, debouncedSearch));
  }, [allMarkets, category, hasApiCategories, scopedMarketsQuery.data, isSearching, debouncedSearch]);

  const isLoading =
    category === "All" || !hasApiCategories ? marketsQuery.isLoading : scopedMarketsQuery.isLoading;
  const isError =
    category === "All" || !hasApiCategories ? marketsQuery.isError : scopedMarketsQuery.isError;
  const activeError =
    category === "All" || !hasApiCategories ? marketsQuery.error : scopedMarketsQuery.error;

  const filtered = useMemo(() => {
    return [...markets].sort((a, b) => compareMarkets(a, b, sortKey, sortDir));
  }, [markets, sortKey, sortDir]);

  const selectCategory = useCallback((cat: string) => {
    setSearchParams((prev) => {
      if (cat === "All") prev.delete("category");
      else prev.set("category", cat);
      prev.delete("subCategory");
      return prev;
    });
  }, [setSearchParams]);

  const selectSubCategory = useCallback((tag: string) => {
    setSearchParams((prev) => {
      if (tag === "All") prev.delete("subCategory");
      else prev.set("subCategory", tag);
      return prev;
    });
  }, [setSearchParams]);

  const setSortOption = useCallback((key: MarketsSortKey, dir: "asc" | "desc") => {
    setSortKey(key);
    setSortDir(dir);
  }, []);

  const onOpenMarket = useCallback((ticker: string) => {
    navigate(`/markets/${encodeURIComponent(ticker)}`);
  }, [navigate]);

  return (
    <Layout showFooter={false}>
      <div className="min-h-[calc(100vh-56px)] bg-bg-0 text-foreground">
        <div className="border-b border-border bg-bg-0/95 backdrop-blur">
          <div className="mx-auto max-w-[1560px] px-4 sm:px-6 lg:px-8">
            <div className="flex gap-5 overflow-x-auto py-4 text-sm text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categoryTabs.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => selectCategory(cat)}
                  className={cn(
                    "whitespace-nowrap border-b-2 pb-3 pt-1 transition-colors",
                    category === cat
                      ? "border-cusp-teal font-semibold text-foreground"
                      : "border-transparent font-medium hover:text-foreground"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1560px] px-4 py-8 sm:px-6 lg:px-8">
          <div
            className={cn(
              "grid grid-cols-1 gap-8",
              category !== "All" && "lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)]"
            )}
          >
            {category !== "All" && (
              <aside className="hidden lg:block">
                <div className="sticky top-24 rounded-[28px] border border-border bg-bg-1 p-6">
                  <button
                    type="button"
                    onClick={() => selectCategory("All")}
                    className="mb-6 text-left text-sm font-semibold text-foreground transition-colors hover:text-cusp-teal"
                  >
                    All markets
                  </button>

                  <div className="space-y-1">
                    {[
                      { label: `All ${category}`, value: "All" },
                      ...subCategoryTabs.map((tag) => ({ label: tag, value: tag })),
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => selectSubCategory(item.value)}
                        className={cn(
                          "block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                          subCategory === item.value
                            ? "bg-bg-2 text-foreground"
                            : "text-muted-foreground hover:bg-bg-2 hover:text-foreground"
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            )}

            <section className="min-w-0">
              <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    {category === "All" ? "Markets" : category}
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Showing top {category === "All" ? "50" : "50 filtered"} markets first for a faster, more Kalshi-like browse experience.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  <label className="flex min-w-[280px] items-center gap-3 rounded-full border border-border bg-bg-1 px-4 py-3 text-muted-foreground">
                    <Search className="h-4 w-4" />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search markets"
                      className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      autoComplete="off"
                    />
                  </label>

                  <div className="relative">
                    <select
                      value={`${sortKey}:${sortDir}`}
                      onChange={(e) => {
                        const [key, dir] = e.target.value.split(":") as [MarketsSortKey, "asc" | "desc"];
                        setSortOption(key, dir);
                      }}
                      className="appearance-none rounded-full border border-border bg-bg-1 px-5 py-3 pr-11 text-sm font-semibold text-foreground outline-none"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={`${option.key}:${option.dir}`} value={`${option.key}:${option.dir}`}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {(category !== "All" || subCategoryTabs.length > 0) && (
                <div className="mb-6 flex gap-2 overflow-x-auto pb-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {(category === "All"
                    ? categoryTabs
                    : ["All", ...subCategoryTabs]).map((item) => {
                    const active = category === "All" ? category === item : subCategory === item;
                    const onClick = category === "All" ? () => selectCategory(item) : () => selectSubCategory(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={onClick}
                        className={cn(
                          "whitespace-nowrap rounded-full border px-4 py-2.5 text-sm transition-colors",
                          active
                            ? "border-active bg-bg-2 font-semibold text-foreground"
                            : "border-border bg-bg-1 font-medium text-muted-foreground"
                        )}
                      >
                        {item === "All" && category !== "All" ? `All ${category}` : item}
                      </button>
                    );
                  })}
                </div>
              )}

              {isLoading && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <MarketCardSkeleton key={i} />
                  ))}
                </div>
              )}

              {isError && !isLoading && (
                <div className="rounded-[28px] border border-cusp-red/40 bg-bg-1 p-8 text-center text-cusp-red">
                  {activeError instanceof Error ? activeError.message : "Failed to load markets. Please try again."}
                </div>
              )}

              {!isLoading && !isError && (
                <>
                  {filtered.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                      {filtered.map((market) => (
                        <MarketEventCard key={market.id} market={market} onOpenMarket={onOpenMarket} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[28px] border border-border bg-bg-1 p-12 text-center">
                      <p className="text-sm text-muted-foreground">
                        {isSearching
                          ? `No markets found for “${debouncedSearch}”. Try another search.`
                          : "No markets match this section yet."}
                      </p>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MarketsPage;
