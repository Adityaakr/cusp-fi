import { motion } from "framer-motion";

const APYBreakdown = () => {
  const sources = [
    { label: "Position Farming", range: "8–12%", value: 10, color: "bg-cusp-teal" },
    { label: "Lending Spread", range: "5–9%", value: 7, color: "bg-cusp-teal" },
    { label: "LP Fees", range: "2–4%", value: 3, color: "bg-cusp-teal" },
  ];

  const total = sources.reduce((s, x) => s + x.value, 0);

  return (
    <div className="space-y-4">
      <div className="flex h-8 rounded-md overflow-hidden">
        {sources.map((source, i) => (
          <motion.div
            key={source.label}
            className={`${source.color} relative group`}
            initial={{ width: 0 }}
            animate={{ width: `${(source.value / total) * 100}%` }}
            transition={{ duration: 0.8, delay: i * 0.15, ease: "easeOut" }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-mono text-primary-foreground font-semibold opacity-80">
                {source.range}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        {sources.map((source) => (
          <div key={source.label} className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${source.color}`} />
            <div>
              <span className="text-xs text-muted-foreground">{source.label}</span>
              <span className="font-mono text-xs text-foreground ml-1.5">{source.range}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end pt-2 border-t border-border">
        <span className="text-xs text-muted-foreground mr-2">Combined APY</span>
        <span className="font-mono text-lg font-semibold text-cusp-amber">15–25%</span>
      </div>
    </div>
  );
};

export default APYBreakdown;
