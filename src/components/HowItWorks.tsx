import PlasmaCard from "@/components/ui/plasma-card";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Coins, Layers, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useState } from "react";

type Step = {
  title: string;
  description: string;
  Icon: typeof Coins;
  visual: React.ReactNode;
};

const row = (label: string, value: string, accent = false) => (
  <div
    className={`flex items-center justify-between rounded-md border p-2.5 ${
      accent ? "border-cusp-teal/30 bg-cusp-teal/5" : "border-border bg-bg-2/60"
    }`}
  >
    <span className="text-[11px] text-muted-foreground">{label}</span>
    <span className={`font-mono text-xs ${accent ? "font-semibold text-cusp-teal" : "text-foreground"}`}>{value}</span>
  </div>
);

const STEPS: Step[] = [
  {
    title: "Deposit & earn",
    description:
      "Liquidity providers supply USDC into tranched vaults. Idle capital earns from the first block, while senior and junior tranches choose their own risk.",
    Icon: Coins,
    visual: (
      <div className="w-full space-y-2.5">
        {row("Vault deposit", "$50,000")}
        {row("Senior APY", "8.4%")}
        {row("Junior APY", "21.6%", true)}
      </div>
    ),
  },
  {
    title: "Borrow against positions",
    description:
      "Traders post eligible event-driven positions as collateral and draw USDC on short, repriced terms — capital that used to sit frozen now works.",
    Icon: Layers,
    visual: (
      <div className="w-full space-y-2.5">
        {row("Position collateral", "$2,500")}
        {row("Borrowed USDC", "$1,250", true)}
        {row("LTV", "50%")}
      </div>
    ),
  },
  {
    title: "Solvency arranged up front",
    description:
      "Pricing and tranching absorb gaps before they happen. Risk is provisioned in advance, not recovered after a position blows through its collateral.",
    Icon: ShieldCheck,
    visual: (
      <div className="w-full space-y-2.5">
        {row("Gap buffer", "Pre-funded")}
        {row("First-loss tranche", "Junior")}
        {row("Depositor risk", "Ring-fenced", true)}
      </div>
    ),
  },
  {
    title: "Instant settlement",
    description:
      "When a market resolves, winning claims pay out immediately — at a small discount — instead of waiting days for the venue to settle.",
    Icon: Zap,
    visual: (
      <div className="w-full space-y-2.5">
        {row("Resolved claim", "$1,000")}
        {row("Discount", "−1.5%")}
        {row("You receive now", "$985", true)}
      </div>
    ),
  },
];

// deterministic small tilt per index — keeps the back-stack lively but stable
const TILTS = [-6, 5, -4, 6];

const HowItWorks = () => {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  const next = () => setActive((p) => (p + 1) % STEPS.length);
  const prev = () => setActive((p) => (p - 1 + STEPS.length) % STEPS.length);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [reduce]);

  const step = STEPS[active];

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16">
      {/* Left — stacked visual panels (isolate: keep card z-index local) */}
      <div className="relative isolate h-72 w-full sm:h-80">
        <AnimatePresence>
          {STEPS.map((s, i) => {
            const isActive = i === active;
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, scale: 0.92, rotate: reduce ? 0 : TILTS[i] }}
                animate={{
                  opacity: isActive ? 1 : 0.4,
                  scale: isActive ? 1 : 0.93,
                  rotate: isActive ? 0 : reduce ? 0 : TILTS[i],
                  zIndex: isActive ? 40 : STEPS.length - i,
                  y: isActive && !reduce ? [0, -14, 0] : 0,
                }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                <PlasmaCard persistent={isActive} className="relative flex h-full flex-col p-6 sm:p-7">
                  {/* ghosted step numeral */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute right-4 top-2 select-none font-mono text-7xl font-bold leading-none text-cusp-teal/[0.08]"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="relative flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-cusp-teal/30 bg-cusp-teal/10 text-cusp-teal">
                      <s.Icon className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Step {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h4 className="relative mt-5 text-lg font-semibold tracking-tight text-foreground">{s.title}</h4>
                  <div className="relative mt-auto pt-6">
                    <span className="mb-2.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                      Illustrative
                    </span>
                    {s.visual}
                  </div>
                </PlasmaCard>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Right — rotating copy + controls */}
      <div className="flex flex-col">
        <span className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-cusp-teal">
          Step {String(active + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
        </span>
        <motion.div
          key={active}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <h3 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{step.title}</h3>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            {step.description.split(" ").map((word, i) => (
              <motion.span
                key={`${active}-${i}`}
                initial={reduce ? false : { filter: "blur(8px)", opacity: 0, y: 4 }}
                animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut", delay: 0.015 * i }}
                className="inline-block"
              >
                {word}&nbsp;
              </motion.span>
            ))}
          </p>
        </motion.div>

        <div className="mt-10 flex items-center gap-4">
          <button
            onClick={prev}
            aria-label="Previous step"
            className="group/btn flex h-10 w-10 items-center justify-center rounded-full border border-border bg-bg-1 text-foreground transition-colors hover:border-cusp-teal/40 hover:text-cusp-teal"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover/btn:-translate-x-0.5" />
          </button>
          <button
            onClick={next}
            aria-label="Next step"
            className="group/btn flex h-10 w-10 items-center justify-center rounded-full border border-border bg-bg-1 text-foreground transition-colors hover:border-cusp-teal/40 hover:text-cusp-teal"
          >
            <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
          </button>

          <div className="ml-2 flex items-center gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                onClick={() => setActive(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === active ? "w-6 bg-cusp-teal" : "w-1.5 bg-border hover:bg-cusp-teal/40"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
