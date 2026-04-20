import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import YieldCounter from "@/components/YieldCounter";
import ProbabilityBar from "@/components/ProbabilityBar";
import APYBreakdown from "@/components/APYBreakdown";
import { faqItems } from "@/data/mockData";
import { useDflowMarkets } from "@/hooks/useDflowMarkets";
import { useProtocolState } from "@/hooks/useProtocolState";
import { supabase } from "@/lib/supabase";
import { useState, useMemo, useEffect } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

const Index = () => {
  const [activeTab, setActiveTab] = useState<"vault" | "lend">("vault");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistStatus, setWaitlistStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [waitlistError, setWaitlistError] = useState("");
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);

  const { data: markets = [] } = useDflowMarkets({ status: "active", limit: 50 });
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
        <div className="absolute inset-0 bg-gradient-to-b from-cusp-teal/3 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-foreground leading-tight tracking-tight mb-4">
                Your prediction market positions shouldn't sit idle.
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                Cusp turns YES/NO outcome tokens into yield-bearing assets. Deposit USDC, earn 15–25% APY. Or borrow against your positions without closing them.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/vault"
                  className="inline-flex items-center px-6 py-2.5 bg-cusp-teal text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity glow-teal"
                >
                  Deposit USDC → Earn Yield
                </Link>
                <Link
                  to="/lend"
                  className="inline-flex items-center px-6 py-2.5 border border-cusp-teal/40 text-cusp-teal rounded-md text-sm font-medium hover:bg-cusp-teal/5 transition-colors"
                >
                  Borrow Against Positions
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
                <div className="text-4xl font-mono font-semibold text-cusp-amber mb-6">
                  <YieldCounter value={15.5} suffix="%" decimals={1} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">TVL</span>
                    <span className="font-mono text-sm text-foreground">
                      ${((protocolState?.total_tvl ?? 0) >= 1_000_000
                        ? `${((protocolState?.total_tvl ?? 0) / 1_000_000).toFixed(1)}M`
                        : (protocolState?.total_tvl ?? 0).toLocaleString())}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Markets</span>
                    <span className="font-mono text-sm text-foreground">150</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">cUSDC Rate</span>
                    <span className="font-mono text-sm text-cusp-teal">${(protocolState?.cusdc_exchange_rate ?? 1).toFixed(4)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Live Markets Preview */}
      <section className="border-t border-border bg-bg-1/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-xl font-semibold text-foreground mb-1">Top DFlow Markets</h2>
            <p className="text-sm text-muted-foreground mb-6">High-probability active markets on DFlow</p>
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
                    className="bg-bg-1 border border-border rounded-lg p-4 hover:bg-bg-2 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-cusp-green/10 text-cusp-green">
                        YES
                      </span>
                      <span className="font-mono text-xs text-cusp-amber">
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

      {/* How It Works */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-xl font-semibold text-foreground mb-6">How It Works</h2>

          <div className="flex gap-1 mb-6">
            {(["vault", "lend"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2 text-sm rounded-md transition-colors ${
                  activeTab === t ? "bg-bg-2 text-cusp-teal border border-active" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "vault" ? "Cusp Vault" : "Cusp Lend"}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {activeTab === "vault" ? (
              <>
                <Step n={1} title="Deposit USDC" desc="Connect your wallet and deposit USDC into the vault. You receive vsUSDC representing your share." />
                <Step n={2} title="Vault farms positions" desc="The vault buys high-probability YES/NO tokens (>85%), earns lending spread income, and collects LP fees across markets." />
                <Step n={3} title="Withdraw anytime" desc="Redeem vsUSDC for USDC plus earned yield. Withdrawals process through a 48-hour queue for vault stability." />
              </>
            ) : (
              <>
                <Step n={1} title="Connect wallet" desc="Connect your Solana wallet. Cusp auto-detects your YES/NO outcome tokens from DFlow positions." />
                <Step n={2} title="Lock collateral" desc="Select outcome tokens to use as collateral. LTV is dynamically calculated based on probability and time to resolution." />
                <Step n={3} title="Borrow USDC" desc="Borrow USDC instantly against your locked tokens. Repay before resolution — all loans auto-close 2 hours before expiry." />
              </>
            )}
          </div>
        </div>
      </section>

      {/* Yield Breakdown */}
      <section className="border-t border-border bg-bg-1/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Where the yield comes from</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Three real sources of income stack to produce 15–25% APY. No token emissions. No Ponzi mechanics. Real yield from real prediction market activity.
              </p>
              <APYBreakdown />
            </div>

            <div className="bg-bg-1 border border-border rounded-lg overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-medium text-foreground">Holding idle vs. Cusp Vault</h3>
              </div>
              <div className="divide-y divide-border">
                <div className="grid grid-cols-3 p-3 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <span />
                  <span>Idle</span>
                  <span>Cusp Vault</span>
                </div>
                {[
                  ["30-day yield", "$0", "+$808"],
                  ["APY", "0%", "19.4%"],
                  ["Risk", "Binary outcome", "Diversified"],
                  ["Effort", "None", "None"],
                ].map(([label, idle, cusp]) => (
                  <div key={label} className="grid grid-cols-3 p-3 text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono text-muted-foreground">{idle}</span>
                    <span className="font-mono text-cusp-amber">{cusp}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar - Live from DFlow */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              {
                label: "Total Volume",
                value:
                  totalVolume >= 1_000_000_000
                    ? `$${(totalVolume / 1_000_000_000).toFixed(1)}B`
                    : `$${(totalVolume / 1_000_000).toFixed(1)}M`,
              },
              { label: "Active Markets", value: "150" },
              { label: "Vault APY (est.)", value: "15.5%" },
              { label: "Platform", value: "DFlow + Kalshi" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-mono text-2xl font-semibold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-bg-1/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-xl font-semibold text-foreground mb-6">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {faqItems.map((item, i) => (
              <div key={i} className="bg-bg-1 border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-bg-2 transition-colors"
                >
                  <span className="text-sm text-foreground pr-4">{item.q}</span>
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

      {/* Waitlist */}
      <section className="border-t border-border" id="waitlist">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
          {waitlistCount !== null && (
            <p className="text-xs text-muted-foreground mb-2">
              <span className="font-mono text-cusp-teal font-semibold">{(waitlistCount + 100).toLocaleString()}</span> people on the waitlist
            </p>
          )}
          <h2 className="text-xl font-semibold text-foreground mb-2">Join the Alpha</h2>
          <p className="text-sm text-muted-foreground mb-6">Early access to Cusp Yield. We'll reach out when you're in.</p>
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

      {/* Final CTA */}
      <section className="border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-cusp-teal/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center relative">
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">
            Stop leaving yield on the table.
          </h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
            Your prediction market positions can earn 15–25% APY while waiting to resolve. Cusp makes it happen.
          </p>
          <Link
            to="/vault"
            className="inline-flex items-center px-8 py-3 bg-cusp-teal text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity glow-teal"
          >
            Open Vault →
          </Link>
        </div>
      </section>
    </Layout>
  );
};

const Step = ({ n, title, desc }: { n: number; title: string; desc: string }) => (
  <motion.div
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true }}
    variants={fadeUp}
    custom={n}
    className="bg-bg-1 border border-border rounded-lg p-5"
  >
    <div className="flex items-center gap-3 mb-2">
      <span className="w-6 h-6 rounded-full bg-cusp-teal/10 text-cusp-teal font-mono text-xs flex items-center justify-center">
        {n}
      </span>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
    </div>
    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
  </motion.div>
);

export default Index;
