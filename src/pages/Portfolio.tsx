import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { useUserPortfolio, type Position, type LeveragedTrade, type TradeExecution } from "@/hooks/useUserPortfolio";
import { useOutcomeTokenHoldings } from "@/hooks/useOutcomeTokenHoldings";
import { useProtocolState } from "@/hooks/useProtocolState";
import { usePhantom } from "@/lib/wallet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ExternalLink,
  Wallet,
  TrendingUp,
  TrendingDown,
  Coins,
  Layers,
  Clock,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Shield,
  Activity,
  RefreshCw,
} from "lucide-react";

const tabs = [
  { id: "positions" as const, label: "Positions", icon: Layers },
  { id: "tokens" as const, label: "Outcome Tokens", icon: Coins },
  { id: "leveraged" as const, label: "Leveraged", icon: Shield },
  { id: "history" as const, label: "History", icon: Clock },
  { id: "vault" as const, label: "Vault", icon: CreditCard },
];

type TabId = (typeof tabs)[number]["id"];

function shortAddr(addr: string, len = 4) {
  if (addr.length <= len * 2 + 1) return addr;
  return `${addr.slice(0, len)}...${addr.slice(-len)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PnlBadge({ value, pct }: { value: number | null | undefined; pct?: number | null }) {
  if (value == null) return <span className="text-[10px] text-muted-foreground">--</span>;
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-mono font-semibold ${positive ? "text-cusp-green" : "text-cusp-red"}`}>
      {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {positive ? "+" : ""}${Math.abs(value).toFixed(2)}
      {pct != null && (
        <span className="text-[10px] font-normal ml-0.5">({positive ? "+" : ""}{pct.toFixed(1)}%)</span>
      )}
    </span>
  );
}

