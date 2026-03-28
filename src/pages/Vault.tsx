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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground mb-1">
            Cusp Vault
          </h1>
          <p className="text-sm text-muted-foreground">
            Deposit USDC. Earn yield from prediction market positions. The vault
            does the rest.
          </p>
        </div>

        {/* Protocol Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {protocolLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-lg" />
            ))
          ) : (
            <>
              <div className="bg-bg-1 border border-border rounded-lg p-4">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  Total TVL
                </span>
                <span className="font-mono text-lg font-semibold text-foreground">
                  {totalTvl >= 1_000_000
                    ? `$${(totalTvl / 1_000_000).toFixed(2)}M`
                    : `$${totalTvl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                </span>
              </div>
              <div className="bg-bg-1 border border-border rounded-lg p-4">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  cUSDC Rate
                </span>
                <span className="font-mono text-lg font-semibold text-cusp-amber">
                  ${exchangeRate.toFixed(4)}
                </span>
              </div>
              <div className="bg-bg-1 border border-border rounded-lg p-4">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  Reserve Ratio
                </span>
                <span className="font-mono text-lg font-semibold text-foreground">
                  {(reserveRatio * 100).toFixed(1)}%
                </span>
              </div>
              <div className="bg-bg-1 border border-border rounded-lg p-4">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  Deployed
                </span>
                <span className="font-mono text-lg font-semibold text-foreground">
                  {(deployedRatio * 100).toFixed(1)}%
                </span>
              </div>
            </>
          )}
        </div>

        {/* User Stats (when connected) */}
        {isConnected && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-bg-1 border border-border rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet className="size-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Total USDC
                </span>
              </div>
              <span className="font-mono text-lg font-semibold text-foreground">
                ${userUnifiedUsdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <div className="mt-1.5 space-y-0.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Vault (devnet)</span>
                  <span className="font-mono text-muted-foreground">${userUsdcBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Trading (mainnet)</span>
                  <span className="font-mono text-cusp-amber">${userMainnetUsdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
            <div className="bg-bg-1 border border-border rounded-lg p-4">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                cUSDC Balance
              </span>
              <span className="font-mono text-lg font-semibold text-foreground">
                {userCusdc.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
            </div>
            <div className="bg-bg-1 border border-border rounded-lg p-4">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                cUSDC Value
              </span>
              <span className="font-mono text-lg font-semibold text-foreground">
                ${userUsdcValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-bg-1 border border-border rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="size-3 text-cusp-amber" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Exchange Rate
                </span>
              </div>
              <span className="font-mono text-lg font-semibold text-cusp-amber">
                ${exchangeRate.toFixed(4)}
              </span>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* NAV Chart */}
            <div className="bg-bg-1 border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">
                cUSDC Exchange Rate History
              </h3>
              {chartData.length > 1 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis
                        dataKey="date"
                        tick={{
                          fill: "#4A5068",
                          fontSize: 10,
                          fontFamily: "'Geist Mono'",
                        }}
                        axisLine={{ stroke: "#1E2235" }}
                        tickLine={false}
                        tickFormatter={(v) => v.slice(5)}
                      />
                      <YAxis
                        tick={{
                          fill: "#4A5068",
                          fontSize: 10,
                          fontFamily: "'Geist Mono'",
                        }}
                        axisLine={{ stroke: "#1E2235" }}
                        tickLine={false}
                        domain={["auto", "auto"]}
                        tickFormatter={(v: number) => `$${v.toFixed(4)}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#141720",
                          border: "1px solid #1E2235",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontFamily: "'Geist Mono'",
                        }}
                        labelStyle={{ color: "#8B92A8" }}
                        itemStyle={{ color: "#00E5CC" }}
                        formatter={(v: number) => [`$${v.toFixed(6)}`, "Rate"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="nav"
                        stroke="#00E5CC"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3, fill: "#00E5CC" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-center">
                    <div className="font-mono text-2xl text-cusp-teal mb-2">
                      ${exchangeRate.toFixed(4)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Current rate. Chart will populate as the vault operates
                      and the exchange rate changes over time.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Yield Sources */}
            <div className="bg-bg-1 border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">
                Yield Sources
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: "Position Farming",
                    desc: "Buy high-prob tokens",
                    color: "text-cusp-amber",
                    icon: TrendingUp,
                  },
                  {
                    label: "Borrow Fees",
                    desc: "Leveraged traders",
                    color: "text-cusp-purple",
                    icon: Wallet,
                  },
                  {
                    label: "Idle USDC",
                    desc: "JupiterLend reserve",
                    color: "text-cusp-teal",
                    icon: Shield,
                  },
                  {
                    label: "Close Fees",
                    desc: "Execution + close",
                    color: "text-muted-foreground",
                    icon: Clock,
                  },
                ].map(({ label, desc, color, icon: Icon }) => (
                  <div
                    key={label}
                    className="text-center p-3 bg-bg-2 rounded-md"
                  >
                    <Icon className={`size-4 mx-auto mb-1.5 ${color}`} />
                    <span className="text-xs font-medium text-foreground block">
                      {label}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Vault Positions (from protocol) */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">
                Vault Positions
                {portfolio?.positions?.length
                  ? ` (${portfolio.positions.length})`
                  : ""}
              </h3>
              {portfolio?.positions && portfolio.positions.length > 0 ? (
                <div className="space-y-2">
                  {portfolio.positions.map((p: any) => (
                    <div
                      key={p.id}
                      className="bg-bg-1 border border-border rounded-lg p-4 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-sm font-medium text-foreground">{p.market_ticker}</span>
                        <span className={`ml-2 text-xs font-mono px-1.5 py-0.5 rounded ${
                          p.side === "YES" ? "bg-cusp-green/15 text-cusp-green" : "bg-cusp-red/15 text-cusp-red"
                        }`}>
                          {p.side}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-sm text-foreground">{p.quantity?.toLocaleString()} @ ${p.entry_price?.toFixed(2)}</span>
                        <span className="text-[10px] text-muted-foreground block">Cost: ${p.usdc_cost?.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-bg-1 border border-border rounded-lg p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {isConnected
                      ? "No active vault positions yet. Deposit USDC to start earning yield."
                      : "Connect your wallet to view positions."}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <DepositWithdrawPanel />

            <div className="bg-bg-1 border border-border rounded-lg p-4">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Vault Info
              </h4>
              <div className="space-y-2">
                {[
                  [
                    "Total TVL",
                    totalTvl >= 1_000_000
                      ? `$${(totalTvl / 1_000_000).toFixed(1)}M`
                      : `$${totalTvl.toLocaleString()}`,
                  ],
                  ["cUSDC Supply", cusdcSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })],
                  ["Reserve Ratio", `${(reserveRatio * 100).toFixed(1)}%`],
                  ["Min Reserve", "20%"],
                  ["Max Leverage", "3x"],
                  ["Max Position/TVL", "8%"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-bg-1 border border-border rounded-lg p-4">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Risk Disclosure
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Prediction market outcomes carry inherent binary risk. The vault
                manages this through position sizing, probability thresholds, and
                diversification. Yield is variable and not guaranteed. cUSDC
                exchange rate reflects net protocol performance after fees and
                reserves.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default VaultPage;
