import Layout from "@/components/Layout";
import DepositWithdrawPanel from "@/components/DepositWithdrawPanel";
import { useProtocolState } from "@/hooks/useProtocolState";
import { useUserPortfolio } from "@/hooks/useUserPortfolio";
import { useFaucet } from "@/hooks/useFaucet";
import { isTestnet } from "@/lib/network-config";
import { usePhantom } from "@phantom/react-sdk";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, TrendingUp, Shield, Clock, Droplets, Loader2 } from "lucide-react";

const VaultPage = () => {
  const { state, isLoading: protocolLoading, reserveRatio, deployedRatio } = useProtocolState();
  const { data: portfolio } = useUserPortfolio();
  const { isConnected } = usePhantom();
  const { requestAirdrop, status: faucetStatus, error: faucetError, isAvailable: faucetAvailable } = useFaucet();

  // Chart data will be populated as exchange rate changes over time
  const chartData: { date: string; nav: number }[] = [];

  const exchangeRate = state?.cusdc_exchange_rate ?? 1.0;
  const totalTvl = state?.unified_tvl ?? state?.total_tvl ?? 0;
  const mainnetReserve = state?.mainnet_reserve ?? 0;
  const cusdcSupply = state?.total_cusdc_supply ?? 0;

  const userCusdc = portfolio?.total_cusdc ?? 0;
  const userUsdcValue = userCusdc * exchangeRate;
  const userUsdcBalance = portfolio?.usdc_balance ?? 0;
  const userMainnetUsdc = portfolio?.mainnet_usdc_balance ?? 0;
  const userUnifiedUsdc = portfolio?.unified_usdc_balance ?? 0;

  return (
    <Layout>
      <div className="w-full border-x border-border max-w-7xl mx-auto min-h-screen flex flex-col bg-bg-0 pt-14">

        {/* Page Header */}
        <section className="border-b border-border px-8 md:px-16 py-12 relative overflow-hidden corner-mark">
          <div className="absolute -right-20 top-1/2 -translate-y-1/2 font-mono text-[18vw] font-bold text-foreground/[0.015] select-none pointer-events-none uppercase">
             Vault
          </div>
          <span className="text-xs font-mono text-cusp-amber uppercase tracking-widest mb-4 block">Earn / Vault</span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">Cusp Vault</h1>
          <p className="text-lg text-muted-foreground max-w-xl">Deposit USDC. Earn real yield from prediction market positions. The vault does the rest.</p>
        </section>

        {/* Protocol Stats Bar */}
        <section className="grid grid-cols-2 md:grid-cols-4 border-b border-border relative overflow-hidden">
          <div className="absolute inset-0 drafting-dots opacity-[0.03] pointer-events-none" />
          {protocolLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`p-6 ${i < 3 ? "border-r border-border" : ""} relative corner-mark`}>
                <Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-28" />
              </div>
            ))
          ) : (
            <>
              {[
                { label: "Total TVL", value: totalTvl >= 1_000_000 ? `$${(totalTvl / 1_000_000).toFixed(2)}M` : `$${totalTvl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, color: "text-foreground" },
                { label: "cUSDC Rate", value: `$${exchangeRate.toFixed(4)}`, color: "text-cusp-amber" },
                { label: "Reserve Ratio", value: `${(reserveRatio * 100).toFixed(1)}%`, color: "text-foreground" },
                { label: "Deployed", value: `${(deployedRatio * 100).toFixed(1)}%`, color: "text-cusp-teal" },
              ].map(({ label, value, color }, i) => (
                <div key={label} className={`p-6 ${i < 3 ? "border-r border-border" : ""} relative corner-mark hover:bg-bg-1/50 transition-colors`}>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono block mb-2">{label}</span>
                  <span className={`font-mono text-2xl font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </>
          )}
        </section>

        {/* User Stats */}
        {isConnected && (
          <section className="grid grid-cols-2 md:grid-cols-4 border-b border-border bg-bg-1/10 backdrop-blur-sm">
            {[
              { label: "Total USDC", value: `$${userUnifiedUsdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, color: "text-foreground" },
              { label: "cUSDC Balance", value: userCusdc.toLocaleString(undefined, { maximumFractionDigits: 4 }), color: "text-foreground" },
              { label: "cUSDC Value", value: `$${userUsdcValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, color: "text-cusp-teal" },
              { label: "Exchange Rate", value: `$${exchangeRate.toFixed(4)}`, color: "text-cusp-amber" },
            ].map(({ label, value, color }, i) => (
              <div key={label} className={`p-6 ${i < 3 ? "border-r border-border" : ""} relative corner-mark`}>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono block mb-2">{label}</span>
                <span className={`font-mono text-2xl font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </section>
        )}

        {/* Main Grid */}
        <div className="flex flex-col lg:flex-row flex-1">
          {/* Left */}
          <div className="flex-1 border-r border-border flex flex-col divide-y divide-border">

            {/* NAV Chart */}
            <div className="p-8 relative overflow-hidden corner-mark">
              <div className="absolute inset-0 drafting-dots opacity-[0.03] pointer-events-none" />
              <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-6 relative z-10">cUSDC Exchange Rate History</h3>
              {chartData.length > 1 ? (
                <div className="h-56 relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis dataKey="date" tick={{ fill: "#4A5068", fontSize: 10, fontFamily: "'Geist Mono'" }} axisLine={{ stroke: "#1E2235" }} tickLine={false} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fill: "#4A5068", fontSize: 10, fontFamily: "'Geist Mono'" }} axisLine={{ stroke: "#1E2235" }} tickLine={false} domain={["auto", "auto"]} tickFormatter={(v: number) => `$${v.toFixed(4)}`} />
                      <Tooltip contentStyle={{ backgroundColor: "#141720", border: "1px solid #1E2235", borderRadius: "6px", fontSize: "12px", fontFamily: "'Geist Mono'" }} labelStyle={{ color: "#8B92A8" }} itemStyle={{ color: "#00E5CC" }} formatter={(v: number) => [`$${v.toFixed(6)}`, "Rate"]} />
                      <Line type="monotone" dataKey="nav" stroke="#00E5CC" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: "#00E5CC" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-56 flex items-center justify-center border border-dashed border-border rounded-[24px] relative z-10 bg-bg-0/50">
                  <div className="text-center">
                    <div className="font-mono text-4xl text-cusp-teal mb-2 tracking-tighter">${exchangeRate.toFixed(4)}</div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Current Vault NAV</p>
                  </div>
                </div>
              )}
            </div>

            {/* Yield Sources */}
            <div className="p-8 relative corner-mark">
              <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-6">Yield Generation</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Position Farming", desc: "Binary premiums", color: "text-cusp-amber", Icon: TrendingUp },
                  { label: "Borrow Fees", desc: "Leveraged spread", color: "text-cusp-purple", Icon: Wallet },
                  { label: "Idle USDC", desc: "Liquidity reserve", color: "text-cusp-teal", Icon: Shield },
                  { label: "Execution", desc: "Settlement fees", color: "text-muted-foreground", Icon: Clock },
                ].map(({ label, desc, color, Icon }) => (
                  <div key={label} className="border border-border rounded-[20px] p-6 hover:bg-bg-1 transition-all group hover:border-cusp-teal/20">
                    <Icon className={`size-6 mb-4 ${color} group-hover:scale-110 transition-transform`} />
                    <span className="text-sm font-bold block mb-2 tracking-tight">{label}</span>
                    <span className="text-[11px] text-muted-foreground leading-relaxed">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Vault Positions */}
            <div className="p-8 relative corner-mark">
              <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-6">
                Active Positions{portfolio?.positions?.length ? ` (${portfolio.positions.length})` : ""}
              </h3>
              {portfolio?.positions && portfolio.positions.length > 0 ? (
                <div className="divide-y divide-border border border-border rounded-[24px] overflow-hidden bg-bg-1/10">
                  {portfolio.positions.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between px-8 py-5 hover:bg-bg-1 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`size-2 rounded-full ${p.side === "YES" ? "bg-cusp-green" : "bg-cusp-red"}`} />
                        <div className="flex flex-col">
                           <span className="font-bold tracking-tight">{p.market_ticker}</span>
                           <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{p.side} POSITION</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-sm block mb-1">{p.quantity?.toLocaleString()} @ ${p.entry_price?.toFixed(2)}</span>
                        <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter">Cost: ${p.usdc_cost?.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-[24px] p-16 text-center bg-bg-1/5">
                  <div className="font-mono text-2xl text-muted-foreground/30 mb-4 select-none uppercase tracking-[0.5em]">EMPTY</div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                    {isConnected ? "No active positions found" : "Connect wallet to view positions"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:w-96 flex flex-col divide-y divide-border relative bg-bg-1/5 backdrop-blur-sm">
            <div className="p-8 relative corner-mark">
              <DepositWithdrawPanel />
            </div>

            {/* Faucet */}
            {isTestnet && faucetAvailable && (
              <div className="p-8 relative corner-mark">
                <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">Devnet Liquidity</h4>
                <button
                  onClick={requestAirdrop}
                  disabled={faucetStatus === "loading"}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 border border-border rounded-full text-sm font-bold hover:bg-bg-2 transition-all active:scale-95 disabled:opacity-50 group"
                >
                  {faucetStatus === "loading" ? <><Loader2 className="size-4 animate-spin" /> Transferring...</> : <><Droplets className="size-4 text-cusp-teal group-hover:scale-125 transition-transform" /> Airdrop 10k USDC</>}
                </button>
                {faucetError && <p className="text-[10px] text-cusp-red mt-3 font-mono">{faucetError}</p>}
                {faucetStatus === "success" && <p className="text-[10px] text-cusp-green mt-3 font-mono">Funds delivered successfully.</p>}
              </div>
            )}

            {/* Vault Info */}
            <div className="p-8 relative corner-mark">
              <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-8">System Status</h4>
              <div className="space-y-4">
                {[
                  ["Protocol TVL", totalTvl >= 1_000_000 ? `$${(totalTvl / 1_000_000).toFixed(1)}M` : `$${totalTvl.toLocaleString()}`],
                  ["Total Supply", cusdcSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })],
                  ["Reserve Ratio", `${(reserveRatio * 100).toFixed(1)}%`],
                  ["Target Min", "20.00%"],
                  ["Leverage Cap", "3.00x"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-[11px] font-mono">
                    <span className="text-muted-foreground uppercase tracking-widest">{label}</span>
                    <span className="text-foreground font-bold">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk */}
            <div className="p-8 relative corner-mark">
              <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">Institutional Risk Disclosure</h4>
              <p className="text-[10px] text-muted-foreground leading-relaxed uppercase tracking-tighter">Prediction positions are binary. Vault maintains liquidity through JupiterLend reserves. Max drawdown is capped at 15% per epoch. Past performance does not guarantee future results.</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default VaultPage;