function SideBadge({ side }: { side: string }) {
  const isYes = side === "YES";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
        isYes ? "bg-cusp-green/15 text-cusp-green" : "bg-cusp-red/15 text-cusp-red"
      }`}
    >
      {isYes ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
      {side}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    direct: "bg-cusp-teal/10 text-cusp-teal border-cusp-teal/20",
    leveraged: "bg-cusp-amber/10 text-cusp-amber border-cusp-amber/20",
    vault: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${colors[type] ?? "bg-bg-2 text-muted-foreground border-border"}`}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string; dot: string }> = {
    open: { color: "text-cusp-green", dot: "bg-cusp-green" },
    active: { color: "text-cusp-green", dot: "bg-cusp-green" },
    confirmed: { color: "text-cusp-green", dot: "bg-cusp-green" },
    submitted: { color: "text-cusp-amber", dot: "bg-cusp-amber" },
    pending: { color: "text-cusp-amber", dot: "bg-cusp-amber" },
    settled: { color: "text-muted-foreground", dot: "bg-muted-foreground" },
    closed: { color: "text-muted-foreground", dot: "bg-muted-foreground" },
    liquidated: { color: "text-cusp-red", dot: "bg-cusp-red" },
    failed: { color: "text-cusp-red", dot: "bg-cusp-red" },
  };
  const cfg = configs[status] ?? configs.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${cfg.color}`}>
      <span className={`size-1.5 rounded-full ${cfg.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SolscanTxLink({ sig }: { sig: string | null | undefined }) {
  if (!sig) return null;
  return (
    <a
      href={`https://solscan.io/tx/${sig}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-cusp-teal/70 hover:text-cusp-teal transition-colors"
      title="View on Solscan"
    >
      <ExternalLink className="size-3.5" />
    </a>
  );
}

function PositionCard({ p }: { p: Position }) {
  const isYes = p.side === "YES";
  const currentPrice = isYes ? p.current_yes_price : p.current_no_price;
  const isOpen = p.status === "open";

  return (
    <div
      className={`bg-bg-1 border rounded-xl p-4 sm:p-5 transition-all hover:shadow-md ${
        isYes
          ? "border-cusp-green/20 hover:border-cusp-green/40"
          : "border-cusp-red/20 hover:border-cusp-red/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SideBadge side={p.side} />
          <TypeBadge type={p.position_type} />
          {!isOpen && <StatusBadge status={p.status} />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOpen && <StatusBadge status={p.status} />}
          <SolscanTxLink sig={p.tx_signature} />
        </div>
      </div>

      <Link
        to={`/markets/${p.market_ticker}`}
        className="text-sm font-medium text-foreground hover:text-cusp-teal transition-colors line-clamp-2 leading-snug mb-1 block"
      >
        {p.market_title ?? p.market_ticker}
      </Link>
      <span className="text-[10px] font-mono text-muted-foreground">{p.market_ticker}</span>

      <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-border/50">
        <div>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">Entry</span>
          <span className="font-mono text-xs text-foreground">${p.entry_price.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">Current</span>
          <span className="font-mono text-xs text-foreground">
            {currentPrice != null ? `$${currentPrice.toFixed(2)}` : "--"}
          </span>
        </div>
        <div>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">Shares</span>
          <span className="font-mono text-xs text-foreground">
            {p.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-2">
        <div>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">Cost</span>
          <span className="font-mono text-xs text-foreground">${p.usdc_cost.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">Value</span>
          <span className="font-mono text-xs text-foreground">
            {p.current_value != null ? `$${p.current_value.toFixed(2)}` : "--"}
          </span>
        </div>
        <div>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">P&L</span>
          <PnlBadge value={p.unrealized_pnl} pct={p.unrealized_pnl_pct} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
        <span className="text-[10px] text-muted-foreground">{formatDate(p.created_at)}</span>
        <Link
          to={`/markets/${p.market_ticker}`}
          className="text-[10px] text-cusp-teal hover:underline"
        >
          View Market
        </Link>
      </div>
    </div>
  );
}

function LeveragedCard({ lt }: { lt: LeveragedTrade }) {
  const hfColor =
    lt.health_factor >= 1.5 ? "text-cusp-green" : lt.health_factor >= 1.1 ? "text-cusp-amber" : "text-cusp-red";
  const hfBg =
    lt.health_factor >= 1.5 ? "bg-cusp-green" : lt.health_factor >= 1.1 ? "bg-cusp-amber" : "bg-cusp-red";
  const hfPct = Math.min((lt.health_factor / 3) * 100, 100);

  return (
    <div className="bg-bg-1 border border-border rounded-xl p-4 sm:p-5 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SideBadge side={lt.side} />
          <span className="text-xs font-mono font-semibold text-cusp-teal px-2 py-0.5 rounded-md bg-cusp-teal/10 border border-cusp-teal/20">
            {lt.leverage}x
          </span>
          <StatusBadge status={lt.status} />
        </div>
        <div className={`text-right ${hfColor}`}>
          <span className="text-[9px] uppercase tracking-wider block mb-0.5">Health</span>
          <span className="font-mono text-sm font-bold">{lt.health_factor.toFixed(2)}</span>
        </div>
      </div>

      <Link
        to={`/markets/${lt.market_ticker}`}
        className="text-sm font-medium text-foreground hover:text-cusp-teal transition-colors line-clamp-2 leading-snug mb-1 block"
      >
        {lt.market_title || lt.market_ticker}
      </Link>

      {/* Health factor bar */}
      <div className="mt-3 mb-4">
        <div className="h-1.5 bg-bg-2 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${hfBg}`} style={{ width: `${hfPct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">Margin</span>
          <span className="font-mono text-xs text-foreground">${lt.margin_usdc.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">Borrowed</span>
          <span className="font-mono text-xs text-cusp-amber">${lt.borrowed_usdc.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">Total Size</span>
          <span className="font-mono text-xs text-foreground">${(lt.margin_usdc + lt.borrowed_usdc).toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">Interest</span>
          <span className="font-mono text-xs text-muted-foreground">${lt.accrued_interest.toFixed(4)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
        <span className="text-[10px] text-muted-foreground">{formatDate(lt.created_at)}</span>
        <span className="text-[10px] text-muted-foreground font-mono">
          Rate: {(lt.borrow_rate_bps / 100).toFixed(1)}% APR
        </span>
      </div>
    </div>
  );
}

function TradeRow({ t }: { t: TradeExecution }) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-bg-2/50 transition-colors rounded-lg">
      <div className={`shrink-0 size-8 rounded-full flex items-center justify-center ${
        t.side === "YES" ? "bg-cusp-green/10" : t.side === "NO" ? "bg-cusp-red/10" : "bg-bg-2"
      }`}>
        {t.direction === "open" ? (
          <ArrowUpRight className={`size-4 ${t.side === "YES" ? "text-cusp-green" : "text-cusp-red"}`} />
        ) : t.direction === "close" ? (
          <ArrowDownRight className="size-4 text-muted-foreground" />
        ) : (
          <RefreshCw className="size-4 text-cusp-teal" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-foreground truncate max-w-[200px]">
            {t.market_title || t.market_ticker || "Trade"}
          </span>
          {t.side && <SideBadge side={t.side} />}
          <TypeBadge type={t.position_type || t.direction} />
        </div>
        <span className="text-[10px] text-muted-foreground">{formatDateTime(t.created_at)}</span>
      </div>
      <div className="text-right shrink-0">
        <span className="font-mono text-xs font-medium text-foreground block">
          ${t.input_amount.toFixed(2)}
        </span>
        <StatusBadge status={t.status} />
      </div>
      <SolscanTxLink sig={t.tx_signature} />
    </div>
  );
}

const PortfolioPage = () => {
  const [tab, setTab] = useState<TabId>("positions");
  const { isConnected } = usePhantom();
  const { data: portfolio, isLoading, dataUpdatedAt } = useUserPortfolio();
  const { data: outcomeHoldings = [], isLoading: outcomeLoading } = useOutcomeTokenHoldings(
    portfolio ?? undefined
  );
  const { state } = useProtocolState();

  const openPositions = useMemo(
    () => (portfolio?.positions ?? []).filter((p) => p.status === "open"),
    [portfolio?.positions]
  );
  const settledPositions = useMemo(
    () => (portfolio?.positions ?? []).filter((p) => p.status !== "open"),
    [portfolio?.positions]
  );
  const activeLeveraged = useMemo(
    () => (portfolio?.leveraged_trades ?? []).filter((lt) => lt.status === "active"),
    [portfolio?.leveraged_trades]
  );

  const exchangeRate = state?.cusdc_exchange_rate ?? 1;
  const totalDeposited = portfolio?.total_deposited ?? 0;
  const totalCusdc = portfolio?.total_cusdc ?? 0;
  const vaultValue = totalCusdc * exchangeRate;

  const tabCounts: Record<TabId, number> = {
    positions: openPositions.length,
    tokens: outcomeHoldings.length,
    leveraged: activeLeveraged.length,
    history: portfolio?.trade_executions?.length ?? 0,
    vault: portfolio?.deposits?.length ?? 0,
  };

  if (!isConnected) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-xl font-semibold text-foreground mb-6">Portfolio</h1>
          <div className="bg-bg-1 border border-border rounded-xl p-12 text-center">
            <Wallet className="size-10 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-1">Connect your wallet to view your Cusp portfolio.</p>
            <p className="text-[11px] text-muted-foreground/60">Track positions, outcome tokens, and trade history.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-foreground">Portfolio</h1>
          {dataUpdatedAt > 0 && (
            <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
              <Activity className="size-3" />
              Synced {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-bg-1 border border-border rounded-xl p-4 flex flex-col gap-2 min-h-[84px]">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-6 w-28" shimmer={i === 0} />
              </div>
            ))
          ) : (
            <>
              <div className="bg-bg-1 border border-border rounded-xl p-4">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  Total Invested
                </span>
                <span className="font-mono text-lg font-semibold text-foreground">
                  ${(portfolio?.total_invested ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-bg-1 border border-border rounded-xl p-4">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  Current Value
                </span>
                <span className="font-mono text-lg font-semibold text-foreground">
                  ${(portfolio?.total_current_value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-bg-1 border border-border rounded-xl p-4">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  Unrealized P&L
                </span>
                <PnlBadge value={portfolio?.unrealized_pnl ?? 0} />
              </div>
              <div className="bg-bg-1 border border-border rounded-xl p-4">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  Outcome Tokens
                </span>
                {outcomeLoading ? (
                  <Skeleton className="h-7 w-12 mt-0.5" shimmer />
                ) : (
                  <span className="font-mono text-lg font-semibold text-foreground">{outcomeHoldings.length}</span>
                )}
              </div>
              <div className="bg-bg-1 border border-border rounded-xl p-4 col-span-2 lg:col-span-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  Vault Balance
                </span>
                <span className="font-mono text-lg font-semibold text-foreground">
                  ${vaultValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                {totalCusdc > 0 && (
                  <span className="text-[9px] text-muted-foreground block mt-0.5">
                    {totalCusdc.toFixed(4)} cUSDT
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border pb-px overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                tab === id
                  ? "text-cusp-teal border-b-2 border-cusp-teal -mb-px"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
              {tabCounts[id] > 0 && (
                <span
                  className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full ${
                    tab === id ? "bg-cusp-teal/15 text-cusp-teal" : "bg-bg-2 text-muted-foreground"
                  }`}
                >
                  {tabCounts[id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Positions Tab ── */}
        {tab === "positions" && (
          <div>
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[240px] rounded-xl" shimmer={i === 0} />
                ))}
              </div>
            ) : openPositions.length > 0 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {openPositions.map((p) => (
                    <PositionCard key={p.id} p={p} />
                  ))}
                </div>
                {settledPositions.length > 0 && (
                  <details className="mt-8 group">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground py-2 flex items-center gap-1">
                      <Clock className="size-3" />
                      {settledPositions.length} settled position{settledPositions.length !== 1 ? "s" : ""}
                    </summary>
                    <div className="grid gap-4 sm:grid-cols-2 mt-3 opacity-70">
                      {settledPositions.map((p) => (
                        <PositionCard key={p.id} p={p} />
                      ))}
                    </div>
                  </details>
                )}
              </>
            ) : (
              <div className="bg-bg-1 border border-border rounded-xl p-10 text-center">
                <Layers className="size-10 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-sm font-medium text-muted-foreground mb-1">No open positions</p>
                <p className="text-[11px] text-muted-foreground/60 mb-4">
                  Place a trade on any market to see your positions here.
                </p>
                <Link
                  to="/markets"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-cusp-teal hover:underline"
                >
                  <TrendingUp className="size-3" />
                  Browse Markets
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── Outcome Tokens Tab ── */}
        {tab === "tokens" && (
          <div>
            {outcomeLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[200px] rounded-xl" shimmer={i === 0} />
                ))}
              </div>
            ) : outcomeHoldings.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {outcomeHoldings.map((h) => {
                  const isYes = h.side === "YES";
                  return (
                    <div
                      key={h.mint}
                      className={`bg-bg-1 border rounded-xl p-4 sm:p-5 transition-all hover:shadow-md ${
                        isYes
                          ? "border-cusp-green/20 hover:border-cusp-green/40"
                          : "border-cusp-red/20 hover:border-cusp-red/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <SideBadge side={h.side ?? "YES"} />
                          <span className="text-[10px] font-mono text-muted-foreground/60 px-1.5 py-0.5 rounded bg-bg-2">
                            {h.program === "token-2022" ? "Token-2022" : "SPL"}
                          </span>
                        </div>
                        <a
                          href={`https://solscan.io/token/${h.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cusp-teal/70 hover:text-cusp-teal transition-colors"
                          title="View on Solscan"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </div>

                      <Link
                        to={`/markets/${h.ticker}`}
                        className="text-sm font-medium text-foreground hover:text-cusp-teal transition-colors line-clamp-2 leading-snug mb-1 block"
                      >
                        {h.title ?? "Prediction outcome"}
                      </Link>
                      <span className="text-[10px] font-mono text-muted-foreground">{h.ticker}</span>

                      <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-border/50">
                        <div>
                          <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">Balance</span>
                          <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
                            {h.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">Side</span>
                          <span className={`font-mono text-xs font-semibold ${isYes ? "text-cusp-green" : "text-cusp-red"}`}>
                            {h.side} tokens
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">Decimals</span>
                          <span className="font-mono text-xs text-foreground">{h.decimals}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {shortAddr(h.mint)}
                        </span>
                        <Link
                          to={`/markets/${h.ticker}`}
                          className="text-[10px] text-cusp-teal hover:underline"
                        >
                          View Market
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-bg-1 border border-border rounded-xl p-10 text-center">
                <Coins className="size-10 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-sm font-medium text-muted-foreground mb-1">No outcome tokens found</p>
                <p className="text-[11px] text-muted-foreground/60 mb-4">
                  When you buy YES or NO outcomes, the SPL tokens will appear here.
                </p>
                <Link
                  to="/markets"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-cusp-teal hover:underline"
                >
                  <Coins className="size-3" />
                  Trade Markets
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── Leveraged Tab ── */}
        {tab === "leveraged" && (
          <div>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-[200px] rounded-xl" shimmer={i === 0} />
                ))}
              </div>
            ) : activeLeveraged.length > 0 ? (
              <div className="space-y-4">
                {activeLeveraged.map((lt) => (
                  <LeveragedCard key={lt.id} lt={lt} />
                ))}
              </div>
            ) : (
              <div className="bg-bg-1 border border-border rounded-xl p-10 text-center">
                <Shield className="size-10 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-sm font-medium text-muted-foreground mb-1">No active leveraged trades</p>
                <p className="text-[11px] text-muted-foreground/60 mb-4">
                  Choose 2x or 3x leverage on any market to trade with borrowed funds from the vault (1x is direct).
                </p>
                <Link
                  to="/markets"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-cusp-teal hover:underline"
                >
                  <TrendingUp className="size-3" />
                  Browse Markets
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── History Tab ── */}
        {tab === "history" && (
          <div>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-[64px] rounded-lg" shimmer={i === 0} />
                ))}
              </div>
            ) : (portfolio?.trade_executions ?? []).length > 0 ? (
              <div className="bg-bg-1 border border-border rounded-xl overflow-hidden divide-y divide-border/50">
                {(portfolio?.trade_executions ?? []).map((t) => (
                  <TradeRow key={t.id} t={t} />
                ))}
              </div>
            ) : (
              <div className="bg-bg-1 border border-border rounded-xl p-10 text-center">
                <Clock className="size-10 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-sm font-medium text-muted-foreground mb-1">No trade history</p>
                <p className="text-[11px] text-muted-foreground/60">
                  Completed trades will appear here with transaction links.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Vault Tab ── */}
        {tab === "vault" && (
          <div>
            {/* Vault summary */}
            {!isLoading && totalDeposited > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-bg-1 border border-border rounded-xl p-4">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                    Net Deposited
                  </span>
                  <span className="font-mono text-lg font-semibold text-foreground">
                    ${(totalDeposited - (portfolio?.total_withdrawn ?? 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-bg-1 border border-border rounded-xl p-4">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                    cUSDT Balance
                  </span>
                  <span className="font-mono text-lg font-semibold text-foreground">
                    {totalCusdc.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </span>
                </div>
                <div className="bg-bg-1 border border-border rounded-xl p-4">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                    Yield Earned
                  </span>
                  <span className={`font-mono text-lg font-semibold ${vaultValue - totalDeposited >= 0 ? "text-cusp-green" : "text-cusp-red"}`}>
                    {vaultValue - totalDeposited >= 0 ? "+" : ""}${(vaultValue - totalDeposited).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {(portfolio?.deposits ?? []).length > 0 ? (
              <div className="space-y-2">
                {portfolio!.deposits.map((d) => (
                  <div
                    key={d.id}
                    className="bg-bg-1 border border-border rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        ${d.amount_usdc.toLocaleString()} USDT
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        &rarr; {d.cusdc_minted.toLocaleString(undefined, { maximumFractionDigits: 4 })} cUSDT
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {formatDate(d.created_at)} at rate ${d.exchange_rate.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={d.status} />
                      <SolscanTxLink sig={d.tx_signature} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-bg-1 border border-border rounded-xl p-10 text-center">
                <CreditCard className="size-10 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-sm font-medium text-muted-foreground mb-1">No vault activity</p>
                <p className="text-[11px] text-muted-foreground/60 mb-4">
                  Deposit USDT to earn yield from the lending pool.
                </p>
                <Link
                  to="/vault"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-cusp-teal hover:underline"
                >
                  <CreditCard className="size-3" />
                  Go to Vault
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PortfolioPage;
