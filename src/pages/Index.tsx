import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import YieldCounter from "@/components/YieldCounter";
import APYBreakdown from "@/components/APYBreakdown";
import { faqItems } from "@/data/mockData";
import { useProtocolState } from "@/hooks/useProtocolState";
import { useState } from "react";
import { ArrowRight, Lock, Percent, ShieldCheck } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

const Skyline = () => (
  <svg viewBox="0 0 1000 300" className="w-full h-full opacity-[0.04] grayscale" preserveAspectRatio="xMidYMax slice">
    <path d="M0 300 H1000 V280 L980 250 H960 V220 L940 180 H920 V250 H900 V100 H880 V250 H860 V50 H840 V250 H820 V150 H800 V250 H780 V120 H760 V250 H740 V180 H720 V250 H700 V80 H680 V250 H660 V140 H640 V250 H620 V40 H600 V250 H580 V160 H560 V250 H540 V90 H520 V250 H500 V130 H480 V250 H460 V20 H440 V250 H420 V110 H400 V250 H380 V60 H360 V250 H340 V150 H320 V250 H300 V70 H280 V250 H260 V190 H240 V250 H220 V30 H200 V250 H180 V120 H160 V250 H140 V90 H120 V250 H100 V40 H80 V250 H60 V160 H40 V250 H20 V100 H0 Z" fill="currentColor" />
    <path d="M200 250 L220 30 L240 250" fill="none" stroke="currentColor" strokeWidth="0.5" />
    <path d="M440 250 L460 20 L480 250" fill="none" stroke="currentColor" strokeWidth="0.5" />
    <path d="M600 250 L620 40 L640 250" fill="none" stroke="currentColor" strokeWidth="0.5" />
    <circle cx="220" cy="30" r="2" fill="currentColor" />
    <circle cx="460" cy="20" r="2" fill="currentColor" />
    <circle cx="620" cy="40" r="2" fill="currentColor" />
  </svg>
);

