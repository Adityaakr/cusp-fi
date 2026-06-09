import { Link, useLocation } from "react-router-dom";
import { useModal, usePhantom } from "@phantom/react-sdk";
import { useState, useEffect, useRef, useCallback } from "react";
import { MAINNET_RPC_URL, MAINNET_USDC_MINT } from "@/lib/network-config";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

// Always use mainnet for wallet balance — user funds live on mainnet.
const RPC_URL = MAINNET_RPC_URL;
const USDC_MINT = MAINNET_USDC_MINT;

const navLinks: Array<{ path: string; label: string; external?: boolean; soon?: boolean }> = [
  { path: "/lend", label: "Borrow" },
  { path: "/vault", label: "Earn" },
  { path: "/markets", label: "Markets" },
  { path: "/portfolio", label: "Portfolio" },
];

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
    if (!address) {
      setSol(null);
      setUsdc(null);
      return;
    }

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

const Navbar = () => {
  const { open } = useModal();
  const { isConnected, isLoading, addresses } = usePhantom();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solanaAddress =
    addresses?.find((a) => String(a.addressType || "").toLowerCase().includes("solana"))?.address ??
    addresses?.[0]?.address ??
    null;

  const { sol, usdc } = useWalletBalance(isConnected ? solanaAddress : null);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => { closeMobile(); }, [location.pathname, closeMobile]);

  const walletLabel = isLoading
    ? "Connecting..."
    : isConnected
      ? solanaAddress
        ? truncateAddress(solanaAddress)
        : "Connected"
      : "Connect Wallet";

  return (
    <div
      className={`fixed inset-x-0 top-0 z-[100] transition-[background-color,border-color,backdrop-filter] duration-300 ${
        scrolled
          ? "border-b border-border bg-bg-0/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src="/cusp.png" alt="Cusp" className="h-6 w-6 shrink-0 rounded-full object-contain" />
          <span className="whitespace-nowrap text-sm font-semibold tracking-tight text-foreground">
            Cusp
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const isActive = !link.external && !link.path.includes("#") && location.pathname === link.path;
            const cls = `relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
              isActive
                ? "bg-bg-2 text-foreground"
                : "text-muted-foreground hover:bg-bg-2/60 hover:text-foreground"
            }`;
            const soonBadge = link.soon ? (
              <span className="rounded-sm bg-cusp-teal/10 px-1 py-px font-mono text-[9px] tracking-wider text-cusp-teal">SOON</span>
            ) : null;

            return link.external || link.path.startsWith("/#") ? (
              <a key={link.path} href={link.path} className={cls}>
                {link.label}
                {soonBadge}
              </a>
            ) : (
              <Link key={link.path} to={link.path} className={cls}>
                {link.label}
                {soonBadge}
              </Link>
            );
          })}
        </div>

        {/* Wallet + mobile toggle */}
        <div className="flex items-center gap-2">
          {isConnected && usdc !== null && (
            <span className="hidden items-center gap-1.5 font-mono text-xs text-muted-foreground sm:flex">
              <span className="text-foreground/80">{usdc.toFixed(2)}</span>
              <span>USDC</span>
            </span>
          )}

          <button
            onClick={open}
            disabled={isLoading}
            className={`rounded-full px-4 py-1.5 font-mono text-sm font-medium transition-colors disabled:opacity-50 ${
              isConnected
                ? "bg-cusp-teal text-primary-foreground hover:opacity-90"
                : "border border-cusp-teal/40 text-cusp-teal hover:bg-cusp-teal/5"
            }`}
          >
            {walletLabel}
          </button>

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-bg-2 hover:text-foreground md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu — floating panel under the bar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="pointer-events-auto absolute inset-x-3 top-16 rounded-2xl border border-border bg-bg-0/95 p-2 shadow-2xl backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive = !link.external && !link.path.includes("#") && location.pathname === link.path;
                const soonBadge = link.soon ? (
                  <span className="ml-2 rounded-sm bg-cusp-teal/10 px-1 py-px font-mono text-[9px] tracking-wider text-cusp-teal">SOON</span>
                ) : null;
                const cls = `flex items-center rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isActive ? "bg-cusp-teal/10 font-medium text-cusp-teal" : "text-muted-foreground hover:bg-bg-2 hover:text-foreground"
                }`;

                return link.external || link.path.startsWith("/#") ? (
                  <a key={link.path} href={link.path} className={cls}>
                    {link.label}
                    {soonBadge}
                  </a>
                ) : (
                  <Link key={link.path} to={link.path} className={cls}>
                    {link.label}
                    {soonBadge}
                  </Link>
                );
              })}
            </div>
            {isConnected && usdc !== null && (
              <div className="mt-1 flex items-center justify-between rounded-xl bg-bg-2 px-3 py-2">
                <span className="text-[11px] text-muted-foreground">Balance</span>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-foreground/80">{usdc.toFixed(2)}</span>
                  <span className="text-muted-foreground">USDC</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Navbar;
