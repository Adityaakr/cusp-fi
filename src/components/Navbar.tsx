import { Link, useLocation } from "react-router-dom";
import { useModal, usePhantom } from "@phantom/react-sdk";
import { useState, useEffect, useRef, useCallback } from "react";
import { MAINNET_RPC_URL, MAINNET_USDC_MINT } from "@/lib/network-config";
import { Menu, X } from "lucide-react";

// Always use mainnet for wallet balance — user funds live on mainnet.
const RPC_URL = MAINNET_RPC_URL;
const USDC_MINT = MAINNET_USDC_MINT;

const navLinks: Array<{ path: string; label: string; external?: boolean; soon?: boolean }> = [
  { path: "/lend", label: "Borrow" },
  { path: "/vault", label: "Lend" },
  { path: "/markets", label: "Markets" },
  { path: "/portfolio", label: "Portfolio" },
  { path: "/docs", label: "Docs" },
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

  const solanaAddress =
    addresses?.find((a) => String(a.addressType || "").toLowerCase().includes("solana"))?.address ??
    addresses?.[0]?.address ??
    null;

  const { sol, usdc } = useWalletBalance(isConnected ? solanaAddress : null);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => { closeMobile(); }, [location.pathname, closeMobile]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-bg-0/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <img src="/cusp.png" alt="Cusp" className="w-6 h-6 rounded-full object-contain" />
            <span className="font-semibold text-foreground text-sm tracking-tight">Cusp</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => {
              const isActive = !link.external && !link.path.includes("#") && location.pathname === link.path;
              const base =
                "relative py-1.5 text-sm transition-colors inline-flex items-center gap-1.5";
              const color = isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground";
              const underline = isActive
                ? "after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-px after:bg-cusp-teal"
                : "";
              const soonBadge = link.soon ? (
                <span className="text-[9px] font-mono px-1 py-px rounded-sm bg-cusp-teal/10 text-cusp-teal tracking-wider">
                  SOON
                </span>
              ) : null;

              return link.external ? (
                <a
                  key={link.path}
                  href={link.path}
                  className={`${base} ${color}`}
                >
                  {link.label}
                  {soonBadge}
                </a>
              ) : link.path.startsWith("/#") ? (
                <a
                  key={link.path}
                  href={link.path}
                  className={`${base} ${color}`}
                >
                  {link.label}
                  {soonBadge}
                </a>
              ) : (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`${base} ${color} ${underline}`}
                >
                  {link.label}
                  {soonBadge}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">

          {isConnected && usdc !== null && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span className="text-foreground/80">{usdc.toFixed(2)}</span>
              <span>USDC</span>
            </div>
          )}

          <button
            onClick={open}
            disabled={isLoading}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 font-mono ${
              isConnected
                ? "bg-cusp-teal text-primary-foreground hover:opacity-90"
                : "border border-cusp-teal/40 text-cusp-teal hover:bg-cusp-teal/5"
            }`}
          >
            {isLoading
              ? "Connecting..."
              : isConnected
                ? solanaAddress
                  ? truncateAddress(solanaAddress)
                  : "Connected"
                : "Connect Wallet"}
          </button>

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-bg-2 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-bg-0/95 backdrop-blur-md">
          <div className="px-4 py-3 flex flex-col gap-1">
            {navLinks.map((link) => {
              const isActive = !link.external && !link.path.includes("#") && location.pathname === link.path;
              const soonBadge = link.soon ? (
                <span className="ml-2 text-[9px] font-mono px-1 py-px rounded-sm bg-cusp-teal/10 text-cusp-teal tracking-wider">
                  SOON
                </span>
              ) : null;
              const cls = `px-3 py-2.5 text-sm rounded-lg transition-colors flex items-center ${
                isActive
                  ? "text-cusp-teal bg-cusp-teal/10 font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-bg-2"
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
            <div className="px-4 py-3 border-t border-border/50">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-2">
                <span className="text-[11px] text-muted-foreground">Balance</span>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-foreground/80">{usdc.toFixed(2)}</span>
                  <span className="text-muted-foreground">USDC</span>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </nav>
  );
};

export default Navbar;
