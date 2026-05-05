import { Link } from "react-router-dom";
import type { CuspMarket } from "@/lib/dflow-api";
import type { UserPortfolio, Position } from "@/hooks/useUserPortfolio";
import { MAX_PROTOCOL_LEVERAGE } from "@/lib/protocol-constants";
import { ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { LeveragedTradeStatus } from "@/hooks/useLeveragedTrade";

const LEVERAGE_OPTIONS = [1, 2, 3] as const;

function priceToCents(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  return Math.round(price * 100);
}

export interface MarketTradePanelProps {
  market: CuspMarket;
  tradeSide: "YES" | "NO";
  setTradeSide: (s: "YES" | "NO") => void;
  contracts: string;
  setContracts: (v: string) => void;
  leverage: 1 | 2 | 3;
  setLeverage: (l: 1 | 2 | 3) => void;
  displayYesPrice: number;
  displayNoPrice: number;
  currentPrice: number;
  mainnetReserve: number;
  effectiveLeverage: number;
  leverageReduced: boolean;
  amountNum: number;
  estimatedShares: number;
  isValidAmount: boolean;
  isConnected: boolean;
  kycVerified: boolean;
  kycLoading: boolean;
  startVerification: () => void;
  portfolio: UserPortfolio | null | undefined;
  myPositions: Position[];
  successDetails: { side: string; amount: number; ticker: string } | null;
  tradeError: string | null;
  leveragedError: string | null;
  leveragedStatus: LeveragedTradeStatus;
  leveragedResult: { leverage: number; total_usdc: number } | null;
  tradeStatus: "idle" | "loading" | "success" | "error";
  onTrade: () => void;
  onTradeErrorClear: () => void;
  onTradeStatusIdle: () => void;
  className?: string;
}

export function MarketTradePanel({
  market,
  tradeSide,
  setTradeSide,
  contracts,
  setContracts,
  leverage,
  setLeverage,
  displayYesPrice,
  displayNoPrice,
  currentPrice,
  mainnetReserve,
  effectiveLeverage,
  leverageReduced,
  amountNum,
  estimatedShares,
  isValidAmount,
  isConnected,
  kycVerified,
  kycLoading,
  startVerification,
  portfolio,
  myPositions,
  successDetails,
  tradeError,
  leveragedError,
  leveragedStatus,
  leveragedResult,
  tradeStatus,
  onTrade,
  onTradeErrorClear,
  onTradeStatusIdle,
  className = "",
}: MarketTradePanelProps) {
  return (
    <div className={`bg-bg-1 border border-border rounded-xl p-5 sm:p-6 shadow-sm ${className}`}>
      <div className="flex items-start gap-3 mb-4">
        <div
          className="shrink-0 size-9 rounded-md flex items-center justify-center bg-cusp-teal/15 border border-cusp-teal/30"
          aria-hidden
        >
          <span className="text-lg font-bold text-cusp-teal">K</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
            {market.name}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Buy {tradeSide === "YES" ? market.yesLabel || "Yes" : market.noLabel || "No"}
            {tradeSide === "YES" ? (
              <span className="text-cusp-green"> · {priceToCents(displayYesPrice)}¢</span>
            ) : (
              <span className="text-cusp-red"> · {priceToCents(displayNoPrice)}¢</span>
            )}
          </p>
        </div>
      </div>

      {isConnected && (
        <div className="flex items-center justify-end mb-3">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-medium ${
              kycVerified ? "text-cusp-green" : "text-cusp-amber"
            }`}
          >
            {kycVerified ? <ShieldCheck className="size-3" /> : <AlertTriangle className="size-3" />}
            {kycVerified ? "KYC Verified" : "KYC Required"}
          </span>
        </div>
      )}

      {myPositions.length > 0 && (
        <div className="mb-4 space-y-2">
          {myPositions.map((pos) => (
            <div
              key={pos.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                pos.side === "YES"
                  ? "bg-cusp-green/8 border-cusp-green/25"
                  : "bg-cusp-red/8 border-cusp-red/25"
              }`}
            >
              <div
                className={`shrink-0 size-6 rounded-full flex items-center justify-center ${
                  pos.side === "YES" ? "bg-cusp-green/20" : "bg-cusp-red/20"
                }`}
              >
                <CheckCircle2
                  className={`size-4 ${pos.side === "YES" ? "text-cusp-green" : "text-cusp-red"}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-semibold ${
                      pos.side === "YES" ? "text-cusp-green" : "text-cusp-red"
                    }`}
                  >
                    {pos.side}
                  </span>
                  <span className="text-[10px] text-muted-foreground">placed</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ${pos.usdc_cost.toFixed(2)} ·{" "}
                  {pos.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} shares
                </span>
              </div>
              <Link to="/portfolio" className="text-[10px] text-cusp-teal hover:underline shrink-0">
                View
              </Link>
            </div>
          ))}
        </div>
      )}

      {successDetails && (
        <div className="mb-4 px-3 py-3 rounded-lg bg-cusp-green/10 border border-cusp-green/30 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-full bg-cusp-green/20 flex items-center justify-center animate-in zoom-in duration-500">
              <CheckCircle2 className="size-5 text-cusp-green" />
            </div>
            <div>
              <p className="text-xs font-semibold text-cusp-green">Bet Placed Successfully!</p>
              <p className="text-[10px] text-muted-foreground">
                {successDetails.side} · ${successDetails.amount.toFixed(2)} USDT on {successDetails.ticker}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-stretch gap-2 mb-4">
        <div className="flex flex-1 min-w-[140px] gap-1 p-1 bg-bg-2 rounded-lg">
          <span className="flex-1 py-1.5 text-center text-xs font-semibold rounded-md bg-bg-1 text-foreground shadow-sm border border-border/60">
            Buy
          </span>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="flex-1 py-1.5 text-xs font-medium rounded-md text-muted-foreground opacity-50 cursor-not-allowed"
          >
            Sell
          </button>
        </div>
        <div
          className="flex items-center px-3 py-1.5 rounded-lg border border-border bg-bg-2 text-xs font-medium text-muted-foreground shrink-0"
          title="DFlow executes at market; limit orders not supported yet"
        >
          Market
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            setTradeSide("YES");
            onTradeErrorClear();
            onTradeStatusIdle();
          }}
          className={`flex-1 flex flex-col items-center justify-center py-3 rounded-lg text-sm font-semibold transition-all min-w-0 border-2 ${
            tradeSide === "YES"
              ? "border-cusp-green text-cusp-green bg-cusp-green/10 shadow-sm"
              : "border-border bg-bg-2 text-muted-foreground hover:border-cusp-green/40"
          }`}
        >
          <span className="truncate w-full text-center">Yes</span>
          <span className="font-mono text-xs tabular-nums mt-0.5">{priceToCents(displayYesPrice)}¢</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTradeSide("NO");
            onTradeErrorClear();
            onTradeStatusIdle();
          }}
          className={`flex-1 flex flex-col items-center justify-center py-3 rounded-lg text-sm font-semibold transition-all min-w-0 border-2 ${
            tradeSide === "NO"
              ? "border-cusp-red text-cusp-red bg-cusp-red/10 shadow-sm"
              : "border-border bg-bg-2 text-muted-foreground hover:border-cusp-red/40"
          }`}
        >
          <span className="truncate w-full text-center">No</span>
          <span className="font-mono text-xs tabular-nums mt-0.5">{priceToCents(displayNoPrice)}¢</span>
        </button>
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">Contracts</label>
          <div className="relative">
            <input
              type="number"
              placeholder="0"
              min="0"
              step="any"
              value={contracts}
              onChange={(e) => {
                setContracts(e.target.value);
                onTradeErrorClear();
              }}
              className="w-full bg-bg-2 border border-border rounded-lg px-4 py-3 pr-14 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cusp-teal/50 focus:border-cusp-teal/50"
            />
            <button
              type="button"
              onClick={() => setContracts("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-cusp-teal/80 hover:text-cusp-teal"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-bg-2/80 px-3 py-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Market price</span>
            <span className="font-mono font-semibold text-foreground tabular-nums">~{priceToCents(currentPrice)}¢</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Executes immediately at market. Limit orders are not available on DFlow yet.
          </p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">Leverage</label>
          <div className="flex gap-2">
            {LEVERAGE_OPTIONS.filter((n) => n <= MAX_PROTOCOL_LEVERAGE).map((lev) => (
              <button
                key={lev}
                type="button"
                onClick={() => {
                  setLeverage(lev);
                  onTradeErrorClear();
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                  leverage === lev
                    ? "bg-cusp-teal/15 text-cusp-teal border border-cusp-teal/50"
                    : "bg-bg-2 text-muted-foreground border border-transparent hover:border-border"
                }`}
              >
                {lev}x
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            1x is a direct trade. 2x–3x uses borrowed funds from the vault (margin shown below).
          </p>
        </div>

        {leverage > 1 && (
          <div className="space-y-1 rounded-lg border border-border/60 bg-bg-2/50 px-3 py-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Vault lending pool</span>
              <span className={`font-mono ${mainnetReserve > 0 ? "text-cusp-green" : "text-cusp-red"}`}>
                ${mainnetReserve.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            {mainnetReserve <= 0 && (
              <p className="text-[10px] text-cusp-red">Pool empty — deposit to the vault Trading pool or use 1x.</p>
            )}
          </div>
        )}

        {isConnected && portfolio && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Your mainnet USDT</span>
            <button
              type="button"
              onClick={() => {
                if (!currentPrice) return;
                const bal = (portfolio.mainnet_usdt_balance ?? 0) + (portfolio.mainnet_usdc_balance ?? 0);
                const maxContracts =
                  leverage === 1 ? bal / currentPrice : (bal * leverage) / currentPrice;
                if (Number.isFinite(maxContracts) && maxContracts > 0) {
                  setContracts(maxContracts >= 1 ? maxContracts.toFixed(2) : maxContracts.toFixed(4));
                }
                onTradeErrorClear();
              }}
              className="font-mono text-cusp-amber hover:text-cusp-teal transition-colors"
            >
              ${((portfolio.mainnet_usdt_balance ?? 0) + (portfolio.mainnet_usdc_balance ?? 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              <span className="ml-1 text-cusp-teal uppercase">max</span>
            </button>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground border-t border-border pt-3">
          Execution: market order — no expiration or resting order options until supported by DFlow.
        </p>

        {isValidAmount && (
          <div className="rounded-lg bg-bg-2/80 px-3 py-2.5 text-xs space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Est. price</span>
              <span className="text-foreground font-mono">${currentPrice.toFixed(2)}</span>
            </div>
            {leverage > 1 && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Your margin</span>
                  <span className="text-foreground font-mono">${amountNum.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Borrowed from vault</span>
                  <span
                    className={`font-mono ${
                      effectiveLeverage > 1 ? "text-cusp-amber" : "text-muted-foreground"
                    }`}
                  >
                    ${(amountNum * (effectiveLeverage - 1)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Total position</span>
                  <span className="text-foreground font-mono font-semibold">
                    ${(amountNum * effectiveLeverage).toFixed(2)}
                  </span>
                </div>
                {leverageReduced && (
                  <div className="text-[10px] text-cusp-amber mt-1">
                    Leverage reduced to {effectiveLeverage.toFixed(1)}x — vault pool only has $
                    {mainnetReserve.toFixed(2)} available to lend
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Est. shares</span>
              <span className="text-foreground font-mono">
                {estimatedShares.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </div>

      {(tradeError || leveragedError) && (
        <p className="text-xs text-cusp-red mb-3 px-2">{tradeError || leveragedError}</p>
      )}

      {leveragedStatus === "success" && leveragedResult && (
        <p className="text-xs text-cusp-green mb-3 px-2">
          Position opened! {leveragedResult.leverage}x at ${leveragedResult.total_usdc.toFixed(2)}
        </p>
      )}

      {isConnected && !kycVerified ? (
        <button
          type="button"
          onClick={startVerification}
          disabled={kycLoading}
          className="w-full py-3 rounded-lg text-sm font-semibold bg-cusp-teal hover:bg-cusp-teal/90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground transition-all"
        >
          {kycLoading ? "Completing KYC…" : "Complete KYC to Trade"}
        </button>
      ) : (
        <button
          type="button"
          onClick={onTrade}
          disabled={
            !isConnected ||
            tradeStatus === "loading" ||
            leveragedStatus === "lending" ||
            leveragedStatus === "signing" ||
            leveragedStatus === "risk_check" ||
            leveragedStatus === "confirming" ||
            (leverage > 1 && effectiveLeverage <= 1)
          }
          className={`w-full py-3 rounded-lg text-sm font-semibold transition-all ${
            tradeSide === "YES"
              ? "bg-cusp-green hover:bg-cusp-green/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              : "bg-cusp-red hover:bg-cusp-red/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          }`}
        >
          {!isConnected
            ? "Connect Wallet to Trade"
            : tradeStatus === "loading" ||
                leveragedStatus === "lending" ||
                leveragedStatus === "signing" ||
                leveragedStatus === "risk_check" ||
                leveragedStatus === "confirming"
              ? "Processing..."
              : leverage > 1 && effectiveLeverage <= 1
                ? "Insufficient pool liquidity"
                : leverage > 1
                  ? `${effectiveLeverage}x ${tradeSide === "YES" ? market.yesLabel || "YES" : market.noLabel || "NO"}`
                  : `Buy ${tradeSide === "YES" ? market.yesLabel || "YES" : market.noLabel || "NO"}`}
        </button>
      )}

      {!isConnected && (
        <p className="text-[11px] text-muted-foreground mt-3 text-center">
          Prediction market trading requires Proof KYC. Connect wallet to get started.
        </p>
      )}
    </div>
  );
}
