import { MarketAvatar } from "@/components/MarketAvatar";
import type { QvacFlowStep, QvacMarketSearchValue } from "@/components/qvac/qvacFlows";
import { Search } from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";

interface QvacStepInputProps {
  step: QvacFlowStep;
  value: unknown;
  onChange: (value: unknown) => void;
  onSubmit: () => void;
  isValid: boolean;
}

interface SearchResultMarket extends QvacMarketSearchValue {
  eventTitle?: string;
}

export default function QvacStepInput({
  step,
  value,
  onChange,
  onSubmit,
  isValid,
}: QvacStepInputProps) {
  if (step.type === "amount") {
    return <AmountInput step={step} value={value} onChange={onChange} onSubmit={onSubmit} isValid={isValid} />;
  }
  if (step.type === "select") {
    return <SelectInput step={step} value={value} onChange={onChange} />;
  }
  if (step.type === "market_search") {
    return <MarketSearchInput step={step} value={value} onChange={onChange} />;
  }
  return null;
}

function AmountInput({
  step,
  value,
  onChange,
  onSubmit,
  isValid,
}: {
  step: QvacFlowStep;
  value: unknown;
  onChange: (value: unknown) => void;
  onSubmit: () => void;
  isValid: boolean;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid) onSubmit();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input
          type="number"
          value={value != null && value !== "" ? String(value) : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          onKeyDown={handleKeyDown}
          placeholder={step.placeholder || "0.00"}
          min={step.min ?? 0}
          max={step.max}
          step="any"
          className="w-full rounded-lg border border-border bg-bg-0 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cusp-teal/50 focus:border-cusp-teal pr-16"
          autoFocus
        />
        {step.asset && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
            {step.asset}
          </span>
        )}
      </div>
      {step.validation && value != null && value !== "" && step.validation(value) && (
        <p className="text-xs text-destructive">{step.validation(value)}</p>
      )}
    </div>
  );
}

