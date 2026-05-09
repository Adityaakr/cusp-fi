import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { usePhantom } from "@/lib/wallet";
import { useUserPortfolio } from "@/hooks/useUserPortfolio";
import { useOutcomeTokenHoldings } from "@/hooks/useOutcomeTokenHoldings";
import { useBorrowPanelRows, type BorrowPanelRow } from "@/hooks/useBorrowPanelRows";
import { useLendingPool } from "@/hooks/useLendingPool";
import { useCreateOutcomeLoan } from "@/hooks/useCreateOutcomeLoan";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

function riskLabel(ltv: number): { text: string; color: string } {
  if (ltv <= 0) return { text: "—", color: "text-muted-foreground" };
  if (ltv <= 20) return { text: "Safe", color: "text-cusp-green" };
  if (ltv <= 25) return { text: "Moderate", color: "text-cusp-amber" };
  if (ltv < 40) return { text: "Risky", color: "text-cusp-red" };
  return { text: "Liquidatable", color: "text-cusp-red font-bold" };
}

function healthFactorColor(hf: number): string {
  if (hf >= 1.5) return "text-cusp-green";
  if (hf >= 1.1) return "text-cusp-amber";
  return "text-cusp-red";
}

const MAX_LTV = 0.30;
const LIQUIDATION_LTV = 0.40;

