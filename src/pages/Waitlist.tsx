import { useWaitlistSignup } from "@/hooks/useWaitlistSignup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ThemeToggle from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Share2, TrendingUp } from "lucide-react";

const TEAL = "hsl(var(--cusp-teal))";
const TEAL_SOFT = "hsl(var(--cusp-teal) / 0.6)";

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
      "w-56 rounded-xl border border-foreground/[0.08] bg-[hsl(var(--splash-card)/0.94)] p-3.5 pointer-events-none backdrop-blur-sm",
      className,
    )}
  >
    <p className="text-[10px] leading-snug text-foreground/42 mb-3">{title}</p>
    <div className="space-y-1.5">
      {[
        { label: "YES", pct: yes, colored: true },
        { label: "NO", pct: 100 - yes, colored: false },
      ].map(({ label, pct, colored }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-foreground/32 w-5">{label}</span>
          <div className="flex-1 h-[3px] rounded-full bg-foreground/[0.07]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: colored ? TEAL_SOFT : "hsl(var(--foreground) / 0.18)",
              }}
            />
          </div>
          <span
            className="font-mono text-[10px] font-semibold w-7 text-right"
            style={{ color: colored ? TEAL : "hsl(var(--foreground) / 0.4)" }}
          >
            {pct}%
          </span>
        </div>
      ))}
    </div>
    <div className="mt-3 pt-2.5 border-t border-foreground/[0.045] flex justify-between">
      <span className="font-mono text-[8px] text-foreground/20">VOL</span>
      <span className="font-mono text-[8px] text-foreground/30">{volume} USDC</span>
    </div>
  </div>
);

const BgPortfolioCard = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "w-44 rounded-xl border border-foreground/[0.08] bg-[hsl(var(--splash-card)/0.94)] p-3.5 pointer-events-none backdrop-blur-sm",
      className,
    )}
  >
    <p className="font-mono text-[8px] uppercase tracking-widest text-foreground/25 mb-2.5">Portfolio</p>
    <p className="font-mono text-xl font-bold text-foreground/55">$12,840</p>
    <p className="font-mono text-[10px] mt-0.5" style={{ color: TEAL }}>
      +$1,247.80 (+10.7%)
    </p>
    <div className="mt-3 pt-2 border-t border-foreground/[0.045] flex justify-between items-center">
      <span className="font-mono text-[8px] text-foreground/20">Positions</span>
      <span className="font-mono text-[9px] text-foreground/38">8 open</span>
    </div>
  </div>
);

const BgPositionCard = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "w-52 rounded-xl border border-foreground/[0.08] bg-[hsl(var(--splash-card)/0.94)] p-3.5 pointer-events-none backdrop-blur-sm",
      className,
    )}
  >
    <div className="flex items-center justify-between mb-2.5">
      <p className="font-mono text-[8px] uppercase tracking-widest text-foreground/25">
        Open Position
      </p>
      <span
        className="font-mono text-[8px] px-1.5 py-0.5 rounded"
        style={{ background: "hsl(var(--cusp-teal) / 0.1)", color: TEAL }}
      >
        LONG
      </span>
    </div>
    <p className="text-[11px] text-foreground/44 leading-snug">SOL hits $500 by Dec 2026</p>
    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
      {[
        { label: "Entry", value: "$0.68", dim: true },
        { label: "Current", value: "$0.71", dim: false },
        { label: "Size", value: "450 USDC", dim: true },
        { label: "P&L", value: "+4.4%", dim: false },
      ].map(({ label, value, dim }) => (
        <div key={label}>
          <p className="font-mono text-[8px] text-foreground/20">{label}</p>
          <p
            className="font-mono text-[10px]"
            style={{ color: dim ? "hsl(var(--foreground) / 0.5)" : TEAL }}
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
      "w-40 rounded-xl border border-foreground/[0.08] bg-[hsl(var(--splash-card)/0.94)] p-3.5 pointer-events-none backdrop-blur-sm",
      className,
    )}
  >
    <p className="font-mono text-[8px] uppercase tracking-widest text-foreground/25 mb-2.5">
      Yield Vault · Illustrative
    </p>
    <div className="flex items-end gap-1">
      <p className="font-mono text-xl font-bold" style={{ color: TEAL }}>
        8.4%
      </p>
      <p className="font-mono text-[9px] text-foreground/28 mb-0.5">APY</p>
    </div>
    <p className="font-mono text-[9px] text-foreground/26 mt-0.5">Senior tranche · USDC</p>
    <div className="mt-3 pt-2 border-t border-foreground/[0.045]">
      <span className="font-mono text-[8px] text-foreground/20">TVL: $4.2M</span>
    </div>
  </div>
);

