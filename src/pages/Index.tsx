import APYBreakdown from "@/components/APYBreakdown";
import HowItWorks from "@/components/HowItWorks";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import PlasmaBackdrop from "@/components/PlasmaBackdrop";
import WaitlistCapture from "@/components/WaitlistCapture";
import PlasmaCard from "@/components/ui/plasma-card";
import { faqItems } from "@/data/mockData";
import { useWaitlistSignup } from "@/hooks/useWaitlistSignup";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowRight, ChevronDown, Gauge, Hourglass } from "lucide-react";
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5 } }),
};

const PRINCIPLE_LINE = "Solvency is arranged in advance, not recovered later.";

/** Staggered words: heavy blur → sharp, slight rise for depth */
const blurRevealContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.06,
    },
  },
};

const blurRevealWord = {
  hidden: {
    opacity: 0,
    filter: "blur(16px)",
    y: 14,
  },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: {
      duration: 0.72,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const blurRevealUnderline = {
  hidden: { opacity: 0, scaleX: 0.3, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    scaleX: 1,
    filter: "blur(0px)",
    transition: {
      delay: 0.35,
      duration: 0.75,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const PROBLEMS = [
  {
    key: "risk",
    Icon: AlertTriangle,
    title: "Risk that's mispriced",
    desc: "A claim at $0.90 isn't 90% safe — one headline can gap it to zero. Financed like spot collateral, the loan is underwater before anyone can react.",
  },
  {
    key: "liquidation",
    Icon: Gauge,
    title: "Liquidations that can't clear",
    desc: "Thin, event-driven books often have no bid to liquidate into. Forced unwinds slip badly or stall, and the loss lands on depositors.",
  },
  {
    key: "settlement",
    Icon: Hourglass,
    title: "Settlement that lags the outcome",
    desc: "A market resolves, but cash arrives days later over venue-specific rails. Capital sits frozen between “decided” and “paid.”",
  },
];

const SUPPORTED_STRUCTURES = [
  { key: "binary", name: "Binary", desc: "One outcome pays, the other goes to zero." },
  { key: "categorical", name: "Categorical", desc: "Several outcomes, exactly one pays." },
  { key: "ladder", name: "Strike ladder", desc: "Yes/no markets across price levels." },
  { key: "scalar", name: "Scalar", desc: "Settles proportionally across a range." },
  { key: "conditional", name: "Conditional", desc: "An active claim with a refund branch." },
];

const StructureGlyph = ({ kind }: { kind: string }) => {
  const base = "hsl(var(--cusp-teal))";
  const muted = "hsl(var(--border))";
  switch (kind) {
    case "binary":
      return (
        <svg width="56" height="22" viewBox="0 0 56 22" fill="none" aria-hidden>
          <rect x="0" y="6" width="26" height="10" rx="3" fill={base} />
          <rect x="30" y="6" width="26" height="10" rx="3" fill={muted} />
        </svg>
      );
    case "categorical":
      return (
        <svg width="56" height="22" viewBox="0 0 56 22" fill="none" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={i * 14.5} y="6" width="11" height="10" rx="3" fill={i === 1 ? base : muted} />
          ))}
        </svg>
      );
    case "ladder":
      return (
        <svg width="56" height="22" viewBox="0 0 56 22" fill="none" aria-hidden>
          {[6, 11, 16, 21].map((h, i) => (
            <rect key={i} x={i * 14.5} y={22 - h} width="11" height={h} rx="2" fill={base} opacity={0.45 + i * 0.18} />
          ))}
        </svg>
      );
    case "scalar":
      return (
        <svg width="56" height="22" viewBox="0 0 56 22" fill="none" aria-hidden>
          <defs>
            <linearGradient id="scalarGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={muted} />
              <stop offset="100%" stopColor={base} />
            </linearGradient>
          </defs>
          <rect x="0" y="8" width="56" height="6" rx="3" fill="url(#scalarGrad)" />
          <circle cx="38" cy="11" r="5" fill={base} stroke="hsl(var(--bg-1))" strokeWidth="2" />
        </svg>
      );
    case "conditional":
      return (
        <svg width="56" height="22" viewBox="0 0 56 22" fill="none" aria-hidden>
          <circle cx="6" cy="11" r="4" fill={base} />
          <path d="M10 11 H28 M28 11 L44 4 M28 11 L44 18" stroke={base} strokeWidth="2" fill="none" opacity="0.7" />
          <circle cx="48" cy="4" r="3.5" fill={base} />
          <circle cx="48" cy="18" r="3.5" fill={muted} />
        </svg>
      );
    default:
      return null;
  }
};

/** Enlarged payoff curve for the collateral-coverage explorer panel. */
const PayoffCurve = ({ kind }: { kind: string }) => {
  const teal = "hsl(var(--cusp-teal))";
  const muted = "hsl(var(--border))";
  const line = {
    fill: "none",
    stroke: teal,
    strokeWidth: 3,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  };
  return (
    <svg viewBox="0 0 240 130" className="h-full w-full" aria-hidden>
      {/* axes */}
      <line x1="20" y1="14" x2="20" y2="110" stroke={muted} strokeWidth="1.5" />
      <line x1="20" y1="110" x2="226" y2="110" stroke={muted} strokeWidth="1.5" />
      {kind === "binary" && <path d="M30 102 H120 V28 H216" {...line} />}
      {kind === "scalar" && <path d="M30 102 L216 26" {...line} />}
      {kind === "ladder" && <path d="M30 102 H74 V80 H118 V54 H162 V30 H216" {...line} />}
      {kind === "categorical" &&
        [
          { x: 36, h: 24 },
          { x: 84, h: 76 },
          { x: 132, h: 34 },
          { x: 180, h: 20 },
        ].map((b, i) => (
          <rect key={i} x={b.x} y={110 - b.h} width="26" height={b.h} rx="3" fill={b.h > 60 ? teal : muted} />
        ))}
      {kind === "conditional" && (
        <>
          <path d="M30 80 L112 80" {...line} />
          <path d="M112 80 L216 30" {...line} />
          <path d="M112 80 L216 92" fill="none" stroke={muted} strokeWidth="3" strokeDasharray="6 6" strokeLinecap="round" />
          <circle cx="112" cy="80" r="4.5" fill={teal} />
        </>
      )}
    </svg>
  );
};

const Index = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeStruct, setActiveStruct] = useState(0);
  const waitlist = useWaitlistSignup();

  return (
    <Layout fullBleed>
      <SEO path="/" />
      {/* Hero — immersive plasma backdrop, full-bleed behind the navbar */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background dark:bg-black">
        <PlasmaBackdrop interactive />
        {/* texture + legibility scrim over the plasma */}
        <div className="cusp-hero-grid pointer-events-none absolute inset-0 opacity-30" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 55% at 50% 47%, hsl(var(--background) / 0.62), transparent 75%)," +
              "linear-gradient(to bottom, transparent 94%, hsl(var(--background)) 100%)",
          }}
        />

        <motion.div
          initial="hidden"
          animate="visible"
          variants={blurRevealContainer}
          className="relative z-10 mx-auto max-w-3xl px-4 pb-28 pt-36 text-center sm:px-6"
        >
          <motion.div
            variants={fadeUp}
            custom={0}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-bg-1/70 px-3 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cusp-teal animate-live-pulse" />
            The capital markets layer for prediction markets
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl"
            style={{ textShadow: "0 2px 20px hsl(var(--background) / 0.85), 0 0 40px hsl(var(--background) / 0.5)" }}
          >
            Capital markets layer for event-driven positions.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            style={{ textShadow: "0 1px 16px hsl(var(--background) / 0.8)" }}
          >
            Borrow against live positions, earn on idle capital, and get paid the moment a market resolves.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/waitlist"
              className="group glow-teal inline-flex items-center gap-2 rounded-full bg-cusp-teal px-7 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-cusp-teal/25 ring-1 ring-inset ring-white/15 transition-all hover:bg-cusp-teal/90 hover:shadow-xl hover:shadow-cusp-teal/35"
            >
              Join the waitlist
              <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </Link>
            <a
              href="https://docs.cusp.fi"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-bg-0/40 px-6 py-3 text-sm font-medium text-foreground backdrop-blur-md transition-colors hover:border-cusp-teal/40 hover:text-cusp-teal"
            >
              Docs
              <span aria-hidden className="text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-cusp-teal">→</span>
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* Problem — why event-driven assets break credit */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
            className="mb-12 max-w-2xl"
          >
            <span className="text-[11px] font-mono text-cusp-teal uppercase tracking-[0.2em] block mb-3">The problem</span>
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight mb-3">
              Event-driven positions don't behave like normal collateral.
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Prediction-market claims jump, gap, and expire. The rails to lend against them safely don't exist yet.
            </p>
          </motion.div>
          <div className="grid gap-3 md:grid-cols-3">
            {PROBLEMS.map(({ key, Icon, title, desc }, i) => (
              <motion.div
                key={key}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={fadeUp}
                custom={i}
                className="h-full"
              >
                <PlasmaCard className="flex h-full flex-col p-6">
                  <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-cusp-teal/30 bg-cusp-teal/10 text-cusp-teal">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold tracking-tight text-foreground">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </PlasmaCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Principle interstitial — the thesis that answers the problem */}
      <section className="relative overflow-hidden border-t border-border">
        {/* contained plasma accent — feathered so it reads as a glow, not a panel */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,black,transparent_72%)]"
        >
          <PlasmaBackdrop />
        </div>
        <div className="relative z-10 mx-auto max-w-5xl px-4 py-24 text-center sm:px-6 md:py-32">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.45 }}
            variants={blurRevealContainer}
            className="mx-auto block text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl"
          >
            {(() => {
              const words = PRINCIPLE_LINE.split(" ");
              // keep the last two words as one atomic token so a wrap never
              // orphans the final word onto its own line
              const tokens = [...words.slice(0, -2), words.slice(-2).join(" ")];
              return tokens.map((token, i, arr) => (
                <Fragment key={`${i}-${token}`}>
                  <motion.span variants={blurRevealWord} className="inline-block">
                    {token}
                  </motion.span>
                  {i < arr.length - 1 ? " " : null}
                </Fragment>
              ));
            })()}
          </motion.h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.45 }}
            variants={blurRevealUnderline}
            className="mx-auto mt-12 h-px max-w-md origin-center bg-gradient-to-r from-transparent via-cusp-teal/45 to-transparent"
            aria-hidden
          />
        </div>
      </section>

      {/* How it works — animated step carousel */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <div className="mb-12 max-w-2xl">
            <span className="text-[11px] font-mono text-cusp-teal uppercase tracking-[0.2em] block mb-3">How it works</span>
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
              From idle position to settled cash, in four moves.
            </h2>
          </div>
          <HowItWorks />
        </div>
      </section>

      {/* Capabilities — plasma-filled (alternating rhythm) */}
      <section className="relative overflow-hidden border-t border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_86%,transparent)]"
        >
          <PlasmaBackdrop />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20">
          <div className="mb-10">
            <span className="text-[11px] font-mono text-cusp-teal uppercase tracking-[0.2em]">What you can do</span>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <CapabilityCard
              index={0}
              eyebrow="Controlled credit"
              title="Borrow"
              body="Borrow against eligible live positions on short, repriced terms."
              href="/lend"
              cta="Open Borrow"
              visual={
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-3 bg-bg-2 border border-border rounded-md">
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground">Position collateral</div>
                      <div className="text-sm font-mono text-foreground">$2,500.00</div>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-cusp-green/10 text-cusp-green">87%</span>
                  </div>
                  <div className="flex items-center justify-center text-muted-foreground">↓</div>
                  <div className="flex items-center justify-between p-3 bg-cusp-teal/5 border border-cusp-teal/30 rounded-md">
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground">Borrowed USDC</div>
                      <div className="text-sm font-mono text-cusp-teal">$1,250.00</div>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">LTV 50%</span>
                  </div>
                </div>
              }
            />
            <CapabilityCard
              index={1}
              eyebrow="Tranched vaults"
              title="Earn"
              body="Senior capital earns steadier income; junior takes first loss for the levered residual. Idle balances earn from the first block."
              href="/vault"
              cta="Open Vault"
              visual={
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">APY sources</span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Illustrative</span>
                  </div>
                  <APYBreakdown />
                </div>
              }
            />
            <CapabilityCard
              index={2}
              eyebrow="Instant Redeem"
              title="Get paid early"
              body="Turn a resolved winning claim into cash immediately, before the venue settles."
              href="/portfolio"
              cta="View Portfolio"
              visual={
                <div className="space-y-2">
                  {[
                    { label: "Resolved claim", value: "$1,000", accent: false },
                    { label: "Discount", value: "−1.5%", accent: false },
                    { label: "You receive now", value: "$985", accent: true },
                    { label: "Venue settles", value: "Later", accent: false },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className={`flex items-center justify-between p-2.5 rounded-md border ${row.accent ? "bg-cusp-teal/5 border-cusp-teal/30" : "bg-bg-2 border-border"}`}
                    >
                      <span className="text-xs text-muted-foreground">{row.label}</span>
                      <span className={`text-xs font-mono ${row.accent ? "text-cusp-teal font-semibold" : "text-foreground"}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              }
            />
          </div>
        </div>
      </section>

      {/* Supported structures — collateral coverage detail */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20">
          <div className="mb-10 max-w-2xl">
            <span className="text-[11px] font-mono text-cusp-teal uppercase tracking-[0.2em] block mb-3">Collateral coverage</span>
            <h2 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight mb-3">
              Every payoff structure, priced for how it behaves.
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              How a claim pays out decides how Cusp values and finances it.
            </p>
          </div>
          <div className="grid items-start gap-8 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-12">
            {/* selectable list */}
            <div className="flex flex-col">
              {SUPPORTED_STRUCTURES.map((s, i) => {
                const active = activeStruct === i;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onMouseEnter={() => setActiveStruct(i)}
                    onClick={() => setActiveStruct(i)}
                    className={`group flex items-center justify-between gap-4 border-b py-4 text-left transition-colors ${
                      active ? "border-cusp-teal/40" : "border-border hover:border-cusp-teal/25"
                    }`}
                  >
                    <span className="flex items-center gap-3.5">
                      <span className={`font-mono text-xs transition-colors ${active ? "text-cusp-teal" : "text-muted-foreground/50"}`}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className={`text-lg font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}>
                        {s.name}
                      </span>
                    </span>
                    <ArrowRight
                      className={`size-4 transition-all ${
                        active
                          ? "translate-x-0 text-cusp-teal opacity-100"
                          : "-translate-x-1 text-muted-foreground/40 opacity-0 group-hover:opacity-60"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* preview panel — pulled up into the heading's whitespace on desktop */}
            <div className="md:-mt-24 lg:-mt-32">
            <PlasmaCard persistent className="px-6 pb-6 pt-4 sm:px-8 sm:pb-8 sm:pt-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={SUPPORTED_STRUCTURES[activeStruct].key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="mb-6 h-44 w-full rounded-lg border border-border/60 bg-bg-2/40 p-4">
                    <PayoffCurve kind={SUPPORTED_STRUCTURES[activeStruct].key} />
                  </div>
                  <div className="mb-3 flex items-center gap-3">
                    <StructureGlyph kind={SUPPORTED_STRUCTURES[activeStruct].key} />
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Payoff
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">
                    {SUPPORTED_STRUCTURES[activeStruct].name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {SUPPORTED_STRUCTURES[activeStruct].desc}
                  </p>
                </motion.div>
              </AnimatePresence>
            </PlasmaCard>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — plasma-filled (alternating rhythm) */}
      <section className="relative overflow-hidden border-t border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_86%,transparent)]"
        >
          <PlasmaBackdrop />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-20">
          <div className="mb-10 text-center">
            <span className="text-[11px] font-mono text-cusp-teal uppercase tracking-[0.2em] block mb-3">Frequently Asked Questions</span>
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">Everything you wanted to know</h2>
          </div>
          <div className="space-y-2.5">
            {faqItems.slice(0, 5).map((item, i) => {
              const open = openFaq === i;
              return (
                <div
                  key={i}
                  className={`overflow-hidden rounded-xl border bg-bg-1 transition-colors ${
                    open ? "border-cusp-teal/40" : "border-border hover:border-cusp-teal/30"
                  }`}
                >
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-bg-2/50"
                  >
                    <span className="text-sm font-medium text-foreground">{item.q}</span>
                    <ChevronDown
                      className={`size-4 shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180 text-cusp-teal" : ""}`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <span className="mb-5 block font-mono text-[11px] uppercase tracking-[0.2em] text-cusp-teal">Why we're building Cusp</span>
          <p className="text-2xl font-semibold leading-snug tracking-tight text-foreground sm:text-3xl">
            Prediction markets move billions a month.
          </p>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Cusp is the capital market that turns them into productive collateral: priced for how they really behave, financed without putting depositors at risk, and verifiable end to end.
          </p>
          <div className="mx-auto mt-8 h-px max-w-xs bg-gradient-to-r from-transparent via-cusp-teal/40 to-transparent" />
          <div className="mt-8 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-border bg-bg-1 px-5 py-2.5 text-sm">
            <span className="text-muted-foreground">We're hiring founding engineers.</span>
            <a href="mailto:contact@cusp.fi" className="font-medium text-cusp-teal transition-colors hover:text-cusp-teal/80">
              contact@cusp.fi →
            </a>
          </div>
        </div>
      </section>

      {/* Waitlist — plasma field, type on top (no container) */}
      <section className="relative overflow-hidden border-t border-border" id="waitlist">
        {/* full plasma field, faded into the page at the seams */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(to_bottom,transparent,black_16%,black_84%,transparent)]"
        >
          <PlasmaBackdrop interactive />
        </div>
        {/* legibility scrim */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 55% 60% at 50% 50%, hsl(var(--background) / 0.55), transparent 75%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-3xl px-4 py-28 text-center sm:px-6 sm:py-36">
          <span className="mb-5 block font-mono text-[11px] uppercase tracking-[0.22em] text-cusp-teal">
            Private alpha
          </span>
          <h2
            className="text-5xl font-semibold leading-[1.02] tracking-tight text-foreground sm:text-6xl md:text-7xl"
            style={{ textShadow: "0 2px 24px hsl(var(--background) / 0.85), 0 0 48px hsl(var(--background) / 0.5)" }}
          >
            Get early access
          </h2>
          <p
            className="mx-auto mt-6 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg"
            style={{ textShadow: "0 1px 16px hsl(var(--background) / 0.8)" }}
          >
            The capital layer for prediction markets. We'll reach out when you're in.
          </p>
          <div className="mx-auto mt-10 max-w-md">
            <WaitlistCapture waitlist={waitlist} variant="editorial" />
          </div>
          <div className="mt-8">
            <Link to="/waitlist" className="text-sm text-cusp-teal transition-colors hover:text-cusp-teal/80">
              Want the full overview? Visit the waitlist page →
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

interface CapabilityCardProps {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  visual: React.ReactNode;
}

const CapabilityCard = ({ eyebrow, title, body, cta, visual, index = 0 }: CapabilityCardProps & { index?: number }) => (
  <motion.div
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: "-60px" }}
    variants={fadeUp}
    custom={index}
    className="h-full"
  >
    <PlasmaCard className="flex h-full flex-col p-5">
      <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-cusp-teal">{eyebrow}</span>
      <h3 className="mb-2 text-xl font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="mb-5 mt-auto rounded-md border border-border/60 bg-bg-2/50 p-4 shadow-lg">{visual}</div>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-cusp-teal">
        {cta} <span aria-hidden>→</span>
      </span>
    </PlasmaCard>
  </motion.div>
);

export default Index;
