import type {
  AnyQvacCommand,
  Asset,
  QvacAssistantIntent,
  QvacAssistantPreviewResult,
  TradeSide,
} from "@cusp/shared";
import { getAdminClient } from "../db/supabase.js";
import { buildExecutionPlan } from "./execution-plan.js";
import { routeQvacCommand } from "./router.js";

interface PreviewContext {
  wallet_address?: string;
  current_market_ticker?: string;
  position_id?: string;
}

interface MarketCandidate {
  ticker: string;
  title: string;
  subtitle?: string;
}

interface PositionCandidate {
  id: string;
  market_ticker: string;
  market_title: string;
  side: string;
  position_type: string;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function includesNormalized(haystack: string, needle: string): boolean {
  const left = normalizeText(haystack);
  const right = normalizeText(needle);
  return !!right && left.includes(right);
}

async function resolveUserId(walletAddress: string): Promise<string | null> {
  const supabase = getAdminClient();
  const { data } = await supabase.rpc("get_or_create_user", {
    p_wallet_address: walletAddress,
  });
  return (data as string | null) ?? null;
}

async function searchMarkets(query: string, currentTicker?: string): Promise<MarketCandidate[]> {
  const supabase = getAdminClient();
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data } = await supabase
    .from("markets_cache")
    .select("ticker, title, subtitle")
    .or(`ticker.ilike.%${trimmed}%,title.ilike.%${trimmed}%,subtitle.ilike.%${trimmed}%`)
    .limit(8);

  const raw = (data ?? []) as Array<{ ticker: string; title: string; subtitle?: string | null }>;
  const ranked = raw.sort((a, b) => {
    if (currentTicker && a.ticker === currentTicker) return -1;
    if (currentTicker && b.ticker === currentTicker) return 1;
    const aExact = includesNormalized(`${a.ticker} ${a.title} ${a.subtitle ?? ""}`, trimmed) ? 1 : 0;
    const bExact = includesNormalized(`${b.ticker} ${b.title} ${b.subtitle ?? ""}`, trimmed) ? 1 : 0;
    return bExact - aExact;
  });

  return ranked.map((item) => ({
    ticker: item.ticker,
    title: item.title,
    subtitle: item.subtitle ?? undefined,
  }));
}

async function resolveMarketCandidate(
  query: string,
  currentTicker?: string
): Promise<{ resolved?: MarketCandidate; candidates: MarketCandidate[] }> {
  const candidates = await searchMarkets(query, currentTicker);
  if (candidates.length === 0) return { candidates: [] };
  if (currentTicker) {
    const current = candidates.find((item) => item.ticker.toLowerCase() === currentTicker.toLowerCase());
    if (current) return { resolved: current, candidates };
  }

  const exact = candidates.find((item) =>
    normalizeText(item.ticker) === normalizeText(query) ||
    normalizeText(item.title) === normalizeText(query)
  );
  if (exact) return { resolved: exact, candidates };
  if (candidates.length === 1) return { resolved: candidates[0], candidates };
  return { candidates };
}

async function listOpenPositions(walletAddress: string): Promise<PositionCandidate[]> {
  const supabase = getAdminClient();
  const userId = await resolveUserId(walletAddress);
  if (!userId) return [];

  const { data } = await supabase
    .from("positions")
    .select("id, market_ticker, side, position_type, status")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  const positions = (data ?? []) as Array<{
    id: string;
    market_ticker: string;
    side: string;
    position_type: string;
    status: string;
  }>;

  const tickers = [...new Set(positions.map((item) => item.market_ticker).filter(Boolean))];
  const { data: markets } = tickers.length
    ? await supabase
        .from("markets_cache")
        .select("ticker, title")
        .in("ticker", tickers)
    : { data: [] };

  const marketMap = new Map<string, string>();
  for (const market of markets ?? []) {
    marketMap.set(market.ticker, market.title);
  }

  return positions.map((position) => ({
    id: position.id,
    market_ticker: position.market_ticker,
    market_title: marketMap.get(position.market_ticker) ?? position.market_ticker,
    side: position.side,
    position_type: position.position_type,
  }));
}

