import { motion } from "framer-motion";

const APYBreakdown = () => {
  const sources = [
    { label: "Position Farming", range: "8–12%", value: 10, color: "bg-cusp-amber" },
    { label: "Lending Spread", range: "5–9%", value: 7, color: "bg-cusp-purple" },
    { label: "LP Fees", range: "2–4%", value: 3, color: "bg-cusp-teal" },
  ];

  const total = sources.reduce((s, x) => s + x.value, 0);
  const share = (value: number) => Math.round((value / total) * 100);

  return (
    <div className="space-y-4">
      {/* proportional allocation bar */}
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {sources.map((source, i) => (
          <motion.div
            key={source.label}
            className={`${source.color} h-full rounded-full`}
            initial={{ width: 0 }}
            animate={{ width: `${(source.value / total) * 100}%` }}
            transition={{ duration: 0.8, delay: i * 0.15, ease: "easeOut" }}
          />
        ))}
      </div>

      {/* per-source rows — color, label, range + share */}
      <div className="space-y-2">
        {sources.map((source) => (
          <div key={source.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${source.color}`} />
              <span className="text-xs text-foreground">{source.label}</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-foreground">{source.range}</span>
              <span className="w-9 text-right text-muted-foreground">{share(source.value)}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="text-xs text-muted-foreground">Combined APY</span>
        <span className="font-mono text-lg font-semibold text-cusp-amber">15–25%</span>
      </div>
    </div>
  );
};

export default APYBreakdown;
