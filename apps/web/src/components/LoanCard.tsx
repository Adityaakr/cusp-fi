import HealthGauge from "./HealthGauge";
import CountdownTimer from "./CountdownTimer";
import { OUTCOME_LIQUIDATION_THRESHOLD_BPS } from "@/lib/protocol-constants";
import { type ActiveLoan } from "@/data/mockData";

interface LoanCardProps {
  loan: ActiveLoan & {
    borrowAsset?: string;
    liquidationPrice?: number;
    positionStateLabel?: string | null;
    helperText?: string | null;
  };
  onRepay?: (loanId: string) => void;
}

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 0,
    maximumFractionDigits: value > 0 && value < 10 ? 3 : 2,
  });
}

const LoanCard = ({ loan, onRepay }: LoanCardProps) => {
  const borrowAsset = loan.borrowAsset || "USDC";
  const isBorrowed = loan.borrowedAmount > 0;
  const liquidationThreshold = OUTCOME_LIQUIDATION_THRESHOLD_BPS / 10_000;

  // Estimate liquidation price from LTV and collateral
  // liqPrice ≈ collateralValue × (ltv/100) / (collateralValue / currentImpliedPrice) × (1 / liqThreshold)
  // Simplified: if LTV is 30% and liq threshold 40%, liq price ≈ currentPrice × (LTV/liqThreshold)
  const liqPrice = loan.liquidationPrice ?? (
    loan.collateralValue > 0 && loan.borrowedAmount > 0
      ? (loan.borrowedAmount / (loan.collateralValue * liquidationThreshold)) * (loan.collateralValue / (loan.collateralValue / 0.60))
      : 0
  );

  return (
    <div className="bg-bg-1 border border-border rounded-lg p-4 hover:bg-bg-2 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-foreground truncate">{loan.marketName}</h4>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${
              loan.tokenType === "YES" ? "bg-cusp-green/10 text-cusp-green" : "bg-cusp-red/10 text-cusp-red"
            }`}>
              {loan.tokenType}
            </span>
            {loan.positionStateLabel ? (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-cusp-purple/10 text-cusp-purple border-cusp-purple/20">
                {loan.positionStateLabel}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Resolves in</span>
            <CountdownTimer targetDate={loan.resolutionDate} />
          </div>
        </div>
        {isBorrowed ? (
          <HealthGauge healthFactor={loan.healthFactor} size={64} />
        ) : (
          <div className="text-right">
            <span className="font-mono text-sm font-semibold text-cusp-green">N/A</span>
            <span className="block text-[10px] text-muted-foreground uppercase tracking-wider">Health</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-border">
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Collateral</span>
          <span className="font-mono text-sm text-foreground">${formatUsd(loan.collateralValue)}</span>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Borrowed</span>
          <span className="font-mono text-sm text-cusp-purple">
            ${formatUsd(loan.borrowedAmount)} <span className="text-[9px] text-muted-foreground">{borrowAsset}</span>
          </span>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">LTV</span>
          <span className="font-mono text-sm text-foreground">{loan.ltv}%</span>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Liq. Price</span>
          <span className="font-mono text-sm text-cusp-red">
            {isBorrowed && liqPrice > 0 ? `$${liqPrice.toFixed(3)}` : "—"}
          </span>
        </div>
      </div>

      {loan.helperText ? (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[11px] text-muted-foreground">{loan.helperText}</p>
        </div>
      ) : null}

      {onRepay && (
        <div className="mt-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={() => onRepay(loan.id)}
            className="w-full py-2 text-xs font-semibold text-cusp-teal bg-cusp-teal/10 border border-cusp-teal/20 rounded-md hover:bg-cusp-teal/20 transition-colors"
          >
            Repay Loan
          </button>
        </div>
      )}
    </div>
  );
};

export default LoanCard;
