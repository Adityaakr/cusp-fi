import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const navLinks: Array<{ label: string }> = [
  { label: "Borrow" },
  { label: "Earn" },
  { label: "Markets" },
  { label: "Portfolio" },
];

const Navbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => { closeMobile(); }, [location.pathname, closeMobile]);

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
          <img src="/cusp-logo.png" alt="Cusp" className="h-6 w-6 shrink-0 rounded-full object-contain" />
          <span className="whitespace-nowrap text-sm font-semibold tracking-tight text-foreground">
            Cusp
          </span>
        </Link>

        {/* Nav sections — static labels, no navigation */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <span
              key={link.label}
              className="relative inline-flex cursor-default items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground"
            >
              {link.label}
            </span>
          ))}
        </div>

        {/* Join waitlist + mobile toggle */}
        <div className="flex items-center gap-2">
          <Link
            to="/waitlist"
            className="rounded-full bg-cusp-teal px-4 py-1.5 font-mono text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Join Waitlist
          </Link>

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
              {navLinks.map((link) => (
                <span
                  key={link.label}
                  className="flex cursor-default items-center rounded-xl px-3 py-2.5 text-sm text-muted-foreground"
                >
                  {link.label}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Navbar;
