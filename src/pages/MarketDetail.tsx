import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Layout from "@/components/Layout";
import ProbabilityBar from "@/components/ProbabilityBar";
import CountdownTimer from "@/components/CountdownTimer";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  useDflowMarket,
  useDflowMarkets,
  useDflowCandlesticks,
  useDflowOrderbook,
  type CandlestickTimeframe,
} from "@/hooks/useDflowMarkets";
import { useDflowWebSocket } from "@/hooks/useDflowWebSocket";
import { usePhantom, useSolana } from "@/lib/wallet";
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MarketOutcomeTable } from "@/components/MarketOutcomeTable";
import { MarketTradePanel, type MarketTradePanelProps } from "@/components/MarketTradePanel";
import { ChevronLeft, BarChart3, Circle, Wifi, WifiOff } from "lucide-react";

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

function parseTradeSide(searchParams: URLSearchParams): "YES" | "NO" {
  const s = searchParams.get("side");
  return s === "NO" ? "NO" : "YES";
}

function parseLeverageFromSearchParams(searchParams: URLSearchParams): 1 | 2 | 3 {
  const raw = searchParams.get("leverage");
  if (raw === "1" || raw === "2" || raw === "3") return Number(raw) as 1 | 2 | 3;
  if (searchParams.get("mode") === "leverage") return 2;
  return 1;
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [timeframe, setTimeframe] = useState<CandlestickTimeframe>("1Y");
  const { isLive, prices: livePrices, orderbook: liveOrderbook, orderbookUpdatedAt, recentTrades } = useDflowWebSocket(ticker);
  const { data: market, isLoading, error } = useDflowMarket(ticker, {
    refetchInterval: isLive ? 30_000 : 10_000,
  });
  const { data: eventMarkets = [], isPending: eventMarketsLoading } = useDflowMarkets({
    status: "active",
    limit: 50,
    eventTicker: market?.eventTicker,
    refetchInterval: 30_000,
    enabled: !!market?.eventTicker,
  });
  const sortedEventMarkets = useMemo(
    () => [...eventMarkets].sort((a, b) => b.probability - a.probability),
    [eventMarkets]
  );
  const { data: candlesticks, isLoading: chartLoading } = useDflowCandlesticks(ticker, timeframe, {
    refetchInterval: timeframe === "1D" || timeframe === "1W" ? 15_000 : 30_000,
  });
  const { data: restOrderbook, isLoading: orderbookLoading } = useDflowOrderbook(ticker, {
    refetchInterval: isLive ? false : 3_000,
  });
  const { isConnected, addresses } = usePhantom();
  const { solana, isAvailable } = useSolana();
  const [tradeSide, setTradeSide] = useState<"YES" | "NO">(() => parseTradeSide(searchParams));
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [contracts, setContracts] = useState("");
  const [leverage, setLeverage] = useState<1 | 2 | 3>(() =>
    parseLeverageFromSearchParams(searchParams)
  );

  useEffect(() => {
    setTradeSide(parseTradeSide(searchParams));
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("openTrade") !== "1") return;
    setTradeModalOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("openTrade");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setLeverage(parseLeverageFromSearchParams(searchParams));
  }, [ticker, searchParams]);
  const [tradeStatus, setTradeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [priceFlash, setPriceFlash] = useState(false);
  const prevPricesRef = useRef<string>("");
  const { verified: kycVerified, loading: kycLoading, startVerification } = useKYC();
  const { openPosition, status: leveragedStatus, error: leveragedError, result: leveragedResult, reset: resetLeveraged } = useLeveragedTrade();
  const { data: portfolio, refetch: refetchPortfolio } = useUserPortfolio();
  const { state: protocolState } = useProtocolState();
  const [successDetails, setSuccessDetails] = useState<{ side: string; amount: number; ticker: string } | null>(null);

  const goOutcomeTrade = useCallback(
    (outcomeTicker: string, side: "YES" | "NO") => {
      const next = new URLSearchParams(searchParams);
      next.set("side", side);
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
        next.set("openTrade", "1");
      }
      navigate(`/markets/${encodeURIComponent(outcomeTicker)}?${next.toString()}`);
    },
    [navigate, searchParams]
  );

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

  const contractsNum = parseFloat(contracts);
  const isValidContracts = !isNaN(contractsNum) && contractsNum > 0;
  const currentPrice = tradeSide === "YES" ? displayYesPrice : displayNoPrice;
  const totalPositionUsdc =
    isValidContracts && currentPrice > 0 ? contractsNum * currentPrice : NaN;
  /** USDT: full notional for 1x; margin for 2x–3x. */
  const amountNum = Number.isFinite(totalPositionUsdc)
    ? leverage === 1
      ? totalPositionUsdc
      : totalPositionUsdc / leverage
    : NaN;
  const isValidAmount = Number.isFinite(amountNum) && amountNum > 0;

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

  const estimatedShares =
    isValidAmount && currentPrice > 0
      ? (leverage > 1 ? (amountNum * effectiveLeverage) : amountNum) / currentPrice
      : 0;

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
    console.log("[trade] Leverage:", leverage, "| Side:", tradeSide, "| Margin/notional USDT:", amountNum);

    if (!isValidAmount) {
      setTradeError("Enter a valid contract size");
      return;
    }
    if (amountNum < MIN_TRADE_USDC) {
      setTradeError(
        `Minimum ${leverage > 1 ? "margin" : "trade"} is $${MIN_TRADE_USDC} USDT`
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

    // DFlow markets operate on mainnet — verify the user has enough mainnet stablecoins
    const userMainnetUsdc = (portfolio?.mainnet_usdt_balance ?? 0) + (portfolio?.mainnet_usdc_balance ?? 0);
    const requiredUsdc = amountNum;
    if (userMainnetUsdc < requiredUsdc) {
      setTradeError(
        `Insufficient balance. You have $${userMainnetUsdc.toFixed(2)} but need $${requiredUsdc.toFixed(2)}. Deposit USDT to your Solflare wallet to trade.`
      );
      return;
    }

    if (leverage > 1) {
      if (effectiveLeverage <= 1) {
        setTradeError(
          `Vault lending pool ($${mainnetReserve.toFixed(2)}) is too low to support leverage. Deposit more to the Trading pool or use 1x.`
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
        setContracts("");
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
            `Transaction simulation failed. This usually means insufficient balance (have $${userMainnetUsdc.toFixed(2)}, need $${amountNum.toFixed(2)}) or insufficient SOL for network fees. Deposit more USDT to your Solflare wallet.`
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
      setContracts("");
      refetchPortfolio();
      setTimeout(() => setSuccessDetails(null), 5000);
    } catch (err) {
      setTradeError(err instanceof Error ? err.message : "Trade failed");
      setTradeStatus("error");
    }
  };

  const tradePanelProps = useMemo((): MarketTradePanelProps | null => {
    if (!market) return null;
    return {
      market,
      tradeSide,
      setTradeSide,
      contracts,
      setContracts,
      leverage,
      setLeverage,
      displayYesPrice,
      displayNoPrice,
      currentPrice,
      mainnetReserve,
      effectiveLeverage,
      leverageReduced,
      amountNum,
      estimatedShares,
      isValidAmount,
      isConnected,
      kycVerified,
      kycLoading,
      startVerification,
      portfolio,
      myPositions,
      successDetails,
      tradeError,
      leveragedError,
      leveragedStatus,
      leveragedResult,
      tradeStatus,
      onTrade: handleTrade,
      onTradeErrorClear: () => setTradeError(null),
      onTradeStatusIdle: () => setTradeStatus("idle"),
    };
  }, [
    market,
    tradeSide,
    contracts,
    leverage,
    displayYesPrice,
    displayNoPrice,
    currentPrice,
    mainnetReserve,
    effectiveLeverage,
    leverageReduced,
    amountNum,
    estimatedShares,
    isValidAmount,
    isConnected,
    kycVerified,
    kycLoading,
    portfolio,
    myPositions,
    successDetails,
    tradeError,
    leveragedError,
    leveragedStatus,
    leveragedResult,
    tradeStatus,
    handleTrade,
  ]);

  if (isLoading || !ticker) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8" aria-busy aria-label="Loading market">
          <Skeleton className="h-5 w-32 mb-6" shimmer />
          <Skeleton className="h-10 w-full max-w-2xl mb-8" />
          <div className="grid lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-2 h-[320px] rounded-xl" shimmer />
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 lg:pb-8">
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
          <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
          {/* Chart - full market (YES + NO) */}
          <div className="bg-bg-1 border border-border rounded-xl p-5 sm:p-6 min-w-0">
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
              <Skeleton className="h-[300px] w-full rounded-lg" shimmer aria-busy aria-label="Loading chart" />
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

            <MarketOutcomeTable
              markets={sortedEventMarkets}
              activeTicker={ticker}
              loading={eventMarketsLoading}
              onYes={(t) => goOutcomeTrade(t, "YES")}
              onNo={(t) => goOutcomeTrade(t, "NO")}
            />
          </div>

          <div className="hidden lg:block lg:sticky lg:top-20 self-start min-w-0 w-full">
            {tradePanelProps && <MarketTradePanel {...tradePanelProps} />}
          </div>
        </div>

        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border bg-bg-1/95 backdrop-blur-sm supports-[backdrop-filter]:bg-bg-1/85">
          <button
            type="button"
            onClick={() => setTradeModalOpen(true)}
            className="w-full py-3 rounded-lg text-sm font-semibold bg-cusp-teal hover:bg-cusp-teal/90 text-primary-foreground shadow-lg"
          >
            Trade
          </button>
        </div>

        <Dialog open={tradeModalOpen} onOpenChange={setTradeModalOpen}>
          <DialogContent className="max-h-[min(90vh,720px)] w-[min(100vw-1rem,32rem)] max-w-[calc(100vw-1rem)] overflow-y-auto gap-0 border-border p-0 left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]">
            <DialogTitle className="sr-only">Place order</DialogTitle>
            <DialogDescription className="sr-only">
              Buy or sell outcome shares for this market
            </DialogDescription>
            {tradePanelProps && (
              <div className="p-4 sm:p-5 max-h-[inherit] overflow-y-auto">
                <MarketTradePanel {...tradePanelProps} className="shadow-none border-0" />
              </div>
            )}
          </DialogContent>
        </Dialog>

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
            <div className="grid md:grid-cols-2 gap-6" aria-busy aria-label="Loading order book">
              <div className="space-y-2 rounded-lg border border-border bg-bg-1/50 p-3">
                <Skeleton className="h-3 w-20" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" shimmer={i < 2} />
                ))}
              </div>
              <div className="space-y-2 rounded-lg border border-border bg-bg-1/50 p-3">
                <Skeleton className="h-3 w-20" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" shimmer={i < 2} />
                ))}
              </div>
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
