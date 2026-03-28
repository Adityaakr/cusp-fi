import { useState } from "react";
import ProbabilityBar from "./ProbabilityBar";

const mockPositions = [
  { id: "1", market: "BTC above $150K by March 2026", type: "YES" as const, price: 0.87, probability: 87, maxBorrow: 7134 },
  { id: "2", market: "ETH flips BNB in daily volume", type: "YES" as const, price: 0.91, probability: 91, maxBorrow: 3906 },
  { id: "3", market: "Fed cuts rates in Q1 2026", type: "NO" as const, price: 0.28, probability: 28, maxBorrow: 1120 },
];

const BorrowPanel = () => {
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [borrowAmount, setBorrowAmount] = useState("");

  const selected = mockPositions.find(p => p.id === selectedPosition);
  const numBorrow = parseFloat(borrowAmount) || 0;
  const ltv = selected ? Math.min((numBorrow / selected.maxBorrow) * 82, 82) : 0;
  const healthFactor = ltv > 0 ? (82 / ltv).toFixed(2) : "—";

  return (
    <div className="bg-bg-1 border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-medium text-foreground mb-1">Borrow USDC</h3>
        <p className="text-xs text-muted-foreground">Select a position to use as collateral</p>
      </div>

      <div className="p-4 space-y-3">
        {mockPositions.map((pos) => (
          <button
            key={pos.id}
            onClick={() => setSelectedPosition(pos.id)}
            className={`w-full text-left p-3 rounded-md border transition-all ${
              selectedPosition === pos.id
                ? "border-active bg-bg-2"
                : "border-border bg-bg-1 hover:bg-bg-2"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-foreground truncate flex-1">{pos.market}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm ml-2 ${
                pos.type === "YES" ? "bg-cusp-green/10 text-cusp-green" : "bg-cusp-red/10 text-cusp-red"
              }`}>
                {pos.type}
              </span>
            </div>
            <ProbabilityBar probability={pos.probability} size="sm" />
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-muted-foreground">Max borrow</span>
              <span className="font-mono text-[10px] text-foreground">${pos.maxBorrow.toLocaleString()}</span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="p-4 border-t border-border space-y-4">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Borrow Amount</label>
            <div className="relative">
              <input
                type="number"
                value={borrowAmount}
                onChange={(e) => setBorrowAmount(e.target.value)}
                placeholder="0.00"
                max={selected.maxBorrow}
                className="w-full bg-bg-2 border border-border rounded-md px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-active transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">USDC</span>
            </div>
          </div>

          {numBorrow > 0 && (
            <div className="space-y-2 p-3 bg-bg-2 rounded-md">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">LTV</span>
                <span className="font-mono text-foreground">{ltv.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Health Factor</span>
                <span className={`font-mono ${parseFloat(healthFactor) >= 1.5 ? "text-cusp-green" : parseFloat(healthFactor) >= 1.1 ? "text-cusp-amber" : "text-cusp-red"}`}>
                  {healthFactor}
                </span>
              </div>
            </div>
          )}

          <button
            disabled={numBorrow <= 0 || numBorrow > selected.maxBorrow}
            className="w-full py-2.5 bg-cusp-purple text-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Borrow USDC
          </button>
        </div>
      )}
    </div>
  );
};

export default BorrowPanel;
