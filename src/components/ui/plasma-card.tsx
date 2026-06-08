import PlasmaBackdrop from "@/components/PlasmaBackdrop";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";

/**
 * Card shell with a real plasma interior on hover (the hero's WebGL plasma,
 * mounted only while hovered so we never exceed the browser's GL-context cap),
 * fading in over a faint resting CSS glow, plus a cursor-tracked spotlight.
 */
export const PlasmaCard = ({
  children,
  className,
  persistent = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Keep the real plasma always on (not just on hover). */
  persistent?: boolean;
}) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    ref.current.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  };

  const showPlasma = persistent || (hovered && !reduce);
  const plasmaOpacity = persistent
    ? hovered
      ? "opacity-[0.7]"
      : "opacity-[0.55]"
    : hovered
      ? "opacity-[0.55]"
      : "opacity-0";

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{ "--mx": "50%", "--my": "50%" } as React.CSSProperties}
      className="group relative h-full overflow-hidden rounded-xl border border-border bg-bg-1 transition-[border-color,box-shadow] duration-300 hover:border-cusp-teal/40 hover:shadow-[0_0_44px_-10px_hsl(var(--cusp-teal)/0.35)]"
    >
      {/* real WebGL plasma — always on when persistent, else on hover */}
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 transition-opacity duration-500", plasmaOpacity)}
      >
        {showPlasma && <PlasmaBackdrop />}
      </div>
      {/* faint resting CSS glow (only needed when plasma isn't persistent) */}
      {!persistent && (
        <div
          aria-hidden
          className={cn(
            "plasma-fill pointer-events-none absolute inset-0 opacity-[0.1] transition-opacity duration-500 group-hover:opacity-25",
            reduce && "!animate-none",
          )}
        />
      )}
      {/* cursor spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(220px circle at var(--mx) var(--my), hsl(var(--cusp-teal) / 0.18), transparent 60%)",
        }}
      />
      <div className={cn("relative z-10", className)}>{children}</div>
    </div>
  );
};

export default PlasmaCard;
