import { motion } from "framer-motion";

interface HealthGaugeProps {
  healthFactor: number;
  size?: number;
}

const HealthGauge = ({ healthFactor, size = 80 }: HealthGaugeProps) => {
  const getColor = (hf: number) => {
    if (hf >= 1.5) return "#10B981";
    if (hf >= 1.1) return "#F59E0B";
    return "#EF4444";
  };

  const color = getColor(healthFactor);
  const normalized = Math.min(healthFactor / 2, 1);
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - normalized);
  const isLow = healthFactor < 1.1;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative ${isLow ? "animate-pulse-red" : ""}`} style={{ width: size, height: size / 2 + 10 }}>
        <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
          <path
            d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <motion.path
            d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-0">
          <span className="font-mono text-sm font-semibold" style={{ color }}>
            {healthFactor.toFixed(2)}
          </span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Health</span>
    </div>
  );
};

export default HealthGauge;
