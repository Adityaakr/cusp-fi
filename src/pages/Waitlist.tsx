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
      "w-56 rounded-xl border border-white/[0.08] bg-[#070707]/[0.94] p-3.5 pointer-events-none backdrop-blur-sm",
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
      "w-44 rounded-xl border border-white/[0.08] bg-[#070707]/[0.94] p-3.5 pointer-events-none backdrop-blur-sm",
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
      "w-52 rounded-xl border border-white/[0.08] bg-[#070707]/[0.94] p-3.5 pointer-events-none backdrop-blur-sm",
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
      "w-40 rounded-xl border border-white/[0.08] bg-[#070707]/[0.94] p-3.5 pointer-events-none backdrop-blur-sm",
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
  { text: "(.) SOVEREIGN YIELD",              top:  "2.1%", left: "3.2%",   rotate: "-1deg",   size: "9px",  opacity: 0.36 },
  { text: "++++++++",                         top:  "1.4%", left: "14%",    rotate: "0deg",    size: "9px",  opacity: 0.18 },
  { text: "// PREDICTION MARKET",             top:  "3.7%", left: "28%",    rotate: "0.5deg",  size: "9px",  opacity: 0.28 },
  { text: "* LEND AT SCALE......",            top:  "6.8%", left: "21%",    rotate: "-0.5deg", size: "8px",  opacity: 0.22 },
  { text: "(.) PERPETUAL CONDUIT",            top:  "2.4%", left: "56%",    rotate: "0deg",    size: "8px",  opacity: 0.30 },
  { text: "* LIVE CAPITAL MARKETS",           top:  "5.9%", left: "62%",    rotate: "1deg",    size: "8px",  opacity: 0.24 },
  { text: "// EPOCH 100 CREDIT",              top:  "3.1%", left: "80%",    rotate: "1.5deg",  size: "9px",  opacity: 0.32 },
  { text: "* INFINITE CREDIT EXPANSION......",top:  "7.3%", left: "4%",     rotate: "0deg",    size: "8px",  opacity: 0.26 },
  { text: "+++++",                            top:  "1.2%", left: "93%",    rotate: "0deg",    size: "9px",  opacity: 0.18 },
  { text: "+++++",                            top:  "2.5%", left: "93%",    rotate: "0deg",    size: "9px",  opacity: 0.15 },
  { text: "+++++",                            top:  "3.8%", left: "93%",    rotate: "0deg",    size: "9px",  opacity: 0.13 },
  { text: "+++++",                            top:  "5.1%", left: "93%",    rotate: "0deg",    size: "9px",  opacity: 0.11 },
  { text: "BACKED BY (CRYPTOECONOMICS)",      top:  "8.8%", left: "47%",    rotate: "-1deg",   size: "8px",  opacity: 0.22 },
  { text: "-01",                              top: "11.5%", left: "2%",     rotate: "0deg",    size: "9px",  opacity: 0.24 },
  { text: "LEND · BORROW · LEVERAGE",         top: "10.3%", left: "17%",    rotate: "-1deg",   size: "10px", opacity: 0.38 },
  { text: "/// PROGRAMMABLE_YIELD",           top: "13.7%", left: "68%",    rotate: "0.5deg",  size: "9px",  opacity: 0.22 },
  { text: "REAL / SYNTHETIC",                 top:  "9.1%", left: "83%",    rotate: "2deg",    size: "8px",  opacity: 0.20 },
  { text: "// BORROW_RATE: 4.2% APR",         top: "12.4%", left: "79%",    rotate: "-1deg",   size: "8px",  opacity: 0.24 },
  { text: "+++++",                            top: "11.8%", left: "93%",    rotate: "0deg",    size: "9px",  opacity: 0.16 },
  { text: "+++++",                            top: "13.1%", left: "93%",    rotate: "0deg",    size: "9px",  opacity: 0.14 },
  { text: ">>> COLLATERAL LOOP",              top: "17.2%", left: "3%",     rotate: "-1.5deg", size: "8px",  opacity: 0.28 },
  { text: "BORROW_MARKET: OPEN",              top: "16.6%", left: "34%",    rotate: "-0.5deg", size: "8px",  opacity: 0.20 },
  { text: "// LEND_RATE: 8.4% APY",           top: "19.3%", left: "58%",    rotate: "1deg",    size: "8px",  opacity: 0.24 },
  { text: "LEVERAGE_RATIO: 10x",              top: "18.1%", left: "82%",    rotate: "-0.5deg", size: "9px",  opacity: 0.34 },
  { text: "* NEW MARKET",                     top: "21.7%", left: "11%",    rotate: "0deg",    size: "9px",  opacity: 0.22 },
  { text: "LEVERAGE_VAULT: ACTIVE",           top: "23.4%", left: "44%",    rotate: "0.5deg",  size: "8px",  opacity: 0.19 },
  { text: "COLLATERAL: USDC · SOL · PYTH",   top: "22.9%", left: "70%",    rotate: "-1deg",   size: "8px",  opacity: 0.26 },
  { text: "// SHORT VOLATILITY LOOP",         top: "25.1%", left: "84%",    rotate: "0.5deg",  size: "8px",  opacity: 0.21 },
  { text: "YIELD > BORROW > COMPOUND",        top: "27.8%", left: "7%",     rotate: "-0.5deg", size: "9px",  opacity: 0.26 },
  { text: "/// OPEN CREDIT MARKETS",          top: "29.5%", left: "26%",    rotate: "0deg",    size: "8px",  opacity: 0.22 },
  { text: "(.) LEND LAYER",                   top: "28.3%", left: "52%",    rotate: "1deg",    size: "9px",  opacity: 0.32 },
  { text: "* BORROW ANY ASSET",               top: "31.2%", left: "72%",    rotate: "-1.5deg", size: "8px",  opacity: 0.24 },
  { text: "+++++",                            top: "26.7%", left: "93%",    rotate: "0deg",    size: "9px",  opacity: 0.16 },
  { text: "+++++",                            top: "28.0%", left: "93%",    rotate: "0deg",    size: "9px",  opacity: 0.14 },
  { text: "=Mo, M1, M2, M3, Mn,",            top: "33.4%", left: "1.5%",   rotate: "0deg",    size: "9px",  opacity: 0.32 },
  { text: "BORROW > LEVERAGE > EARN",         top: "34.7%", left: "18%",    rotate: "-0.5deg", size: "9px",  opacity: 0.28 },
  { text: "// BORROW MARKET",                 top: "33.1%", left: "45%",    rotate: "-1deg",   size: "9px",  opacity: 0.30 },
  { text: "* LEVERAGED YIELD FARMING",        top: "35.9%", left: "62%",    rotate: "0.5deg",  size: "8px",  opacity: 0.24 },
  { text: "LEND RATE: 8.4% APY",              top: "34.3%", left: "79%",    rotate: "0deg",    size: "8px",  opacity: 0.28 },
  { text: "++++++++",                         top: "33.8%", left: "92%",    rotate: "0deg",    size: "9px",  opacity: 0.17 },
  { text: "M0 > CASH",                        top: "38.2%", left: "1.5%",   rotate: "0deg",    size: "9px",  opacity: 0.38 },
  { text: "(.) EVENT RESOLUTION: LIVE",       top: "39.6%", left: "21%",    rotate: "-0.5deg", size: "8px",  opacity: 0.22 },
  { text: "* OPEN LEVERAGE POOL",             top: "38.8%", left: "48%",    rotate: "1deg",    size: "8px",  opacity: 0.26 },
  { text: "COLLATERAL_FACTOR: 0.85",          top: "40.1%", left: "68%",    rotate: "-0.5deg", size: "8px",  opacity: 0.24 },
  { text: "M0 > CASH",                        top: "38.5%", left: "89%",    rotate: "0deg",    size: "9px",  opacity: 0.28 },
  { text: "M1 > LIQUID",                      top: "42.3%", left: "1.5%",   rotate: "0deg",    size: "9px",  opacity: 0.30 },
  { text: "// LEND · BORROW · COMPOUND",      top: "43.7%", left: "19%",    rotate: "1deg",    size: "9px",  opacity: 0.36 },
  { text: ">>> YIELD COMPOUNDING",            top: "44.2%", left: "54%",    rotate: "0.5deg",  size: "9px",  opacity: 0.38 },
  { text: "(.) CREDIT_LINE: ACTIVE",          top: "43.0%", left: "76%",    rotate: "-1deg",   size: "8px",  opacity: 0.26 },
  { text: "M1 > LIQUID",                      top: "42.7%", left: "89%",    rotate: "0deg",    size: "9px",  opacity: 0.26 },
  { text: "M2 > CREDIT",                      top: "46.4%", left: "1.5%",   rotate: "0deg",    size: "9px",  opacity: 0.27 },
  { text: "* CREDIT EXPANSION LOOP",          top: "47.8%", left: "24%",    rotate: "-0.5deg", size: "8px",  opacity: 0.24 },
  { text: "BORROW_CAP: $50M USDC",            top: "46.9%", left: "47%",    rotate: "1.5deg",  size: "8px",  opacity: 0.24 },
  { text: "(.) LEVERAGE_CAP: NONE",           top: "48.3%", left: "69%",    rotate: "0deg",    size: "8px",  opacity: 0.22 },
  { text: "M2 > CREDIT",                      top: "46.6%", left: "89%",    rotate: "0deg",    size: "9px",  opacity: 0.24 },
  { text: "M3 > SHADOW",                      top: "50.5%", left: "1.5%",   rotate: "0deg",    size: "9px",  opacity: 0.24 },
  { text: "/// SYNTHETIC LEVERAGE",           top: "51.9%", left: "20%",    rotate: "0deg",    size: "9px",  opacity: 0.30 },
  { text: "* POSITION_SIZE: FLEXIBLE",        top: "52.7%", left: "51%",    rotate: "-0.5deg", size: "8px",  opacity: 0.22 },
  { text: "SOLANA · USDC · BORROW",           top: "51.3%", left: "74%",    rotate: "-1.5deg", size: "8px",  opacity: 0.28 },
  { text: "M3 > SHADOW",                      top: "50.8%", left: "89%",    rotate: "0deg",    size: "9px",  opacity: 0.22 },
  { text: "M4 > YIELD...",                    top: "54.6%", left: "1.5%",   rotate: "0deg",    size: "9px",  opacity: 0.21 },
  { text: "(.) EARN WHILE LEVERAGED",         top: "55.4%", left: "27%",    rotate: "1deg",    size: "9px",  opacity: 0.28 },
  { text: "// REAL YIELD · REAL BORROW",      top: "56.8%", left: "58%",    rotate: "-1.5deg", size: "8px",  opacity: 0.24 },
  { text: "* LEVERAGE YOUR YIELD",            top: "54.9%", left: "81%",    rotate: "0deg",    size: "8px",  opacity: 0.24 },
  { text: "M4 > CREDIT...",                   top: "54.7%", left: "89%",    rotate: "0deg",    size: "9px",  opacity: 0.20 },
  { text: ">> LEND MULTIPLIER",               top: "59.2%", left: "3%",     rotate: "-1deg",   size: "8px",  opacity: 0.26 },
  { text: "* PREDICTION VAULT: OPEN",         top: "58.7%", left: "24%",    rotate: "0.5deg",  size: "8px",  opacity: 0.24 },
  { text: "(FUTURE_BACKED CREDIT)",           top: "60.3%", left: "49%",    rotate: "1deg",    size: "8px",  opacity: 0.24 },
  { text: "* BORROW AGAINST POSITIONS",       top: "59.8%", left: "73%",    rotate: "-0.5deg", size: "8px",  opacity: 0.22 },
  { text: "(FUTURE_BACKED CREDIT)",           top: "59.5%", left: "88%",    rotate: "1deg",    size: "8px",  opacity: 0.22 },
  { text: "> TERMINAL USD HARVEST",           top: "63.7%", left: "3%",     rotate: "0deg",    size: "8px",  opacity: 0.24 },
  { text: ">>> MONEY MULTIPLIER",             top: "64.5%", left: "22%",    rotate: "-1deg",   size: "9px",  opacity: 0.28 },
  { text: "( )))))))))) :)",                  top: "65.9%", left: "48%",    rotate: "0deg",    size: "9px",  opacity: 0.22 },
  { text: "// EPOCH CREDIT: ACTIVE",          top: "64.2%", left: "72%",    rotate: "-0.5deg", size: "8px",  opacity: 0.22 },
  { text: "+++++",                            top: "63.0%", left: "91%",    rotate: "0deg",    size: "9px",  opacity: 0.16 },
  { text: "+++++",                            top: "64.3%", left: "91%",    rotate: "0deg",    size: "9px",  opacity: 0.14 },
  { text: "* BORROW AGAINST POSITIONS",       top: "68.4%", left: "4%",     rotate: "1deg",    size: "8px",  opacity: 0.22 },
  { text: "(.) ALPHA COHORT_01",              top: "69.8%", left: "25%",    rotate: "0.5deg",  size: "9px",  opacity: 0.26 },
  { text: "* LEVERAGE YOUR YIELD",            top: "70.5%", left: "53%",    rotate: "-1deg",   size: "8px",  opacity: 0.24 },
  { text: "SOLANA · USDC · BORROW",           top: "68.9%", left: "77%",    rotate: "0deg",    size: "8px",  opacity: 0.26 },
  { text: "+++++",                            top: "67.6%", left: "91%",    rotate: "0deg",    size: "9px",  opacity: 0.15 },
  { text: "+++++",                            top: "68.9%", left: "91%",    rotate: "0deg",    size: "9px",  opacity: 0.13 },
  { text: "(.) SOVEREIGN PRODUCTIVITY...",    top: "73.2%", left: "4%",     rotate: "1deg",    size: "9px",  opacity: 0.26 },
  { text: "// CAPITAL EFFICIENCY",            top: "74.6%", left: "24%",    rotate: "-0.5deg", size: "9px",  opacity: 0.22 },
  { text: "* YIELD COMPOUND: ON",             top: "75.3%", left: "52%",    rotate: "0.5deg",  size: "8px",  opacity: 0.20 },
  { text: "(.) PERPETUAL CONDUIT",            top: "74.1%", left: "75%",    rotate: "1.5deg",  size: "8px",  opacity: 0.24 },
  { text: "(.) INFINITE CREDIT EXPANSION.....",top:"78.5%", left: "4%",     rotate: "0deg",    size: "8px",  opacity: 0.24 },
  { text: "(.) BORROW_LIMIT: NONE",           top: "79.9%", left: "27%",    rotate: "0deg",    size: "9px",  opacity: 0.22 },
  { text: "* LIVE CAPITAL MARKETS",           top: "80.7%", left: "57%",    rotate: "-0.5deg", size: "8px",  opacity: 0.22 },
  { text: "(.) FUTURE_BACKED CREDIT",         top: "79.3%", left: "80%",    rotate: "-1deg",   size: "9px",  opacity: 0.24 },
  { text: "-01",                              top: "83.1%", left: "2%",     rotate: "0deg",    size: "9px",  opacity: 0.22 },
  { text: "LEND · LEVERAGE · PROFIT",         top: "84.3%", left: "18%",    rotate: "-0.5deg", size: "10px", opacity: 0.36 },
  { text: "(.) CIRCULATING......",            top: "83.8%", left: "48%",    rotate: "0.5deg",  size: "9px",  opacity: 0.20 },
  { text: "* BORROW · EARN · REPEAT",         top: "84.9%", left: "73%",    rotate: "-0.5deg", size: "9px",  opacity: 0.22 },
  { text: "++++++++",                         top: "82.7%", left: "91%",    rotate: "0deg",    size: "9px",  opacity: 0.17 },
  { text: "* NEW MARKET",                     top: "88.2%", left: "3%",     rotate: "0deg",    size: "9px",  opacity: 0.20 },
  { text: "// PREDICTION MARKET",             top: "89.5%", left: "26%",    rotate: "0.5deg",  size: "9px",  opacity: 0.18 },
  { text: "LEND · BORROW · LEVERAGE",         top: "90.8%", left: "54%",    rotate: "-1deg",   size: "9px",  opacity: 0.22 },
  { text: "(.) SOVEREIGN PRODUCTIVITY...",    top: "89.1%", left: "78%",    rotate: "1deg",    size: "8px",  opacity: 0.18 },
  { text: "[ EXIT ]",                         top: "94.0%", left: "2%",     rotate: "0deg",    size: "9px",  opacity: 0.16 },
  { text: "* INFINITE CREDIT EXPANSION......",top: "93.4%", left: "22%",    rotate: "0deg",    size: "8px",  opacity: 0.14 },
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
      "Early on @usecusp 👀\n\nCUSP is building the DeFi capital layer on Solana starting with @Kalshi linked markets\n\nUse your prediction market position without closing it\n\nMore capital. better efficiency - all at once\n\nJoin now 👉 https://beta.cusp.fi/waitlist",
    );
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060606] flex items-center justify-center px-4 py-12 sm:py-16">

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
        className="relative z-10 w-full max-w-[420px] mt-10 sm:mt-0"
      >
        <div
          className="rounded-2xl bg-[#070707]/[0.96] p-5 sm:p-8 backdrop-blur-2xl"
          style={{
            border: "0.5px solid hsl(160 67% 48% / 0.35)",
            boxShadow: "0 0 18px hsl(160 67% 48% / 0.06), 0 8px 32px rgba(0,0,0,0.45)",
          }}
        >

          {/* badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-[5px] text-[10px] font-semibold uppercase tracking-[0.14em] text-white/52">
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ background: TEAL }}
            />
            Early Access
          </span>

          <h1 className="mt-4 text-[1.45rem] sm:text-[1.85rem] font-bold leading-[1.1] tracking-tight text-white">
            The DeFi capital layer for prediction markets.
          </h1>

          <p className="mt-2.5 text-sm leading-relaxed text-white/46">
            Yield, credit, and portfolio tooling for event-market positions.
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
                    style={{ background: "hsl(160 67% 48% / 0.15)", color: TEAL }}
                  >
                    ✓
                  </span>
                  <p className="text-sm font-semibold text-white">You're on the list</p>
                </div>
                <p className="text-xs text-white/40 pl-[30px]">We'll reach out when you're in.</p>
                <Button
                  onClick={shareOnX}
                  className="h-10 w-full rounded-xl border text-xs font-semibold hover:bg-white/[0.04] transition-colors"
                  style={{ borderColor: "hsl(160 67% 48% / 0.3)", color: TEAL, background: "transparent" }}
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
                  className="h-12 rounded-xl border-white/[0.1] bg-white/[0.05] px-4 text-white placeholder:text-white/28 focus-visible:ring-1 focus-visible:ring-white/18"
                />
                <Button
                  type="submit"
                  disabled={waitlist.status === "loading"}
                  className="h-12 w-full rounded-xl text-sm font-semibold text-[#070707] shadow-none transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                  style={{
                    background: `linear-gradient(135deg, hsl(160 67% 48%) 0%, hsl(160 67% 38%) 100%)`,
                    boxShadow: "0 0 16px hsl(160 67% 48% / 0.28), 0 2px 8px rgba(0,0,0,0.3)",
                  }}
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

        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-white/16">
          Built on Solana · Private alpha
        </p>
      </motion.div>
    </div>
  );
};

export default Waitlist;
