import type { CuspMarket } from "@/lib/dflow-api";
import ProbabilityBar from "@/components/ProbabilityBar";
import CountdownTimer from "@/components/CountdownTimer";
import {
  MarketsTableSkeletonDesktopRows,
  MarketsTableSkeletonMobileBlocks,
} from "@/components/loading/MarketsTableSkeleton";
import { MAX_PROTOCOL_LEVERAGE } from "@/lib/protocol-constants";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

export type MarketsSortKey =
  | "title"
  | "probability"
  | "yesBid"
  | "yesAsk"
  | "spread"
  | "volume24h"
  | "openInterest"
  | "close"
  | "yield"
  | "volume";

function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n === 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function cents(d: number): string {
  if (!Number.isFinite(d) || d <= 0) return "—";
  return `${Math.round(d * 100)}¢`;
}

function SortTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  sortKey: MarketsSortKey;
  activeKey: MarketsSortKey;
  dir: "asc" | "desc";
  onSort: (k: MarketsSortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th
      className={cn(
        "border-b border-border bg-bg-1 px-2 py-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap",
        align === "right" && "text-right",
        className
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "w-full inline-flex items-center gap-0.5 hover:text-foreground transition-colors",
          align === "right" ? "justify-end" : "justify-start"
        )}
      >
        {label}
        {active && (dir === "desc" ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronUp className="h-3 w-3 shrink-0" />)}
      </button>
    </th>
  );
}

interface MarketsTableProps {
  markets: CuspMarket[];
  sortKey: MarketsSortKey;
  sortDir: "asc" | "desc";
  onSort: (key: MarketsSortKey) => void;
  onOpenMarket: (ticker: string) => void;
  onOpenLeveraged: (ticker: string, e: React.MouseEvent) => void;
  loading?: boolean;
  /** Extra skeleton rows while fetching the next page (desktop + mobile). */
  loadingMore?: boolean;
}

