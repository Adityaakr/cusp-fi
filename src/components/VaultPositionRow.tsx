import ProbabilityBar from "./ProbabilityBar";
import { type VaultPosition } from "@/data/mockData";

interface VaultPositionRowProps {
  position: VaultPosition;
}

const VaultPositionRow = ({ position }: VaultPositionRowProps) => {
  const pnlPositive = position.unrealizedPnL >= 0;

  return (
    <div className="flex items-center gap-4 py-3 px-4 bg-bg-1 border border-border rounded-lg hover:bg-bg-2 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-medium text-foreground truncate">{position.marketName}</h4>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${
            position.tokenType === "YES" ? "bg-cusp-green/10 text-cusp-green" : "bg-cusp-red/10 text-cusp-red"
          }`}>
            {position.tokenType}
          </span>
        </div>
        <ProbabilityBar probability={position.probability} size="sm" />
      </div>

      <div className="text-right shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <span className="text-[10px] text-muted-foreground block">Entry</span>
            <span className="font-mono text-xs text-foreground">${position.entryPrice.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Current</span>
            <span className="font-mono text-xs text-foreground">${position.currentPrice.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">PnL</span>
            <span className={`font-mono text-xs ${pnlPositive ? "text-cusp-green" : "text-cusp-red"}`}>
              {pnlPositive ? "+" : ""}${position.unrealizedPnL.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Resolves</span>
            <span className="font-mono text-xs text-muted-foreground">{position.daysToResolution}d</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaultPositionRow;
