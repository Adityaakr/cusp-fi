import { useWaitlistSignup } from "@/hooks/useWaitlistSignup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Share2, TrendingUp } from "lucide-react";

const TEAL = "hsl(160 67% 48%)";
const TEAL_SOFT = "hsl(160 67% 48% / 0.6)";

// ── Static background market snapshot components ───────────────────────────

const BgMarketCard = ({
  title,
  yes,
  volume,
  className,
}: {
  title: string;
  yes: number;
  volume: string;
  className?: string;
}) => (
  <div
    className={cn(
      "w-56 rounded-xl border border-white/[0.06] bg-white/[0.018] p-3.5 pointer-events-none",
      className,
    )}
  >
    <p className="text-[10px] leading-snug text-white/42 mb-3">{title}</p>
    <div className="space-y-1.5">
      {[
        { label: "YES", pct: yes, colored: true },
        { label: "NO", pct: 100 - yes, colored: false },
      ].map(({ label, pct, colored }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-white/32 w-5">{label}</span>
          <div className="flex-1 h-[3px] rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: colored ? TEAL_SOFT : "rgba(255,255,255,0.15)",
              }}
            />
          </div>
          <span
            className="font-mono text-[10px] font-semibold w-7 text-right"
            style={{ color: colored ? TEAL : "rgba(255,255,255,0.28)" }}
          >
            {pct}%
          </span>
        </div>
      ))}
    </div>
    <div className="mt-3 pt-2.5 border-t border-white/[0.045] flex justify-between">
      <span className="font-mono text-[8px] text-white/20">VOL</span>
      <span className="font-mono text-[8px] text-white/30">{volume} USDC</span>
    </div>
  </div>
);

const BgPortfolioCard = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "w-44 rounded-xl border border-white/[0.06] bg-white/[0.018] p-3.5 pointer-events-none",
      className,
    )}
  >
    <p className="font-mono text-[8px] uppercase tracking-widest text-white/25 mb-2.5">Portfolio</p>
    <p className="font-mono text-xl font-bold text-white/55">$12,840</p>
    <p className="font-mono text-[10px] mt-0.5" style={{ color: TEAL }}>
      +$1,247.80 (+10.7%)
    </p>
    <div className="mt-3 pt-2 border-t border-white/[0.045] flex justify-between items-center">
      <span className="font-mono text-[8px] text-white/20">Positions</span>
      <span className="font-mono text-[9px] text-white/38">8 open</span>
    </div>
  </div>
);

const BgPositionCard = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "w-52 rounded-xl border border-white/[0.06] bg-white/[0.018] p-3.5 pointer-events-none",
      className,
    )}
  >
    <div className="flex items-center justify-between mb-2.5">
      <p className="font-mono text-[8px] uppercase tracking-widest text-white/25">
        Open Position
      </p>
      <span
        className="font-mono text-[8px] px-1.5 py-0.5 rounded"
        style={{ background: "hsl(160 67% 48% / 0.1)", color: TEAL }}
      >
        LONG
      </span>
    </div>
    <p className="text-[11px] text-white/44 leading-snug">SOL hits $500 by Dec 2026</p>
    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
      {[
        { label: "Entry", value: "$0.68", dim: true },
        { label: "Current", value: "$0.71", dim: false },
        { label: "Size", value: "450 USDC", dim: true },
        { label: "P&L", value: "+4.4%", dim: false },
      ].map(({ label, value, dim }) => (
        <div key={label}>
          <p className="font-mono text-[8px] text-white/20">{label}</p>
          <p
            className="font-mono text-[10px]"
            style={{ color: dim ? "rgba(255,255,255,0.38)" : TEAL }}
          >
            {value}
          </p>
        </div>
      ))}
    </div>
  </div>
);

