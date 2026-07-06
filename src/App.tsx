import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { PhantomProviderWrapper } from "@/lib/phantom";
import { getOrCreateApiKey } from "@/lib/access";
import AccessGate from "@/components/AccessGate";
import Landing from "./pages/Landing";
import Vault from "./pages/Vault";
import Lend from "./pages/Lend";
import Markets from "./pages/Markets";
import MarketDetail from "./pages/MarketDetail";
import Portfolio from "./pages/Portfolio";
import Docs from "./pages/Docs";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Wallet SDK mounts only on routes that use it: PhantomProvider eagerly calls
// sdk.autoConnect() on mount (no opt-out), which makes injected wallets like
// Solflare pop their unlock window on the public landing page.
const protectedRoute = (element: React.ReactNode) => (
  <PhantomProviderWrapper>
    <AccessGate>{element}</AccessGate>
  </PhantomProviderWrapper>
);

const App = () => {
  useEffect(() => {
    getOrCreateApiKey();
  }, []);

  return (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/waitlist" element={<Navigate to="/" replace />} />
            <Route path="/vault" element={protectedRoute(<Vault />)} />
            <Route path="/lend" element={protectedRoute(<Lend />)} />
            <Route path="/markets" element={protectedRoute(<Markets />)} />
            <Route path="/markets/:ticker" element={protectedRoute(<MarketDetail />)} />
            <Route path="/portfolio" element={protectedRoute(<Portfolio />)} />
            <Route path="/docs" element={protectedRoute(<Docs />)} />
            <Route
              path="/auth/callback"
              element={<PhantomProviderWrapper><AuthCallback /></PhantomProviderWrapper>}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
  );
};

export default App;
