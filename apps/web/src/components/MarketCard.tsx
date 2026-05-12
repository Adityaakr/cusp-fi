import ProbabilityBar from "./ProbabilityBar";
import CountdownTimer from "./CountdownTimer";
import type { CuspMarket } from "@/lib/dflow-api";

interface MarketCardProps {
  market: CuspMarket & { vaultExposure?: boolean };
  onClick?: () => void;
}

const MarketCard = ({ market, onClick }: MarketCardProps) => {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick?.()}
      className="bg-bg-1 border border-border rounded-lg p-4 hover:bg-bg-2 transition-colors group cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-sm font-medium text-foreground leading-snug flex-1">{market.name}</h3>
        {market.vaultExposure && (
          <span className="text-[10px] font-mono bg-cusp-teal/10 text-cusp-teal px-1.5 py-0.5 rounded-sm shrink-0">
            VAULT
          </span>
        )}
      </div>

      <ProbabilityBar probability={market.probability} size="sm" />

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider truncate block">
            {market.yesLabel || "YES"}
          </span>
          <p className="font-mono text-sm text-cusp-green">${market.yesPrice.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider truncate block">
            {market.noLabel || "NO"}
          </span>
          <p className="font-mono text-sm text-cusp-red">${market.noPrice.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Volume</span>
          <p className="font-mono text-sm text-foreground">
            {market.volume >= 1_000_000 ? `$${(market.volume / 1_000_000).toFixed(1)}M` : `$${(market.volume / 1_000).toFixed(1)}K`}
          </p>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Resolves</span>
          <CountdownTimer targetDate={market.resolutionDate} />
        </div>
      </div>

      {market.estimatedYield > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Est. Yield</span>
            <span className="font-mono text-sm text-cusp-amber">{market.estimatedYield.toFixed(1)}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketCard;
