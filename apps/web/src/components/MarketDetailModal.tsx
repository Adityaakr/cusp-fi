import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ProbabilityBar from "./ProbabilityBar";
import CountdownTimer from "./CountdownTimer";
import type { CuspMarket } from "@/lib/dflow-api";

interface MarketDetailModalProps {
  market: CuspMarket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MarketDetailModal = ({ market, open, onOpenChange }: MarketDetailModalProps) => {
  if (!market) return null;

  const daysLeft = Math.ceil(
    (new Date(market.resolutionDate).getTime() - Date.now()) / 86400000
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-bg-2 border-border">
        <DialogHeader>
          <DialogTitle className="text-base font-medium text-foreground pr-8">
            {market.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-bg-1 text-muted-foreground">
                {market.ticker}
              </span>
              <span className="text-[10px] text-muted-foreground">{market.category}</span>
            </div>
            <ProbabilityBar probability={market.probability} size="md" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-bg-1 rounded-lg p-4 border border-border">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                YES
              </span>
              <p className="font-mono text-lg text-cusp-green">${market.yesPrice.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Buy YES to profit if outcome occurs
              </p>
            </div>
            <div className="bg-bg-1 rounded-lg p-4 border border-border">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                NO
              </span>
              <p className="font-mono text-lg text-cusp-red">${market.noPrice.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Buy NO to profit if outcome does not occur
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Volume
              </span>
              <p className="font-mono text-foreground">
                {market.volume >= 1_000_000
                  ? `$${(market.volume / 1_000_000).toFixed(1)}M`
                  : `$${(market.volume / 1_000).toFixed(1)}K`}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Resolves
              </span>
              <CountdownTimer targetDate={market.resolutionDate} />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Days to resolution
              </span>
              <p className="font-mono text-foreground">{daysLeft} days</p>
            </div>
            {market.estimatedYield > 0 && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  Est. Yield (YES)
                </span>
                <p className="font-mono text-cusp-amber">{market.estimatedYield.toFixed(1)}%</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">
              Trading powered by DFlow. Connect your wallet to buy or sell outcome tokens.
            </p>
            <a
              href="https://pond.dflow.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cusp-teal hover:underline"
            >
              Learn more about DFlow →
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MarketDetailModal;