async function resolveClosePosition(
  walletAddress: string,
  marketReference?: string,
  side?: TradeSide
): Promise<{ resolved?: PositionCandidate; candidates: PositionCandidate[] }> {
  const positions = (await listOpenPositions(walletAddress)).filter(
    (position) =>
      position.position_type === "leveraged" ||
      position.position_type === "direct"
  );

  if (!marketReference?.trim()) {
    return positions.length === 1
      ? { resolved: positions[0], candidates: positions }
      : { candidates: positions };
  }

  const filtered = positions.filter((position) => {
    const marketMatch =
      includesNormalized(position.market_ticker, marketReference) ||
      includesNormalized(position.market_title, marketReference);
    const sideMatch = side ? position.side.toLowerCase() === side.toLowerCase() : true;
    return marketMatch && sideMatch;
  });

  if (filtered.length === 1) return { resolved: filtered[0], candidates: filtered };
  return { candidates: filtered };
}

function intentError(intent: QvacAssistantIntent, message: string): QvacAssistantPreviewResult {
  return { success: false, intent, error: message };
}

export async function previewAssistantIntent(
  intent: QvacAssistantIntent,
  context: PreviewContext
): Promise<QvacAssistantPreviewResult> {
  const wallet = context.wallet_address?.trim();
  if (!wallet) return intentError(intent, "Connect your wallet to use QVAC actions.");

  if (intent.type === "market_search" || intent.type === "position_summary" || intent.type === "risk_explain" || intent.type === "unknown") {
    return { success: true, intent };
  }

  if (intent.type === "leverage_close") {
    if (context.position_id) {
      const openPositions = await listOpenPositions(wallet);
      const byId = openPositions.find((position) => position.id === context.position_id);
      if (byId) {
        intent = {
          ...intent,
          resolved_position_id: byId.id,
          resolved_market_ticker: byId.market_ticker,
          resolved_market_title: byId.market_title,
          market_reference_text: intent.market_reference_text ?? byId.market_ticker,
          side: intent.side ?? (byId.side.toLowerCase() as TradeSide),
        };
      }
    }

    if (intent.resolved_position_id && intent.resolved_market_ticker) {
      const command: AnyQvacCommand = {
        intent_id: crypto.randomUUID(),
        user_wallet: wallet,
        input_accounting_asset: "USDT",
        underlying_asset: "USDT",
        execution_asset: "USDT",
        amount_ui: intent.amount_ui ?? 1,
        requires_user_confirmation: true,
        service: "leverage_trade",
        action: "close",
        margin_asset: "cUSDT",
        margin_amount_ui: intent.amount_ui ?? 1,
        borrow_asset: "USDT",
        leverage: 1.1,
        market_query: intent.resolved_market_ticker,
        side: intent.side ?? "yes",
        max_slippage_bps: 100,
      };

      const routeResult = await routeQvacCommand({
        ...command,
        position_id: intent.resolved_position_id,
      });
      if (!routeResult.success || !routeResult.execution_plan) {
        return intentError(intent, routeResult.error || "Unable to prepare close preview.");
      }
      return {
        success: true,
        intent,
        command,
        execution_plan: routeResult.execution_plan,
      };
    }

    const resolved = await resolveClosePosition(wallet, intent.position_reference_text || intent.market_reference_text, intent.side);
    if (!resolved.resolved) {
      return {
        success: false,
        intent,
        error: resolved.candidates.length
          ? "I found multiple open positions. Pick the one you want to close."
          : "I couldn't find an open position matching that request.",
        candidates: resolved.candidates.map((candidate) => ({
          kind: "position" as const,
          id: candidate.id,
          label: `${candidate.market_title} · ${candidate.side}`,
          subtitle: candidate.position_type,
        })),
      };
    }

    const command: AnyQvacCommand = {
      intent_id: crypto.randomUUID(),
      user_wallet: wallet,
      input_accounting_asset: "USDT",
      underlying_asset: "USDT",
      execution_asset: "USDT",
      amount_ui: intent.amount_ui ?? 1,
      requires_user_confirmation: true,
      service: "leverage_trade",
      action: "close",
      margin_asset: "cUSDT",
      margin_amount_ui: intent.amount_ui ?? 1,
      borrow_asset: "USDT",
      leverage: 1.1,
      market_query: resolved.resolved.market_ticker,
      side: (intent.side ?? resolved.resolved.side.toLowerCase()) as TradeSide,
      max_slippage_bps: 100,
    };

    const routeResult = await routeQvacCommand({
      ...command,
      position_id: resolved.resolved.id,
    });

    if (!routeResult.success || !routeResult.execution_plan) {
      return intentError(intent, routeResult.error || "Unable to prepare close preview.");
    }

    return {
      success: true,
      intent: {
        ...intent,
        resolved_position_id: resolved.resolved.id,
        resolved_market_ticker: resolved.resolved.market_ticker,
        resolved_market_title: resolved.resolved.market_title,
      },
      command,
      execution_plan: routeResult.execution_plan,
    };
  }

  const marketReference = intent.market_reference_text || context.current_market_ticker;
  if (!marketReference?.trim()) {
    return intentError(intent, "Tell me which market you want to use.");
  }

  const marketResolution = await resolveMarketCandidate(marketReference, context.current_market_ticker);
  if (!marketResolution.resolved) {
    return {
      success: false,
      intent,
      error: marketResolution.candidates.length
        ? "I found several matching markets. Pick one to continue."
        : "I couldn't find a matching market.",
      candidates: marketResolution.candidates.map((candidate) => ({
        kind: "market" as const,
        id: candidate.ticker,
        label: candidate.title,
        subtitle: candidate.subtitle || candidate.ticker,
      })),
    };
  }

  const resolvedMarket = marketResolution.resolved;
  const side = intent.side ?? "yes";
  const amount = intent.amount_ui ?? 0;

  if (!amount || amount <= 0) {
    return intentError(intent, "Tell me how much you want to trade.");
  }

  let command: AnyQvacCommand;

  if (intent.type === "direct_trade") {
    command = {
      intent_id: crypto.randomUUID(),
      user_wallet: wallet,
      input_accounting_asset: "USDT",
      underlying_asset: "USDT",
      execution_asset: "USDT",
      amount_ui: amount,
      requires_user_confirmation: true,
      service: "direct_trade",
      action: "buy",
      input_asset: (intent.asset ?? "USDT") as Asset,
      input_amount_ui: amount,
      market_query: resolvedMarket.ticker,
      side,
      max_slippage_bps: 100,
    };
  } else {
    command = {
      intent_id: crypto.randomUUID(),
      user_wallet: wallet,
      input_accounting_asset: "USDT",
      underlying_asset: "USDT",
      execution_asset: "USDT",
      amount_ui: amount,
      requires_user_confirmation: true,
      service: "leverage_trade",
      action: "open",
      margin_asset: "cUSDT",
      margin_amount_ui: amount,
      borrow_asset: "USDT",
      leverage: Math.max(1.1, Math.min(intent.leverage ?? 2, 3)),
      market_query: resolvedMarket.ticker,
      side,
      max_slippage_bps: 100,
    };
  }

  const executionPlan = buildExecutionPlan(command);

  return {
    success: true,
    intent: {
      ...intent,
      resolved_market_ticker: resolvedMarket.ticker,
      resolved_market_title: resolvedMarket.title,
    },
    command,
    execution_plan: executionPlan,
  };
}

export async function executeAssistantIntent(
  command: AnyQvacCommand,
  intent: QvacAssistantIntent
): Promise<Awaited<ReturnType<typeof routeQvacCommand>>> {
  if (intent.type === "direct_trade" || intent.type === "leverage_open") {
    return {
      success: true,
      intent_id: command.intent_id,
      data: {
        execution_mode: "navigate",
      },
    };
  }

  return routeQvacCommand({
    ...command,
    requires_user_confirmation: false,
    position_id: intent.resolved_position_id,
  });
}
