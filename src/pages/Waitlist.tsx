import PlasmaBackdrop from "@/components/PlasmaBackdrop";
import SEO from "@/components/SEO";
import CountUp from "@/components/ui/count-up";
import { useWaitlistSignup } from "@/hooks/useWaitlistSignup";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Share2 } from "lucide-react";
import { Link } from "react-router-dom";

const TEXT_SHADOW = "0 2px 24px hsl(var(--background) / 0.85), 0 0 48px hsl(var(--background) / 0.5)";

const Waitlist = () => {
  const waitlist = useWaitlistSignup();
  const reduce = useReducedMotion();

  const shareOnX = () => {
    const text = encodeURIComponent(
      "Early on @usecusp 👀\n\nCusp is the capital markets layer for prediction markets on Solana.\n\nBorrow against live positions, earn on idle capital, and get paid the moment a market resolves.\n\nJoin now 👉 https://beta.cusp.fi/waitlist",
    );
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank");
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background dark:bg-black">
      <SEO
        title="Join the waitlist"
        description="Request early access to Cusp — the capital markets layer for prediction markets on Solana. Borrow against live positions and earn on idle capital."
        path="/waitlist"
      />
      {/* full-bleed plasma field */}
      <PlasmaBackdrop interactive />
      {/* legibility scrim */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 55% at 50% 45%, hsl(var(--background) / 0.6), transparent 75%)," +
            "linear-gradient(to bottom, hsl(var(--background) / 0.5), transparent 28%, transparent 72%, hsl(var(--background) / 0.55))",
        }}
      />

      {/* logo — top-left */}
      <Link
        to="/"
        className="fixed left-5 top-5 z-50 flex items-center gap-2 opacity-70 transition-opacity hover:opacity-100"
      >
        <img src="/cusp.png" alt="Cusp" className="h-6 w-6 rounded-full object-contain" />
        <span className="text-sm font-semibold tracking-tight text-foreground">Cusp</span>
      </Link>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-24">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-2xl text-center"
        >
          <span className="mb-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-cusp-teal">
            <span aria-hidden className="size-1.5 rounded-full bg-cusp-teal motion-safe:animate-pulse" />
            Private alpha · Early access
          </span>

          <h1
            className="text-5xl font-semibold leading-[1.02] tracking-tight text-foreground sm:text-6xl md:text-7xl"
            style={{ textShadow: TEXT_SHADOW }}
          >
            Get early access
          </h1>

          <p
            className="mx-auto mt-6 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg"
            style={{ textShadow: "0 1px 16px hsl(var(--background) / 0.8)" }}
          >
            The capital markets layer for prediction markets. Borrow against live positions, earn on idle
            capital, and get paid the moment a market resolves.
          </p>

          {/* live count — number rolls up once loaded (text stays put) */}
          <div className="mt-8 flex h-5 items-center justify-center">
            {!waitlist.countLoading && waitlist.displayCount > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-2"
              >
                <span aria-hidden className="size-1.5 rounded-full bg-cusp-teal motion-safe:animate-pulse" />
                <span className="font-mono text-xs text-muted-foreground">
                  <CountUp value={waitlist.displayCount} className="font-semibold text-foreground/80" /> already in line
                </span>
              </motion.div>
            )}
          </div>

          {/* form / success — underline input on the plasma */}
          <div className="mx-auto mt-8 max-w-md">
            {waitlist.status === "success" ? (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <p className="text-lg font-medium text-foreground">You're on the list.</p>
                <p className="text-sm text-muted-foreground">We'll reach out when you're in.</p>
                <button
                  onClick={shareOnX}
                  className="inline-flex items-center gap-2 rounded-full border border-cusp-teal/40 px-5 py-2.5 text-sm font-medium text-cusp-teal transition-colors hover:bg-cusp-teal/10"
                >
                  <Share2 className="size-4" />
                  Share on X
                </button>
              </motion.div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await waitlist.submit();
                }}
                className="group"
              >
                <div className="flex items-center gap-3 border-b-2 border-foreground/15 py-3 transition-colors focus-within:border-cusp-teal">
                  <input
                    type="email"
                    value={waitlist.email}
                    onChange={(e) => waitlist.setEmail(e.target.value)}
                    placeholder="contact@cusp.fi"
                    autoComplete="email"
                    required
                    disabled={waitlist.status === "loading"}
                    aria-label="Email address"
                    className="min-w-0 flex-1 bg-transparent text-lg text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-xl"
                  />
                  <button
                    type="submit"
                    disabled={waitlist.status === "loading"}
                    aria-label="Join the waitlist"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cusp-teal text-primary-foreground shadow-[0_0_22px_hsl(var(--cusp-teal)/0.35)] transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                  >
                    {waitlist.status === "loading" ? <span className="text-sm">…</span> : <ArrowRight className="size-5" />}
                  </button>
                </div>
                {waitlist.status === "error" && <p className="mt-3 text-left text-xs text-cusp-red">{waitlist.error}</p>}
              </form>
            )}
          </div>

          {/* follow */}
          <div className="mt-10 flex items-center justify-center">
            <a
              href="https://x.com/usecusp"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Follow us on
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span className="font-semibold">@usecusp</span>
            </a>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Waitlist;
