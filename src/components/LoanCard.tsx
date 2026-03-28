import HealthGauge from "./HealthGauge";
import CountdownTimer from "./CountdownTimer";
import { type ActiveLoan } from "@/data/mockData";

interface LoanCardProps {
  loan: ActiveLoan;
}

const LoanCard = ({ loan }: LoanCardProps) => {
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
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Resolves in</span>
            <CountdownTimer targetDate={loan.resolutionDate} />
          </div>
        </div>
        <HealthGauge healthFactor={loan.healthFactor} size={64} />
      </div>

      <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border">
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Collateral</span>
          <span className="font-mono text-sm text-foreground">${loan.collateralValue.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Borrowed</span>
          <span className="font-mono text-sm text-cusp-purple">${loan.borrowedAmount.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">LTV</span>
          <span className="font-mono text-sm text-foreground">{loan.ltv}%</span>
        </div>
      </div>
    </div>
  );
};

export default LoanCard;
