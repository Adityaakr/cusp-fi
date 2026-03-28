import { useEffect, useState, useRef } from "react";

interface YieldCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  duration?: number;
}

const YieldCounter = ({ value, prefix = "", suffix = "", decimals = 1, className = "", duration = 1500 }: YieldCounterProps) => {
  const [display, setDisplay] = useState(0);
  const startTime = useRef<number>(0);
  const animFrame = useRef<number>(0);

  useEffect(() => {
    startTime.current = Date.now();
    const start = display;
    const diff = value - start;

    const animate = () => {
      const elapsed = Date.now() - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + diff * eased);
      if (progress < 1) {
        animFrame.current = requestAnimationFrame(animate);
      }
    };

    animFrame.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame.current);
  }, [value, duration]);

  return (
    <span className={`font-mono ${className}`}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
};

export default YieldCounter;
