import Layout from "@/components/Layout";
import LoanCard from "@/components/LoanCard";
import BorrowPanel from "@/components/BorrowPanel";
import { mockActiveLoans } from "@/data/mockData";

const LendPage = () => {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground mb-1">Cusp Lend</h1>
          <p className="text-sm text-muted-foreground">Borrow against your YES/NO tokens. Keep your position open.</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Active Loans */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">Active Loans ({mockActiveLoans.length})</h3>
              <div className="space-y-3">
                {mockActiveLoans.map((loan) => (
                  <LoanCard key={loan.id} loan={loan} />
                ))}
              </div>

              {mockActiveLoans.some(l => l.healthFactor < 1.1) && (
                <div className="mt-3 p-3 bg-cusp-red/5 border border-cusp-red/20 rounded-md">
                  <p className="text-xs text-cusp-red">
                    Your loan is approaching the liquidation threshold. Add collateral or repay now.
                  </p>
                </div>
              )}
            </div>

            {/* How Lending Works */}
            <div className="bg-bg-1 border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">How Lending Works</h3>
              <div className="space-y-3">
                {[
                  { title: "Dynamic LTV", desc: "LTV adjusts based on implied probability and time to resolution. Tokens >85% probability with <48hrs to resolve get up to 82% LTV." },
                  { title: "Hard Expiry Rule", desc: "All loans are automatically closed 2 hours before market resolution. This protects both borrowers and the protocol from binary settlement risk." },
                  { title: "Liquidation", desc: "If health factor drops below 1.0, collateral is liquidated to repay the loan. Monitor your health factor closely on volatile markets." },
                ].map((item) => (
                  <div key={item.title} className="p-3 bg-bg-2 rounded-md">
                    <h4 className="text-xs font-medium text-foreground mb-1">{item.title}</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <BorrowPanel />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LendPage;