const BgYieldCard = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "w-40 rounded-xl border border-white/[0.06] bg-white/[0.018] p-3.5 pointer-events-none",
      className,
    )}
  >
    <p className="font-mono text-[8px] uppercase tracking-widest text-white/25 mb-2.5">
      Yield Vault
    </p>
    <div className="flex items-end gap-1">
      <p className="font-mono text-xl font-bold" style={{ color: TEAL }}>
        8.4%
      </p>
      <p className="font-mono text-[9px] text-white/28 mb-0.5">APY</p>
    </div>
    <p className="font-mono text-[9px] text-white/26 mt-0.5">USDC · 7-day lock</p>
    <div className="mt-3 pt-2 border-t border-white/[0.045]">
      <span className="font-mono text-[8px] text-white/20">TVL: $4.2M</span>
    </div>
  </div>
);

// ── Ambient text fragments ─────────────────────────────────────────────────

const TEXT_FRAGMENTS = [
  // top band
  { text: "(.) SOVEREIGN YIELD",        top: "5%",  left: "4%",    rotate: "-1deg",   size: "9px",  opacity: 0.17 },
  { text: "// PREDICTION MARKET",       top: "4%",  left: "34%",   rotate: "0deg",    size: "9px",  opacity: 0.13 },
  { text: "EVENT-BASED CREDIT",         top: "7%",  right: "6%",   rotate: "1.5deg",  size: "9px",  opacity: 0.15 },
  { text: "++++++++",                   top: "3%",  right: "2%",   rotate: "0deg",    size: "10px", opacity: 0.1  },
  // upper-mid
  { text: ">>> COLLATERAL LOOP",        top: "22%", left: "1%",    rotate: "-2deg",   size: "8px",  opacity: 0.13 },
  { text: "/// PROGRAMMABLE_YIELD",     top: "26%", left: "28%",   rotate: "0.5deg",  size: "9px",  opacity: 0.11 },
  { text: "// EPOCH_100 CREDIT",        top: "20%", right: "3%",   rotate: "2deg",    size: "9px",  opacity: 0.14 },
  { text: "BACKED BY (CRYPTOECONOMICS)",top: "30%", right: "7%",   rotate: "-1deg",   size: "8px",  opacity: 0.11 },
  // mid-left
  { text: "M0 > CASH",                 top: "44%", left: "1.5%",  rotate: "0deg",    size: "9px",  opacity: 0.15 },
  { text: "M1 > LIQUID",               top: "48%", left: "1.5%",  rotate: "0deg",    size: "9px",  opacity: 0.13 },
  { text: "M2 > CREDIT",               top: "52%", left: "1.5%",  rotate: "0deg",    size: "9px",  opacity: 0.11 },
  { text: "M3 > YIELD",                top: "56%", left: "1.5%",  rotate: "0deg",    size: "9px",  opacity: 0.1  },
  // mid-right
  { text: "(.) PERPETUAL CONDUIT",      top: "44%", right: "2%",   rotate: "1deg",    size: "8px",  opacity: 0.12 },
  { text: "* LIVE CAPITAL MARKETS",     top: "48%", right: "2%",   rotate: "0deg",    size: "8px",  opacity: 0.11 },
  // lower-mid
  { text: ">> POSITION MULTIPLIER",    top: "62%", left: "4%",    rotate: "-1deg",   size: "9px",  opacity: 0.13 },
  { text: "(.) ALPHA COHORT_01",        top: "66%", left: "26%",   rotate: "0.5deg",  size: "9px",  opacity: 0.10 },
  { text: "SOLANA · USDC · BORROW",    top: "68%", right: "5%",   rotate: "-1.5deg", size: "8px",  opacity: 0.12 },
  // bottom band
  { text: "(.) INFINITE CREDIT SUPPLY", top: "80%", left: "3%",    rotate: "1deg",    size: "9px",  opacity: 0.14 },
  { text: "// CAPITAL EFFICIENCY",      top: "84%", left: "30%",   rotate: "-0.5deg", size: "9px",  opacity: 0.11 },
  { text: "(.) FUTURE_BACKED CREDIT",   top: "78%", right: "4%",   rotate: "1.5deg",  size: "9px",  opacity: 0.12 },
  { text: "[ EXIT ]",                   top: "88%", left: "2%",    rotate: "0deg",    size: "9px",  opacity: 0.09 },
  { text: "++++++++",                   top: "90%", right: "1.5%", rotate: "0deg",    size: "10px", opacity: 0.08 },
] as const;

