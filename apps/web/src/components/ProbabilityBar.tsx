import { motion } from "framer-motion";

interface ProbabilityBarProps {
  probability: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const ProbabilityBar = ({ probability, size = "md", showLabel = true }: ProbabilityBarProps) => {
  const height = size === "sm" ? "h-1.5" : size === "md" ? "h-2.5" : "h-3.5";
  
  const getColor = (p: number) => {
    if (p >= 80) return "from-cusp-teal to-cusp-teal";
    if (p >= 60) return "from-cusp-teal to-cusp-teal";
    if (p >= 40) return "from-amber-500 to-yellow-400";
    if (p >= 20) return "from-orange-500 to-amber-400";
    return "from-red-500 to-orange-400";
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <div className={`flex-1 rounded-full bg-muted overflow-hidden ${height}`}>
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${getColor(probability)}`}
          initial={{ width: 0 }}
          animate={{ width: `${probability}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      {showLabel && (
        <span className="font-mono text-xs text-muted-foreground min-w-[3ch] text-right">
          {probability}%
        </span>
      )}
    </div>
  );
};

export default ProbabilityBar;