const BorrowPanel = () => {
  const { isConnected, addresses } = usePhantom();
  const wallet =
    addresses?.find((a) => String(a.addressType || "").toLowerCase().includes("solana"))?.address ?? null;

  const { data: portfolio, isLoading: portfolioLoading } = useUserPortfolio();
  const { data: holdings = [], isLoading: holdingsLoading } = useOutcomeTokenHoldings(portfolio ?? undefined);
  const { rows, isPricesLoading } = useBorrowPanelRows(portfolio ?? undefined, holdings);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [borrowAmount, setBorrowAmount] = useState("");
  const { data: poolState } = useLendingPool(wallet);
  const { createLoan, status: loanStatus, error: loanError, reset: resetLoan } = useCreateOutcomeLoan();

  const selected = rows.find((p) => p.id === selectedId);
  const numBorrow = parseFloat(borrowAmount) || 0;

  // LTV, health factor, liquidation price calculations
  const ltvPct = useMemo(() => {
    if (!selected || selected.collateralUsd <= 0 || numBorrow <= 0) return 0;
    return Math.min((numBorrow / selected.collateralUsd) * 100, 100);
  }, [selected, numBorrow]);

  const healthFactor = useMemo(() => {
    if (numBorrow <= 0 || !selected || selected.collateralUsd <= 0) return Infinity;
    return (selected.collateralUsd * LIQUIDATION_LTV) / numBorrow;
  }, [selected, numBorrow]);

  const liquidationPriceForBorrow = useMemo(() => {
    if (!selected || numBorrow <= 0 || selected.quantity <= 0) return 0;
    // Price where (quantity × price × LIQUIDATION_LTV) = borrowAmount
    return numBorrow / (selected.quantity * LIQUIDATION_LTV);
  }, [selected, numBorrow]);

  const risk = riskLabel(ltvPct);

  const loading = portfolioLoading || holdingsLoading;
  const canBorrow =
    numBorrow > 0 &&
    selected &&
    numBorrow <= selected.maxBorrowUsd &&
    loanStatus !== "creating" &&
    (poolState?.availableLiquidity ?? 0) >= numBorrow;

  const handleBorrow = async () => {
    if (!selected || !wallet || !canBorrow) return;
    resetLoan();
    await createLoan({
      walletAddress: wallet,
      marketTicker: selected.ticker ?? "unknown",
      side: selected.side,
      outcomeMint: selected.outcomeMint,
      tokenQuantity: selected.quantity,
      tokenDecimals: selected.decimals,
      tokenProgram: selected.tokenProgram,
      currentPrice: selected.currentPrice,
      collateralValueUsdc: selected.collateralUsd,
      borrowAmountUsdc: numBorrow,
      maxLtvBps: MAX_LTV * 10000,
      liquidationThresholdBps: LIQUIDATION_LTV * 10000,
      poolPublicKey: poolState?.poolPublicKey || "",
    });
    setBorrowAmount("");
  };

  return (
    <div className="bg-bg-1 border border-border rounded-lg overflow-hidden">
      {/* Header + toggle */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium text-foreground">Borrow Quote</h3>
          <span className="px-2.5 py-1 text-[10px] font-semibold rounded-[5px] bg-cusp-teal text-primary-foreground shadow-sm">
            USDC
          </span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[65%]">
            Select a position below, enter borrow amount. Max <span className="font-mono text-foreground">30% LTV</span>.
          </p>
          {isConnected && portfolio && (
            <div className="text-[10px] text-right">
              <span className="text-muted-foreground block mb-0.5">Wallet Balance</span>
              <span className="font-mono text-foreground font-medium">
                {portfolio.unified_usdc_balance.toFixed(2)} USDC
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Position list */}
      <div className="p-4 space-y-2 max-h-[280px] overflow-y-auto">
        {!isConnected && (
          <p className="text-xs text-muted-foreground text-center py-4">Connect your wallet to see positions.</p>
        )}

        {isConnected && loading && (
          <p className="text-xs text-muted-foreground text-center py-4">Scanning wallet for outcome tokens…</p>
        )}

        {isConnected && !loading && rows.length === 0 && (
          <div className="text-center py-4 space-y-2">
            <p className="text-xs text-muted-foreground">No outcome tokens detected.</p>
            <p className="text-[10px] text-muted-foreground/70">
              Trade first to create collateral.
            </p>
            <Link
              to="/markets"
              className="inline-block text-xs font-medium text-cusp-teal hover:underline pt-1"
            >
              Browse DFlow markets →
            </Link>
          </div>
        )}

        {isConnected && rows.map((pos) => (
          <PositionRow
            key={pos.id}
            pos={pos}
            isSelected={selectedId === pos.id}
            onSelect={() => { setSelectedId(pos.id); setBorrowAmount(""); resetLoan(); }}
            isPricesLoading={isPricesLoading}
          />
        ))}
      </div>

      {/* Borrow quote section */}
      {selected && (
        <div className="p-4 border-t border-border space-y-3">
          {/* Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Borrow amount
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setBorrowAmount(selected.safeBorrowUsd.toFixed(2))}
                  className="text-[9px] font-mono text-cusp-green hover:underline"
                  title="Safe borrow (20% LTV)"
                >
                  SAFE
                </button>
                <button
                  type="button"
                  onClick={() => setBorrowAmount(selected.maxBorrowUsd.toFixed(2))}
                  className="text-[9px] font-mono text-cusp-amber hover:underline"
                  title="Max borrow (30% LTV)"
                >
                  MAX
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                type="number"
                value={borrowAmount}
                onChange={(e) => { setBorrowAmount(e.target.value); resetLoan(); }}
                placeholder="0.00"
                step="0.01"
                className="w-full bg-bg-2 border border-border rounded-md px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-active transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                USDC
              </span>
            </div>
          </div>

          {/* Quote details */}
          {numBorrow > 0 && (
            <div className="space-y-2 p-3 bg-bg-2 rounded-md text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Collateral</span>
                <span className="font-mono text-foreground">
                  {selected.quantity.toFixed(2)} {selected.side} @ ${selected.currentPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Collateral value</span>
                <span className="font-mono text-foreground">${selected.collateralUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Borrow asset</span>
                <span className="font-mono text-foreground">USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max borrow</span>
                <span className="font-mono text-foreground">${selected.maxBorrowUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Suggested safe</span>
                <span className="font-mono text-cusp-green">${selected.safeBorrowUsd.toFixed(2)}</span>
              </div>

              <div className="border-t border-border/50 pt-2 mt-2 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current LTV</span>
                  <span className={`font-mono font-semibold ${risk.color}`}>
                    {ltvPct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Liquidation price</span>
                  <span className="font-mono text-cusp-red">
                    ${liquidationPriceForBorrow.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Health factor</span>
                  <span className={`font-mono font-semibold ${healthFactorColor(healthFactor)}`}>
                    {healthFactor >= 10 ? "∞" : healthFactor.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Risk</span>
                  <span className={`font-semibold ${risk.color}`}>{risk.text}</span>
                </div>
              </div>
            </div>
          )}

          {/* Pool availability check */}
          {numBorrow > 0 && (poolState?.availableLiquidity ?? 0) < numBorrow && (
            <div className="flex items-start gap-1.5 p-2 bg-cusp-amber/5 border border-cusp-amber/20 rounded-md">
              <AlertCircle className="size-3 text-cusp-amber shrink-0 mt-0.5" />
              <p className="text-[10px] text-cusp-amber leading-relaxed">
                Pool has ${(poolState?.availableLiquidity ?? 0).toFixed(2)} USDC available.
                Reduce borrow amount.
              </p>
            </div>
          )}

          {!poolState?.poolPublicKey && (
            <div className="flex items-start gap-1.5 p-2 bg-cusp-red/5 border border-cusp-red/20 rounded-md">
              <AlertCircle className="size-3 text-cusp-red shrink-0 mt-0.5" />
              <p className="text-[10px] text-cusp-red leading-relaxed">
                Mainnet pool wallet is not configured yet.
              </p>
            </div>
          )}

          {/* Status messages */}
          {loanStatus === "creating" && (
            <div className="flex items-center gap-2 text-xs text-cusp-teal">
              <Loader2 className="size-3 animate-spin" />
              Locking collateral and creating loan…
            </div>
          )}
          {loanStatus === "success" && (
            <div className="flex items-center gap-2 text-xs text-cusp-green">
              <CheckCircle className="size-3" />
              Borrow opened. Check Active Loans.
            </div>
          )}
          {loanError && (
            <div className="flex items-start gap-1.5 text-xs text-cusp-red">
              <AlertCircle className="size-3 shrink-0 mt-0.5" />
              <span>{loanError}</span>
            </div>
          )}

          {/* Borrow button */}
          <button
            type="button"
            disabled={!canBorrow}
            onClick={handleBorrow}
            className="w-full py-2.5 bg-cusp-teal text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loanStatus === "creating"
              ? "Processing…"
              : numBorrow > (selected?.maxBorrowUsd ?? 0)
                ? "Exceeds 30% LTV"
                : "Borrow USDC"}
          </button>
        </div>
      )}
    </div>
  );
};

/* ── Position row sub-component ── */

function PositionRow({
  pos,
  isSelected,
  onSelect,
  isPricesLoading,
}: {
  pos: BorrowPanelRow;
  isSelected: boolean;
  onSelect: () => void;
  isPricesLoading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-md border transition-all ${
        isSelected ? "border-cusp-teal/60 bg-bg-2 shadow-sm" : "border-border bg-bg-1 hover:bg-bg-2"
      }`}
    >
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="text-xs text-foreground truncate flex-1 min-w-0">{pos.marketLabel}</span>
        <span
          className={`shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
            pos.side === "YES" ? "bg-cusp-green/15 text-cusp-green" : "bg-cusp-red/15 text-cusp-red"
          }`}
        >
          {pos.side}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1 mt-1.5 text-[10px]">
        <div>
          <span className="text-muted-foreground block">Balance</span>
          <span className="font-mono text-foreground">{pos.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Price</span>
          <span className="font-mono text-foreground">${pos.currentPrice.toFixed(2)}</span>
          {isPricesLoading && <span className="text-[8px] text-muted-foreground/50 ml-0.5">…</span>}
        </div>
        <div>
          <span className="text-muted-foreground block">Max borrow</span>
          <span className="font-mono text-cusp-teal font-semibold">${pos.maxBorrowUsd.toFixed(2)}</span>
        </div>
      </div>

      {pos.entryPrice != null && (
        <div className="mt-1 text-[9px] text-muted-foreground/70">
          Entry: ${pos.entryPrice.toFixed(2)}
        </div>
      )}

      {isSelected && (
        <div className="mt-2 pt-2 border-t border-border/40 grid grid-cols-2 gap-1 text-[9px]">
          <div>
            <span className="text-muted-foreground block">Collateral</span>
            <span className="font-mono text-foreground">${pos.collateralUsd.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Liq. price</span>
            <span className="font-mono text-cusp-red">${pos.liquidationPrice.toFixed(3)}</span>
          </div>
        </div>
      )}
    </button>
  );
}

export default BorrowPanel;
