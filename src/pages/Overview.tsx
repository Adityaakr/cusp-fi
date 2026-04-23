import { useEffect, useState } from "react";
import Layout from "@/components/Layout";

const sections = [
  { id: "overview", label: "01 Protocol Overview" },
  { id: "architecture", label: "02 System Architecture" },
  { id: "vault", label: "03 Vault System" },
  { id: "lending", label: "04 Lending System" },
  { id: "liquidation", label: "05 Liquidation Architecture" },
  { id: "settlement", label: "06 Settlement Waterfall" },
  { id: "dflow", label: "07 DFlow Integration Layer" },
  { id: "risk", label: "08 Protocol Risk Management" },
  { id: "contracts", label: "09 Smart Contract Architecture" },
  { id: "fees", label: "10 Fee Model" },
  { id: "example", label: "11 Worked Example" },
];

export default function Overview() {
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -80% 0px" }
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <Layout>
      <div className="w-full border-x border-border max-w-7xl mx-auto min-h-screen flex bg-bg-0 pt-14">
        {/* Sidebar */}
        <aside className="w-72 border-r border-border hidden md:block flex-shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto p-8">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-6">Contents</h3>
          <nav className="flex flex-col gap-2">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`text-left text-sm py-2 px-3 rounded-md transition-colors ${
                  activeSection === s.id
                    ? "bg-bg-2 text-cusp-teal font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-bg-1"
                }`}
              >
                <span className="font-mono text-cusp-teal/70 mr-2 text-xs">{s.label.split(" ")[0]}</span>
                {s.label.substring(s.label.indexOf(" ") + 1)}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-8 md:p-16 lg:p-24 overflow-y-auto">
          <div className="max-w-3xl">
             <div className="mb-16 border-b border-border pb-12">
               <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.05] mb-6">
                 Technical <span className="text-cusp-teal">Documentation</span>
               </h1>
               <p className="text-xl text-muted-foreground leading-relaxed mb-8">
                 The DeFi capital layer for prediction markets on Solana. End-to-end protocol architecture covering vault mechanics, lending, liquidation, risk management, and smart contract design.
               </p>
               <div className="flex flex-wrap gap-3">
                 <span className="px-3 py-1 bg-bg-2 border border-border rounded-full text-xs font-medium text-muted-foreground flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-cusp-teal"></div> Solana Native
                 </span>
                 <span className="px-3 py-1 bg-bg-2 border border-border rounded-full text-xs font-medium text-muted-foreground flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-cusp-amber"></div> DFlow Powered
                 </span>
                 <span className="px-3 py-1 bg-bg-2 border border-border rounded-full text-xs font-medium text-muted-foreground flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-cusp-green"></div> Kalshi Regulated
                 </span>
                 <span className="px-3 py-1 bg-bg-2 border border-border rounded-full text-xs font-medium text-muted-foreground flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-cusp-purple"></div> v1.0 - March 2026
                 </span>
               </div>
             </div>

             <div className="prose prose-invert prose-headings:font-bold prose-h2:text-3xl prose-h2:mt-16 prose-h2:mb-6 prose-h2:border-b prose-h2:border-border prose-h2:pb-4 prose-p:text-muted-foreground prose-p:leading-relaxed prose-a:text-cusp-teal prose-strong:text-foreground max-w-none">
                
                {/* 01 Overview */}
                <section id="overview" className="scroll-mt-32">
                  <h2><span className="font-mono text-cusp-teal text-lg mr-3">01</span>Protocol Overview</h2>
                  <p>CUSP is the DeFi capital layer for prediction markets on Solana. The protocol makes prediction market positions productive by enabling yield, lending, borrowing, and leverage on outcome tokens - the tokenized YES/NO positions issued by DFlow representing Kalshi markets.</p>
                  <p>The protocol serves <strong>two sides</strong>: LPs who deposit USDC and earn yield from protocol activity, and traders who gain capital efficiency on high-conviction prediction market positions without closing their exposure.</p>
                  
                  <div className="my-8 border-l-4 border-cusp-teal bg-cusp-teal/10 p-6 rounded-r-lg">
                    <div className="text-xs font-bold uppercase tracking-widest text-cusp-teal mb-2">Core thesis</div>
                    <p className="m-0 text-foreground"><strong>Combined Kalshi and Polymarket open interest exceeds $800M.</strong> Every dollar of it earns 0%. CUSP is the protocol that makes it productive. We do not replace prediction markets - we make them financially complete.</p>
                  </div>

                  <h3>What CUSP is not</h3>
                  <ul className="list-disc pl-5">
                    <li><strong>Not a prediction market.</strong> We do not compete with Kalshi or Polymarket.</li>
                    <li><strong>Not an oracle provider.</strong> We consume DFlow's price and resolution data.</li>
                    <li><strong>Not a consumer trading interface.</strong> We are infrastructure for capital efficiency.</li>
                  </ul>
                </section>

                {/* 02 Architecture */}
                <section id="architecture" className="scroll-mt-32 mt-16">
                  <h2><span className="font-mono text-cusp-teal text-lg mr-3">02</span>System Architecture</h2>
                  <p>CUSP is built as a layered system. External infrastructure (DFlow, Kalshi, Solana) provides data and execution. CUSP programs manage capital, risk, and yield. Off-chain services handle strategy execution and monitoring.</p>
                  
                  <div className="overflow-x-auto mt-8 border border-border rounded-lg">
                    <table className="w-full text-sm text-left m-0">
                      <thead className="bg-bg-1 text-xs uppercase text-muted-foreground font-mono">
                        <tr><th className="px-6 py-4 font-normal">Layer</th><th className="px-6 py-4 font-normal">Technology</th><th className="px-6 py-4 font-normal">Purpose</th></tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-border">
                          <td className="px-6 py-4 font-medium text-foreground">Smart contracts</td><td className="px-6 py-4 text-muted-foreground">Rust + Anchor</td><td className="px-6 py-4 text-muted-foreground">All on-chain programs</td>
                        </tr>
                        <tr className="border-t border-border bg-bg-1/50">
                          <td className="px-6 py-4 font-medium text-foreground">Strategy engine</td><td className="px-6 py-4 text-muted-foreground">Python 3.11 + httpx</td><td className="px-6 py-4 text-muted-foreground">Position scoring and DFlow API calls</td>
                        </tr>
                        <tr className="border-t border-border">
                          <td className="px-6 py-4 font-medium text-foreground">Keeper bot</td><td className="px-6 py-4 text-muted-foreground">TypeScript + Jito SDK</td><td className="px-6 py-4 text-muted-foreground">Health factor monitoring + liquidations</td>
                        </tr>
                        <tr className="border-t border-border bg-bg-1/50">
                          <td className="px-6 py-4 font-medium text-foreground">Frontend</td><td className="px-6 py-4 text-muted-foreground">Next.js 14 + Tailwind</td><td className="px-6 py-4 text-muted-foreground">Vault dashboard, lending UI</td>
                        </tr>
                        <tr className="border-t border-border">
                          <td className="px-6 py-4 font-medium text-foreground">Data fetching</td><td className="px-6 py-4 text-muted-foreground">SWR + 10s revalidation</td><td className="px-6 py-4 text-muted-foreground">Real-time DFlow price polling</td>
                        </tr>
                        <tr className="border-t border-border bg-bg-1/50">
                          <td className="px-6 py-4 font-medium text-foreground">Base yield</td><td className="px-6 py-4 text-muted-foreground">Kamino SDK</td><td className="px-6 py-4 text-muted-foreground">Idle USDC deployment</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 03 Vault */}
                <section id="vault" className="scroll-mt-32 mt-16">
                  <h2><span className="font-mono text-cusp-teal text-lg mr-3">03</span>Vault System</h2>
                  <p>The vault is CUSP's core capital pool. LPs deposit USDC and receive cUSDC tokens representing their share. The vault deploys capital across multiple yield strategies and returns value to LPs through a rising cUSDC exchange rate - not token emissions.</p>
                  
                  <h3>Yield sources</h3>
                  <div className="overflow-x-auto mt-6 border border-border rounded-lg">
                    <table className="w-full text-sm text-left m-0">
                      <thead className="bg-bg-1 text-xs uppercase text-muted-foreground font-mono">
                        <tr><th className="px-6 py-4 font-normal">Source</th><th className="px-6 py-4 font-normal">Target APY</th><th className="px-6 py-4 font-normal">Risk</th><th className="px-6 py-4 font-normal">Capital allocation</th></tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-border">
                          <td className="px-6 py-4 text-muted-foreground">High-conviction farming</td><td className="px-6 py-4 text-muted-foreground">8-14%</td><td className="px-6 py-4 text-muted-foreground">Low-medium</td><td className="px-6 py-4 text-muted-foreground">50-60% of vault</td>
                        </tr>
                        <tr className="border-t border-border bg-bg-1/50">
                          <td className="px-6 py-4 text-muted-foreground">Base yield (Kamino/Aave)</td><td className="px-6 py-4 text-muted-foreground">4-6%</td><td className="px-6 py-4 text-muted-foreground">Very low</td><td className="px-6 py-4 text-muted-foreground">25% reserve (always)</td>
                        </tr>
                        <tr className="border-t border-border">
                          <td className="px-6 py-4 text-muted-foreground">Lending spread</td><td className="px-6 py-4 text-muted-foreground">3-7%</td><td className="px-6 py-4 text-muted-foreground">Low</td><td className="px-6 py-4 text-muted-foreground">15-25% (Phase 2)</td>
                        </tr>
                        <tr className="border-t border-border font-bold bg-cusp-teal/5">
                          <td className="px-6 py-4 text-cusp-teal">Combined target</td><td className="px-6 py-4 text-cusp-teal">15-25%</td><td className="px-6 py-4 text-cusp-teal">Managed</td><td className="px-6 py-4 text-cusp-teal">100%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="my-8 border-l-4 border-cusp-amber bg-cusp-amber/10 p-6 rounded-r-lg">
                    <div className="text-xs font-bold uppercase tracking-widest text-cusp-amber mb-2">Reserve buffer rule</div>
                    <p className="m-0 text-foreground">25% of all LP deposits are held as liquid USDC at all times. Never deployed. Never lent. This reserve covers LP withdrawals and serves as first-loss buffer if any strategy generates bad debt. The vault program enforces this programmatically.</p>
                  </div>
                </section>

                {/* 04 Lending */}
                <section id="lending" className="scroll-mt-32 mt-16">
                  <h2><span className="font-mono text-cusp-teal text-lg mr-3">04</span>Lending System</h2>
                  <p>Traders holding DFlow outcome SPL tokens (YES/NO) can borrow USDC against their positions without closing them. The collateral model is purpose-built for binary outcome assets and uses two inputs no standard lending protocol has ever combined: <strong>implied probability</strong> and <strong>time to resolution</strong>.</p>
                  
                  <div className="my-8 bg-bg-1 border border-border rounded-lg p-6 text-center font-mono text-sm">
                    <div className="text-cusp-teal font-bold text-base mb-2">Health Factor = (Collateral Value × LTV × Time Multiplier) / Borrow Amount</div>
                    <div className="text-muted-foreground text-xs">Liquidation triggers at HF &lt; 1.0 | Warning at HF &lt; 1.10</div>
                  </div>
                </section>

                {/* 05 Liquidation */}
                <section id="liquidation" className="scroll-mt-32 mt-16">
                  <h2><span className="font-mono text-cusp-teal text-lg mr-3">05</span>Liquidation Architecture</h2>
                  <p>Binary outcome tokens are the <strong>hardest collateral type in DeFi to liquidate correctly</strong>. Standard lending protocols assume continuous price decline. YES/NO tokens jump instantly from $0.85 to $1.00 or $0.00 at resolution. CUSP handles this with three layered defense mechanisms.</p>
                  
                  <div className="my-8 border-l-4 border-cusp-red bg-cusp-red/10 p-6 rounded-r-lg">
                    <div className="text-xs font-bold uppercase tracking-widest text-cusp-red mb-2">The binary jump problem</div>
                    <p className="m-0 text-foreground">A standard liquidation bot monitoring health factors every 60 seconds could see a perfectly healthy position at 11:58 PM and worthless collateral at midnight. No partial liquidation, no Dutch auction, no gradual price recovery is possible. <strong>No existing lending protocol was designed to handle this.</strong></p>
                  </div>

                  <h3>Why full close, not partial liquidation</h3>
                  <p>Kamino and MarginFi use partial liquidations - selling 10-20% of collateral to restore health. This works for continuous-price assets where partial sale can restore the collateral ratio. For binary outcome tokens, <strong>partial liquidation is dangerous</strong>: selling 20% of a deteriorating YES position does not change the binary outcome. If the market resolves NO, the remaining 80% goes to zero. Full close on breach is the only safe approach.</p>
                </section>

                {/* 06 Settlement */}
                <section id="settlement" className="scroll-mt-32 mt-16">
                  <h2><span className="font-mono text-cusp-teal text-lg mr-3">06</span>Settlement Waterfall</h2>
                  <p>When a prediction market resolves, the protocol executes a strict settlement order. LP capital is always repaid before any trader equity is returned.</p>
                  
                  <ol className="list-decimal pl-5 space-y-2 mt-6">
                    <li><strong className="text-cusp-green">1ST PRIORITY:</strong> Repay outstanding loan to LP pool</li>
                    <li><strong className="text-cusp-green">2ND PRIORITY:</strong> Repay accrued interest to LP pool</li>
                    <li><strong className="text-cusp-amber">3RD PRIORITY:</strong> Liquidation bonus (5%) to keeper</li>
                    <li><strong className="text-cusp-blue">4TH PRIORITY:</strong> Remaining equity to borrower</li>
                    <li><strong className="text-cusp-red">SHORTFALL:</strong> Insurance fund absorbs bad debt</li>
                    <li><strong className="text-cusp-red">LAST RESORT:</strong> Reserve buffer covers remainder</li>
                  </ol>
                </section>

                {/* 07 DFlow */}
                <section id="dflow" className="scroll-mt-32 mt-16">
                  <h2><span className="font-mono text-cusp-teal text-lg mr-3">07</span>DFlow Integration Layer</h2>
                  <p>Every technical decision in CUSP is designed around DFlow's existing API surface. DFlow provides market access and routing into Kalshi without CUSP rebuilding exchange infrastructure. Outcome SPL tokens - the tokenized YES/NO positions - are the core asset primitive the entire protocol is built on.</p>
                </section>

                {/* 08 Risk */}
                <section id="risk" className="scroll-mt-32 mt-16">
                  <h2><span className="font-mono text-cusp-teal text-lg mr-3">08</span>Protocol Risk Management</h2>
                  
                  <h3>Circuit breaker conditions</h3>
                  <p>The protocol automatically pauses new loan issuance (but not existing position monitoring) if any of these conditions are met:</p>
                  <ul className="list-disc pl-5">
                    <li><strong>Insurance fund below minimum threshold</strong> - protocol is absorbing unexpected losses</li>
                    <li><strong>Total outstanding loans exceed 70% of pool TVL</strong> - over-leveraged system</li>
                    <li><strong>DFlow API errors for 5+ consecutive minutes</strong> - cannot price collateral</li>
                    <li><strong>Single market exceeds 15% of total collateral</strong> - concentration risk</li>
                  </ul>
                </section>

                {/* 09 Contracts */}
                <section id="contracts" className="scroll-mt-32 mt-16">
                  <h2><span className="font-mono text-cusp-teal text-lg mr-3">09</span>Smart Contract Architecture</h2>
                  <p>Minimal on-chain surface area. Every instruction that is not strictly necessary is deferred or moved off-chain. Complex programs are attack surface.</p>
                  <ul className="list-disc pl-5 mt-4">
                    <li><strong>48-hour upgrade timelock</strong> on all upgradeable programs - users can exit before changes take effect</li>
                    <li><strong>5-of-9 multisig</strong> for emergency pause - geographically distributed signers on Ledger hardware</li>
                    <li><strong>Sherlock audit contest</strong> before mainnet launch</li>
                    <li><strong>Immunefi bug bounty</strong> from day one - $200K max for critical findings</li>
                  </ul>
                </section>

                {/* 10 Fees */}
                <section id="fees" className="scroll-mt-32 mt-16">
                  <h2><span className="font-mono text-cusp-teal text-lg mr-3">10</span>Fee Model</h2>
                  <div className="overflow-x-auto mt-6 border border-border rounded-lg">
                    <table className="w-full text-sm text-left m-0">
                      <thead className="bg-bg-1 text-xs uppercase text-muted-foreground font-mono">
                        <tr><th className="px-6 py-4 font-normal">Fee type</th><th className="px-6 py-4 font-normal">Rate</th><th className="px-6 py-4 font-normal">Paid by</th><th className="px-6 py-4 font-normal">Distribution</th></tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-border">
                          <td className="px-6 py-4 text-muted-foreground">Vault management fee</td><td className="px-6 py-4 text-muted-foreground">1.0% per year</td><td className="px-6 py-4 text-muted-foreground">LP depositors</td><td className="px-6 py-4 text-muted-foreground">100% to protocol treasury</td>
                        </tr>
                        <tr className="border-t border-border bg-bg-1/50">
                          <td className="px-6 py-4 text-muted-foreground">Lending origination fee</td><td className="px-6 py-4 text-muted-foreground">0.5% of loan</td><td className="px-6 py-4 text-muted-foreground">Borrowers</td><td className="px-6 py-4 text-muted-foreground">80% to LP pool, 20% to treasury</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 11 Example */}
                <section id="example" className="scroll-mt-32 mt-16 mb-32">
                  <h2><span className="font-mono text-cusp-teal text-lg mr-3">11</span>End-to-End Worked Example</h2>
                  <div className="my-8 border-l-4 border-cusp-teal bg-cusp-teal/10 p-6 rounded-r-lg">
                    <div className="text-xs font-bold uppercase tracking-widest text-cusp-teal mb-2">Scenario setup</div>
                    <p className="m-0 text-foreground"><strong>Market:</strong> "Will BTC exceed $120K by June 30, 2026?" on Kalshi via DFlow</p>
                    <p className="m-0 text-foreground"><strong>Trader:</strong> Holds 1,000 YES tokens at $0.88 each ($880 total value)</p>
                    <p className="m-0 text-foreground"><strong>LTV:</strong> 35% (conservative beta parameter)</p>
                    <p className="m-0 text-foreground"><strong>Resolution:</strong> 10 days away</p>
                  </div>
                  <p>If the YES price drops to $0.69 on Day 5, the HF falls below 1.0. The Keeper fires a Jito bundle liquidation, selling the collateral at $0.69. The loan ($308) and liquidation bonus ($35) are deducted, returning $347 equity to the trader.</p>
                  <p>If the price holds and resolves YES on Day 10, the loan is force-closed 2 hours pre-resolution. The trader receives a full $1,000 payout minus the $308 loan and $5 interest, keeping $687 equity. <strong>The trader was right and full equity is returned.</strong></p>
                </section>

             </div>
          </div>
        </main>
      </div>
    </Layout>
  );
}