const Index = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { state: protocolState } = useProtocolState();

  const currentYield = 19.4;

  return (
    <Layout>
      <div className="w-full border-x border-border max-w-7xl mx-auto min-h-screen flex flex-col bg-bg-0">
        
        {/* HERO SECTION */}
        <section className="grid grid-cols-1 md:grid-cols-2 border-b border-border min-h-[85vh] relative overflow-hidden">
          {/* Background Monument */}
          <div className="absolute inset-0 z-0 pointer-events-none">
             <Skyline />
          </div>
          
          {/* Left - Branding */}
          <div className="relative z-10 border-b md:border-b-0 md:border-r border-border p-8 md:p-16 lg:p-24 flex flex-col justify-center overflow-hidden corner-mark">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <span className="text-xs font-mono text-cusp-teal uppercase tracking-[0.3em] mb-8 block">Institutional Grade / Solana</span>
              <h1 className="text-7xl md:text-8xl lg:text-9xl font-bold tracking-tighter text-foreground leading-[0.85] mb-12">
                Yield<br/>Redefined.
              </h1>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/vault"
                  className="inline-flex items-center justify-center gap-2 px-10 py-5 bg-cusp-teal text-primary-foreground rounded-full text-lg font-bold hover:opacity-90 transition-all hover:scale-105"
                >
                  Enter Vault <ArrowRight className="size-6" />
                </Link>
                <Link
                  to="/markets"
                  className="inline-flex items-center justify-center gap-2 px-10 py-5 border border-border rounded-full text-lg font-bold hover:bg-bg-1 transition-all"
                >
                  Explore Markets
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Right - Market Interaction */}
          <div className="relative z-10 p-8 md:p-16 lg:p-24 flex flex-col justify-center bg-bg-1/20 backdrop-blur-sm overflow-hidden corner-mark">
             {/* Large Ghost Number */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[25vw] font-bold text-foreground/[0.02] select-none pointer-events-none">
                19%
             </div>

             <motion.div 
               initial="hidden" animate="visible" variants={fadeUp} custom={3}
               className="bg-bg-0 border border-border p-10 rounded-[32px] shadow-2xl relative z-10 max-w-md mx-auto w-full group hover:border-cusp-teal/30 transition-colors"
             >
                <div className="flex items-center justify-between mb-10">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono mb-1">Cusp / Yield Market</span>
                    <span className="font-bold text-xl tracking-tight text-foreground/90">USDC Lending Pool</span>
                  </div>
                  <div className="flex items-center gap-2 bg-cusp-green/10 border border-cusp-green/20 px-3 py-1 rounded-full">
                     <div className="size-1.5 rounded-full bg-cusp-green animate-pulse" />
                     <span className="text-[10px] font-mono text-cusp-green uppercase tracking-widest">Live</span>
                  </div>
                </div>

                <div className="text-center mb-10">
                   <div className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-mono mb-2">Current Variable APY</div>
                   <div className="text-7xl font-mono font-bold text-cusp-teal tracking-tighter">
                      <YieldCounter value={currentYield} suffix="%" decimals={1} />
                   </div>
                </div>

                {/* YES / NO Selection Visual */}
                <div className="grid grid-cols-2 gap-4 mb-10">
                   <div className="flex flex-col items-center gap-3 p-6 rounded-[24px] bg-cusp-green/5 border border-cusp-green/10 group-hover:bg-cusp-green/10 transition-colors">
                      <span className="text-3xl font-bold text-cusp-green/80">YES</span>
                      <span className="text-[10px] font-mono text-cusp-green/40">LONG 1.4x</span>
                   </div>
                   <div className="flex flex-col items-center gap-3 p-6 rounded-[24px] bg-cusp-red/5 border border-cusp-red/10 group-hover:bg-cusp-red/10 transition-colors">
                      <span className="text-3xl font-bold text-cusp-red/80">NO</span>
                      <span className="text-[10px] font-mono text-cusp-red/40">SHORT 3.1x</span>
                   </div>
                </div>

                <div className="border-t border-border pt-8 flex justify-between items-end">
                   <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono mb-1">Total TVL</span>
                      <span className="text-2xl font-mono font-bold text-foreground">
                        ${((protocolState?.total_tvl ?? 0) >= 1_000_000 ? `${((protocolState?.total_tvl ?? 0) / 1_000_000).toFixed(1)}M` : (protocolState?.total_tvl ?? 0).toLocaleString())}
                      </span>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono mb-1">Safety Score</span>
                      <span className="text-xl font-mono text-cusp-teal font-bold tracking-widest">AA+</span>
                   </div>
                </div>
             </motion.div>
          </div>
        </section>

        {/* FEATURE 1: Vault */}
        <section className="grid grid-cols-1 md:grid-cols-2 border-b border-border overflow-hidden relative">
          <div className="absolute -left-10 top-1/2 -translate-y-1/2 font-mono text-[20vw] font-bold text-foreground/[0.01] select-none pointer-events-none rotate-90">
             YIELD
          </div>
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-10%" }} variants={fadeUp} custom={0}
            className="border-b md:border-b-0 md:border-r border-border p-8 md:p-16 lg:p-24 flex flex-col justify-center corner-mark"
          >
            <span className="text-xs font-mono text-cusp-amber uppercase tracking-widest mb-6 block">01 / Deposit</span>
            <h2 className="text-5xl md:text-6xl font-bold mb-8 leading-[0.9] tracking-tighter">Your capital,<br/>working harder.</h2>
            <p className="text-lg text-muted-foreground mb-12 leading-relaxed max-w-md">
              Cusp Vault harvests premium from prediction markets by farming high-probability outcomes. Real yield, settled on-chain.
            </p>
            <Link to="/vault" className="inline-flex items-center justify-center px-8 py-3 border border-border rounded-full text-sm font-bold hover:bg-bg-2 transition-colors self-start">
              Launch Vault
            </Link>
          </motion.div>
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-10%" }} variants={fadeUp} custom={1}
            className="p-8 md:p-16 lg:p-24 bg-bg-1/10 flex flex-col justify-center items-center relative overflow-hidden"
          >
            <div className="absolute inset-0 drafting-dots opacity-10" />
            {/* Mockup Card */}
            <div className="w-full max-w-md bg-bg-0 border border-border rounded-[24px] p-10 shadow-2xl relative z-10">
               <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-8">Performance History</h3>
               <div className="h-48 flex items-end gap-2">
                  {[40, 65, 45, 90, 60, 80, 100].map((h, i) => (
                    <motion.div 
                      key={i}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      transition={{ delay: i * 0.1, duration: 1, ease: "circOut" }}
                      className="flex-1 bg-cusp-teal/20 border-t-2 border-cusp-teal"
                    />
                  ))}
               </div>
               <div className="mt-8 flex justify-between">
                  <span className="text-[10px] font-mono text-muted-foreground">MAR 24</span>
                  <span className="text-[10px] font-mono text-cusp-teal">CURRENT</span>
               </div>
            </div>
          </motion.div>
        </section>

        {/* FEATURE 2: Borrow */}
        <section className="grid grid-cols-1 md:grid-cols-2 border-b border-border overflow-hidden relative">
          <div className="absolute -right-20 top-1/2 -translate-y-1/2 font-mono text-[20vw] font-bold text-foreground/[0.01] select-none pointer-events-none -rotate-90">
             LOAN
          </div>
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-10%" }} variants={fadeUp} custom={0}
            className="p-8 md:p-16 lg:p-24 bg-bg-1/10 flex flex-col justify-center items-center border-b md:border-b-0 md:border-r border-border order-2 md:order-1 relative overflow-hidden"
          >
            <div className="absolute inset-0 drafting-dots opacity-10" />
            <div className="w-full max-w-md bg-bg-0 border border-border rounded-[24px] p-10 shadow-2xl relative z-10">
               <div className="flex justify-between items-center mb-8">
                 <span className="font-mono text-xs uppercase text-muted-foreground tracking-widest">Health Factor</span>
                 <span className="text-cusp-green font-mono font-bold bg-cusp-green/10 border border-cusp-green/20 px-3 py-1 rounded-full text-xs">2.41</span>
               </div>
               <div className="flex items-end gap-2 mb-4">
                 <span className="text-6xl font-mono font-bold text-foreground">1.50</span>
                 <span className="text-xl font-mono text-muted-foreground mb-2">M</span>
               </div>
               <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-8">Total Borrowed / USDC</div>
               <div className="grid grid-cols-2 gap-8 border-t border-border pt-8">
                 <div>
                   <span className="text-[10px] text-muted-foreground block uppercase font-mono tracking-widest mb-2">Collateral</span>
                   <span className="font-mono text-xl">$4.2M</span>
                 </div>
                 <div>
                   <span className="text-[10px] text-muted-foreground block uppercase font-mono tracking-widest mb-2">Utilization</span>
                   <span className="font-mono text-xl text-cusp-purple">35.7%</span>
                 </div>
               </div>
            </div>
          </motion.div>
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-10%" }} variants={fadeUp} custom={1}
            className="p-8 md:p-16 lg:p-24 flex flex-col justify-center order-1 md:order-2 corner-mark"
          >
            <span className="text-xs font-mono text-cusp-purple uppercase tracking-widest mb-6 block">02 / Borrow</span>
            <h2 className="text-5xl md:text-6xl font-bold mb-8 leading-[0.9] tracking-tighter">Liquidity at<br/>the speed of light.</h2>
            <p className="text-lg text-muted-foreground mb-12 leading-relaxed max-w-md">
              Unlock instant USDC by collateralizing your prediction positions. No need to exit your trade to access capital.
            </p>
            <Link to="/lend" className="inline-flex items-center justify-center px-8 py-3 border border-border rounded-full text-sm font-bold hover:bg-bg-2 transition-colors self-start">
              Borrow Now
            </Link>
          </motion.div>
        </section>

        {/* SECURITY */}
        <section className="px-8 py-32 md:py-48 border-b border-border text-center relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-full drafting-dots opacity-[0.05] pointer-events-none" />
           <motion.h2 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-10%" }} variants={fadeUp} custom={0}
            className="text-6xl md:text-8xl lg:text-9xl font-bold mb-32 leading-[0.8] tracking-tighter"
          >
            Immutable.<br/>Audit-proven.
          </motion.h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto text-left relative z-10">
            {[
              { icon: ShieldCheck, color: "text-cusp-teal", title: "Open Source", desc: "Our smart contracts are verified and open for public inspection on-chain." },
              { icon: Lock, color: "text-cusp-amber", title: "Non-Custodial", desc: "You maintain full control of your keys and funds at all times. Always." },
              { icon: Percent, color: "text-cusp-purple", title: "Real Yield", desc: "Revenue generated from spread lending, not inflationary token emissions." },
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-10%" }} variants={fadeUp} custom={i+1}
                className="border border-border p-10 bg-bg-1/40 rounded-[28px] hover:bg-bg-1 transition-all hover:border-cusp-teal/20 group corner-mark"
              >
                 <feature.icon className={`size-10 ${feature.color} mb-8 group-hover:scale-110 transition-transform`} />
                 <h3 className="font-bold text-xl mb-4 tracking-tight">{feature.title}</h3>
                 <p className="text-muted-foreground leading-relaxed text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="grid grid-cols-1 md:grid-cols-2 overflow-hidden relative">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-10%" }} variants={fadeUp} custom={0}
            className="border-b md:border-b-0 md:border-r border-border p-8 md:p-16 lg:p-24 corner-mark"
          >
            <h2 className="text-6xl font-bold mb-8 tracking-tighter">FAQ</h2>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-sm">Common questions regarding the Cusp protocol and architecture.</p>
          </motion.div>
          <div className="flex flex-col bg-bg-1/5">
            {faqItems.map((item, i) => (
              <div key={i} className="border-b border-border last:border-b-0 p-10 md:px-16 md:py-12 hover:bg-bg-1/30 transition-colors relative corner-mark">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left flex items-center justify-between group"
                >
                  <span className="font-bold text-xl pr-6 group-hover:text-cusp-teal transition-colors tracking-tight">{item.q}</span>
                  <div className={`size-8 rounded-full border border-border flex items-center justify-center transition-all ${openFaq === i ? "rotate-45 bg-cusp-teal border-cusp-teal text-black" : "text-muted-foreground"}`}>
                    <span className="text-xl font-light">+</span>
                  </div>
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="mt-8 text-muted-foreground leading-relaxed text-lg">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Index;
