import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import MarketCard from "@/components/MarketCard";
import { useDflowMarkets, useDflowSearchMarkets } from "@/hooks/useDflowMarkets";

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const categories = ["All", "Crypto", "Sports", "Politics", "Economics", "Finance", "Other"];
const sortOptions = [
  { value: "yield", label: "Highest APY" },
  { value: "ending", label: "Ending Soon" },
  { value: "volume", label: "Highest Volume" },
];

const MarketsPage = () => {
  const navigate = useNavigate();
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("volume");
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebouncedValue(search, 350);

  const marketsQuery = useDflowMarkets({
    status: "active",
    limit: 200,
    refetchInterval: 30_000,
  });
  const searchQuery = useDflowSearchMarkets(debouncedSearch);

  const isSearching = debouncedSearch.length >= 2;
  const markets = useMemo(
    () => (isSearching ? (searchQuery.data ?? []) : (marketsQuery.data ?? [])),
    [isSearching, searchQuery.data, marketsQuery.data]
  );
  const isLoading = isSearching ? searchQuery.isLoading : marketsQuery.isLoading;
  const error = isSearching ? searchQuery.error : marketsQuery.error;

  const filtered = useMemo(() => {
    let list = markets;

    if (category !== "All") {
      list = list.filter((m) => m.category === category);
    }

    switch (sort) {
      case "yield":
        return [...list].sort((a, b) => b.estimatedYield - a.estimatedYield);
      case "ending":
        return [...list].sort((a, b) => new Date(a.resolutionDate).getTime() - new Date(b.resolutionDate).getTime());
      case "volume":
        return [...list].sort((a, b) => b.volume - a.volume);
      default:
        return list;
    }
  }, [markets, category, sort]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: markets.length };
    markets.forEach((m) => {
      counts[m.category] = (counts[m.category] ?? 0) + 1;
    });
    return counts;
  }, [markets]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground mb-1">Markets Explorer</h1>
          <p className="text-sm text-muted-foreground">Live DFlow prediction markets from Kalshi</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-bg-1 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-active transition-colors"
          />
          <div className="flex gap-1 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
                  category === cat ? "bg-bg-2 text-cusp-teal border border-active" : "text-muted-foreground hover:text-foreground bg-bg-1 border border-border"
                }`}
              >
                {cat}
                {categoryCounts[cat] != null && (
                  <span className="ml-1 opacity-70">({categoryCounts[cat]})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1 mb-6">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                sort === opt.value ? "bg-bg-2 text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">
              {isSearching ? "Searching DFlow markets..." : "Loading markets..."}
            </p>
          </div>
        )}

        {error && (
          <div className="text-center py-16">
            <p className="text-sm text-cusp-red">Failed to load markets. Please try again.</p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((market) => (
                <MarketCard
                  key={market.id}
                  market={market}
                  onClick={() => navigate(`/markets/${market.ticker}`)}
                />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-16">
                <p className="text-sm text-muted-foreground">
                  {isSearching
                    ? `No markets found for "${debouncedSearch}". Try a different search.`
                    : "No markets found matching your criteria."}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default MarketsPage;
