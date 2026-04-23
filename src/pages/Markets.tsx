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
  const markets = isSearching ? (searchQuery.data ?? []) : (marketsQuery.data ?? []);
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
  }, [markets, category, sort, search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: markets.length };
    markets.forEach((m) => {
      counts[m.category] = (counts[m.category] ?? 0) + 1;
    });
    return counts;
  }, [markets]);

  return (
    <Layout>
      <div className="w-full border-x border-border max-w-7xl mx-auto min-h-screen flex flex-col bg-bg-0 pt-14">

        {/* Page Header */}
        <section className="border-b border-border grid grid-cols-1 md:grid-cols-2 relative overflow-hidden">
          <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]">
             <div className="absolute top-0 right-0 w-full h-full drafting-dots" />
          </div>
          <div className="px-8 md:px-16 py-12 border-b md:border-b-0 md:border-r border-border relative z-10 corner-mark">
            <span className="text-xs font-mono text-cusp-teal uppercase tracking-widest mb-4 block">Explore / Markets</span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">Markets Explorer</h1>
            <p className="text-lg text-muted-foreground">Live DFlow prediction markets from Kalshi, sortable and filterable in real time.</p>
          </div>
          {/* Gondor monumental stat */}
          <div className="px-8 md:px-16 py-12 flex flex-col justify-center relative overflow-hidden z-10 corner-mark">
            <div className="text-[100px] md:text-[120px] font-bold font-mono leading-none text-cusp-teal/5 absolute right-4 top-1/2 -translate-y-1/2 select-none pointer-events-none uppercase">{category === "All" ? "LIVE" : category}</div>
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Total Markets</span>
            <div className="text-5xl font-bold font-mono text-cusp-teal tracking-tighter">{markets.length}</div>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-xs">Active Kalshi markets available for yield farming and collateral lending.</p>
          </div>
        </section>

        {/* Sticky Filter Bar */}
        <div className="border-b border-border px-8 py-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center sticky top-14 bg-bg-0/95 backdrop-blur-md z-20 corner-mark">
          <div className="relative w-full sm:w-80 group">
            <input
              type="text"
              placeholder="Search ticker or event..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-bg-1 border border-border rounded-[12px] px-5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cusp-teal/50 transition-all focus:ring-1 focus:ring-cusp-teal/20"
            />
            {isSearching && isLoading && (
               <div className="absolute right-4 top-1/2 -translate-y-1/2 size-4 border-2 border-cusp-teal/30 border-t-cusp-teal rounded-full animate-spin" />
            )}
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-1.5 text-[11px] font-mono uppercase tracking-widest rounded-[8px] transition-all ${
                  category === cat ? "bg-cusp-teal text-black font-bold" : "text-muted-foreground hover:text-foreground bg-bg-1 border border-border"
                }`}
              >
                {cat}
                {categoryCounts[cat] != null && <span className="ml-2 opacity-50">[{categoryCounts[cat]}]</span>}
              </button>
            ))}
          </div>

          <div className="flex gap-2 ml-auto">
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value)}
                className={`px-4 py-1.5 text-[11px] font-mono uppercase tracking-widest rounded-[8px] transition-all ${
                  sort === opt.value ? "bg-bg-2 text-foreground border border-border/50 font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Markets Grid */}
        <div className="flex-1 p-8 relative overflow-hidden">
           <div className="absolute inset-0 z-0 drafting-dots opacity-[0.02] pointer-events-none" />
          
          {isLoading && !isSearching && (
            <div className="flex items-center justify-center py-48 relative z-10">
               <div className="flex flex-col items-center gap-4">
                  <div className="size-10 border-4 border-cusp-teal/20 border-t-cusp-teal rounded-full animate-spin" />
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.3em]">Calibrating Markets</span>
               </div>
            </div>
          )}

          {error && (
            <div className="text-center py-48 relative z-10">
              <p className="text-sm text-cusp-red font-mono uppercase tracking-widest">Protocol Sync Failed</p>
            </div>
          )}

          {!isLoading && !error && (
            <div className="relative z-10">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filtered.map((market) => (
                  <MarketCard
                    key={market.id}
                    market={market}
                    onClick={() => navigate(`/markets/${market.ticker}`)}
                  />
                ))}
              </div>
              
              {filtered.length === 0 && (
                <div className="text-center py-48 border border-dashed border-border rounded-[32px] bg-bg-1/5">
                   <div className="text-4xl font-mono text-muted-foreground/20 mb-4 select-none uppercase tracking-[1em]">NO_DATA</div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-mono">
                    {isSearching
                      ? `Zero results for "${debouncedSearch}"`
                      : "Matching set is empty."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default MarketsPage;
