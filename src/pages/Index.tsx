import APYBreakdown from "@/components/APYBreakdown";
import Layout from "@/components/Layout";
import ProbabilityBar from "@/components/ProbabilityBar";
import YieldCounter from "@/components/YieldCounter";
import { faqItems } from "@/data/mockData";
import { useDflowMarkets } from "@/hooks/useDflowMarkets";
import { useProtocolState } from "@/hooks/useProtocolState";
import { supabase } from "@/lib/supabase";
import { MarketCardSkeleton } from "@/components/loading/MarketCardSkeleton";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5 } }),
};

const CAPITAL_EFFICIENCY_HEADLINE = "Unlocking capital efficiency for prediction markets on Kalshi.";

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

const Index = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistStatus, setWaitlistStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [waitlistError, setWaitlistError] = useState("");
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);

  const { data: markets = [], isPending: marketsPending } = useDflowMarkets({ status: "active", limit: 50 });
  const { state: protocolState } = useProtocolState();

  useEffect(() => {
    if (!supabase) return;
    supabase.rpc("get_waitlist_count").then(({ data }) => {
      if (data !== null) setWaitlistCount(Number(data));
    });
  }, []);

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail.trim() || !supabase) return;
    setWaitlistStatus("loading");
    setWaitlistError("");
    const { error } = await supabase.from("waitlist").insert({ email: waitlistEmail.trim().toLowerCase() });
    if (error) {
      setWaitlistStatus("error");
      setWaitlistError(error.code === "23505" ? "Already registered." : "Something went wrong.");
      return;
    }
    setWaitlistStatus("success");
    setWaitlistEmail("");
    setWaitlistCount((c) => (c !== null ? c + 1 : 1));
  };

  const topMarkets = useMemo(
    () =>
      [...markets]
        .filter((m) => m.probability >= 70)
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 4),
    [markets]
  );

  const totalVolume = useMemo(() => markets.reduce((sum, m) => sum + m.volume, 0), [markets]);

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cusp-teal/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-bg-1 text-[11px] font-mono text-muted-foreground mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-cusp-teal animate-live-pulse" />
                The DeFi layer for prediction markets
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-foreground leading-[1.1] tracking-tight mb-5">
                Your prediction market positions shouldn't sit idle.
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                Borrow, lend, and leverage your Kalshi positions on Solana. Built on DFlow, secured by regulated event markets — no token, no emissions, real yield.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/vault"
                  className="inline-flex items-center px-6 py-2.5 bg-cusp-teal text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity glow-teal"
                >
                  Launch App
                </Link>
              </div>
              <div className="flex items-center gap-4 mt-8 text-xs text-muted-foreground">
                <span>Built on DFlow</span>
                <span className="w-px h-3 bg-border" />
                <span>Powered by Kalshi</span>
                <span className="w-px h-3 bg-border" />
                <span>Solana Native</span>
              </div>
            </motion.div>

            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2} className="hidden md:block">
              <div className="bg-bg-1 border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Vault APY</span>
                  <span className="text-[10px] font-mono text-cusp-green">● Live</span>
                </div>
                <div className="text-4xl font-mono font-semibold text-cusp-teal mb-6">
                  <YieldCounter value={19.4} suffix="%" decimals={1} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                      TVL (mainnet)
                    </span>
                    <span className="font-mono text-sm text-foreground">
                      ${((protocolState?.mainnet_reserve ?? 0) >= 1_000_000
                        ? `${((protocolState?.mainnet_reserve ?? 0) / 1_000_000).toFixed(1)}M`
                        : (protocolState?.mainnet_reserve ?? 0).toLocaleString())}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Markets</span>
                    <span className="font-mono text-sm text-foreground">150</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">cUSDT Rate</span>
                    <span className="font-mono text-sm text-cusp-teal">${(protocolState?.cusdc_exchange_rate ?? 1).toFixed(4)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Backers */}
      <section className="border-t border-border bg-bg-1/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col items-center justify-center gap-5 sm:flex-row sm:flex-wrap sm:gap-8 lg:-ml-20">
            <span className="shrink-0 text-[18px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
              Backed by
            </span>
            <div className="flex flex-wrap items-center justify-center gap-5 text-2xl text-foreground">
              <a
                href="https://x.com/SuperteamIN"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-bg-1 px-7 py-3 hover:border-cusp-teal/40 transition-colors lg:-ml-4"
              >
                <img
                  src="/superteam-india-logo.jpg"
                  alt="Superteam India"
                  className="w-10 h-10 rounded-full object-cover"
                />
                Superteam India
              </a>
              <div className="inline-flex items-center justify-center gap-5">
                <span className="shrink-0 text-[18px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
                  Built On
                </span>
                <a
                  href="https://dflow.net"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full border border-border/60 bg-bg-1 px-3 py-1 hover:border-cusp-teal/40 transition-colors"
                  aria-label="DFlow"
                >
                  <img
                    src="/dflow-logo.png"
                    alt="DFlow"
                    className="h-14 w-auto object-contain"
                  />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capital efficiency pitch */}
      {/* 3 Pillars: Borrow / Lend / Leverage */}
      <section className="border-t border-border bg-bg-1/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <div className="mb-12">
            <span className="text-[11px] font-mono text-cusp-teal uppercase tracking-[0.2em]">Our Features</span>
          </div>

          {/* Borrow */}
          <PillarRow
            eyebrow="UP TO 50% OF POSITION'S VALUE"
            title="Borrow against your Kalshi shares"
            body="Use your YES/NO outcome tokens as collateral and borrow USDT instantly. Capped interest rates, repay anytime, positions auto-close two hours before resolution so binary risk never touches lenders."
            href="/lend"
            cta="Open Borrow"
            visual={
              <PillarCard>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Collateral → Borrow</span>
                  <span className="text-[10px] font-mono text-cusp-green">Health 2.14</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-bg-2 border border-border rounded-md">
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground">YES · BTC $150K</div>
                      <div className="text-sm font-mono text-foreground">$2,500.00</div>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-cusp-green/10 text-cusp-green">87%</span>
                  </div>
                  <div className="flex items-center justify-center text-muted-foreground">↓</div>
                  <div className="flex items-center justify-between p-3 bg-cusp-teal/5 border border-cusp-teal/30 rounded-md">
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground">Borrowed</div>
                      <div className="text-sm font-mono text-cusp-teal">$1,250.00</div>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">LTV 50%</span>
                  </div>
                </div>
              </PillarCard>
            }
          />

          <section className="relative overflow-hidden">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  "radial-gradient(ellipse 85% 55% at 50% 45%, hsl(var(--cusp-teal) / 0.12), transparent 65%)",
              }}
            />
            <div className="relative mx-auto max-w-5xl px-4 py-32 text-center sm:px-6 md:py-44">
              <motion.h2
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.45 }}
                variants={blurRevealContainer}
                className="mx-auto block max-w-none text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl md:whitespace-nowrap md:text-4xl"
              >
                {CAPITAL_EFFICIENCY_HEADLINE.split(" ").map((word, i) => (
                  <motion.span
                    key={`${i}-${word}`}
                    variants={blurRevealWord}
                    className={`inline-block ${word.startsWith("Kalshi") ? "font-bold" : ""}`}
                    style={word.startsWith("Kalshi") ? { color: "#28cc95" } : undefined}
                  >
                    {word}
                    {i < CAPITAL_EFFICIENCY_HEADLINE.split(" ").length - 1 ? "\u00A0" : ""}
                  </motion.span>
                ))}
              </motion.h2>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.45 }}
                variants={blurRevealUnderline}
                className="mx-auto mt-16 h-px max-w-md origin-center bg-gradient-to-r from-transparent via-cusp-teal/45 to-transparent"
                aria-hidden
              />
            </div>
          </section>

          {/* Lend */}
          <PillarRow
            reverse
            hideTopBorder
            eyebrow="UP TO 25% APY"
            title="Lend to Kalshi traders"
            body="Deposit USDT into the Cusp Vault and earn yield sourced from real borrower interest, high-probability outcome farming, and LP fees on Kalshi markets. No emissions, uncorrelated with crypto."
            href="/vault"
            cta="Open Vault"
            visual={
              <PillarCard>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">APY Breakdown</span>
                  <span className="text-sm font-mono text-cusp-teal font-semibold">19.4%</span>
                </div>
                <APYBreakdown />
              </PillarCard>
            }
          />

          {/* Leverage */}
          <PillarRow
            eyebrow="UP TO 5X"
            title="Leverage your positions"
            body="Loop your collateral in one click to turn an existing Kalshi position into up to 5x exposure with no additional capital. Ideal for high-conviction trades without fresh deposits."
            href="#leverage"
            cta="Beta"
            visual={
              <PillarCard>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Loop preview</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-cusp-teal/10 text-cusp-teal">Beta</span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Initial position", value: "$1,000", accent: false },
                    { label: "Borrow at 50% LTV", value: "$500", accent: false },
                    { label: "Buy more YES", value: "+$500", accent: false },
                    { label: "Net exposure", value: "$1,500", accent: true },
                    { label: "Leverage", value: "1.5x → 5.0x", accent: true },
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
              </PillarCard>
            }
          />
        </div>
      </section>

      {/* Live Markets */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-1">Markets you can collateralize</h2>
            <p className="text-sm text-muted-foreground mb-6">High-probability Kalshi markets tokenized on DFlow</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {marketsPending ? (
              Array.from({ length: 4 }).map((_, i) => <MarketCardSkeleton key={i} shimmer={i < 2} />)
            ) : (
              topMarkets.map((market, i) => {
                const daysLeft = Math.ceil((new Date(market.resolutionDate).getTime() - Date.now()) / 86400000);
                return (
                  <Link key={market.id} to="/markets">
                    <motion.div
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true }}
                      variants={fadeUp}
                      custom={i}
                      className="bg-bg-1 border border-border rounded-lg p-4 hover:bg-bg-2 hover:border-cusp-teal/30 transition-all"
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
              })
            )}
          </div>
          {!marketsPending && topMarkets.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No high-probability markets right now.</p>
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
            {faqItems.map((item, i) => (
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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-6 tracking-tight">A bit about us</h2>
          <div className="space-y-5 text-muted-foreground text-sm sm:text-base leading-relaxed">
            <p>
              Cusp is built by a small team of prediction-market and DeFi researchers. We believe regulated event markets like Kalshi will become one of the largest derivatives categories on earth, and that their most productive form is onchain — composable, non-custodial, and capital efficient.
            </p>
            <p>
              Our goal is to be the financial primitive underneath that future: borrow, lend, and leverage rails that turn every outcome token into a productive asset. We build for advanced traders and funds first; retail follows.
            </p>
            <p className="text-foreground">
              We are hiring founding engineers.{" "}
              <a href="mailto:contact@cusp.fi" className="text-cusp-teal hover:underline">
                Mail us at contact@cusp.fi
              </a>.
            </p>
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section className="border-t border-border bg-bg-1/40" id="waitlist">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-3 tracking-tight">
            Idle capital ends here
          </h2>
          {waitlistCount !== null && (
            <p className="text-xs text-muted-foreground mb-2">
              <span className="font-mono text-cusp-teal font-semibold">{(waitlistCount + 100).toLocaleString()}</span> people on the waitlist
            </p>
          )}
          <p className="text-sm text-muted-foreground mb-6">Early access to Cusp. We'll reach out when you're in.</p>
          {waitlistStatus === "success" ? (
            <p className="text-sm text-cusp-green font-medium">You're in. We'll be in touch.</p>
          ) : (
            <form onSubmit={handleWaitlist} className="flex gap-2 max-w-sm mx-auto">
              <input
                type="email"
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="flex-1 bg-bg-2 border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cusp-teal/50"
                disabled={waitlistStatus === "loading"}
              />
              <button
                type="submit"
                disabled={waitlistStatus === "loading"}
                className="px-5 py-2.5 bg-cusp-teal text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {waitlistStatus === "loading" ? "Joining..." : "Join"}
              </button>
            </form>
          )}
          {waitlistStatus === "error" && (
            <p className="text-xs text-cusp-red mt-2">{waitlistError}</p>
          )}
        </div>
      </section>
    </Layout>
  );
};

const PillarCard = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-bg-1 border border-border rounded-lg p-5 shadow-lg">
    {children}
  </div>
);

interface PillarRowProps {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  disabled?: boolean;
  reverse?: boolean;
  hideTopBorder?: boolean;
  visual: React.ReactNode;
}

const PillarRow = ({ eyebrow, title, body, href, cta, disabled, reverse, hideTopBorder, visual }: PillarRowProps) => (
  <motion.div
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: "-80px" }}
    variants={fadeUp}
    custom={0}
    className={`grid md:grid-cols-2 gap-10 lg:gap-16 items-center py-12 md:py-16 ${
      hideTopBorder ? "" : "border-t border-border first:border-t-0"
    }`}
  >
    <div className={reverse ? "md:order-2" : ""}>
      <span className="text-[11px] font-mono text-cusp-teal uppercase tracking-[0.2em] block mb-4">{eyebrow}</span>
      <h3 className="text-2xl md:text-3xl font-semibold text-foreground leading-tight tracking-tight mb-4">{title}</h3>
      <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-6 max-w-lg">{body}</p>
      {disabled ? (
        <span className="inline-flex items-center px-5 py-2 border border-border text-muted-foreground rounded-md text-sm font-medium cursor-not-allowed">
          {cta}
        </span>
      ) : (
        <Link
          to={href}
          className="inline-flex items-center gap-1.5 px-5 py-2 border border-cusp-teal/40 text-cusp-teal rounded-md text-sm font-medium hover:bg-cusp-teal/5 transition-colors"
        >
          {cta} <span aria-hidden>→</span>
        </Link>
      )}
    </div>
    <div className={reverse ? "md:order-1" : ""}>{visual}</div>
  </motion.div>
);

export default Index;
