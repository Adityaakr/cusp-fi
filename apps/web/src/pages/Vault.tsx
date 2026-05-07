import Layout from "@/components/Layout";
import DepositWithdrawPanel from "@/components/DepositWithdrawPanel";
import { useProtocolState } from "@/hooks/useProtocolState";
import { useUserPortfolio, type Position } from "@/hooks/useUserPortfolio";
import { useKaminoVault, useKaminoPosition } from "@/hooks/useKaminoVault";
import { useEarnVaultState } from "@/hooks/useEarnVaultState";
import { isTestnet } from "@/lib/network-config";
import { usePhantom } from "@/lib/wallet";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, TrendingUp, Shield, Clock, Sprout } from "lucide-react";

const VaultPage = () => {
  const { state, isLoading: protocolLoading, reserveRatio, deployedRatio } = useProtocolState();
  const { data: portfolio } = useUserPortfolio();
  const { isConnected } = usePhantom();
  const { vault: kaminoVault, apy: kaminoApy, tvl: kaminoTvl, sharePrice: kaminoSharePrice } = useKaminoVault();
  const { position: kaminoPosition } = useKaminoPosition();
  const earnVault = useEarnVaultState();

  // Chart data will be populated as exchange rate changes over time
  const chartData: { date: string; nav: number }[] = [];

  const exchangeRate = state?.cusdc_exchange_rate ?? 1.0;
  const tradingPoolTvl = state?.mainnet_reserve ?? 0;
  const cusdcSupply = state?.total_cusdc_supply ?? 0;
  const protocolStatCount = isTestnet ? 2 : 4;

  const userCusdc = portfolio?.total_cusdc ?? 0;
  const userUsdcValue = userCusdc * exchangeRate;
  const userMainnetUsdc = (portfolio?.mainnet_usdt_balance ?? 0) + (portfolio?.mainnet_usdc_balance ?? 0);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground mb-1">
            Cusp Vault
          </h1>
          <p className="text-sm text-muted-foreground">
            Deposit USDT. Earn yield from prediction market positions. The vault
            does the rest.
          </p>
        </div>

        {/* Protocol Stats */}
        <div
          className={`grid grid-cols-2 gap-4 mb-8 ${isTestnet ? "md:grid-cols-2" : "md:grid-cols-4"}`}
        >
          {protocolLoading ? (
            Array.from({ length: protocolStatCount }).map((_, i) => (
              <div
                key={i}
                className="bg-bg-1 border border-border rounded-lg p-4 flex flex-col gap-2 min-h-[88px]"
              >
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-6 w-32" shimmer={i === 0} />
                <Skeleton className="h-2 w-16 mt-auto" />
              </div>
            ))
          ) : (
            <>
              <div className="bg-bg-1 border border-border rounded-lg p-4">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  Trading pool TVL
                </span>
                <span className="font-mono text-lg font-semibold text-foreground">
                  {tradingPoolTvl >= 1_000_000
                    ? `$${(tradingPoolTvl / 1_000_000).toFixed(2)}M`
                    : `$${tradingPoolTvl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                </span>
                <span className="text-[10px] text-muted-foreground/80 block mt-1">Mainnet</span>
              </div>
              <div className="bg-bg-1 border border-border rounded-lg p-4">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  cUSDT Rate
                </span>
                <span className="font-mono text-lg font-semibold text-cusp-amber">
                  ${exchangeRate.toFixed(4)}
                </span>
                {earnVault.state && earnVault.exchangeRate > 1.001 && (
                  <span className="ml-1 text-[10px] text-cusp-green">↑ earn</span>
                )}
              </div>
              {!isTestnet && (
                <>
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
                  Trading USDT (mainnet)
                </span>
              </div>
              <span className="font-mono text-lg font-semibold text-foreground">
                ${userMainnetUsdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                In your wallet for the Cusp trading pool and leveraged trades.
              </p>
            </div>
            <div className="bg-bg-1 border border-border rounded-lg p-4">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                cUSDT Balance
              </span>
              <span className="font-mono text-lg font-semibold text-foreground">
                {userCusdc.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
            </div>
            <div className="bg-bg-1 border border-border rounded-lg p-4">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                cUSDT Value
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
            {kaminoPosition && kaminoPosition.tokenValue > 0 && (
              <div className="bg-bg-1 border border-border rounded-lg p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sprout className="size-3 text-cusp-teal" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Kamino Earn
                  </span>
                </div>
                <span className="font-mono text-lg font-semibold text-cusp-teal">
                  ${kaminoPosition.tokenValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  {kaminoPosition.sharesBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} kUSDC shares
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* NAV Chart */}
            <div className="bg-bg-1 border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">
                cUSDT Exchange Rate History
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
                        itemStyle={{ color: "#28cc95" }}
                        formatter={(v: number) => [`$${v.toFixed(6)}`, "Rate"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="nav"
                        stroke="#28cc95"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3, fill: "#28cc95" }}
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
                    label: "Kamino Earn",
                    desc: kaminoApy > 0 ? `${kaminoApy.toFixed(2)}% APY` : "USDT→USDC vault yield",
                    color: "text-cusp-teal",
                    icon: Sprout,
                  },
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
                  {portfolio.positions.map((p: Position) => (
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
                      ? "No active vault positions yet. Deposit USDT to start earning yield."
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
                    "Trading pool TVL",
                    tradingPoolTvl >= 1_000_000
                      ? `$${(tradingPoolTvl / 1_000_000).toFixed(1)}M`
                      : `$${tradingPoolTvl.toLocaleString()}`,
                  ],
                  ["cUSDT Supply", cusdcSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })],
                  ...(!isTestnet
                    ? ([["Reserve Ratio", `${(reserveRatio * 100).toFixed(1)}%`]] as [string, string][])
                    : []),
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

            {kaminoVault && (
              <div className="bg-bg-1 border border-cusp-teal/30 rounded-lg p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Sprout className="size-3.5 text-cusp-teal" />
                  <h4 className="text-xs text-cusp-teal uppercase tracking-wider font-medium">
                    Kamino Earn
                  </h4>
                </div>
                <div className="space-y-2">
                  {[
                    ["APY", `${kaminoApy.toFixed(2)}%`],
                    ["kUSDC Price", `$${kaminoSharePrice.toFixed(4)}`],
                    ["TVL", kaminoTvl >= 1_000_000 ? `$${(kaminoTvl / 1_000_000).toFixed(1)}M` : `$${kaminoTvl.toLocaleString()}`],
                    ["Perf. Fee", `${(kaminoVault.performanceFeeBps / 100).toFixed(1)}%`],
["Min Deposit", `${kaminoVault.minDepositAmount} USDC`],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-mono text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                    Deposits swap USDT→USDC via Jupiter, then deposit into Kamino's Steakhouse USDC vault. kUSDC shares appreciate as yield accrues.
                  </p>
              </div>
            )}

            <div className="bg-bg-1 border border-border rounded-lg p-4">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Risk Disclosure
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Prediction market outcomes carry inherent binary risk. The vault
                manages this through position sizing, probability thresholds, and
diversification. Yield is variable and not guaranteed. cUSDT
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
