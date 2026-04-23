import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PhantomProviderWrapper } from "@/lib/phantom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AuthCallback from "./pages/AuthCallback";
import Index from "./pages/Index";
import Lend from "./pages/Lend";
import MarketDetail from "./pages/MarketDetail";
import Markets from "./pages/Markets";
import NotFound from "./pages/NotFound";
import Overview from "./pages/Overview";
import Portfolio from "./pages/Portfolio";
import Vault from "./pages/Vault";

const queryClient = new QueryClient();

const App = () => (
  <PhantomProviderWrapper>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/vault" element={<Vault />} />
            <Route path="/lend" element={<Lend />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/markets/:ticker" element={<MarketDetail />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </PhantomProviderWrapper>
);

export default App;
