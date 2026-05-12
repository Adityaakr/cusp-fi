import { useMemo } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import LoanCard from "@/components/LoanCard";
import BorrowPanel from "@/components/BorrowPanel";
import MainnetPoolPanel from "@/components/MainnetPoolPanel";
import { usePhantom } from "@/lib/wallet";
import { useUserPortfolio } from "@/hooks/useUserPortfolio";
import { useOutcomeLoans, type OutcomeLoanRow } from "@/hooks/useOutcomeLoans";
import { useOutcomeCollateralPositions, type OutcomeCollateralPosition } from "@/hooks/useOutcomeCollateralPositions";
import { useOutcomeTokenHoldings } from "@/hooks/useOutcomeTokenHoldings";
import { useBorrowPanelRows } from "@/hooks/useBorrowPanelRows";
import { type ActiveLoan } from "@/data/mockData";
import { useDflowMarkets } from "@/hooks/useDflowMarkets";
import { useLendingPool } from "@/hooks/useLendingPool";
import { isTestnet } from "@/lib/network-config";
import {
  Vault,
  TrendingUp,
  Percent,
  Activity,
  ArrowRight,
  ChevronRight,
  AlertTriangle,
  Shield,
} from "lucide-react";

type LoanCardView = ActiveLoan & {
  borrowAsset?: string;
  liquidationPrice?: number;
  positionStateLabel?: string | null;
  helperText?: string | null;
};

/* ── helpers ── */

function outcomeLoanToActive(loan: OutcomeLoanRow): ActiveLoan {
  const ltv =
    loan.collateral_value_usdc > 0
      ? Math.round((loan.borrowed_amount_usdc / loan.collateral_value_usdc) * 100)
      : 0;
  const resolutionDate =
    loan.resolution_time && loan.resolution_time > 0
      ? new Date(loan.resolution_time * 1000).toISOString()
      : loan.expires_at ?? new Date(Date.now() + 7 * 864e5).toISOString();
  return {
    id: loan.id,
    marketName: loan.market_ticker,
    tokenType: loan.side,
    collateralValue: loan.collateral_value_usdc,
    borrowedAmount: loan.borrowed_amount_usdc,
    healthFactor: loan.health_factor ?? 1.2,
    resolutionDate,
    ltv,
  };
}

function collateralPositionToActive(position: OutcomeCollateralPosition): ActiveLoan {
  const collateralValue =
    position.current_value ?? position.snapshot_value_usdc;
  const borrowedAmount =
    position.borrowed_amount_usdc + position.accrued_interest_usdc;
  const ltv =
    collateralValue > 0
      ? Math.round((borrowedAmount / collateralValue) * 100)
      : 0;
  const healthFactor =
    borrowedAmount > 0
      ? (position.health_factor ?? 1.2)
      : 9.99;
  const resolutionDate =
    position.resolution_time && position.resolution_time > 0
      ? new Date(position.resolution_time * 1000).toISOString()
      : position.expires_at ?? new Date(Date.now() + 7 * 864e5).toISOString();

  return {
    id: position.loan_id ?? position.collateral_lot_id,
    marketName: position.market_title || position.market_ticker,
    tokenType: position.side,
    collateralValue,
    borrowedAmount,
    healthFactor,
    resolutionDate,
    ltv,
  };
}

function riskBadge(ltv: number): { text: string; color: string; bg: string } {
  if (ltv <= 0) return { text: "—", color: "text-muted-foreground", bg: "" };
  if (ltv <= 35) return { text: "Safe", color: "text-cusp-green", bg: "bg-cusp-green/10" };
  if (ltv <= 50) return { text: "Moderate", color: "text-cusp-amber", bg: "bg-cusp-amber/10" };
  if (ltv < 60) return { text: "Risky", color: "text-cusp-red", bg: "bg-cusp-red/10" };
  return { text: "Liquidatable", color: "text-cusp-red", bg: "bg-cusp-red/15" };
}

/* ── page ── */

