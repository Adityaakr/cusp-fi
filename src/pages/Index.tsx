import APYBreakdown from "@/components/APYBreakdown";
import Layout from "@/components/Layout";
import PlasmaBackdrop from "@/components/PlasmaBackdrop";
import ProbabilityBar from "@/components/ProbabilityBar";
import WaitlistCapture from "@/components/WaitlistCapture";
import { faqItems } from "@/data/mockData";
import { useWaitlistSignup } from "@/hooks/useWaitlistSignup";
import { useDflowMarkets } from "@/hooks/useDflowMarkets";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useMemo, useRef, useState } from "react";
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

/** Pointer-driven 3D tilt + scroll-reveal wrapper for cards. */
const Tilt = ({
  children,
  className,
  custom = 0,
  max = 9,
}: {
  children: React.ReactNode;
  className?: string;
  custom?: number;
  max?: number;
}) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [max, -max]), { stiffness: 150, damping: 18 });
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), { stiffness: 150, damping: 18 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const onLeave = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <div style={{ perspective: 900 }}>
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={fadeUp}
        custom={custom}
        style={reduce ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={className}
      >
        {children}
      </motion.div>
    </div>
  );
};

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

const Index = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const waitlist = useWaitlistSignup();

  const { data: markets = [] } = useDflowMarkets({ status: "active", limit: 50 });

  const topMarkets = useMemo(
    () =>
      [...markets]
        .filter((m) => m.probability >= 70)
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 4),
    [markets]
  );

  return (
    <Layout>
      {/* Hero — immersive plasma backdrop */}
      <section className="relative flex min-h-[88vh] items-center justify-center overflow-hidden bg-background dark:bg-black">
        <PlasmaBackdrop />
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
          className="relative z-10 mx-auto max-w-3xl px-4 py-28 text-center sm:px-6"
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
            Capital markets for event-driven positions.
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
              to="/vault"
              className="glow-teal inline-flex items-center rounded-md bg-cusp-teal px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Launch App
            </Link>
            <Link
              to="/waitlist"
              className="inline-flex items-center rounded-md border border-cusp-teal/40 bg-bg-0/40 px-6 py-2.5 text-sm font-medium text-cusp-teal backdrop-blur-sm transition-colors hover:bg-cusp-teal/5"
            >
              Join the waitlist
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Supported structures */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20">
          <div className="mb-10 max-w-2xl">
            <span className="text-[11px] font-mono text-cusp-teal uppercase tracking-[0.2em] block mb-3">Collateral support</span>
            <h2 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight mb-3">
              Built for every payoff structure
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              How a claim pays out decides how Cusp values and finances it.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {SUPPORTED_STRUCTURES.map((s, i) => (
              <Tilt
                key={s.key}
                custom={i}
                className="flex h-full flex-col rounded-lg border border-border bg-bg-1 p-4 transition-colors hover:border-cusp-teal/40"
              >
                <div className="mb-4 flex h-6 items-center" style={{ transform: "translateZ(28px)" }}>
                  <StructureGlyph kind={s.key} />
                </div>
                <div className="mb-1.5 text-sm font-semibold text-foreground" style={{ transform: "translateZ(18px)" }}>{s.name}</div>
                <p className="text-xs leading-relaxed text-muted-foreground" style={{ transform: "translateZ(12px)" }}>{s.desc}</p>
              </Tilt>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="border-t border-border bg-bg-1/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20">
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

      {/* Principle interstitial */}
      <section className="relative overflow-hidden border-t border-border">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 85% 55% at 50% 45%, hsl(var(--cusp-teal) / 0.12), transparent 65%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 py-24 text-center sm:px-6 md:py-32">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.45 }}
            variants={blurRevealContainer}
            className="mx-auto block max-w-3xl text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl"
          >
            {PRINCIPLE_LINE.split(" ").map((word, i) => (
              <motion.span key={`${i}-${word}`} variants={blurRevealWord} className="inline-block">
                {word}
                {i < PRINCIPLE_LINE.split(" ").length - 1 ? " " : ""}
              </motion.span>
            ))}
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

      {/* Live Markets */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-1">Markets you can collateralize</h2>
            <p className="text-sm text-muted-foreground mb-6">Live prediction markets you can collateralize</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {topMarkets.map((market, i) => {
              const daysLeft = Math.ceil((new Date(market.resolutionDate).getTime() - Date.now()) / 86400000);
              return (
                <Link key={market.id} to="/markets">
                  <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp}
                    custom={i}
                    whileHover={{ y: -6, scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    className="bg-bg-1 border border-border rounded-lg p-4 hover:bg-bg-2 hover:border-cusp-teal/40 hover:shadow-xl hover:shadow-cusp-teal/5 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-cusp-green/10 text-cusp-green">
                        YES
                      </span>
                      <span className="font-mono text-xs text-cusp-teal">
                        {market.estimatedYield > 0 ? `${market.estimatedYield.toFixed(1)}% yield` : ""}
                      </span>
                    </div>
                    <h4 className="text-sm text-foreground mb-2 leading-snug">{market.name}</h4>
                    <ProbabilityBar probability={market.probability} size="sm" />
                    <div className="flex justify-between mt-2">
                      <span className="font-mono text-xs text-muted-foreground">${market.yesPrice.toFixed(2)}</span>
                      <span className="font-mono text-xs text-muted-foreground">{daysLeft}d left</span>
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>
          {topMarkets.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Loading markets...</p>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-bg-1/40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
          <div className="mb-10 text-center">
            <span className="text-[11px] font-mono text-cusp-teal uppercase tracking-[0.2em] block mb-3">Frequently Asked Questions</span>
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">Everything you wanted to know</h2>
          </div>
          <div className="space-y-2">
            {faqItems.slice(0, 5).map((item, i) => (
              <div key={i} className="bg-bg-1 border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-bg-2 transition-colors"
                >
                  <span className="text-sm text-foreground pr-4 font-medium">{item.q}</span>
                  <span className="text-muted-foreground text-lg shrink-0">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="border-t border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <p className="text-lg sm:text-xl text-foreground leading-snug font-medium tracking-tight">
            Prediction markets move billions a year. The positions just sit there.
          </p>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
            Cusp is the capital market that turns them into productive collateral: priced for how they really behave, financed without putting depositors at risk, and verifiable end to end.
          </p>
          <p className="mt-4 text-sm text-foreground">
            We are hiring founding engineers.{" "}
            <a href="mailto:contact@cusp.fi" className="text-cusp-teal hover:underline">
              Mail us at contact@cusp.fi
            </a>
            .
          </p>
        </div>
      </section>

      {/* Waitlist */}
      <section className="border-t border-border bg-bg-1/40" id="waitlist">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
          <WaitlistCapture
            waitlist={waitlist}
            title="Get early access"
            description="Cusp is in private alpha. We'll reach out when you're in."
            className="text-center"
          />
          <div className="mt-4">
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

const CapabilityCard = ({ eyebrow, title, body, href, cta, visual, index = 0 }: CapabilityCardProps & { index?: number }) => (
  <Tilt custom={index} max={7} className="flex h-full flex-col rounded-lg border border-border bg-bg-1 p-5 transition-colors hover:border-cusp-teal/40">
    <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-cusp-teal" style={{ transform: "translateZ(30px)" }}>{eyebrow}</span>
    <h3 className="mb-2 text-xl font-semibold tracking-tight text-foreground" style={{ transform: "translateZ(24px)" }}>{title}</h3>
    <p className="mb-5 text-sm leading-relaxed text-muted-foreground" style={{ transform: "translateZ(16px)" }}>{body}</p>
    <div className="mb-5 mt-auto rounded-md border border-border/60 bg-bg-2/50 p-4 shadow-lg" style={{ transform: "translateZ(40px)" }}>{visual}</div>
    <Link
      to={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-cusp-teal transition-all hover:gap-2.5"
      style={{ transform: "translateZ(20px)" }}
    >
      {cta} <span aria-hidden>→</span>
    </Link>
  </Tilt>
);

export default Index;
