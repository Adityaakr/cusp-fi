import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-bg-0 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img src="/cusp.png" alt="Cusp" className="w-5 h-5 rounded-full object-contain" />
              <span className="font-semibold text-foreground text-sm">Cusp</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
              The DeFi layer for prediction markets. Borrow, lend, and leverage your Kalshi positions on Solana.
            </p>
          </div>

          <div>
            <h4 className="text-[11px] text-muted-foreground uppercase tracking-[0.15em] mb-3">Product</h4>
            <div className="space-y-2">
              <Link to="/lend" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Borrow</Link>
              <Link to="/vault" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Lend</Link>
              <a href="/#leverage" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Leverage</a>
              <Link to="/markets" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Markets</Link>
              <Link to="/portfolio" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Portfolio</Link>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] text-muted-foreground uppercase tracking-[0.15em] mb-3">Protocol</h4>
            <div className="space-y-2">
              <Link to="/docs" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Docs</Link>
              <a href="https://dflow.net" target="_blank" rel="noopener noreferrer" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">DFlow</a>
              <a href="https://kalshi.com" target="_blank" rel="noopener noreferrer" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Kalshi</a>
              <a href="https://solana.com" target="_blank" rel="noopener noreferrer" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Solana</a>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] text-muted-foreground uppercase tracking-[0.15em] mb-3">Company</h4>
            <div className="space-y-2">
              <a href="/#waitlist" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Waitlist</a>
              <a href="#" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Twitter</a>
              <a href="#" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Discord</a>
              <a href="mailto:hello@cusp.fi" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Contact</a>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">© 2026 Cusp Protocol. All rights reserved.</span>
          <span className="text-[10px] font-mono text-muted-foreground">Built on Solana · Powered by Kalshi</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
