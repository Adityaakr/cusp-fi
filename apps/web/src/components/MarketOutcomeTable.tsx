import { getMarketOutcomeRowLabels, type CuspMarket } from "@/lib/dflow-api";
import { useState } from "react";
import { InlineMarkdownText } from "@/components/InlineMarkdownText";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DEFAULT_VISIBLE_OUTCOMES = 5;

function yesNoCents(m: CuspMarket, side: "yes" | "no"): string {
  const p =
    side === "yes"
      ? m.yesBestAsk > 0
        ? m.yesBestAsk
        : m.yesPrice
      : m.noBestAsk > 0
        ? m.noBestAsk
        : m.noPrice;
  if (!Number.isFinite(p) || p <= 0) return "—";
  return `${Math.round(p * 100)}¢`;
}

export interface MarketOutcomeTableProps {
  markets: CuspMarket[];
  activeTicker: string;
  eventTitle?: string;
  loading?: boolean;
  onSelect?: (outcomeTicker: string) => void;
  onYes: (outcomeTicker: string) => void;
  onNo: (outcomeTicker: string) => void;
}

/**
 * Kalshi-style outcome rows: name, chance %, Yes/No ask cents (REST snapshot).
 */
export function MarketOutcomeTable({
  markets,
  activeTicker,
  eventTitle,
  loading,
  onSelect,
  onYes,
  onNo,
}: MarketOutcomeTableProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="bg-bg-1 border border-border rounded-xl p-5 sm:p-6 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" shimmer={i < 2} />
          ))}
        </div>
      </div>
    );
  }

  if (markets.length === 0) return null;

  const visibleMarkets = expanded ? markets : markets.slice(0, DEFAULT_VISIBLE_OUTCOMES);
  const hiddenCount = Math.max(0, markets.length - visibleMarkets.length);

  return (
    <div className="bg-bg-1 border border-border rounded-xl p-5 sm:p-6 min-w-0">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="text-sm font-semibold text-foreground">Market choices</h3>
        <span className="text-[10px] text-muted-foreground tabular-nums">{markets.length} outcomes</span>
      </div>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-sm min-w-[320px]">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left font-medium py-2 pr-3">Outcome</th>
              <th className="text-right font-medium py-2 px-2 w-20">Chance</th>
              <th className="text-right font-medium py-2 pl-2 w-[200px]">Trade</th>
            </tr>
          </thead>
          <tbody>
            {visibleMarkets.map((m) => {
              const active = m.ticker.toLowerCase() === activeTicker.toLowerCase();
              const { primary, secondary } = getMarketOutcomeRowLabels(m, eventTitle);
              return (
                <tr
                  key={m.ticker}
                  onClick={() => onSelect?.(m.ticker)}
                  className={cn(
                    "border-b border-border/60 last:border-0 transition-colors",
                    onSelect && "cursor-pointer",
                    active
                      ? "bg-cusp-teal/5 ring-1 ring-inset ring-cusp-teal/30"
                      : "hover:bg-bg-2/40"
                  )}
                >
                  <td className={cn("py-3 pr-3 align-middle", active && "pl-3")}>
                    <div className="min-w-0">
                      <span className="font-semibold text-foreground leading-snug block">
                        <InlineMarkdownText text={primary} />
                      </span>
                      {secondary && (
                        <span className="text-[11px] text-muted-foreground leading-snug block mt-0.5">
                          <InlineMarkdownText text={secondary} />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2 align-middle text-right tabular-nums font-mono font-semibold text-foreground">
                    {Number.isFinite(m.probability) ? `${m.probability}%` : "—"}
                  </td>
                  <td className={cn("py-3 pl-2 align-middle", active && "pr-2")}>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onYes(m.ticker);
                        }}
                        className={cn(
                          "px-2.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors shrink-0",
                          active
                            ? "border-cusp-green text-cusp-green bg-cusp-green/10"
                            : "border-cusp-green text-cusp-green bg-cusp-green/5 hover:bg-cusp-green/10"
                        )}
                      >
                        Yes {yesNoCents(m, "yes")}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNo(m.ticker);
                        }}
                        className={cn(
                          "px-2.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors shrink-0",
                          active
                            ? "border-cusp-red text-cusp-red bg-cusp-red/10"
                            : "border-cusp-red text-cusp-red bg-cusp-red/5 hover:bg-cusp-red/10"
                        )}
                      >
                        No {yesNoCents(m, "no")}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {hiddenCount > 0 && (
              <tr className="border-b border-border/60 last:border-0">
                <td colSpan={3} className="py-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="text-sm font-medium text-foreground hover:text-cusp-teal transition-colors"
                  >
                    {hiddenCount} more
                  </button>
                </td>
              </tr>
            )}
            {expanded && markets.length > DEFAULT_VISIBLE_OUTCOMES && (
              <tr className="border-b border-border/60 last:border-0">
                <td colSpan={3} className="py-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Show less
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 pt-3 border-t border-border">
        <Link
          to="/markets"
          className="text-xs font-medium text-cusp-teal hover:underline"
        >
          More markets
        </Link>
      </div>
    </div>
  );
}
