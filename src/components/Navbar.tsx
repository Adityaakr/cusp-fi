import { Link, useLocation } from "react-router-dom";
import { useModal, usePhantom } from "@phantom/react-sdk";
import { useState, useEffect, useRef, useCallback } from "react";
import { SOLANA_RPC_URL, USDC_MINT_ADDRESS } from "@/lib/network-config";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";

const RPC_URL = SOLANA_RPC_URL;
const USDC_MINT = USDC_MINT_ADDRESS;

type NavLink = { path: string; label: string; external?: boolean };

const navLinks: NavLink[] = [
  { path: "/overview", label: "Overview" },
  { path: "/vault", label: "Vault" },
  { path: "/lend", label: "Lend" },
  { path: "/markets", label: "Markets" },
  { path: "/portfolio", label: "Portfolio" },
];

// Gondor-style 8-pointed star SVG mark — matches brand reference asterisk logo
function StarMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2 L13.2 10.8 L22 12 L13.2 13.2 L12 22 L10.8 13.2 L2 12 L10.8 10.8 Z" />
      <path d="M12 4.5 L12.6 10.2 L18 12 L12.6 13.8 L12 19.5 L11.4 13.8 L6 12 L11.4 10.2 Z" opacity="0.4" />
    </svg>
  );
}

function truncateAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

async function rpcCall(method: string, params: unknown[]) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function fetchSolBalance(address: string): Promise<number> {
  const result = await rpcCall("getBalance", [address, { commitment: "confirmed" }]);
  return (result?.value ?? 0) / 1e9;
}

async function fetchUsdcBalance(address: string): Promise<number> {
  const result = await rpcCall("getTokenAccountsByOwner", [
    address,
    { mint: USDC_MINT },
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  const accounts = result?.value ?? [];
  if (accounts.length === 0) return 0;
  return accounts[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
}

function useWalletBalance(address: string | null) {
  const [sol, setSol] = useState<number | null>(null);
  const [usdc, setUsdc] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!address) { setSol(null); setUsdc(null); return; }
    let cancelled = false;
    async function load() {
      try {
        const [s, u] = await Promise.all([fetchSolBalance(address!), fetchUsdcBalance(address!)]);
        if (!cancelled) { setSol(s); setUsdc(u); }
      } catch (err) {
        console.warn("[Navbar] balance fetch failed:", err);
      }
    }
    load();
    intervalRef.current = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(intervalRef.current); };
  }, [address]);

  return { sol, usdc };
}

// Individual nav link with Gondor-style animated underline sweep
function NavItem({ link, isActive }: { link: NavLink; isActive: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to={link.path}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative px-3 py-1 text-sm font-medium tracking-wide transition-colors duration-200 whitespace-nowrap flex flex-col items-center gap-0 ${
        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <span>{link.label}</span>
      {/* Sweep underline — teal for active, white for hover */}
      <span className="relative h-px w-full overflow-hidden block">
        {/* Hover underline */}
        <motion.span
          className="absolute inset-0 bg-muted-foreground/40"
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: hovered && !isActive ? 1 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{ display: "block" }}
        />
        {/* Active underline (layoutId animated between links) */}
        {isActive && (
          <motion.span
            layoutId="nav-underline"
            className="absolute inset-0 bg-cusp-teal"
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            style={{ display: "block" }}
          />
        )}
      </span>
    </Link>
  );
}

