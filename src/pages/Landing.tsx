import { useEffect } from "react";
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
    <div className="geist w-full h-screen overflow-hidden bg-black p-3 sm:p-4">
      <SEO path="/" />

      {/* Rounded frame — the video and all hero chrome live inside it */}
      <div className="relative w-full h-full overflow-hidden rounded-[2rem]">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src={BG_VIDEO}
          autoPlay
          muted
          loop
          playsInline
        />

        {/* Navbar — logo only */}
        <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 sm:px-8 py-5">
          <div className="flex items-center gap-2 text-white font-semibold text-xl tracking-[-0.01em]">
            <img src="/cusp-logo.png" alt="Cusp" className="h-7 w-7 rounded-full object-contain" />
            <span>Cusp</span>
          </div>
          <span className="liquid-glass rounded-full px-4 py-2 text-sm font-medium text-white/80">
            Coming Soon
          </span>
        </header>

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 z-20 px-6 sm:px-12 pb-10 sm:pb-16 max-w-2xl">
          <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl font-medium leading-tight tracking-tight mb-4">
            Capital markets for assets that resolve
          </h1>
          <p className="text-white/60 text-sm leading-relaxed max-w-lg">
            Cusp turns prediction market positions into productive collateral. Borrow against them
            while markets are live, get paid at resolution instead of waiting on settlement, &amp;
            earn on the capital that funds&nbsp;both.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Landing;
