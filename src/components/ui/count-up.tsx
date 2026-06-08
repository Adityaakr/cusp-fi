import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect } from "react";

/**
 * Animates a number rolling up to `value` (odometer feel). Renders the value
 * formatted with thousands separators. Honors reduced-motion (snaps to value).
 */
export const CountUp = ({
  value,
  duration = 1.2,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) => {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return controls.stop;
  }, [value, duration, reduce, mv]);

  return <motion.span className={className}>{text}</motion.span>;
};

export default CountUp;
