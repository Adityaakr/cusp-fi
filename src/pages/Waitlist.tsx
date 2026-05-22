import WaitlistCapture from "@/components/WaitlistCapture";
import { useWaitlistSignup } from "@/hooks/useWaitlistSignup";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

const Waitlist = () => {
  const waitlist = useWaitlistSignup();
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg-0 flex flex-col items-center justify-center px-4">
      {/* ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, hsl(var(--cusp-teal) / 0.18), transparent), radial-gradient(ellipse 40% 30% at 90% 90%, hsl(var(--cusp-purple) / 0.10), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      {/* center content */}
      <div className="relative w-full max-w-md">
        {/* logo */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 28, delay: 0.05 }}
        >
          <Link to="/" className="mb-10 inline-flex items-center gap-2">
            <img src="/cusp.png" alt="Cusp" className="h-6 w-6 rounded-full object-contain" />
            <span className="text-sm font-semibold tracking-tight text-foreground">Cusp</span>
          </Link>
        </motion.div>

        {/* headline */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.18 }}
        >
          <h1 className="mb-2 text-[2.25rem] font-semibold leading-[1.05] tracking-tight text-foreground">
            The DeFi capital layer for prediction markets.
          </h1>
          <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
            Yield, credit, and portfolio tooling for event-market positions. Private alpha — join the queue.
          </p>
        </motion.div>

        {/* form — box opening animation */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.92, filter: "blur(12px)", y: 20 }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)", y: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 22, delay: 0.42 }}
          className="relative"
        >
          {/* teal scan line that sweeps through the card once on reveal */}
          {!reduceMotion && (
            <motion.div
              aria-hidden
              initial={{ top: "0%", opacity: 0.7 }}
              animate={{ top: "105%", opacity: 0 }}
              transition={{ duration: 0.9, delay: 0.9, ease: [0.4, 0, 0.2, 1] }}
              className="pointer-events-none absolute inset-x-6 z-10 h-px bg-gradient-to-r from-transparent via-cusp-teal/70 to-transparent"
              style={{ position: "absolute" }}
            />
          )}

          <WaitlistCapture
            waitlist={waitlist}
            variant="immersive"
            title="Get early access"
            description="Alpha invitations roll out in cohorts. Reserve your place now."
            countLabel="people already in line"
          />
        </motion.div>
      </div>

      {/* bottom strip */}
      <motion.p
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.1 }}
        className="absolute bottom-6 font-mono text-[11px] tracking-widest text-muted-foreground/40 uppercase"
      >
        Built on Solana · Private alpha
      </motion.p>
    </div>
  );
};

export default Waitlist;
