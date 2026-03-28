import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-bg-0 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src="/cusp.png" alt="Cusp" className="w-5 h-5 rounded-full object-contain" />
              <span className="font-semibold text-foreground text-sm">Cusp</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The yield and lending layer for prediction market outcome tokens.
            </p>
          </div>

          <div>
            <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Product</h4>
            <div className="space-y-2">
              <Link to="/vault" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Vault</Link>
              <Link to="/lend" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Lend</Link>
              <Link to="/markets" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Markets</Link>
            </div>
          </div>

          <div>
            <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Infrastructure</h4>
            <div className="space-y-2">
              <a href="https://dflow.net" target="_blank" rel="noopener noreferrer" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">DFlow</a>
              <a href="https://kalshi.com" target="_blank" rel="noopener noreferrer" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Kalshi</a>
              <a href="https://solana.com" target="_blank" rel="noopener noreferrer" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Solana</a>
            </div>
          </div>

          <div>
            <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Community</h4>
            <div className="space-y-2">
              <a href="#" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Documentation</a>
              <a href="#" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Twitter</a>
              <a href="#" className="block text-sm text-foreground hover:text-cusp-teal transition-colors">Discord</a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">© 2026 Cusp Protocol. All rights reserved.</span>
          <span className="text-[10px] font-mono text-muted-foreground">Built on Solana</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