const MarketsTable = ({
  markets,
  sortKey,
  sortDir,
  onSort,
  onOpenMarket,
  onOpenLeveraged,
  loading,
  loadingMore,
}: MarketsTableProps) => {
  const showSkeleton = loading && markets.length === 0;
  const showAppendSkeleton = Boolean(loadingMore && markets.length > 0);

  const rowInner = (m: CuspMarket) => (
    <>
      <td className="px-2 py-2 align-top">
        <div className="min-w-0 max-w-md">
          <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{m.name}</p>
          {m.subtitle && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{m.subtitle}</p>}
        </div>
      </td>
      <td className="px-2 py-2 align-middle w-36">
        <div className="max-w-[132px] min-w-0">
          <ProbabilityBar probability={m.probability} size="sm" showLabel />
        </div>
      </td>
      <td className="px-2 py-2 text-right font-mono text-xs text-foreground tabular-nums whitespace-nowrap">
        {cents(m.yesBestBid)}
      </td>
      <td className="px-2 py-2 text-right font-mono text-xs text-cusp-green tabular-nums whitespace-nowrap">
        {cents(m.yesBestAsk)}
      </td>
      <td className="px-2 py-2 text-right font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {m.yesSpread != null ? cents(m.yesSpread) : "—"}
      </td>
      <td className="px-2 py-2 text-right font-mono text-xs text-foreground tabular-nums whitespace-nowrap">
        {formatUsd(m.volume24h ?? 0)}
      </td>
      <td className="px-2 py-2 text-right font-mono text-xs text-foreground tabular-nums whitespace-nowrap">
        {formatUsd(m.openInterest ?? 0)}
      </td>
      <td className="px-2 py-2 text-right whitespace-nowrap">
        <CountdownTimer targetDate={m.resolutionDate} />
      </td>
      <td className="px-2 py-2 text-right font-mono text-xs text-cusp-amber tabular-nums whitespace-nowrap">
        {m.estimatedYield > 0 ? `${m.estimatedYield.toFixed(1)}%` : "—"}
      </td>
      <td className="px-2 py-2 text-right align-middle">
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">Up to {MAX_PROTOCOL_LEVERAGE}x</span>
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenMarket(m.ticker);
              }}
              className="rounded border border-border bg-bg-1 px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-bg-2 transition-colors"
            >
              Trade
            </button>
            <button
              type="button"
              onClick={(e) => onOpenLeveraged(m.ticker, e)}
              className="rounded border border-active/50 bg-cusp-teal/10 px-2 py-0.5 text-[10px] font-medium text-cusp-teal hover:bg-cusp-teal/20 transition-colors"
            >
              Leverage
            </button>
          </div>
        </div>
      </td>
    </>
  );

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-bg-0">
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead>
            <tr>
              <SortTh label="Market" sortKey="title" activeKey={sortKey} dir={sortDir} onSort={onSort} className="min-w-[200px]" />
              <SortTh label="Chance" sortKey="probability" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortTh label="Yes bid" sortKey="yesBid" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
              <SortTh label="Yes ask" sortKey="yesAsk" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
              <SortTh label="Spread" sortKey="spread" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
              <SortTh label="24h vol" sortKey="volume24h" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
              <SortTh label="OI" sortKey="openInterest" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
              <SortTh label="Closes" sortKey="close" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
              <SortTh label="Est. yield" sortKey="yield" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
              <th className="border-b border-border bg-bg-1 px-2 py-2.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                Cusp
              </th>
            </tr>
          </thead>
          <tbody>
            {showSkeleton && <MarketsTableSkeletonDesktopRows rows={10} />}
            {!showSkeleton &&
              markets.map((m, idx) => (
                <tr
                  key={m.id}
                  onClick={() => onOpenMarket(m.ticker)}
                  className={cn(
                    "border-b border-border cursor-pointer transition-colors hover:bg-bg-2/80",
                    idx % 2 === 1 && "bg-bg-1/30"
                  )}
                >
                  {rowInner(m)}
                </tr>
              ))}
            {showAppendSkeleton && <MarketsTableSkeletonDesktopRows rows={2} narrowAfter={0} />}
          </tbody>
        </table>
      </div>

      {/* Mobile: dense stacked rows */}
      <div className="md:hidden divide-y divide-border">
        {showSkeleton && (
          <div className="divide-y divide-border">
            <MarketsTableSkeletonMobileBlocks rows={8} />
          </div>
        )}
        {!showSkeleton &&
          markets.map((m) => (
            <div
              key={m.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenMarket(m.ticker)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpenMarket(m.ticker)}
              className="p-3 hover:bg-bg-2/80 transition-colors cursor-pointer"
            >
              <p className="text-sm font-medium text-foreground leading-snug mb-2">{m.name}</p>
              <div className="max-w-full mb-2">
                <ProbabilityBar probability={m.probability} size="sm" showLabel />
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs font-mono tabular-nums">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Yes bid</span>
                  <p className="text-foreground">{cents(m.yesBestBid)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Yes ask</span>
                  <p className="text-cusp-green">{cents(m.yesBestAsk)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Spread</span>
                  <p>{m.yesSpread != null ? cents(m.yesSpread) : "—"}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">24h vol</span>
                  <p>{formatUsd(m.volume24h ?? 0)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">OI</span>
                  <p>{formatUsd(m.openInterest ?? 0)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Closes</span>
                  <p>
                    <CountdownTimer targetDate={m.resolutionDate} />
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">Leverage up to {MAX_PROTOCOL_LEVERAGE}x</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenMarket(m.ticker);
                    }}
                    className="rounded border border-border bg-bg-1 px-2 py-1 text-xs font-medium"
                  >
                    Trade
                  </button>
                  <button
                    type="button"
                    onClick={(e) => onOpenLeveraged(m.ticker, e)}
                    className="rounded border border-active/50 bg-cusp-teal/10 px-2 py-1 text-xs font-medium text-cusp-teal"
                  >
                    Leverage
                  </button>
                </div>
              </div>
            </div>
          ))}
        {showAppendSkeleton && (
          <div className="divide-y divide-border border-t border-border">
            <MarketsTableSkeletonMobileBlocks rows={2} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketsTable;
