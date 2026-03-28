import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { usePhantom } from "@phantom/react-sdk";
import { PublicKey } from "@solana/web3.js";
import { getConnection, getMainnetConnection, USDC_MINT, MAINNET_USDC } from "@/lib/solana";
import {
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { supabase } from "@/lib/supabase";

const VAULT_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_VAULT_PROGRAM_ID || "EtGTQ9pmcnkYtTdorACENJPBmYVeWo8vrDzH7kU1K7DQ"
);

const [CUSDC_MINT] = PublicKey.findProgramAddressSync(
  [Buffer.from("cusdc-mint")],
  VAULT_PROGRAM_ID
);

export interface Position {
  id: string;
  position_type: string;
  market_ticker: string;
  side: string;
  entry_price: number;
  quantity: number;
  usdc_cost: number;
  outcome_mint: string | null;
  status: string;
  created_at: string;
  settled_at?: string | null;
  settlement_payout?: number | null;
  tx_signature?: string | null;
  market_title?: string;
  current_yes_price?: number | null;
  current_no_price?: number | null;
  current_value?: number | null;
  unrealized_pnl?: number | null;
  unrealized_pnl_pct?: number | null;
}

export interface LeveragedTrade {
  id: string;
  position_id: string;
  margin_usdc: number;
  borrowed_usdc: number;
  leverage: number;
  health_factor: number;
  borrow_rate_bps: number;
  accrued_interest: number;
  status: string;
  created_at: string;
  closed_at?: string | null;
  market_ticker: string;
  side: string;
  entry_price: number;
  quantity: number;
  outcome_mint: string | null;
  market_title: string;
  current_price?: number | null;
}

export interface TradeExecution {
  id: string;
  position_id: string;
  direction: string;
  input_mint: string;
  output_mint: string;
  input_amount: number;
  output_amount: number;
  tx_signature: string | null;
  dflow_order_status?: string | null;
  status: string;
  created_at: string;
  market_ticker: string;
  side: string;
  position_type: string;
  market_title: string;
}

export interface Deposit {
  id: string;
  amount_usdc: number;
  cusdc_minted: number;
  exchange_rate: number;
  tx_signature: string | null;
  status: string;
  created_at: string;
}

export interface UserPortfolio {
  deposits: Deposit[];
  positions: Position[];
  leveraged_trades: LeveragedTrade[];
  trade_executions: TradeExecution[];
  total_deposited: number;
  total_withdrawn: number;
  total_cusdc: number;
  usdc_balance: number;
  mainnet_usdc_balance: number;
  unified_usdc_balance: number;
  total_invested: number;
  total_current_value: number;
  unrealized_pnl: number;
  open_position_count: number;
}

interface OnChainBalances {
  total_cusdc: number;
  usdc_balance: number;
  mainnet_usdc_balance: number;
}

interface DbPortfolio {
  deposits: Deposit[];
  positions: Position[];
  leveraged_trades: LeveragedTrade[];
  trade_executions: TradeExecution[];
  total_deposited: number;
  total_withdrawn: number;
}

const EMPTY_DB: DbPortfolio = {
  deposits: [],
  positions: [],
  leveraged_trades: [],
  trade_executions: [],
  total_deposited: 0,
  total_withdrawn: 0,
};