const BgTextLayer = ({ reduceMotion }: { reduceMotion: boolean | null }) => (
  <>
    {TEXT_FRAGMENTS.map(({ text, opacity, size, rotate, ...pos }, i) => (
      <motion.span
        key={i}
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: reduceMotion ? opacity : opacity }}
        transition={reduceMotion ? { duration: 0 } : { delay: 0.08 + i * 0.045, duration: 1.1 }}
        className="pointer-events-none absolute font-mono uppercase tracking-widest whitespace-nowrap"
        style={{
          color: TEAL,
          fontSize: size,
          rotate,
          opacity: 0,
          ...("left" in pos ? { left: pos.left } : {}),
          ...("right" in pos ? { right: pos.right } : {}),
          top: pos.top,
        }}
      >
        {text}
      </motion.span>
    ))}
  </>
);

// ── Per-card fade-in helper ────────────────────────────────────────────────

function bgTransition(delay: number) {
  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.8, ease: [0.0, 0.0, 0.2, 1] as const },
  };
}

// ── Page ───────────────────────────────────────────────────────────────────

const Waitlist = () => {
  const waitlist = useWaitlistSignup();
  const reduceMotion = useReducedMotion();

  const shareOnX = () => {
    const text = encodeURIComponent(
      "Just joined the waitlist for @CuspFi — the DeFi capital layer for prediction markets. Built on Solana.\n\nhttps://cusp.fi",
    );
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060606] flex items-center justify-center px-4 py-16">

      {/* logo — top-left */}
      <Link
        to="/"
        className="fixed top-5 left-5 z-50 flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity"
      >
        <img src="/cusp.png" alt="Cusp" className="w-6 h-6 rounded-full object-contain" />
        <span className="font-semibold text-sm tracking-tight text-white">Cusp</span>
      </Link>

      {/* top teal glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% -8%, hsl(160 67% 48% / 0.1), transparent)",
        }}
      />

      {/* ── Ambient scattered text ──────────────────────────── */}
      <BgTextLayer reduceMotion={reduceMotion} />

      {/* ── Background: static market snapshot cards ───────── */}

      {/* top-left — market card */}
      <motion.div
        {...(reduceMotion ? {} : bgTransition(0.2))}
        className="hidden lg:block absolute top-[13%] left-[5%] -rotate-[2deg]"
        style={{ opacity: 0.3 }}
      >
        <BgMarketCard title="Will SOL reach $500 by Dec 2026?" yes={72} volume="2.4M" />
      </motion.div>

      {/* top-right — portfolio */}
      <motion.div
        {...(reduceMotion ? {} : bgTransition(0.32))}
        className="hidden lg:block absolute top-[10%] right-[5%] rotate-[1.5deg]"
        style={{ opacity: 0.26 }}
      >
        <BgPortfolioCard />
      </motion.div>

      {/* mid-left — yield vault */}
      <motion.div
        {...(reduceMotion ? {} : bgTransition(0.44))}
        className="hidden xl:block absolute top-1/2 -translate-y-1/2 left-[3%] rotate-[1deg]"
        style={{ opacity: 0.22 }}
      >
        <BgYieldCard />
      </motion.div>

      {/* mid-right — market card */}
      <motion.div
        {...(reduceMotion ? {} : bgTransition(0.44))}
        className="hidden lg:block absolute top-[42%] -translate-y-1/2 right-[4%] rotate-[2deg]"
        style={{ opacity: 0.26 }}
      >
        <BgMarketCard title="Will Polymarket TVL hit $500M?" yes={58} volume="1.1M" />
      </motion.div>

      {/* bottom-left — open position */}
      <motion.div
        {...(reduceMotion ? {} : bgTransition(0.56))}
        className="hidden lg:block absolute bottom-[11%] left-[4%] rotate-[1.5deg]"
        style={{ opacity: 0.24 }}
      >
        <BgPositionCard />
      </motion.div>

      {/* bottom-right — market card */}
      <motion.div
        {...(reduceMotion ? {} : bgTransition(0.56))}
        className="hidden xl:block absolute bottom-[14%] right-[5%] -rotate-[1.5deg]"
        style={{ opacity: 0.22 }}
      >
        <BgMarketCard
          title="ETH ETF weekly inflows exceed $1B?"
          yes={54}
          volume="870K"
        />
      </motion.div>

      {/* vignette — darkens edges, keeps center clean */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse 68% 68% at 50% 50%, transparent 28%, rgba(6,6,6,0.82) 100%)",
        }}
      />

      {/* ── Center: frosted glass form ──────────────────────── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ type: "spring", stiffness: 200, damping: 26, delay: 0.3 }}
        className="relative z-10 w-full max-w-[420px]"
      >
        <div className="rounded-2xl border border-white/[0.09] bg-black/52 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_28px_80px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl">

          {/* badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-[5px] text-[10px] font-semibold uppercase tracking-[0.14em] text-white/52">
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ background: TEAL }}
            />
            Early Access
          </span>

          <h1 className="mt-5 text-[1.85rem] font-bold leading-[1.08] tracking-tight text-white">
            The DeFi capital layer for prediction markets.
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-white/46">
            Yield, credit, and portfolio tooling for event-market positions.
            Private alpha. Join the queue.
          </p>

          {/* live count */}
          {!waitlist.countLoading && waitlist.displayCount > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
              className="mt-4 flex items-center gap-2"
            >
              <TrendingUp size={12} style={{ color: TEAL }} />
              <span className="font-mono text-xs text-white/36">
                <span className="font-semibold text-white/60">
                  {waitlist.displayCount.toLocaleString()}
                </span>{" "}
                already in line
              </span>
            </motion.div>
          )}

          {/* form / success */}
          <div className="mt-6">
            {waitlist.status === "success" ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
              >
                <div
                  className="rounded-xl border px-5 py-4"
                  style={{
                    borderColor: "hsl(160 67% 48% / 0.18)",
                    background: "hsl(160 67% 48% / 0.05)",
                  }}
                >
                  <p className="text-sm font-semibold text-white">You're on the list!</p>
                  <p className="mt-1 text-sm text-white/48">
                    We'll reach out when you're in.
                  </p>
                </div>
                <Button
                  onClick={shareOnX}
                  className="mt-3 h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] text-sm font-semibold text-white hover:bg-white/[0.07]"
                  variant="ghost"
                >
                  <Share2 size={13} className="mr-2" />
                  Share on X
                </Button>
              </motion.div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await waitlist.submit();
                }}
                className="space-y-2.5"
              >
                <Input
                  type="email"
                  value={waitlist.email}
                  onChange={(e) => waitlist.setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  disabled={waitlist.status === "loading"}
                  className="h-12 rounded-xl border-white/[0.1] bg-white/[0.05] px-4 text-white placeholder:text-white/28 focus-visible:ring-1 focus-visible:ring-white/18"
                />
                <Button
                  type="submit"
                  disabled={waitlist.status === "loading"}
                  className="h-12 w-full rounded-xl border border-white/[0.1] bg-white/[0.05] text-sm font-semibold text-white hover:bg-white/[0.09] shadow-none"
                  variant="ghost"
                >
                  {waitlist.status === "loading" ? "Joining…" : "Get early access"}
                  {waitlist.status !== "loading" && <ArrowRight size={14} className="ml-2" />}
                </Button>
                {waitlist.status === "error" && (
                  <p className="text-xs text-white/42">{waitlist.error}</p>
                )}
              </form>
            )}
          </div>
        </div>

        <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-white/16">
          Built on Solana · Private alpha
        </p>
      </motion.div>
    </div>
  );
};

export default Waitlist;