// ── Ambient text fragments ─────────────────────────────────────────────────

const TEXT_FRAGMENTS = [
  { text: "(.) RISK ENGINE",                  top:  "2.1%", left: "3.2%",   rotate: "-1deg",   size: "9px",  opacity: 0.36 },
  { text: "++++++++",                         top:  "1.4%", left: "14%",    rotate: "0deg",    size: "9px",  opacity: 0.18 },
  { text: "// PREDICTION MARKET",             top:  "3.7%", left: "28%",    rotate: "0.5deg",  size: "9px",  opacity: 0.28 },
  { text: "* STRESSED RECOVERABLE VALUE",     top:  "6.8%", left: "21%",    rotate: "-0.5deg", size: "8px",  opacity: 0.22 },
  { text: "(.) POSITION STANDARD",            top:  "2.4%", left: "56%",    rotate: "0deg",    size: "8px",  opacity: 0.30 },
  { text: "* LIVE CAPITAL MARKETS",           top:  "5.9%", left: "62%",    rotate: "1deg",    size: "8px",  opacity: 0.24 },
  { text: "// CONTROLLED CREDIT",             top:  "3.1%", left: "80%",    rotate: "1.5deg",  size: "9px",  opacity: 0.32 },
  { text: "* SOLVENCY ARRANGED IN ADVANCE",   top:  "7.3%", left: "4%",     rotate: "0deg",    size: "8px",  opacity: 0.26 },
  { text: "+++++",                            top:  "1.2%", left: "93%",    rotate: "0deg",    size: "9px",  opacity: 0.18 },
  { text: "+++++",                            top:  "2.5%", left: "93%",    rotate: "0deg",    size: "9px",  opacity: 0.15 },
  { text: "+++++",                            top:  "3.8%", left: "93%",    rotate: "0deg",    size: "9px",  opacity: 0.13 },
  { text: "+++++",                            top:  "5.1%", left: "93%",    rotate: "0deg",    size: "9px",  opacity: 0.11 },
  { text: "EVENT-DRIVEN COLLATERAL",          top:  "8.8%", left: "47%",    rotate: "-1deg",   size: "8px",  opacity: 0.22 },
  { text: "-01",                              top: "11.5%", left: "2%",     rotate: "0deg",    size: "9px",  opacity: 0.24 },
  { text: "BORROW · EARN · REDEEM",           top: "10.3%", left: "17%",    rotate: "-1deg",   size: "10px", opacity: 0.38 },
  { text: "/// CONSERVATIVE MARK",            top: "13.7%", left: "68%",    rotate: "0.5deg",  size: "9px",  opacity: 0.22 },
  { text: "DEPTH-WALKED EXIT",                top:  "9.1%", left: "83%",    rotate: "2deg",    size: "8px",  opacity: 0.20 },
  { text: "// REPRICED EACH EPOCH",           top: "12.4%", left: "79%",    rotate: "-1deg",   size: "8px",  opacity: 0.24 },
  { text: "+++++",                            top: "11.8%", left: "93%",    rotate: "0deg",    size: "9px",  opacity: 0.16 },
  { text: "+++++",                            top: "13.1%", left: "93%",    rotate: "0deg",    size: "9px",  opacity: 0.14 },
  { text: ">>> ORIGINATION GATE",             top: "17.2%", left: "3%",     rotate: "-1.5deg", size: "8px",  opacity: 0.28 },
  { text: "CREDIT MARKET: OPEN",              top: "16.6%", left: "34%",    rotate: "-0.5deg", size: "8px",  opacity: 0.20 },
  { text: "// IDLE EARNS FROM BLOCK ONE",     top: "19.3%", left: "58%",    rotate: "1deg",    size: "8px",  opacity: 0.24 },
  { text: "STRUCTURES: 5",                    top: "18.1%", left: "82%",    rotate: "-0.5deg", size: "9px",  opacity: 0.34 },
  { text: "* NEW MARKET",                     top: "21.7%", left: "11%",    rotate: "0deg",    size: "9px",  opacity: 0.22 },
  { text: "TRANCHED VAULTS: ACTIVE",          top: "23.4%", left: "44%",    rotate: "0.5deg",  size: "8px",  opacity: 0.19 },
  { text: "BINARY · CATEGORICAL · SCALAR",   top: "22.9%", left: "70%",    rotate: "-1deg",   size: "8px",  opacity: 0.26 },
  { text: "// CAPACITY DECAYS TO RESOLUTION", top: "25.1%", left: "84%",    rotate: "0.5deg",  size: "8px",  opacity: 0.21 },
  { text: "MARK > BID > RECOVER",             top: "27.8%", left: "7%",     rotate: "-0.5deg", size: "9px",  opacity: 0.26 },
  { text: "/// DESCENDING-PRICE AUCTION",     top: "29.5%", left: "26%",    rotate: "0deg",    size: "8px",  opacity: 0.22 },
  { text: "(.) CREDIT LAYER",                 top: "28.3%", left: "52%",    rotate: "1deg",    size: "9px",  opacity: 0.32 },
  { text: "* BONDED SPECIALISTS",             top: "31.2%", left: "72%",    rotate: "-1.5deg", size: "8px",  opacity: 0.24 },
  { text: "+++++",                            top: "26.7%", left: "93%",    rotate: "0deg",    size: "9px",  opacity: 0.16 },
  { text: "+++++",                            top: "28.0%", left: "93%",    rotate: "0deg",    size: "9px",  opacity: 0.14 },
  { text: "SENIOR / JUNIOR",                  top: "33.4%", left: "1.5%",   rotate: "0deg",    size: "9px",  opacity: 0.32 },
  { text: "FIRST LOSS > LEVERED RESIDUAL",    top: "34.7%", left: "18%",    rotate: "-0.5deg", size: "9px",  opacity: 0.28 },
  { text: "// CREDIT MARKET",                 top: "33.1%", left: "45%",    rotate: "-1deg",   size: "9px",  opacity: 0.30 },
  { text: "* CAPPED BY FIRST-LOSS CAPITAL",   top: "35.9%", left: "62%",    rotate: "0.5deg",  size: "8px",  opacity: 0.24 },
  { text: "SETTLES ATOMICALLY",               top: "34.3%", left: "79%",    rotate: "0deg",    size: "8px",  opacity: 0.28 },
  { text: "++++++++",                         top: "33.8%", left: "92%",    rotate: "0deg",    size: "9px",  opacity: 0.17 },
  { text: "INSTANT REDEEM",                   top: "38.2%", left: "1.5%",   rotate: "0deg",    size: "9px",  opacity: 0.38 },
  { text: "(.) EVENT RESOLUTION: LIVE",       top: "39.6%", left: "21%",    rotate: "-0.5deg", size: "8px",  opacity: 0.22 },
  { text: "* PAID BEFORE SETTLEMENT",         top: "38.8%", left: "48%",    rotate: "1deg",    size: "8px",  opacity: 0.26 },
  { text: "ELIGIBILITY VERDICT: PASS",        top: "40.1%", left: "68%",    rotate: "-0.5deg", size: "8px",  opacity: 0.24 },
  { text: "FACE VALUE AT SETTLEMENT",         top: "38.5%", left: "89%",    rotate: "0deg",    size: "9px",  opacity: 0.28 },
  { text: "VENUE RECORD",                     top: "42.3%", left: "1.5%",   rotate: "0deg",    size: "9px",  opacity: 0.30 },
  { text: "// BORROW · EARN · REDEEM",        top: "43.7%", left: "19%",    rotate: "1deg",    size: "9px",  opacity: 0.36 },
  { text: ">>> CALIBRATION RECORD",           top: "44.2%", left: "54%",    rotate: "0.5deg",  size: "9px",  opacity: 0.38 },
  { text: "(.) HEALTH FACTOR: 2.14",          top: "43.0%", left: "76%",    rotate: "-1deg",   size: "8px",  opacity: 0.26 },
  { text: "VENUE RECORD",                     top: "42.7%", left: "89%",    rotate: "0deg",    size: "9px",  opacity: 0.26 },
  { text: "LIQUIDITY HAIRCUT",                top: "46.4%", left: "1.5%",   rotate: "0deg",    size: "9px",  opacity: 0.27 },
  { text: "* COMPLETE-SET NETTING",           top: "47.8%", left: "24%",    rotate: "-0.5deg", size: "8px",  opacity: 0.24 },
  { text: "EXPOSURE CAP: PER MARKET",         top: "46.9%", left: "47%",    rotate: "1.5deg",  size: "8px",  opacity: 0.24 },
  { text: "(.) RESERVE COVERS DEBT",          top: "48.3%", left: "69%",    rotate: "0deg",    size: "8px",  opacity: 0.22 },
  { text: "LIQUIDITY HAIRCUT",                top: "46.6%", left: "89%",    rotate: "0deg",    size: "9px",  opacity: 0.24 },
  { text: "TOXICITY HAIRCUT",                 top: "50.5%", left: "1.5%",   rotate: "0deg",    size: "9px",  opacity: 0.24 },
  { text: "/// SCALAR PAYOFF",                top: "51.9%", left: "20%",    rotate: "0deg",    size: "9px",  opacity: 0.30 },
  { text: "* NO TERMINAL CLIFF",              top: "52.7%", left: "51%",    rotate: "-0.5deg", size: "8px",  opacity: 0.22 },
  { text: "SOLANA · USDC · EVENT MARKETS",   top: "51.3%", left: "74%",    rotate: "-1.5deg", size: "8px",  opacity: 0.28 },
  { text: "TOXICITY HAIRCUT",                 top: "50.8%", left: "89%",    rotate: "0deg",    size: "9px",  opacity: 0.22 },
  { text: "ROUTE HEALTH...",                  top: "54.6%", left: "1.5%",   rotate: "0deg",    size: "9px",  opacity: 0.21 },
  { text: "(.) STRESS VALUE, NOT LAST PRINT", top: "55.4%", left: "27%",    rotate: "1deg",    size: "9px",  opacity: 0.28 },
  { text: "// REAL YIELD · NO EMISSIONS",     top: "56.8%", left: "58%",    rotate: "-1.5deg", size: "8px",  opacity: 0.24 },
  { text: "* SENIOR PROTECTED BY ARITHMETIC", top: "54.9%", left: "81%",    rotate: "0deg",    size: "8px",  opacity: 0.24 },
  { text: "ROUTE HEALTH...",                  top: "54.7%", left: "89%",    rotate: "0deg",    size: "9px",  opacity: 0.20 },
  { text: ">> PUBLIC LIQUIDATION LOG",        top: "59.2%", left: "3%",     rotate: "-1deg",   size: "8px",  opacity: 0.26 },
  { text: "* TRANCHED VAULT: OPEN",           top: "58.7%", left: "24%",    rotate: "0.5deg",  size: "8px",  opacity: 0.24 },
  { text: "(SETTLEMENT FINANCING)",           top: "60.3%", left: "49%",    rotate: "1deg",    size: "8px",  opacity: 0.24 },
  { text: "* BORROW AGAINST POSITIONS",       top: "59.8%", left: "73%",    rotate: "-0.5deg", size: "8px",  opacity: 0.22 },
  { text: "(SETTLEMENT FINANCING)",           top: "59.5%", left: "88%",    rotate: "1deg",    size: "8px",  opacity: 0.22 },
  { text: "> NON-CUSTODIAL",                  top: "63.7%", left: "3%",     rotate: "0deg",    size: "8px",  opacity: 0.24 },
  { text: ">>> VERIFIABLE RECORD",            top: "64.5%", left: "22%",    rotate: "-1deg",   size: "9px",  opacity: 0.28 },
  { text: "( )))))))))) :)",                  top: "65.9%", left: "48%",    rotate: "0deg",    size: "9px",  opacity: 0.22 },
  { text: "// EPOCH ROLLOVER",                top: "64.2%", left: "72%",    rotate: "-0.5deg", size: "8px",  opacity: 0.22 },
  { text: "+++++",                            top: "63.0%", left: "91%",    rotate: "0deg",    size: "9px",  opacity: 0.16 },
  { text: "+++++",                            top: "64.3%", left: "91%",    rotate: "0deg",    size: "9px",  opacity: 0.14 },
  { text: "* BORROW AGAINST POSITIONS",       top: "68.4%", left: "4%",     rotate: "1deg",    size: "8px",  opacity: 0.22 },
  { text: "(.) ALPHA COHORT_01",              top: "69.8%", left: "25%",    rotate: "0.5deg",  size: "9px",  opacity: 0.26 },
  { text: "* GET PAID EARLY",                 top: "70.5%", left: "53%",    rotate: "-1deg",   size: "8px",  opacity: 0.24 },
  { text: "SOLANA · USDC · EVENT MARKETS",   top: "68.9%", left: "77%",    rotate: "0deg",    size: "8px",  opacity: 0.26 },
  { text: "+++++",                            top: "67.6%", left: "91%",    rotate: "0deg",    size: "9px",  opacity: 0.15 },
  { text: "+++++",                            top: "68.9%", left: "91%",    rotate: "0deg",    size: "9px",  opacity: 0.13 },
  { text: "(.) CAPITAL MARKETS LAYER...",     top: "73.2%", left: "4%",     rotate: "1deg",    size: "9px",  opacity: 0.26 },
  { text: "// CONDITIONAL: BRANCH + REFUND",  top: "74.6%", left: "24%",    rotate: "-0.5deg", size: "9px",  opacity: 0.22 },
  { text: "* IDLE EARNS: ON",                 top: "75.3%", left: "52%",    rotate: "0.5deg",  size: "8px",  opacity: 0.20 },
  { text: "(.) POSITION STANDARD",            top: "74.1%", left: "75%",    rotate: "1.5deg",  size: "8px",  opacity: 0.24 },
  { text: "(.) STRIKE LADDER: MONOTONIC",     top: "78.5%", left: "4%",     rotate: "0deg",    size: "8px",  opacity: 0.24 },
  { text: "(.) EXPOSURE CAP: ENFORCED",       top: "79.9%", left: "27%",    rotate: "0deg",    size: "9px",  opacity: 0.22 },
  { text: "* LIVE CAPITAL MARKETS",           top: "80.7%", left: "57%",    rotate: "-0.5deg", size: "8px",  opacity: 0.22 },
  { text: "(.) SETTLEMENT FINANCING",         top: "79.3%", left: "80%",    rotate: "-1deg",   size: "9px",  opacity: 0.24 },
  { text: "-01",                              top: "83.1%", left: "2%",     rotate: "0deg",    size: "9px",  opacity: 0.22 },
  { text: "BORROW · EARN · REDEEM",           top: "84.3%", left: "18%",    rotate: "-0.5deg", size: "10px", opacity: 0.36 },
  { text: "(.) PUBLISHED......",              top: "83.8%", left: "48%",    rotate: "0.5deg",  size: "9px",  opacity: 0.20 },
  { text: "* MARK · LEND · CLEAR",            top: "84.9%", left: "73%",    rotate: "-0.5deg", size: "9px",  opacity: 0.22 },
  { text: "++++++++",                         top: "82.7%", left: "91%",    rotate: "0deg",    size: "9px",  opacity: 0.17 },
  { text: "* NEW MARKET",                     top: "88.2%", left: "3%",     rotate: "0deg",    size: "9px",  opacity: 0.20 },
  { text: "// PREDICTION MARKET",             top: "89.5%", left: "26%",    rotate: "0.5deg",  size: "9px",  opacity: 0.18 },
  { text: "BORROW · EARN · REDEEM",           top: "90.8%", left: "54%",    rotate: "-1deg",   size: "9px",  opacity: 0.22 },
  { text: "(.) CAPITAL MARKETS LAYER...",     top: "89.1%", left: "78%",    rotate: "1deg",    size: "8px",  opacity: 0.18 },
  { text: "[ EXIT ]",                         top: "94.0%", left: "2%",     rotate: "0deg",    size: "9px",  opacity: 0.16 },
  { text: "* SOLVENCY ARRANGED IN ADVANCE",   top: "93.4%", left: "22%",    rotate: "0deg",    size: "8px",  opacity: 0.14 },
  { text: "+++++",                            top: "91.5%", left: "91%",    rotate: "0deg",    size: "9px",  opacity: 0.15 },
  { text: "+++++",                            top: "92.8%", left: "91%",    rotate: "0deg",    size: "9px",  opacity: 0.13 },
  { text: "+++++",                            top: "94.1%", left: "91%",    rotate: "0deg",    size: "9px",  opacity: 0.11 },
] as const;