async function fetchOnChainBalances(solanaAddress: string): Promise<OnChainBalances> {
  const connection = getConnection();
  const mainnetConnection = getMainnetConnection();
  const owner = new PublicKey(solanaAddress);

  let cusdcBalance = 0;
  let usdcBalance = 0;
  let mainnetUsdcBalance = 0;

  const [cusdcResult, usdcResult, mainnetResult] = await Promise.allSettled([
    getAssociatedTokenAddress(CUSDC_MINT, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
      .then((ata) => getAccount(connection, ata)),
    getAssociatedTokenAddress(USDC_MINT, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
      .then((ata) => getAccount(connection, ata)),
    getAssociatedTokenAddress(MAINNET_USDC, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
      .then((ata) => getAccount(mainnetConnection, ata)),
  ]);

  if (cusdcResult.status === "fulfilled") cusdcBalance = Number(cusdcResult.value.amount) / 1e6;
  if (usdcResult.status === "fulfilled") usdcBalance = Number(usdcResult.value.amount) / 1e6;
  if (mainnetResult.status === "fulfilled") mainnetUsdcBalance = Number(mainnetResult.value.amount) / 1e6;

  return { total_cusdc: cusdcBalance, usdc_balance: usdcBalance, mainnet_usdc_balance: mainnetUsdcBalance };
}

async function fetchFromSupabase(walletAddress: string): Promise<DbPortfolio & { userId: string | null }> {
  if (!supabase) return { ...EMPTY_DB, userId: null };

  const { data: userId, error: userError } = await supabase.rpc("get_or_create_user", {
    p_wallet_address: walletAddress,
  });

  if (userError || !userId) {
    console.warn("[portfolio] get_or_create_user failed:", userError);
    return { ...EMPTY_DB, userId: null };
  }

  const [positionsRes, leveragedRes, depositsRes, marketsRes] = await Promise.all([
    supabase.from("positions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("leveraged_trades").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("deposits").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("markets_cache").select("ticker, title, yes_price, no_price, yes_mint, no_mint"),
  ]);

  const rawPositions = positionsRes.data ?? [];

  let rawExecutions: Array<Record<string, unknown>> = [];
  const positionIds = rawPositions.map((p) => p.id);
  if (positionIds.length > 0) {
    const { data } = await supabase
      .from("trade_executions")
      .select("*")
      .in("position_id", positionIds)
      .order("created_at", { ascending: false });
    rawExecutions = (data ?? []) as Array<Record<string, unknown>>;
  }

  const marketMap = new Map<string, { title: string; yes_price: number | null; no_price: number | null }>();
  for (const m of marketsRes.data ?? []) {
    marketMap.set(m.ticker, { title: m.title, yes_price: m.yes_price, no_price: m.no_price });
  }

  const execByPosition = new Map<string, Record<string, unknown>>();
  for (const e of rawExecutions) {
    const pid = e.position_id as string;
    if (!execByPosition.has(pid)) execByPosition.set(pid, e);
  }

  const positions: Position[] = rawPositions.map((p) => {
    const market = marketMap.get(p.market_ticker);
    const exec = execByPosition.get(p.id);
    const currentPrice = p.side === "YES" ? (market?.yes_price ?? null) : (market?.no_price ?? null);
    const qty = Number(p.quantity) || 0;
    const cost = Number(p.usdc_cost) || 0;
    const currentValue = currentPrice != null && qty > 0 ? qty * currentPrice : null;
    const unrealizedPnl = currentValue != null && cost > 0 ? currentValue - cost : null;
    const unrealizedPnlPct = unrealizedPnl != null && cost > 0 ? (unrealizedPnl / cost) * 100 : null;

    return {
      id: p.id,
      position_type: p.position_type,
      market_ticker: p.market_ticker,
      side: p.side,
      entry_price: Number(p.entry_price) || 0,
      quantity: qty,
      usdc_cost: cost,
      outcome_mint: p.outcome_mint,
      status: p.status,
      created_at: p.created_at,
      settled_at: p.settled_at ?? null,
      settlement_payout: p.settlement_payout != null ? Number(p.settlement_payout) : null,
      tx_signature: (exec?.tx_signature as string) ?? null,
      market_title: market?.title ?? p.market_ticker,
      current_yes_price: market?.yes_price ?? null,
      current_no_price: market?.no_price ?? null,
      current_value: currentValue,
      unrealized_pnl: unrealizedPnl,
      unrealized_pnl_pct: unrealizedPnlPct,
    };
  });

  const positionMap = new Map<string, Position>();
  for (const p of positions) positionMap.set(p.id, p);

  const leveraged_trades: LeveragedTrade[] = (leveragedRes.data ?? []).map((lt) => {
    const pos = positionMap.get(lt.position_id);
    const market = pos ? marketMap.get(pos.market_ticker) : null;
    const cp = pos?.side === "YES" ? (market?.yes_price ?? null) : (market?.no_price ?? null);
    return {
      id: lt.id,
      position_id: lt.position_id,
      margin_usdc: Number(lt.margin_usdc) || 0,
      borrowed_usdc: Number(lt.borrowed_usdc) || 0,
      leverage: Number(lt.leverage) || 1,
      health_factor: Number(lt.health_factor) || 2,
      borrow_rate_bps: lt.borrow_rate_bps ?? 500,
      accrued_interest: Number(lt.accrued_interest) || 0,
      status: lt.status,
      created_at: lt.created_at,
      closed_at: lt.closed_at ?? null,
      market_ticker: pos?.market_ticker ?? "",
      side: pos?.side ?? "",
      entry_price: pos?.entry_price ?? 0,
      quantity: pos?.quantity ?? 0,
      outcome_mint: pos?.outcome_mint ?? null,
      market_title: market?.title ?? pos?.market_ticker ?? "",
      current_price: cp,
    };
  });

  const trade_executions: TradeExecution[] = rawExecutions.map((e) => {
    const pos = positionMap.get(e.position_id as string);
    const market = pos ? marketMap.get(pos.market_ticker) : null;
    return {
      id: e.id as string,
      position_id: e.position_id as string,
      direction: e.direction as string,
      input_mint: e.input_mint as string,
      output_mint: e.output_mint as string,
      input_amount: Number(e.input_amount) || 0,
      output_amount: Number(e.output_amount) || 0,
      tx_signature: (e.tx_signature as string) ?? null,
      dflow_order_status: (e.dflow_order_status as string) ?? null,
      status: e.status as string,
      created_at: e.created_at as string,
      market_ticker: pos?.market_ticker ?? "",
      side: pos?.side ?? "",
      position_type: pos?.position_type ?? "",
      market_title: market?.title ?? pos?.market_ticker ?? "",
    };
  });

  const confirmedDeposits = (depositsRes.data ?? []).filter((d) => d.status === "confirmed");
  const deposits: Deposit[] = (depositsRes.data ?? []).map((d) => ({
    id: d.id,
    amount_usdc: Number(d.amount_usdc) || 0,
    cusdc_minted: Number(d.cusdc_minted) || 0,
    exchange_rate: Number(d.exchange_rate) || 1,
    tx_signature: d.tx_signature ?? null,
    status: d.status,
    created_at: d.created_at,
  }));

  return {
    deposits,
    positions,
    leveraged_trades,
    trade_executions,
    total_deposited: confirmedDeposits.reduce((sum, d) => sum + Number(d.amount_usdc), 0),
    total_withdrawn: 0,
    userId: userId as string,
  };
}

async function fetchPortfolio(solanaAddress: string): Promise<UserPortfolio & { _userId: string | null }> {
  const [onChain, db] = await Promise.all([
    fetchOnChainBalances(solanaAddress),
    fetchFromSupabase(solanaAddress),
  ]);

  const openPositions = db.positions.filter((p) => p.status === "open");
  const totalInvested = openPositions.reduce((sum, p) => sum + p.usdc_cost, 0);
  const totalCurrentValue = openPositions.reduce((sum, p) => sum + (p.current_value ?? p.usdc_cost), 0);

  return {
    deposits: db.deposits,
    positions: db.positions,
    leveraged_trades: db.leveraged_trades,
    trade_executions: db.trade_executions,
    total_deposited: db.total_deposited,
    total_withdrawn: db.total_withdrawn,
    total_cusdc: onChain.total_cusdc,
    usdc_balance: onChain.usdc_balance,
    mainnet_usdc_balance: onChain.mainnet_usdc_balance,
    unified_usdc_balance: onChain.usdc_balance + onChain.mainnet_usdc_balance,
    total_invested: totalInvested,
    total_current_value: totalCurrentValue,
    unrealized_pnl: totalCurrentValue - totalInvested,
    open_position_count: openPositions.length,
    _userId: db.userId,
  };
}

export function useUserPortfolio() {
  const { addresses, isConnected } = usePhantom();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  const solanaAddress = addresses?.find((a) =>
    String(a.addressType || "").toLowerCase().includes("solana")
  )?.address;

  // Supabase realtime: auto-refetch when positions/trades change
  useEffect(() => {
    if (!supabase || !userId) return;

    try {
      const channel = supabase
        .channel(`portfolio-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "positions", filter: `user_id=eq.${userId}` },
          () => queryClient.invalidateQueries({ queryKey: ["userPortfolio"] })
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "leveraged_trades", filter: `user_id=eq.${userId}` },
          () => queryClient.invalidateQueries({ queryKey: ["userPortfolio"] })
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "deposits", filter: `user_id=eq.${userId}` },
          () => queryClient.invalidateQueries({ queryKey: ["userPortfolio"] })
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      // Realtime may fail if browser blocks storage access — non-critical
    }
  }, [userId, queryClient]);

  const query = useQuery<UserPortfolio | null>({
    queryKey: ["userPortfolio", solanaAddress],
    queryFn: async () => {
      if (!solanaAddress) return null;
      const result = await fetchPortfolio(solanaAddress);
      if (result._userId && result._userId !== userId) {
        setUserId(result._userId);
      }
      return result;
    },
    enabled: !!solanaAddress && isConnected,
    refetchInterval: 15_000,
  });

  return query;
}
