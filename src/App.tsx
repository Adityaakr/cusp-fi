import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PhantomProviderWrapper } from "@/lib/phantom";
import { getOrCreateApiKey } from "@/lib/access";
import AccessGate from "@/components/AccessGate";
import Index from "./pages/Index";
import Vault from "./pages/Vault";
import Lend from "./pages/Lend";
import Markets from "./pages/Markets";
import MarketDetail from "./pages/MarketDetail";
import Portfolio from "./pages/Portfolio";
import Docs from "./pages/Docs";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const protectedRoute = (element: React.ReactNode) => (
  <AccessGate>{element}</AccessGate>
);

const App = () => {
  useEffect(() => {
    getOrCreateApiKey();
  }, []);

  return (
  <PhantomProviderWrapper>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/vault" element={protectedRoute(<Vault />)} />
            <Route path="/lend" element={protectedRoute(<Lend />)} />
            <Route path="/markets" element={protectedRoute(<Markets />)} />
            <Route path="/markets/:ticker" element={protectedRoute(<MarketDetail />)} />
            <Route path="/portfolio" element={protectedRoute(<Portfolio />)} />
            <Route path="/docs" element={protectedRoute(<Docs />)} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </PhantomProviderWrapper>
  );
};

export default App;
