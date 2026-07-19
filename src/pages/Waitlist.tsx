import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import CountUp from "@/components/ui/count-up";
import { isValidEmail, useWaitlistSignup } from "@/hooks/useWaitlistSignup";
import { ArrowRight, Check, Share2 } from "lucide-react";
import { Link } from "react-router-dom";

const BG_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_230229_7c9bc431-46cf-489a-948d-e8144d8eb5d4.mp4";

const Waitlist = () => {
  const waitlist = useWaitlistSignup();
  const [inlineError, setInlineError] = useState("");

  // Match the landing: suppress the global brand line / body glow while mounted.
  useEffect(() => {
    document.body.classList.add("landing-solo");
    return () => document.body.classList.remove("landing-solo");
  }, []);

  const loading = waitlist.status === "loading";

  const messageForState = () => {
    if (inlineError) return inlineError;
    if (waitlist.status !== "error") return "";
    if (waitlist.errorKind === "invalid") return "Please enter a valid email address.";
    if (waitlist.errorKind === "duplicate") return "You’re already on the list.";
    return "We couldn’t add you right now. Please try again.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Inline validation before hitting the network.
    if (!isValidEmail(waitlist.email)) {
      setInlineError(
        waitlist.email.trim() ? "Please enter a valid email address." : "Please enter your email.",
      );
      return;
    }
    setInlineError("");
    await waitlist.submit();
  };

  const shareOnX = () => {
    const text = encodeURIComponent(
      "Early access to @usecusp is open 👀\n\nCusp is the open capital network behind markets that price the future, built on Solana.\n\nBorrow against live positions, earn through vaults, and keep capital productive through settlement.\n\nJoin early → https://beta.cusp.fi/waitlist",
    );
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank");
  };

  const errorMessage = messageForState();

  return (
    <div className="geist w-full h-screen supports-[height:100dvh]:h-[100dvh] overflow-hidden bg-black p-2.5 sm:p-4">
      <SEO
        title="Join the waitlist"
        description="Request early access to Cusp — the capital markets layer for prediction markets on Solana. Borrow against live positions and earn on idle capital."
        path="/waitlist"
      />

      {/* Rounded frame — the video and all chrome live inside it */}
      <div className="relative w-full h-full overflow-hidden rounded-3xl sm:rounded-[2rem]">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src={BG_VIDEO}
          autoPlay
          muted
          loop
          playsInline
        />

        {/* Navbar — logo (back to home) + status pill */}
        <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5">
          <Link
            to="/"
            className="flex items-center gap-2 text-white font-semibold text-lg sm:text-xl tracking-[-0.01em] opacity-90 transition-opacity hover:opacity-100"
          >
            <img src="/cusp-logo.png" alt="Cusp" className="h-6 w-6 sm:h-7 sm:w-7 rounded-full object-contain" />
            <span>Cusp</span>
          </Link>
          <span className="liquid-glass flex items-center gap-2 rounded-full px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white/80">
            <span aria-hidden className="size-1.5 rounded-full bg-white/70 motion-safe:animate-pulse" />
            Private Alpha
          </span>
        </header>

        {/* Content — bottom-left, matching the landing hero */}
        <div className="absolute bottom-0 left-0 right-0 sm:right-auto z-20 px-4 sm:px-12 pb-8 sm:pb-16 max-w-2xl">
          <span className="block text-white/50 text-xs sm:text-sm font-medium uppercase tracking-[0.2em] mb-3 sm:mb-4">
            Early Access
          </span>

          <h1 className="text-white font-medium tracking-[-0.02em] leading-[1] text-[clamp(1.5rem,4.6vw,2.5rem)] mb-3 sm:mb-4 whitespace-normal sm:whitespace-nowrap">
            Join the capital network.
          </h1>

          <p className="text-white/60 text-sm leading-relaxed max-w-lg">
            Get early access to Cusp the open capital network behind markets that price the future.
            Borrow against positions across diverse event markets, earn through risk-aware vaults, and
            keep liquidity productive from live trading through resolution and&nbsp;settlement.
          </p>

          {/* form / success */}
          <div className="mt-6 sm:mt-8 max-w-md">
            {waitlist.status === "success" ? (
              <div className="flex flex-col items-start gap-3">
                <div className="flex items-center gap-2.5 text-white">
                  <span className="flex size-6 items-center justify-center rounded-full bg-white/15">
                    <Check className="size-3.5" />
                  </span>
                  <span className="text-base font-medium">You’re in. We’ll be in touch.</span>
                </div>
                <button
                  onClick={shareOnX}
                  className="liquid-glass mt-1 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white/85 transition-opacity hover:opacity-80"
                >
                  <Share2 className="size-4" />
                  Share on X
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <div className="flex items-center gap-3 border-b border-white/20 py-3 transition-colors focus-within:border-white/60">
                  <input
                    type="email"
                    value={waitlist.email}
                    onChange={(e) => {
                      waitlist.setEmail(e.target.value);
                      if (inlineError) setInlineError("");
                    }}
                    placeholder="enter your email"
                    autoComplete="email"
                    disabled={loading}
                    aria-label="Email address"
                    aria-invalid={errorMessage ? true : undefined}
                    aria-describedby={errorMessage ? "waitlist-error" : undefined}
                    className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/40 sm:text-lg"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    aria-label="Request access"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? <span className="text-sm">…</span> : <ArrowRight className="size-[18px]" />}
                  </button>
                </div>

                {/* inline validation / server error */}
                <div className="mt-3 h-4">
                  {errorMessage && (
                    <p id="waitlist-error" role="alert" className="text-xs text-red-400">
                      {errorMessage}
                    </p>
                  )}
                </div>

                {/* live count */}
                <div className="mt-4 flex h-8 items-center">
                  {!waitlist.countLoading && waitlist.displayCount > 0 && (
                    <span className="liquid-glass inline-flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3.5">
                      {/* stacked avatars */}
                      <span aria-hidden className="flex items-center -space-x-2">
                        {[
                          { src: "/waitlist-avatars/solana.png", alt: "Solana" },
                          { src: "/waitlist-avatars/sphere.png", alt: "" },
                          { src: "/waitlist-avatars/superteam.png", alt: "Superteam" },
                        ].map((a, i) => (
                          <img
                            key={i}
                            src={a.src}
                            alt={a.alt}
                            className="size-5 rounded-full object-cover ring-2 ring-black/50"
                          />
                        ))}
                      </span>
                      <span className="text-xs text-white/60">
                        <CountUp value={waitlist.displayCount} className="font-semibold text-white" />
                        <span className="ml-1">already in line</span>
                      </span>
                      <span className="ml-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400">
                        Live
                      </span>
                    </span>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* follow */}
          <div className="mt-6 sm:mt-8">
            <a
              href="https://x.com/usecusp"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-white/45 transition-colors hover:text-white/80"
            >
              Follow
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span className="font-semibold text-white/70">@usecusp</span>
              for updates.
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Waitlist;
