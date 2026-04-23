import { useParams, Link } from "react-router-dom";
import { useMemo, useState, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import ProbabilityBar from "@/components/ProbabilityBar";
import CountdownTimer from "@/components/CountdownTimer";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { useDflowMarket, useDflowCandlesticks, useDflowOrderbook, type CandlestickTimeframe } from "@/hooks/useDflowMarkets";
import { useDflowWebSocket } from "@/hooks/useDflowWebSocket";
import { usePhantom, useSolana } from "@phantom/react-sdk";
import { VersionedTransaction } from "@solana/web3.js";
import { fetchOrderQuote } from "@/lib/dflow-api";
import { MAINNET_USDC_MINT } from "@/lib/network-config";
import { MIN_TRADE_USDC } from "@/lib/protocol-constants";
import { supabase } from "@/lib/supabase";
import { useKYC } from "@/hooks/useKYC";
import { useLeveragedTrade } from "@/hooks/useLeveragedTrade";
import { useUserPortfolio } from "@/hooks/useUserPortfolio";
import { useProtocolState } from "@/hooks/useProtocolState";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, BarChart3, Circle, Wifi, WifiOff, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

const chartConfig = {
  yesPrice: {
    label: "YES",
    color: "hsl(var(--cusp-green))",
  },
  noPrice: {
    label: "NO",
    color: "hsl(var(--cusp-red))",
  },
};

const TIMEFRAMES: CandlestickTimeframe[] = ["1D", "1W", "1M", "3M", "1Y"];

function formatOrderbookEntries(
  bids: Record<string, string>,
  limit = 12
): { price: string; quantity: string; qtyNum: number }[] {
  return Object.entries(bids)
    .map(([price, qty]) => ({ price, quantity: qty, qtyNum: parseFloat(qty) }))
    .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
    .slice(0, limit);
}

function computeDepthData(
  yesBids: { price: string; qtyNum: number }[],
  noBids: { price: string; qtyNum: number }[]
) {
  const yesCumulative = yesBids.reduce<number[]>((acc, { qtyNum }) => {
    acc.push((acc[acc.length - 1] ?? 0) + qtyNum);
    return acc;
  }, []);
  const noCumulative = noBids.reduce<number[]>((acc, { qtyNum }) => {
    acc.push((acc[acc.length - 1] ?? 0) + qtyNum);
    return acc;
  }, []);
  const maxDepth = Math.max(...yesCumulative, ...noCumulative, 1);
  return {
    yesBids: yesBids.map((b, i) => ({
      ...b,
      cumulative: yesCumulative[i],
      pct: (yesCumulative[i] / maxDepth) * 100,
    })),
    noBids: noBids.map((b, i) => ({
      ...b,
      cumulative: noCumulative[i],
      pct: (noCumulative[i] / maxDepth) * 100,
    })),
  };
}

const MarketDetail = () => {
  const { ticker } = useParams<{ ticker: string }>();
  const [timeframe, setTimeframe] = useState<CandlestickTimeframe>("1Y");
  const { isLive, prices: livePrices, orderbook: liveOrderbook, orderbookUpdatedAt, recentTrades } = useDflowWebSocket(ticker);
  const { data: market, isLoading, error } = useDflowMarket(ticker, {
    refetchInterval: isLive ? 30_000 : 10_000,
  });
  const { data: candlesticks, isLoading: chartLoading } = useDflowCandlesticks(ticker, timeframe, {
    refetchInterval: timeframe === "1D" || timeframe === "1W" ? 15_000 : 30_000,
  });
  const { data: restOrderbook, isLoading: orderbookLoading } = useDflowOrderbook(ticker, {
    refetchInterval: isLive ? false : 3_000,
  });
  const { isConnected, addresses } = usePhantom();
  const { solana, isAvailable } = useSolana();
  const [tradeSide, setTradeSide] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState("");
  const [tradeMode, setTradeMode] = useState<"direct" | "leveraged">("direct");
  const [leverage, setLeverage] = useState(1);
  const [tradeStatus, setTradeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [priceFlash, setPriceFlash] = useState(false);
  const prevPricesRef = useRef<string>("");
  const { verified: kycVerified, loading: kycLoading, startVerification } = useKYC();
  const { openPosition, status: leveragedStatus, error: leveragedError, result: leveragedResult, reset: resetLeveraged } = useLeveragedTrade();
  const { data: portfolio, refetch: refetchPortfolio } = useUserPortfolio();
  const { state: protocolState } = useProtocolState();
  const [successDetails, setSuccessDetails] = useState<{ side: string; amount: number; ticker: string } | null>(null);

  const myPositions = useMemo(() => {
    if (!portfolio?.positions || !ticker) return [];
    return portfolio.positions.filter(
      (p) => p.market_ticker.toLowerCase() === ticker.toLowerCase() && p.status === "open"
    );
  }, [portfolio?.positions, ticker]);

  // Wall clock for WS freshness (updates every second so we re-evaluate without a dummy hook dep)
  const [orderbookClock, setOrderbookClock] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setOrderbookClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Merge REST + live orderbook: prefer WS when fresh (<45s), else use REST (real DFlow orders)
  const orderbook = useMemo(() => {
    const wsFresh =
      liveOrderbook &&
      orderbookUpdatedAt &&
      orderbookClock - orderbookUpdatedAt < 45_000 &&
      Object.keys(liveOrderbook.yes_bids).length + Object.keys(liveOrderbook.no_bids).length > 0;
    if (wsFresh) return liveOrderbook;
    return restOrderbook
      ? { yes_bids: restOrderbook.yes_bids ?? {}, no_bids: restOrderbook.no_bids ?? {} }
      : null;
  }, [liveOrderbook, orderbookUpdatedAt, restOrderbook, orderbookClock]);

  const orderbookFromWs =
    liveOrderbook &&
    orderbookUpdatedAt &&
    orderbookClock - orderbookUpdatedAt < 45_000 &&
    Object.keys(liveOrderbook.yes_bids).length + Object.keys(liveOrderbook.no_bids).length > 0;

  const yesBidsRaw = orderbook ? formatOrderbookEntries(orderbook.yes_bids) : [];
  const noBidsRaw = orderbook ? formatOrderbookEntries(orderbook.no_bids) : [];
  const { yesBids, noBids } = computeDepthData(yesBidsRaw, noBidsRaw);

  // Live prices override market (yesAsk for YES, noAsk for NO; fallback to bid)
  const displayYesPrice = livePrices?.yesAsk ?? livePrices?.yesBid ?? market?.yesPrice ?? 0;
  const displayNoPrice = livePrices?.noAsk ?? livePrices?.noBid ?? market?.noPrice ?? 0;
  const displayProbability = Math.round((displayYesPrice || (1 - displayNoPrice)) * 100);

  // Chart: full market (YES + NO) — historical candlesticks + live trades + current live price
  const chartData = useMemo(() => {
    const base =
      candlesticks?.candlesticks?.map((c) => {
        const yesPrice =
          c.yes_ask?.close_dollars ?? c.price?.close_dollars ?? c.yes_bid?.close_dollars ?? "0";
        const yes = parseFloat(yesPrice);
        const no = Math.max(0, Math.min(1, 1 - yes));
        return {
          date: new Date(c.end_period_ts * 1000).toLocaleDateString("short", {
            month: "short",
            day: "numeric",
            year: timeframe === "1Y" ? "2-digit" : undefined,
          }),
          yesPrice: yes,
          noPrice: no,
          fullDate: new Date(c.end_period_ts * 1000).toLocaleDateString(),
          ts: c.end_period_ts * 1000,
        };
      }) ?? [];

    const tradePoints = recentTrades.map((t) => ({
      date: new Date(t.createdTime).toLocaleDateString("short", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      yesPrice: t.yesPrice,
      noPrice: t.noPrice,
      fullDate: new Date(t.createdTime).toLocaleString(),
      ts: t.createdTime,
    }));

    const lastBaseTs = base.length > 0 ? base[base.length - 1].ts : 0;
    const newTrades = tradePoints.filter((p) => p.ts > lastBaseTs);
    let combined = [...base, ...newTrades].sort((a, b) => a.ts - b.ts);

    // Append current live price so the chart extends to "now" and updates in real-time
    const liveYes = livePrices?.yesAsk ?? livePrices?.yesBid ?? null;
    const liveNo = livePrices?.noAsk ?? livePrices?.noBid ?? null;
    if ((liveYes != null || liveNo != null) && combined.length > 0) {
      const now = Date.now();
      const yes = liveYes ?? (liveNo != null ? Math.max(0, 1 - liveNo) : combined[combined.length - 1].yesPrice);
      const no = liveNo ?? Math.max(0, 1 - yes);
      combined = [
        ...combined,
        {
          date: "Now",
          yesPrice: yes,
          noPrice: no,
          fullDate: new Date(now).toLocaleString(),
          ts: now,
        },
      ];
    }
    return combined;
  }, [candlesticks, timeframe, recentTrades, livePrices?.yesAsk, livePrices?.yesBid, livePrices?.noAsk, livePrices?.noBid]);

  const solanaAddress = addresses?.find((a) =>
    String(a.addressType || "").toLowerCase().includes("solana")
  )?.address;

  const amountNum = parseFloat(amount);
  const isValidAmount = !isNaN(amountNum) && amountNum > 0;
  const currentPrice = tradeSide === "YES" ? displayYesPrice : displayNoPrice;
  const estimatedShares = isValidAmount && currentPrice > 0 ? amountNum / currentPrice : 0;

  // Auto-reduce leverage based on mainnet vault reserve
  const mainnetReserve = protocolState?.mainnet_reserve ?? 0;
  const effectiveLeverage = useMemo(() => {
    if (leverage <= 1 || !isValidAmount) return leverage;
    const borrowNeeded = amountNum * (leverage - 1);
    const maxBorrow = mainnetReserve * 0.8; // keep 20% reserve
    if (borrowNeeded <= maxBorrow) return leverage;
    if (maxBorrow <= 0) return 1;
    return Math.max(1, Math.floor((1 + maxBorrow / amountNum) * 10) / 10);
  }, [leverage, amountNum, mainnetReserve, isValidAmount]);
  const leverageReduced = effectiveLeverage < leverage;

  // Flash effect when live price updates (only on change, not initial)
  useEffect(() => {
    if (!livePrices) return;
    const key = `${livePrices.yesAsk ?? livePrices.yesBid}-${livePrices.noAsk ?? livePrices.noBid}`;
    if (prevPricesRef.current && prevPricesRef.current !== key) {
      setPriceFlash(true);
      const t = setTimeout(() => setPriceFlash(false), 600);
      prevPricesRef.current = key;
      return () => clearTimeout(t);
    }
    prevPricesRef.current = key;
  }, [livePrices]);

  const handleTrade = async () => {
    if (!market || !solanaAddress) {
      setTradeError("Connect your wallet to trade");
      return;
    }

    console.log("[trade] Connected wallet:", solanaAddress);
    console.log("[trade] Mode:", tradeMode, "| Side:", tradeSide, "| Amount:", amountNum);

    if (!isValidAmount) {
      setTradeError("Enter a valid amount");
      return;
    }
    if (amountNum < MIN_TRADE_USDC) {
      setTradeError(
        `Minimum ${tradeMode === "leveraged" ? "margin" : "trade"} is $${MIN_TRADE_USDC} USDC`
      );
      return;
    }
    const outputMint = tradeSide === "YES" ? market.yesMint : market.noMint;
    if (!outputMint) {
      setTradeError("Market not initialized");
      return;
    }

    console.log("[trade] Market:", market.ticker, "| Output mint:", outputMint);
    console.log("[trade] Settlement mint:", market.settlementMint);
    console.log("[trade] KYC verified:", kycVerified);

    // DFlow markets operate on mainnet — verify the user has enough mainnet USDC
    const userMainnetUsdc = portfolio?.mainnet_usdc_balance ?? 0;
    const requiredUsdc = tradeMode === "leveraged" ? amountNum : amountNum;
    if (userMainnetUsdc < requiredUsdc) {
      setTradeError(
        `Insufficient mainnet USDC. You have $${userMainnetUsdc.toFixed(2)} but need $${requiredUsdc.toFixed(2)}. DFlow trades require real mainnet USDC in your Phantom wallet.`
      );
      return;
    }

    if (tradeMode === "leveraged") {
      if (effectiveLeverage <= 1) {
        setTradeError(
          `Vault lending pool ($${mainnetReserve.toFixed(2)}) is too low to support leverage. Deposit more to the Trading pool or use Direct mode.`
        );
        return;
      }
      setTradeError(null);
      resetLeveraged();
      const result = await openPosition({
        marketTicker: market.ticker,
        side: tradeSide,
        marginUsdc: amountNum,
        leverage: effectiveLeverage,
        outputMint,
      });
      if (result) {
        setAmount("");
        setSuccessDetails({ side: tradeSide, amount: amountNum * effectiveLeverage, ticker: market.ticker });
        refetchPortfolio();
        setTimeout(() => setSuccessDetails(null), 5000);
      }
      return;
    }

    // DFlow Trade API always takes mainnet USDC as input — the settlement mint
    // (e.g. CASH) is internal to the on-chain program, not used by the quote API.
    const inputMint = MAINNET_USDC_MINT;
    const amountAtomic = Math.round(amountNum * 1_000_000);
    setTradeStatus("loading");
    setTradeError(null);
    try {
      const { transaction } = await fetchOrderQuote({
        userPublicKey: solanaAddress,
        inputMint,
        outputMint,
        amount: amountAtomic,
        slippageBps: "auto",
      });
      if (!solana || !isAvailable) {
        setTradeError("Solana wallet not ready");
        setTradeStatus("error");
        return;
      }
      const txBytes = Uint8Array.from(atob(transaction), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(txBytes);

      let result;
      try {
        result = await solana.signAndSendTransaction(tx);
      } catch (signErr) {
        const msg = signErr instanceof Error ? signErr.message : String(signErr);
        if (msg.toLowerCase().includes("revert") || msg.toLowerCase().includes("simulation")) {
          throw new Error(
            `Transaction simulation failed. This usually means insufficient mainnet USDC (have $${userMainnetUsdc.toFixed(2)}, need $${amountNum.toFixed(2)}) or insufficient SOL for network fees. Ensure your Phantom wallet has enough mainnet USDC and a small SOL balance.`
          );
        }
        throw signErr;
      }

      const sig = typeof result === "string" ? result : result?.signature ?? "";

      if (supabase && sig) {
        try {
          await supabase.rpc("record_direct_trade", {
            p_wallet_address: solanaAddress,
            p_market_ticker: market.ticker,
            p_side: tradeSide,
            p_usdc_amount: amountNum,
            p_output_mint: outputMint,
            p_tx_signature: sig,
            p_entry_price: currentPrice,
            p_quantity: amountNum / currentPrice,
          });
        } catch (_) { /* position recording is best-effort */ }
      }

      setTradeStatus("success");
      setSuccessDetails({ side: tradeSide, amount: amountNum, ticker: market.ticker });
      setAmount("");
      refetchPortfolio();
      setTimeout(() => setSuccessDetails(null), 5000);
    } catch (err) {
      setTradeError(err instanceof Error ? err.message : "Trade failed");
      setTradeStatus("error");
    }
  };

  if (isLoading || !ticker) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <Skeleton className="h-5 w-32 mb-6" />
          <Skeleton className="h-10 w-full max-w-2xl mb-8" />
          <div className="grid lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-2 h-[320px] rounded-xl" />
            <Skeleton className="h-[320px] rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !market) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <p className="text-cusp-red">Market not found.</p>
          <Link to="/markets" className="text-cusp-teal hover:underline mt-2 inline-block">
            ← Back to Markets
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Breadcrumb */}
        <Link
          to="/markets"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-cusp-teal transition-colors mb-6"
        >
          <ChevronLeft className="size-4" />
          Back to Markets
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground leading-tight">
              {market.name}
            </h1>
            {isLive && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cusp-green/15 text-cusp-green text-[11px] font-medium animate-live-pulse">
                <Circle className="size-1.5 fill-current" />
                Live
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-mono px-2 py-1 rounded-md bg-bg-2 text-muted-foreground border border-border/60">
              {market.ticker}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-md bg-bg-2 text-muted-foreground border border-border/60">
              {market.category}
            </span>
            <div className="flex items-center gap-2 min-w-[140px]">
              <ProbabilityBar probability={displayProbability} size="sm" />
            </div>
          </div>
        </div>

        {/* Stats bar - live prices */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-8">
          <div className="bg-bg-1 border border-border rounded-xl p-4 sm:p-5">
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
              Volume
            </span>
            <p className="font-mono text-base sm:text-lg font-semibold text-foreground">
              {market.volume >= 1_000_000
                ? `$${(market.volume / 1_000_000).toFixed(1)}M`
                : `$${(market.volume / 1_000).toFixed(1)}K`}
            </p>
          </div>
          <div className="bg-bg-1 border border-border rounded-xl p-4 sm:p-5">
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
              Resolves
            </span>
            <CountdownTimer
              targetDate={market.resolutionDate}
              className="font-mono text-base sm:text-lg font-semibold"
            />
          </div>
          <div
            className={`bg-bg-1 border border-border rounded-xl p-4 sm:p-5 transition-colors ${
              priceFlash ? "animate-flash" : ""
            }`}
          >
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-1.5 truncate" title={market.yesLabel}>
              {market.yesLabel || "YES"}
            </span>
            <p className="font-mono text-base sm:text-lg font-semibold text-cusp-green">
              ${displayYesPrice.toFixed(2)}
            </p>
          </div>
          <div
            className={`bg-bg-1 border border-border rounded-xl p-4 sm:p-5 transition-colors ${
              priceFlash ? "animate-flash" : ""
            }`}
          >
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-1.5 truncate" title={market.noLabel}>
              {market.noLabel || "NO"}
            </span>
            <p className="font-mono text-base sm:text-lg font-semibold text-cusp-red">
              ${displayNoPrice.toFixed(2)}
            </p>
          </div>
          {market.openInterest != null && market.openInterest > 0 && (
            <div className="bg-bg-1 border border-border rounded-xl p-4 sm:p-5 col-span-2 sm:col-span-1">
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">
                Open Interest
              </span>
              <p className="font-mono text-base sm:text-lg font-semibold text-foreground">
                {market.openInterest >= 1_000_000
                  ? `$${(market.openInterest / 1_000_000).toFixed(1)}M`
                  : `$${(market.openInterest / 1_000).toFixed(1)}K`}
              </p>
            </div>
          )}
        </div>

        {market.rulesPrimary && (
          <details className="mb-6 group">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground py-2">
              Resolution rules
            </summary>
            <div className="mt-2 p-4 bg-bg-1 border border-border rounded-xl text-xs text-muted-foreground leading-relaxed">
              {market.rulesPrimary}
              {market.rulesSecondary && (
                <p className="mt-3 pt-3 border-t border-border">{market.rulesSecondary}</p>
              )}
            </div>
          </details>
        )}

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* Chart - full market (YES + NO) */}
          <div className="lg:col-span-2 bg-bg-1 border border-border rounded-xl p-5 sm:p-6 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate">
                  Market Price History
                </h3>
                <div className="flex items-center gap-3 shrink-0 text-[11px]">
                  <span className="flex items-center gap-1.5 truncate max-w-[80px]" title={market.yesLabel}>
                    <span className="size-2 rounded-full bg-cusp-green shrink-0" />
                    {market.yesLabel || "YES"}
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground truncate max-w-[80px]" title={market.noLabel}>
                    <span className="size-2 rounded-full bg-cusp-red shrink-0" />
                    {market.noLabel || "NO"}
                  </span>
                </div>
                {isLive && (
                  <span className="shrink-0 text-[10px] font-medium text-cusp-green/90">
                    Live
                  </span>
                )}
              </div>
              <div className="flex gap-1 p-1 bg-bg-2 rounded-lg w-fit shrink-0">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      timeframe === tf
                        ? "bg-cusp-teal/20 text-cusp-teal"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            {chartLoading ? (
              <Skeleton className="h-[300px] w-full rounded-lg" />
            ) : chartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px] w-full min-h-0">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="yesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--cusp-green))" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(var(--cusp-green))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="noGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--cusp-red))" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(var(--cusp-red))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border/50"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 1]}
                    tickFormatter={(v) => `$${v.toFixed(2)}`}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    width={42}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => (
                          <span className="font-mono">${Number(value).toFixed(2)}</span>
                        )}
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.fullDate ?? ""
                        }
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="yesPrice"
                    name={market.yesLabel || "YES"}
                    stroke="hsl(var(--cusp-green))"
                    strokeWidth={2}
                    fill="url(#yesGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="noPrice"
                    name={market.noLabel || "NO"}
                    stroke="hsl(var(--cusp-red))"
                    strokeWidth={2}
                    fill="url(#noGradient)"
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm rounded-lg border border-dashed border-border">
                No chart data available
              </div>
            )}
          </div>

          {/* Trade Panel */}
          <div className="bg-bg-1 border border-border rounded-xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Trade</h3>
              {isConnected && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${kycVerified ? "text-cusp-green" : "text-cusp-amber"}`}>
                  {kycVerified ? <ShieldCheck className="size-3" /> : <AlertTriangle className="size-3" />}
                  {kycVerified ? "KYC Verified" : "KYC Required"}
                </span>
              )}
            </div>

            {/* Existing Position Badge */}
            {myPositions.length > 0 && (
              <div className="mb-4 space-y-2">
                {myPositions.map((pos) => (
                  <div
                    key={pos.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                      pos.side === "YES"
                        ? "bg-cusp-green/8 border-cusp-green/25"
                        : "bg-cusp-red/8 border-cusp-red/25"
                    }`}
                  >
                    <div className={`shrink-0 size-6 rounded-full flex items-center justify-center ${
                      pos.side === "YES" ? "bg-cusp-green/20" : "bg-cusp-red/20"
                    }`}>
                      <CheckCircle2 className={`size-4 ${
                        pos.side === "YES" ? "text-cusp-green" : "text-cusp-red"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-semibold ${
                          pos.side === "YES" ? "text-cusp-green" : "text-cusp-red"
                        }`}>
                          {pos.side}
                        </span>
                        <span className="text-[10px] text-muted-foreground">placed</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ${pos.usdc_cost.toFixed(2)} · {pos.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} shares
                      </span>
                    </div>
                    <Link
                      to="/portfolio"
                      className="text-[10px] text-cusp-teal hover:underline shrink-0"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            )}

            {/* Success Confirmation */}
            {successDetails && (
              <div className="mb-4 px-3 py-3 rounded-lg bg-cusp-green/10 border border-cusp-green/30 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-full bg-cusp-green/20 flex items-center justify-center animate-in zoom-in duration-500">
                    <CheckCircle2 className="size-5 text-cusp-green" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-cusp-green">Bet Placed Successfully!</p>
                    <p className="text-[10px] text-muted-foreground">
                      {successDetails.side} · ${successDetails.amount.toFixed(2)} USDC on {successDetails.ticker}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Trade Mode Toggle */}
            <div className="flex gap-1 p-1 bg-bg-2 rounded-lg mb-4">
              <button
                onClick={() => { setTradeMode("direct"); setLeverage(1); setTradeError(null); setTradeStatus("idle"); }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  tradeMode === "direct" ? "bg-bg-1 text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Direct
              </button>
              <button
                onClick={() => { setTradeMode("leveraged"); setLeverage(2); setTradeError(null); setTradeStatus("idle"); }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  tradeMode === "leveraged" ? "bg-bg-1 text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Leveraged
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => { setTradeSide("YES"); setTradeError(null); setTradeStatus("idle"); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all truncate min-w-0 ${
                  tradeSide === "YES"
                    ? "bg-cusp-green/15 text-cusp-green border border-cusp-green/50 shadow-sm"
                    : "bg-bg-2 text-muted-foreground border border-transparent hover:border-border"
                }`}
                title={`Buy ${market.yesLabel || "YES"}`}
              >
                Buy {market.yesLabel || "YES"}
              </button>
              <button
                onClick={() => { setTradeSide("NO"); setTradeError(null); setTradeStatus("idle"); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all truncate min-w-0 ${
                  tradeSide === "NO"
                    ? "bg-cusp-red/15 text-cusp-red border border-cusp-red/50 shadow-sm"
                    : "bg-bg-2 text-muted-foreground border border-transparent hover:border-border"
                }`}
                title={`Buy ${market.noLabel || "NO"}`}
              >
                Buy {market.noLabel || "NO"}
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">
                  Amount (USDC)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setTradeError(null); }}
                    className="w-full bg-bg-2 border border-border rounded-lg px-4 py-3 pr-14 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cusp-teal/50 focus:border-cusp-teal/50"
                  />
                  <button
                    type="button"
                    onClick={() => setAmount("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-cusp-teal/80 hover:text-cusp-teal"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {tradeMode === "direct" && isConnected && portfolio && (
                <div className="flex items-center justify-between text-[10px] mt-2">
                  <span className="text-muted-foreground">Your mainnet USDC</span>
                  <button
                    onClick={() => setAmount(String(portfolio.mainnet_usdc_balance ?? 0))}
                    className="font-mono text-cusp-amber hover:text-cusp-teal transition-colors"
                  >
                    ${(portfolio.mainnet_usdc_balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    <span className="ml-1 text-cusp-teal uppercase">max</span>
                  </button>
                </div>
              )}
              {tradeMode === "leveraged" && (
                <div className="mt-3">
                  <label className="text-xs text-muted-foreground block mb-1.5">
                    Leverage
                  </label>
                  <div className="flex gap-2">
                    {[1.5, 2, 2.5, 3].map((lev) => (
                      <button
                        key={lev}
                        onClick={() => { setLeverage(lev); setTradeError(null); }}
                        className={`flex-1 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                          leverage === lev
                            ? "bg-cusp-teal/15 text-cusp-teal border border-cusp-teal/50"
                            : "bg-bg-2 text-muted-foreground border border-transparent hover:border-border"
                        }`}
                      >
                        {lev}x
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 space-y-1">
                    {isConnected && portfolio && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Your mainnet USDC</span>
                        <button
                          onClick={() => setAmount(String(portfolio.mainnet_usdc_balance ?? 0))}
                          className="font-mono text-cusp-amber hover:text-cusp-teal transition-colors"
                        >
                          ${(portfolio.mainnet_usdc_balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          <span className="ml-1 text-cusp-teal uppercase">max</span>
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Vault lending pool</span>
                      <span className={`font-mono ${mainnetReserve > 0 ? "text-cusp-green" : "text-cusp-red"}`}>
                        ${mainnetReserve.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {mainnetReserve <= 0 && (
                      <p className="text-[10px] text-cusp-red mt-1">
                        Vault lending pool is empty. Deposit mainnet USDC to the vault's Trading pool to enable leverage.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {isValidAmount && (
                <div className="rounded-lg bg-bg-2/80 px-3 py-2.5 text-xs space-y-1 mt-3">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Price</span>
                    <span className="text-foreground font-mono">
                      ${currentPrice.toFixed(2)}
                    </span>
                  </div>
                  {tradeMode === "leveraged" && (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Your margin</span>
                        <span className="text-foreground font-mono">${amountNum.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Borrowed from vault</span>
                        <span className={`font-mono ${effectiveLeverage > 1 ? "text-cusp-amber" : "text-muted-foreground"}`}>
                          ${(amountNum * (effectiveLeverage - 1)).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Total position</span>
                        <span className="text-foreground font-mono font-semibold">${(amountNum * effectiveLeverage).toFixed(2)}</span>
                      </div>
                      {leverageReduced && (
                        <div className="text-[10px] text-cusp-amber mt-1">
                          Leverage reduced to {effectiveLeverage.toFixed(1)}x — vault pool only has ${mainnetReserve.toFixed(2)} available to lend
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Est. shares</span>
                    <span className="text-foreground font-mono">
                      {((tradeMode === "leveraged" ? amountNum * effectiveLeverage : amountNum) / currentPrice).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
            {(tradeError || leveragedError) && (
              <p className="text-xs text-cusp-red mb-3 px-2">{tradeError || leveragedError}</p>
            )}

            {leveragedStatus === "success" && leveragedResult && (
              <p className="text-xs text-cusp-green mb-3 px-2">
                Position opened! {leveragedResult.leverage}x at ${leveragedResult.total_usdc.toFixed(2)}
              </p>
            )}

            {isConnected && !kycVerified && !kycLoading ? (
              <button
                onClick={startVerification}
                className="w-full py-3 rounded-lg text-sm font-semibold bg-cusp-amber hover:bg-cusp-amber/90 text-white transition-all"
              >
                Complete KYC to Trade
              </button>
            ) : (
              <button
                onClick={handleTrade}
                disabled={
                  !isConnected ||
                  tradeStatus === "loading" ||
                  leveragedStatus === "lending" ||
                  leveragedStatus === "signing" ||
                  leveragedStatus === "risk_check" ||
                  leveragedStatus === "confirming" ||
                  (tradeMode === "leveraged" && effectiveLeverage <= 1)
                }
                className={`w-full py-3 rounded-lg text-sm font-semibold transition-all ${
                  tradeSide === "YES"
                    ? "bg-cusp-green hover:bg-cusp-green/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    : "bg-cusp-red hover:bg-cusp-red/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                {!isConnected
                  ? "Connect Wallet to Trade"
                  : tradeStatus === "loading" || leveragedStatus === "lending" || leveragedStatus === "signing" || leveragedStatus === "risk_check" || leveragedStatus === "confirming"
                    ? "Processing..."
                    : tradeMode === "leveraged" && effectiveLeverage <= 1
                      ? "Insufficient pool liquidity"
                      : tradeMode === "leveraged"
                        ? `${effectiveLeverage}x ${tradeSide === "YES" ? (market.yesLabel || "YES") : (market.noLabel || "NO")}`
                        : `Buy ${tradeSide === "YES" ? (market.yesLabel || "YES") : (market.noLabel || "NO")}`}
              </button>
            )}

            {!isConnected && (
              <p className="text-[11px] text-muted-foreground mt-3 text-center">
                Prediction market trading requires Proof KYC. Connect wallet to
                get started.
              </p>
            )}
          </div>
        </div>

        {/* Order Book with Depth - Live (real DFlow orders via REST + WebSocket) */}
        <div className="mt-6 bg-bg-1 border border-border rounded-xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BarChart3 className="size-4 text-muted-foreground" />
              Order Book
              {isLive ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-normal text-cusp-green">
                  <Wifi className="size-3" />
                  Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-normal text-muted-foreground">
                  <WifiOff className="size-3" />
                  Connecting...
                </span>
              )}
            </h3>
            {orderbook &&
              (orderbookFromWs && orderbookUpdatedAt ? (
                <span className="text-[10px] text-cusp-green font-mono">Real-time</span>
              ) : (
                <span className="text-[10px] text-muted-foreground">Polling every 3s</span>
              ))}
          </div>
          {orderbookLoading && !orderbook ? (
            <div className="grid md:grid-cols-2 gap-6">
              <Skeleton className="h-48 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-medium text-cusp-green mb-3">{market.yesLabel || "YES"} Bids</h4>
                <div className="space-y-0.5 max-h-52 overflow-y-auto">
                  {yesBids.length > 0 ? (
                    yesBids.map(({ price, qtyNum, pct }) => (
                      <div
                        key={price}
                        className="relative flex justify-between items-center py-1.5 px-2 rounded group hover:bg-bg-2/50 transition-colors"
                      >
                        <div
                          className="absolute inset-y-0 left-0 bg-cusp-green/10 rounded transition-[width] duration-300 ease-out"
                          style={{ width: `${pct}%` }}
                        />
                        <span className="relative font-mono text-sm text-cusp-green">
                          ${price}
                        </span>
                        <span className="relative text-xs text-muted-foreground font-mono">
                          {qtyNum.toLocaleString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground py-4">No bids</p>
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-medium text-cusp-red mb-3">{market.noLabel || "NO"} Bids</h4>
                <div className="space-y-0.5 max-h-52 overflow-y-auto">
                  {noBids.length > 0 ? (
                    noBids.map(({ price, qtyNum, pct }) => (
                      <div
                        key={price}
                        className="relative flex justify-between items-center py-1.5 px-2 rounded group hover:bg-bg-2/50 transition-colors"
                      >
                        <div
                          className="absolute inset-y-0 left-0 bg-cusp-red/10 rounded transition-[width] duration-300 ease-out"
                          style={{ width: `${pct}%` }}
                        />
                        <span className="relative font-mono text-sm text-cusp-red">
                          ${price}
                        </span>
                        <span className="relative text-xs text-muted-foreground font-mono">
                          {qtyNum.toLocaleString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground py-4">No bids</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default MarketDetail;
