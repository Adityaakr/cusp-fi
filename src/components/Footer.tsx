import PlasmaBackdrop from "@/components/PlasmaBackdrop";
import { Mail, Twitter } from "lucide-react";
import { Link } from "react-router-dom";

const productLinks = [
  { to: "/lend", label: "Borrow" },
  { to: "/vault", label: "Earn" },
  { to: "/markets", label: "Markets" },
  { to: "/portfolio", label: "Portfolio" },
];

const companyLinks = [
  { to: "/waitlist", label: "Waitlist" },
  { href: "https://x.com/usecusp", label: "Twitter" },
  { href: "mailto:hello@cusp.fi", label: "Contact" },
];

const socials = [
  { href: "https://x.com/usecusp", label: "Twitter", Icon: Twitter },
  { href: "mailto:hello@cusp.fi", label: "Email", Icon: Mail },
];

const Footer = () => {
  return (
    <footer className="relative overflow-hidden bg-bg-0">
      {/* gradient hairline divider */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
      {/* subtle teal glow accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-60"
        style={{
          background: "radial-gradient(ellipse 50% 100% at 50% 0%, hsl(var(--cusp-teal) / 0.07), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 text-center sm:text-left">
            <div className="mb-4 flex items-center justify-center gap-2 sm:justify-start">
              <img src="/cusp-logo.png" alt="Cusp" className="h-6 w-6 rounded-full object-contain" />
              <span className="text-base font-semibold tracking-tight text-foreground">Cusp</span>
            </div>
            <p className="mx-auto max-w-xs text-xs leading-relaxed text-muted-foreground sm:mx-0">
              The capital markets layer for prediction markets. Risk, credit, settlement, and liquidation
              infrastructure for event-driven positions on Solana.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2 sm:justify-start">
              {socials.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-cusp-teal/40 hover:text-cusp-teal"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div className="text-center sm:text-left">
            <h4 className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Product</h4>
            <div className="space-y-2.5">
              {productLinks.map((l) => (
                <span
                  key={l.label}
                  className="block text-sm text-foreground/90"
                >
                  {l.label}
                </span>
              ))}
            </div>
          </div>

          {/* Protocol */}
          <div className="text-center sm:text-left">
            <h4 className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Protocol</h4>
            <div className="space-y-2.5">
              <a
                href="https://solana.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-foreground/90 transition-colors hover:text-cusp-teal"
              >
                Solana
              </a>
            </div>
          </div>

          {/* Company */}
          <div className="text-center sm:text-left">
            <h4 className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Company</h4>
            <div className="space-y-2.5">
              {companyLinks.map((l) =>
                l.to ? (
                  <Link
                    key={l.label}
                    to={l.to}
                    className="block text-sm text-foreground/90 transition-colors hover:text-cusp-teal"
                  >
                    {l.label}
                  </Link>
                ) : (
                  <a
                    key={l.label}
                    href={l.href}
                    target={l.href?.startsWith("http") ? "_blank" : undefined}
                    rel={l.href?.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="block text-sm text-foreground/90 transition-colors hover:text-cusp-teal"
                  >
                    {l.label}
                  </a>
                ),
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 border-t border-border pt-6 sm:flex-row sm:justify-between">
          <span className="text-xs text-muted-foreground">© 2026 Cusp Protocol. All rights reserved.</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Built on Solana
          </span>
        </div>
      </div>

      {/* small plasma ornament */}
      <div aria-hidden className="relative flex items-center justify-center gap-4 pb-12 pt-2">
        <span className="h-px w-16 bg-gradient-to-r from-transparent to-border sm:w-28" />
        <span className="relative size-12 overflow-hidden rounded-full border border-cusp-teal/30 shadow-[0_0_24px_-4px_hsl(var(--cusp-teal)/0.5)]">
          <PlasmaBackdrop />
        </span>
        <span className="h-px w-16 bg-gradient-to-l from-transparent to-border sm:w-28" />
      </div>
    </footer>
  );
};

export default Footer;