const BgTextLayer = ({ reduceMotion }: { reduceMotion: boolean | null }) => (
  <>
    {TEXT_FRAGMENTS.map(({ text, opacity, size, rotate, top, ...pos }, i) => {
      const style: React.CSSProperties & { rotate?: string } = {
        color: TEAL,
        fontSize: size,
        rotate,
        opacity: 0,
        top,
      };
      if ("left" in pos) style.left = (pos as { left: string }).left;
      if ("right" in pos) style.right = (pos as { right: string }).right;
      return (
        <motion.span
          key={i}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: Math.min(opacity * 1.9, 0.72) }}
          transition={reduceMotion ? { duration: 0 } : { delay: 0.06 + i * 0.022, duration: 1.0 }}
          className="pointer-events-none absolute font-mono uppercase tracking-widest whitespace-nowrap"
          style={style}
        >
          {text}
        </motion.span>
      );
    })}
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
      "Early on @usecusp 👀\n\nCusp is the capital markets layer for prediction markets on Solana.\n\nBorrow against live positions, earn on idle capital, and get paid the moment a market resolves.\n\nJoin now 👉 https://beta.cusp.fi/waitlist",
    );
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank");
  };

  return (
    <div className="relative h-[100dvh] sm:min-h-screen overflow-y-auto overflow-x-hidden bg-[hsl(var(--splash-bg))] flex items-center justify-center px-4 py-10 sm:py-16">

      {/* logo — top-left */}
      <Link
        to="/"
        className="fixed top-5 left-5 z-50 flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity"
      >
        <img src="/cusp.png" alt="Cusp" className="w-6 h-6 rounded-full object-contain" />
        <span className="font-semibold text-sm tracking-tight text-foreground">Cusp</span>
      </Link>

      {/* theme toggle — top-right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* top teal glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% -8%, hsl(var(--cusp-teal) / 0.1), transparent)",
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
            "radial-gradient(ellipse 68% 68% at 50% 50%, transparent 28%, hsl(var(--splash-vignette) / 0.82) 100%)",
        }}
      />

      {/* ── Center: frosted glass form ──────────────────────── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ type: "spring", stiffness: 200, damping: 26, delay: 0.3 }}
        className="relative z-10 w-full max-w-[420px] mt-8 sm:mt-0"
      >
        <div
          className="rounded-2xl bg-[hsl(var(--splash-card)/0.96)] p-5 sm:p-8 backdrop-blur-2xl"
          style={{
            border: "0.5px solid hsl(var(--cusp-teal) / 0.35)",
            boxShadow: "0 0 18px hsl(var(--cusp-teal) / 0.06), 0 8px 32px rgba(0,0,0,0.45)",
          }}
        >

          {/* badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/[0.09] bg-foreground/[0.04] px-3 py-[5px] text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/52">
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ background: TEAL }}
            />
            Early Access
          </span>

          <h1 className="mt-4 text-[1.45rem] sm:text-[1.85rem] font-bold leading-[1.1] tracking-tight text-foreground">
            The DeFi capital layer for prediction markets.
          </h1>

          <p className="mt-2.5 text-sm leading-relaxed text-foreground/46">
            Risk, credit, settlement, and liquidation infrastructure for event-driven positions.
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
              <span className="font-mono text-xs text-foreground/36">
                <span className="font-semibold text-foreground/60">
                  {waitlist.displayCount.toLocaleString()}
                </span>{" "}
                already in line
              </span>
            </motion.div>
          )}

          {/* form / success */}
          <div className="mt-4 sm:mt-6">
            {waitlist.status === "success" ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 24 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]"
                    style={{ background: "hsl(var(--cusp-teal) / 0.15)", color: TEAL }}
                  >
                    ✓
                  </span>
                  <p className="text-sm font-semibold text-foreground">You're on the list</p>
                </div>
                <p className="text-xs text-foreground/40 pl-[30px]">We'll reach out when you're in.</p>
                <Button
                  onClick={shareOnX}
                  className="h-10 w-full rounded-xl border text-xs font-semibold hover:bg-foreground/[0.04] transition-colors"
                  style={{ borderColor: "hsl(var(--cusp-teal) / 0.3)", color: TEAL, background: "transparent" }}
                  variant="ghost"
                >
                  <Share2 size={12} className="mr-2" />
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
                  placeholder="contact@cusp.fi"
                  autoComplete="email"
                  required
                  disabled={waitlist.status === "loading"}
                  className="h-12 rounded-xl border-foreground/[0.1] bg-foreground/[0.05] px-4 text-foreground placeholder:text-foreground/28 focus-visible:ring-1 focus-visible:ring-white/18"
                />
                <Button
                  type="submit"
                  disabled={waitlist.status === "loading"}
                  className="h-12 w-full rounded-xl text-sm font-semibold text-primary-foreground shadow-none transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                  style={{
                    background: `linear-gradient(135deg, hsl(var(--cusp-teal)) 0%, hsl(var(--cusp-teal) / 0.85) 100%)`,
                    boxShadow: "0 0 16px hsl(var(--cusp-teal) / 0.28), 0 2px 8px rgba(0,0,0,0.3)",
                  }}
                  variant="ghost"
                >
                  {waitlist.status === "loading" ? "Joining…" : "Get early access"}
                  {waitlist.status !== "loading" && <ArrowRight size={14} className="ml-2" />}
                </Button>
                {waitlist.status === "error" && (
                  <p className="text-xs text-foreground/42">{waitlist.error}</p>
                )}
              </form>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-foreground/[0.06] flex items-center justify-center">
            <a
              href="https://x.com/usecusp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-foreground/36 hover:text-foreground/70 transition-colors text-xs"
            >
              Follow us on{" "}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>{" "}
              <span className="font-semibold">@usecusp</span>
            </a>
          </div>
        </div>

        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/16">
          Private alpha
        </p>
      </motion.div>
    </div>
  );
};

export default Waitlist;