function SelectInput({
  step,
  value,
  onChange,
}: {
  step: QvacFlowStep;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (!step.options) return null;

  return (
    <div className="flex flex-col gap-2">
      {step.options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
            value === opt.value
              ? "border-cusp-teal bg-cusp-teal/10 text-cusp-teal"
              : "border-border hover:border-cusp-teal/50 text-foreground"
          }`}
        >
          <div className="flex flex-col">
            <span className="text-sm font-medium">{opt.label}</span>
            {opt.description && (
              <span className={`text-xs ${value === opt.value ? "text-cusp-teal/70" : "text-muted-foreground"}`}>
                {opt.description}
              </span>
            )}
          </div>
          {value === opt.value && (
            <svg className="size-4 text-cusp-teal shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}

function bestEffortImageUrl(source: Record<string, unknown> | undefined): string | undefined {
  if (!source) return undefined;
  for (const key of ["imageUrl", "image_url", "iconUrl", "icon_url", "thumbnailUrl", "thumbnail_url", "logoUrl", "logo_url"]) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function formatPercent(value: number | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${Math.round(value * 100)}¢`;
}

function formatCompactUsd(value: number | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatDateLabel(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed);
}

function MarketSearchInput({
  step,
  value,
  onChange,
}: {
  step: QvacFlowStep;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const selectedMarket = useMemo(
    () => (value && typeof value === "object" && "ticker" in (value as Record<string, unknown>) ? (value as QvacMarketSearchValue) : null),
    [value]
  );
  const [query, setQuery] = useState(selectedMarket?.title ?? "");
  const [markets, setMarkets] = useState<SearchResultMarket[]>([]);
  const [loading, setLoading] = useState(false);

  const searchMarkets = useCallback(async (q: string) => {
    if (q.length < 2) {
      setMarkets([]);
      return;
    }
    setLoading(true);
    try {
      const { searchKalshiMarketsByQuery } = await import("@/lib/kalshi-api");
      const data = await searchKalshiMarketsByQuery(q, 25);

      const results: SearchResultMarket[] = [];
      for (const item of data.current_page || []) {
        for (const market of item.markets || []) {
          const yesAsk = market.yes_ask_dollars ? Number(market.yes_ask_dollars) : undefined;
          const yesBid = market.yes_bid_dollars ? Number(market.yes_bid_dollars) : undefined;
          const lastPrice = market.last_price_dollars ? Number(market.last_price_dollars) : undefined;
          const yesPrice = yesAsk && yesAsk > 0 ? yesAsk : lastPrice && lastPrice > 0 ? lastPrice : undefined;
          const noPrice = yesBid && yesBid > 0 ? 1 - yesBid : lastPrice && lastPrice > 0 ? 1 - lastPrice : undefined;
          const derivedImage = bestEffortImageUrl(item.product_metadata_derived);
          results.push({
            ticker: market.ticker,
            title: market.title || item.event_title || item.series_title || market.ticker,
            subtitle: item.event_subtitle || item.series_title || item.category,
            eventTitle: item.event_title,
            category: item.category,
            yesPrice,
            noPrice,
            yesLabel: market.yes_subtitle || "Yes",
            noLabel: market.no_subtitle || "No",
            volume24h: market.volume ?? item.total_volume ?? undefined,
            resolutionDate: market.expected_expiration_ts || market.close_ts,
            imageUrl: derivedImage,
          });
        }
      }
      setMarkets(results.slice(0, 8));
    } catch {
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      onChange(undefined);
    }
    void searchMarkets(q);
  };

  const chooseMarket = (market: SearchResultMarket) => {
    onChange(market);
    setQuery(market.title);
    setMarkets([]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder={step.placeholder || "Search markets..."}
          className="w-full rounded-lg border border-border bg-bg-0 pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cusp-teal/50 focus:border-cusp-teal"
          autoFocus
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin rounded-full border-2 border-cusp-teal border-t-transparent" />
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Search for a market, then pick one result to continue.
      </p>

      {markets.length > 0 && (
        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto rounded-xl border border-border bg-bg-0 p-2">
          {markets.map((market) => {
            const selected = selectedMarket?.ticker === market.ticker;
            const yesPrice = formatPercent(market.yesPrice);
            const noPrice = formatPercent(market.noPrice);
            const closeLabel = formatDateLabel(market.resolutionDate);
            const volumeLabel = formatCompactUsd(market.volume24h);

            return (
              <button
                key={market.ticker}
                onClick={() => chooseMarket(market)}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition-all",
                  selected
                    ? "border-cusp-teal bg-cusp-teal/10 shadow-[0_0_0_1px_rgba(45,212,191,0.12)]"
                    : "border-border bg-bg-1 hover:border-cusp-teal/40 hover:bg-bg-2"
                )}
              >
                <div className="flex gap-3">
                  <MarketAvatar
                    market={{
                      imageUrl: market.imageUrl,
                      competition: market.eventTitle,
                      subCategory: market.subtitle,
                      category: market.category || "Other",
                      name: market.title,
                    }}
                    className="size-14 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-medium text-foreground">{market.title}</p>
                        {(market.subtitle || market.category) && (
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {[market.subtitle, market.category].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      <span className="rounded-full border border-border bg-bg-2 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        {selected ? "Selected" : "Select"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      {yesPrice && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300">
                          {market.yesLabel || "Yes"} {yesPrice}
                        </span>
                      )}
                      {noPrice && (
                        <span className="rounded-full bg-rose-500/10 px-2 py-1 text-rose-300">
                          {market.noLabel || "No"} {noPrice}
                        </span>
                      )}
                      {closeLabel && (
                        <span className="rounded-full bg-bg-2 px-2 py-1 text-muted-foreground">Closes {closeLabel}</span>
                      )}
                      {volumeLabel && (
                        <span className="rounded-full bg-bg-2 px-2 py-1 text-muted-foreground">Vol {volumeLabel}</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!loading && query.trim().length >= 2 && markets.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-bg-1/50 px-3 py-4 text-sm text-muted-foreground">
          No matching markets found. Try a broader keyword.
        </div>
      )}

      {selectedMarket && (
        <div className="rounded-xl border border-cusp-teal/30 bg-cusp-teal/10 px-3 py-3">
          <div className="flex items-center gap-2 text-xs font-medium text-cusp-teal">
            <svg className="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Market selected
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">{selectedMarket.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Great — continue with the next step below.
          </p>
        </div>
      )}
    </div>
  );
}
