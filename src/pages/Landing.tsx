import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SEO from "@/components/SEO";

const BG_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_230229_7c9bc431-46cf-489a-948d-e8144d8eb5d4.mp4";

const Landing = () => {
  // Solo landing page: suppress the global brand line / body glow while mounted.
  useEffect(() => {
    document.body.classList.add("landing-solo");
    return () => document.body.classList.remove("landing-solo");
  }, []);

  return (
    <div className="geist w-full h-screen supports-[height:100dvh]:h-[100dvh] overflow-hidden bg-black p-2.5 sm:p-4">
      <SEO path="/" />

      {/* Rounded frame — the video and all hero chrome live inside it */}
      <div className="relative w-full h-full overflow-hidden rounded-3xl sm:rounded-[2rem]">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src={BG_VIDEO}
          autoPlay
          muted
          loop
          playsInline
        />

        {/* Navbar — logo only */}
        <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5">
          <div className="flex items-center gap-2 text-white font-semibold text-lg sm:text-xl tracking-[-0.01em]">
            <img src="/cusp-logo.png" alt="Cusp" className="h-6 w-6 sm:h-7 sm:w-7 rounded-full object-contain" />
            <span>Cusp</span>
          </div>
          <span className="liquid-glass rounded-full px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white/80">
            Coming Soon
          </span>
        </header>

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 sm:right-auto z-20 px-4 sm:px-12 pb-8 sm:pb-16 max-w-2xl">
          <span className="block text-white/50 text-xs sm:text-sm font-medium uppercase tracking-[0.2em] mb-3 sm:mb-4">
            The Open Capital Network
          </span>
          <h1 className="text-white font-medium tracking-[-0.02em] leading-[0.97] text-[clamp(1.75rem,5.5vw,3rem)] mb-3 sm:mb-4">
            <span className="block whitespace-normal sm:whitespace-nowrap">Capital for markets</span>
            <span className="block whitespace-normal sm:whitespace-nowrap">that price the future.</span>
          </h1>
          <p className="text-white/60 text-sm leading-relaxed max-w-lg">
            Prediction markets created a new asset class. Cusp makes its positions productive through
            risk-aware vaults, credit, and&nbsp;settlement.
          </p>

          <Link
            to="/waitlist"
            className="group mt-6 sm:mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Join the waitlist
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Landing;