const LendPage = () => {
  const { addresses, isConnected } = usePhantom();
  const wallet =
    addresses?.find((a) => String(a.addressType || "").toLowerCase().includes("solana"))?.address ?? null;

  const { data: portfolio } = useUserPortfolio();
  const outcomeLoansQuery = useOutcomeLoans(wallet);
  const outcomeLoans = outcomeLoansQuery.data ?? [];
  const { data: collateralPositions = [] } = useOutcomeCollateralPositions(wallet);

  const { data: holdings = [], isLoading: holdingsLoading } = useOutcomeTokenHoldings(portfolio ?? undefined);
  const { rows: borrowablePositions, isPricesLoading } = useBorrowPanelRows(portfolio ?? undefined, holdings);

  const activeCustodyPositions = useMemo(
    () =>
      collateralPositions.filter(
        (position) => position.loan_status === "active" || position.loan_status === "pending"
      ),
    [collateralPositions]
  );
  const lockedCollateralPositions = useMemo(
    () =>
      collateralPositions.filter(
        (position) =>
          !position.loan_status &&
          (position.collateral_status === "confirmed" || position.collateral_status === "locked")
      ),
    [collateralPositions]
  );
  const activeLoans: LoanCardView[] = useMemo(() => {
    const custodyRows = [...activeCustodyPositions, ...lockedCollateralPositions];
    if (custodyRows.length > 0) {
      return custodyRows.map((position) => {
        const base = collateralPositionToActive(position);
        const threshold = position.liquidation_threshold_bps / 10_000;
        const borrowedAmount = position.borrowed_amount_usdc + position.accrued_interest_usdc;
        const liquidationPrice =
          borrowedAmount > 0 && position.quantity > 0 && threshold > 0
            ? borrowedAmount / (position.quantity * threshold)
            : undefined;

        return {
          ...base,
          borrowAsset: "USDC",
          liquidationPrice,
          positionStateLabel:
            position.loan_status === "active" || position.loan_status === "pending"
              ? null
              : "Locked collateral",
          helperText:
            position.loan_status === "active" || position.loan_status === "pending"
              ? null
              : "Held in Cusp pool custody. No active borrow has been recorded on this collateral.",
        };
      });
    }
    return outcomeLoans.map(outcomeLoanToActive);
  }, [activeCustodyPositions, lockedCollateralPositions, outcomeLoans]);

  // Live DFlow markets for discovery
  const marketsQuery = useDflowMarkets({ status: "active", limit: 120 });
  const dflowMarkets = useMemo(() => {
    const list = [...(marketsQuery.data ?? [])];
    list.sort((a, b) => (b.volume ?? b.volume24h ?? 0) - (a.volume ?? a.volume24h ?? 0));
    return list.slice(0, 18);
  }, [marketsQuery.data]);

  // Lending pool state
  const { data: poolState, isLoading: poolLoading } = useLendingPool(wallet);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── A. Header ── */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground mb-1">
            Borrow Against Your Prediction Positions
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Use YES/NO outcome exposure as collateral without closing your bet.{" "}
            <Link to="/markets" className="text-cusp-teal hover:underline">
              Trade on Markets
            </Link>
            {" "}— positions sync here automatically.
          </p>
        </div>

        {/* ── B. Pool Card ── */}
        <div className="bg-bg-1 border border-border rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Vault className="size-4 text-cusp-teal" />
              <h3 className="text-sm font-medium text-foreground">Lending Pool</h3>
              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wide ${
                poolState?.poolStatus === "devnet_demo"
                  ? "bg-cusp-amber/15 text-cusp-amber border border-cusp-amber/30"
                  : "bg-cusp-green/15 text-cusp-green border border-cusp-green/30"
              }`}>
                {poolState?.poolStatusLabel ?? (isTestnet ? "Devnet Demo" : "Beta")}
              </span>
            </div>
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-md border border-cusp-teal/25 bg-cusp-teal/10 text-cusp-teal">
              USDC pool
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <StatCell
              icon={<Vault className="size-3" />}
              label="Total Pool"
              value={`$${(poolState?.totalPoolSize ?? 0).toLocaleString()}`}
              loading={poolLoading}
              iconColor="text-cusp-teal"
            />
            <StatCell
              icon={<TrendingUp className="size-3" />}
              label="Available"
              value={`$${(poolState?.availableLiquidity ?? 0).toLocaleString()}`}
              loading={poolLoading}
              iconColor="text-cusp-green"
            />
            <StatCell
              icon={<Activity className="size-3" />}
              label="Borrowed"
              value={`$${(poolState?.totalBorrowed ?? 0).toLocaleString()}`}
              loading={poolLoading}
              iconColor="text-cusp-purple"
            />
            <StatCell
              icon={<Percent className="size-3" />}
              label="Utilization"
              value={`${((poolState?.utilizationRate ?? 0) * 100).toFixed(1)}%`}
              loading={poolLoading}
              iconColor="text-cusp-amber"
            />
            <StatCell
              icon={<TrendingUp className="size-3" />}
              label="Lender APY"
              value={`${(poolState?.lenderApyPlaceholder ?? 0).toFixed(1)}%`}
              loading={poolLoading}
              iconColor="text-cusp-green"
              subtitle="placeholder"
            />
            <StatCell
              icon={<Shield className="size-3" />}
              label="Active Loans"
              value={String(poolState?.activeLoans ?? activeLoans.length)}
              loading={poolLoading}
              iconColor="text-cusp-teal"
            />
          </div>

          {poolState?.poolStatus === "devnet_demo" && (
            <div className="mt-3 flex items-start gap-1.5 text-[10px] text-cusp-amber/90">
              <AlertTriangle className="size-3 shrink-0 mt-px" />
              This pool shows 10,000 USDC for devnet demo purposes only. Not real mainnet liquidity.
            </div>
          )}
          {!poolState?.poolReady && (
            <div className="mt-3 flex items-start gap-1.5 text-[10px] text-cusp-amber/90">
              <AlertTriangle className="size-3 shrink-0 mt-px" />
              The mainnet LP signer is not configured yet. Outcome positions still sync live, but supply, withdraw, and funded borrows stay disabled until the pool wallet is wired.
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Main Content ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* ── C. Your Borrow-Eligible Positions ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-foreground">
                  Your Borrow-Eligible Positions
                  {isConnected && borrowablePositions.length > 0 && (
                    <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-cusp-teal/15 text-cusp-teal">
                      {borrowablePositions.length}
                    </span>
                  )}
                </h3>
                {borrowablePositions.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">30% max LTV · live DFlow prices</span>
                )}
              </div>

              {!isConnected ? (
                <div className="rounded-xl border border-dashed border-border bg-bg-1 p-8 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Connect your wallet</p>
                  <p className="text-[11px] text-muted-foreground/70 max-w-md mx-auto">
                    Connect your Solana wallet to see your outcome token positions and borrow against them.
                  </p>
                </div>
              ) : holdingsLoading ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {[0, 1].map((i) => (
                    <div key={i} className="rounded-xl border border-border bg-bg-1 p-4">
                      <div className="h-4 w-3/4 bg-bg-2 rounded animate-pulse mb-3" />
                      <div className="h-3 w-1/2 bg-bg-2 rounded animate-pulse mb-2" />
                      <div className="h-3 w-2/3 bg-bg-2 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : borrowablePositions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-bg-1 p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-1">
                    {activeCustodyPositions.length > 0 || lockedCollateralPositions.length > 0
                      ? "No borrow-eligible positions left in wallet"
                      : "No outcome tokens in your wallet"}
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 max-w-md mx-auto mb-3">
                    {activeCustodyPositions.length > 0 || lockedCollateralPositions.length > 0
                      ? "Your prediction positions are currently locked in the Cusp pool as collateral. They remain visible below and in Portfolio."
                      : "Trade first to create collateral. Buy YES or NO on any DFlow market — tokens appear here automatically."}
                  </p>
                  <Link
                    to="/markets"
                    className="inline-flex items-center gap-1 text-xs font-medium text-cusp-teal hover:underline"
                  >
                    {activeCustodyPositions.length > 0 || lockedCollateralPositions.length > 0 ? "View markets" : "Trade on Markets"} <ArrowRight className="size-3" />
                  </Link>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {borrowablePositions.map((pos) => {
                    const ltvIfMax = 30;
                    const hfIfMax = pos.collateralUsd > 0
                      ? (pos.collateralUsd * 0.40) / pos.maxBorrowUsd
                      : Infinity;
                    const risk = riskBadge(ltvIfMax);

                    return (
                      <div
                        key={pos.id}
                        className="rounded-xl border border-border bg-bg-1 p-4 hover:border-active/40 hover:bg-bg-2/50 transition-all"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-xs font-medium text-foreground leading-snug line-clamp-2 flex-1 min-w-0">
                            {pos.marketLabel}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                pos.side === "YES"
                                  ? "bg-cusp-green/15 text-cusp-green"
                                  : "bg-cusp-red/15 text-cusp-red"
                              }`}
                            >
                              {pos.side}
                            </span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${risk.bg} ${risk.color}`}>
                              Borrow Available
                            </span>
                          </div>
                        </div>

                        {/* Probability bar */}
                        <div className="mb-3">
                          <div className="h-1.5 bg-bg-2 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pos.probability}%`,
                                background: pos.side === "YES" ? "hsl(var(--cusp-green))" : "hsl(var(--cusp-red))",
                              }}
                            />
                          </div>
                        </div>

                        {/* Stats grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Balance</span>
                            <span className="font-mono text-foreground">{pos.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Price</span>
                            <span className="font-mono text-foreground">${pos.currentPrice.toFixed(2)}</span>
                          </div>
                          {pos.entryPrice != null && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Entry</span>
                              <span className="font-mono text-foreground">${pos.entryPrice.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Collateral</span>
                            <span className="font-mono text-foreground">${pos.collateralUsd.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Max LTV</span>
                            <span className="font-mono text-foreground">30%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Max borrow</span>
                            <span className="font-mono font-semibold text-cusp-teal">${pos.maxBorrowUsd.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Liq. price</span>
                            <span className="font-mono text-cusp-red">${pos.liquidationPrice.toFixed(3)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Health (max)</span>
                            <span className={`font-mono font-semibold ${
                              hfIfMax >= 1.5 ? "text-cusp-green" : hfIfMax >= 1.1 ? "text-cusp-amber" : "text-cusp-red"
                            }`}>
                              {hfIfMax >= 10 ? "∞" : hfIfMax.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {isPricesLoading && (
                          <p className="text-[8px] text-muted-foreground/50 mt-2 animate-pulse">Updating prices…</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── E. Active Loans ── */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">
                Active Loans ({activeLoans.length})
              </h3>
              <div className="space-y-3">
                {activeLoans.length === 0 ? (
                  <div className="rounded-xl border border-border bg-bg-1 p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-1">No active loans</p>
                    <p className="text-[11px] text-muted-foreground/70 max-w-md mx-auto">
                      When you borrow against your outcome token collateral, active loans appear here
                      with live health factor and liquidation tracking.
                    </p>
                  </div>
                ) : (
                  activeLoans.map((loan) => <LoanCard key={loan.id} loan={loan} />)
                )}
              </div>

              {(activeCustodyPositions.length > 0
                ? activeCustodyPositions.some((position) => (position.health_factor ?? 2) < 1.1)
                : outcomeLoans.some((l) => (l.health_factor ?? 2) < 1.1)) && (
                <div className="mt-3 p-3 bg-cusp-red/5 border border-cusp-red/20 rounded-md flex items-start gap-2">
                  <AlertTriangle className="size-3 text-cusp-red shrink-0 mt-0.5" />
                  <p className="text-xs text-cusp-red">
                    A loan is near liquidation. Add collateral or repay to avoid loss.
                  </p>
                </div>
              )}
            </div>

            {/* ── Live DFlow Markets (discovery) ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-foreground">Eligible Kalshi Markets</h3>
                <Link
                  to="/markets"
                  className="text-[11px] text-cusp-teal hover:underline font-medium inline-flex items-center gap-0.5"
                >
                  View all <ChevronRight className="size-3" />
                </Link>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Trade on any active market — outcome tokens become borrow-eligible collateral automatically.
              </p>
              {marketsQuery.isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="rounded-lg border border-border bg-bg-1 p-3">
                      <div className="h-4 w-full bg-bg-2 rounded animate-pulse mb-2" />
                      <div className="h-3 w-1/2 bg-bg-2 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : dflowMarkets.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">Could not load markets.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {dflowMarkets.map((m) => (
                    <Link
                      key={m.id}
                      to={`/markets/${encodeURIComponent(m.ticker)}`}
                      className="group rounded-lg border border-border bg-bg-1 p-3 hover:bg-bg-2 hover:border-active/40 transition-all"
                    >
                      <p className="text-[11px] font-medium text-foreground line-clamp-2 leading-snug mb-2 group-hover:text-cusp-teal transition-colors">
                        {m.name}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                        <span className="truncate">{m.category ?? "Market"}</span>
                        <span
                          className={
                            (m.probability ?? 50) >= 60
                              ? "text-cusp-green"
                              : (m.probability ?? 50) <= 40
                                ? "text-cusp-red"
                                : ""
                          }
                        >
                          {Math.round(m.probability ?? 50)}%
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* ── How It Works ── */}
            <div className="bg-bg-1 border border-border rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">How it works</h3>
              <div className="space-y-3">
                {[
                  {
                    title: "50% Max LTV · 35% Safe LTV",
                    desc: "Borrow up to 50% of your outcome token's market value. We recommend around 35% for a safer buffer against price swings.",
                  },
                  {
                    title: "Live price valuation",
                    desc: "Collateral is valued using real-time DFlow market prices. As implied probability changes, so does your borrowing capacity and health factor.",
                  },
                  {
                    title: "Liquidation at 60% LTV",
                    desc: "If market price drops enough that your LTV exceeds 60%, the position can be liquidated. The liquidation price shown is the token price where this happens.",
                  },
                  {
                    title: "Hard expiry",
                    desc: "Loans now carry a 7-day hard expiry by default, limiting stale borrows and forcing periodic rollover or repayment.",
                  },
                ].map((item) => (
                  <div key={item.title} className="p-3 bg-bg-2 rounded-md">
                    <h4 className="text-xs font-medium text-foreground mb-1">{item.title}</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-4">
            <BorrowPanel />

            <MainnetPoolPanel poolState={poolState} />

            {/* Pool Info */}
            <div className="bg-bg-1 border border-border rounded-xl p-4">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Pool Parameters
              </h4>
              <div className="space-y-2">
                {[
                  ["Max LTV", "50%"],
                  ["Safe LTV", "35%"],
                  ["Liquidation threshold", "60% LTV"],
                  ["Borrow APR", `${(poolState?.borrowRateApr ?? 8).toFixed(1)}%`],
                  ["Collateral", "YES/NO SPL tokens"],
                  ["Borrow asset", "USDC"],
                  ["Hard expiry", "7 days"],
                  ["Health < 1.0", "→ Liquidation"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

/* ── Stat cell sub-component ── */

function StatCell({
  icon,
  label,
  value,
  loading,
  iconColor,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading: boolean;
  iconColor: string;
  subtitle?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <span className={iconColor}>{icon}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      {loading ? (
        <div className="h-5 w-16 bg-bg-2 rounded animate-pulse" />
      ) : (
        <div>
          <span className="font-mono text-sm font-semibold text-foreground">{value}</span>
          {subtitle && <span className="text-[8px] text-muted-foreground/60 ml-1">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}

export default LendPage;