const Navbar = () => {
  const { open } = useModal();
  const { isConnected, isLoading, addresses } = usePhantom();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const logoControls = useAnimation();

  const solanaAddress =
    addresses?.find((a) => String(a.addressType || "").toLowerCase().includes("solana"))?.address ??
    addresses?.[0]?.address ??
    null;

  const { sol, usdc } = useWalletBalance(isConnected ? solanaAddress : null);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Logo star spins on every route change — Gondor brand mark behavior
  useEffect(() => {
    logoControls.start({
      rotate: [0, 45, 0],
      scale: [1, 1.15, 1],
      transition: { duration: 0.5, ease: "easeInOut" },
    });
    closeMobile();
  }, [location.pathname, logoControls, closeMobile]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-bg-0/90 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto h-14 grid grid-cols-3">

        {/* LEFT: Nav Links */}
        <div className="flex items-center border-r border-border px-4 sm:px-6 overflow-x-auto no-scrollbar">
          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden mr-3 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-bg-2 transition-colors shrink-0"
            aria-label="Toggle menu"
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileOpen
                ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X className="size-5" /></motion.span>
                : <motion.span key="m" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><Menu className="size-5" /></motion.span>
              }
            </AnimatePresence>
          </button>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavItem
                key={link.path}
                link={link}
                isActive={location.pathname === link.path}
              />
            ))}
          </div>
        </div>

        {/* CENTER: Logo with animated Gondor star mark */}
        <div className="flex items-center justify-center border-r border-border px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 group">
            {/* Animated star mark — the Gondor asterisk icon */}
            <motion.div animate={logoControls} className="relative w-7 h-7 flex items-center justify-center">
              <StarMark className="w-full h-full text-cusp-teal" />
              {/* Subtle glow ring on hover */}
              <motion.div
                className="absolute inset-0 rounded-full bg-cusp-teal/20"
                initial={{ scale: 0, opacity: 0 }}
                whileHover={{ scale: 1.6, opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
            </motion.div>
            <span className="font-bold text-foreground text-sm tracking-widest uppercase group-hover:text-cusp-teal transition-colors duration-200">Cusp</span>
          </Link>
        </div>

        {/* RIGHT: Wallet */}
        <div className="flex items-center justify-end gap-3 px-4 sm:px-6">
          {isConnected && sol !== null && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="hidden lg:flex items-center gap-2 text-xs font-mono text-muted-foreground"
            >
              <span className="text-foreground/80">{sol.toFixed(3)}</span>
              <span>SOL</span>
              {usdc !== null && usdc > 0 && (
                <>
                  <span className="text-border">|</span>
                  <span className="text-foreground/80">{usdc.toFixed(2)}</span>
                  <span>USDC</span>
                </>
              )}
            </motion.div>
          )}

          <motion.button
            onClick={open}
            disabled={isLoading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="relative px-4 py-1.5 text-sm font-medium rounded-full border border-cusp-teal/40 text-cusp-teal hover:border-cusp-teal hover:bg-cusp-teal/8 transition-colors disabled:opacity-50 font-mono whitespace-nowrap overflow-hidden group"
          >
            {/* Shimmer sweep on hover */}
            <motion.span
              className="absolute inset-0 bg-gradient-to-r from-transparent via-cusp-teal/10 to-transparent -translate-x-full group-hover:translate-x-full"
              transition={{ duration: 0.5, ease: "easeInOut" }}
              style={{ display: "block" }}
            />
            <span className="relative z-10">
              {isLoading
                ? "Connecting..."
                : isConnected
                  ? solanaAddress ? truncateAddress(solanaAddress) : "Connected"
                  : "Connect"}
            </span>
          </motion.button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="md:hidden overflow-hidden border-t border-border bg-bg-0/98 backdrop-blur-lg"
          >
            <div className="px-4 py-3 flex flex-col">
              {navLinks.map((link, i) => {
                const isActive = location.pathname === link.path;
                return (
                  <motion.div
                    key={link.path}
                    initial={{ x: -16, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.05, duration: 0.2 }}
                  >
                    <Link
                      to={link.path}
                      className={`flex items-center gap-3 px-3 py-3 text-sm border-b border-border/40 last:border-0 transition-colors ${
                        isActive ? "text-cusp-teal" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isActive && <StarMark className="w-3 h-3 text-cusp-teal shrink-0" />}
                      {!isActive && <span className="w-3 h-3 shrink-0" />}
                      {link.label}
                      {isActive && <span className="ml-auto text-[10px] font-mono text-cusp-teal/60 uppercase tracking-widest">Active</span>}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
            {isConnected && sol !== null && (
              <div className="px-6 pb-3 pt-1 border-t border-border/50 flex items-center gap-3 text-xs font-mono text-muted-foreground">
                <span className="text-foreground/80">{sol.toFixed(3)}</span>
                <span>SOL</span>
                {usdc !== null && usdc > 0 && (
                  <>
                    <span className="text-border">|</span>
                    <span className="text-foreground/80">{usdc.toFixed(2)}</span>
                    <span>USDC</span>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
