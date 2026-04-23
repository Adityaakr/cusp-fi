import Layout from "@/components/Layout";
import LoanCard from "@/components/LoanCard";
import BorrowPanel from "@/components/BorrowPanel";
import { mockActiveLoans } from "@/data/mockData";
import { AlertTriangle } from "lucide-react";

const LendPage = () => {
  const atRisk = mockActiveLoans.some((l) => l.healthFactor < 1.1);

  return (
    <Layout>
      <div className="w-full border-x border-border max-w-7xl mx-auto min-h-screen flex flex-col bg-bg-0 pt-14">

        {/* Page Header */}
        <section className="border-b border-border grid grid-cols-1 md:grid-cols-2 relative overflow-hidden">
          <div className="absolute -left-10 top-1/2 -translate-y-1/2 font-mono text-[15vw] font-bold text-foreground/[0.01] select-none pointer-events-none uppercase">
             Loan
          </div>
          <div className="px-8 md:px-16 py-12 border-b md:border-b-0 md:border-r border-border corner-mark relative z-10">
            <span className="text-xs font-mono text-cusp-purple uppercase tracking-widest mb-4 block">Capital / Borrow</span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">Borrow USDC</h1>
            <p className="text-lg text-muted-foreground">Lock your YES/NO outcome tokens as collateral. Get instant USDC liquidity while keeping your position open.</p>
          </div>
          {/* Gondor-style monumental stat */}
          <div className="px-8 md:px-16 py-12 flex flex-col justify-center relative overflow-hidden corner-mark relative z-10">
            <div className="text-[80px] md:text-[100px] font-bold font-mono leading-none text-cusp-purple/10 absolute right-8 top-1/2 -translate-y-1/2 select-none pointer-events-none">35%</div>
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Max LTV</span>
            <div className="text-5xl font-bold font-mono text-cusp-purple">35%</div>
            <p className="text-sm text-muted-foreground mt-3">Conservative initial LTV. Adjusts dynamically based on implied probability &amp; time to resolution.</p>
          </div>
        </section>

        {/* Main Layout */}
        <div className="flex flex-col lg:flex-row flex-1">
          {/* Left: Loans + Info */}
          <div className="flex-1 border-r border-border flex flex-col divide-y divide-border relative">
             <div className="absolute inset-0 drafting-dots opacity-[0.02] pointer-events-none" />
            
            {/* At-risk warning */}
            {atRisk && (
              <div className="px-8 py-4 bg-cusp-red/5 flex items-center gap-3 relative z-10 border-b border-cusp-red/10">
                <AlertTriangle className="size-4 text-cusp-red shrink-0" />
                <p className="text-sm text-cusp-red">Your loan is approaching the liquidation threshold. Add collateral or repay now.</p>
              </div>
            )}

            {/* Active Loans */}
            <div className="p-8 relative z-10 corner-mark">
              <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-6">Active Loans ({mockActiveLoans.length})</h3>
              <div className="space-y-4">
                {mockActiveLoans.map((loan) => (
                  <LoanCard key={loan.id} loan={loan} />
                ))}
              </div>
            </div>

            {/* How Lending Works */}
            <div className="p-8 relative z-10 corner-mark">
              <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-6">How It Works</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { num: "01", title: "Dynamic LTV", desc: "LTV adjusts based on implied probability and time to resolution. Tokens >85% probability with <48hrs get up to 82% LTV." },
                  { num: "02", title: "Hard Expiry Rule", desc: "All loans are automatically closed 2 hours before market resolution to protect against binary settlement risk." },
                  { num: "03", title: "Liquidation", desc: "If health factor drops below 1.0, collateral is liquidated to repay the loan. Full close — not partial." },
                ].map((item) => (
                  <div key={item.title} className="border border-border rounded-[24px] p-8 hover:bg-bg-1 transition-all hover:border-cusp-purple/20 group">
                    <span className="text-xs font-mono text-cusp-purple mb-4 block group-hover:scale-110 transition-transform origin-left">{item.num}</span>
                    <h4 className="font-bold text-foreground mb-3 text-lg tracking-tight">{item.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar: Borrow Panel */}
          <div className="lg:w-96 bg-bg-1/5 backdrop-blur-sm relative">
            <div className="p-8 corner-mark">
              <BorrowPanel />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LendPage;

export default LendPage;
          <div className="lg:w-96 bg-bg-1/5 backdrop-blur-sm relative">
            <div className="p-8 corner-mark">
              <BorrowPanel />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LendPage;
