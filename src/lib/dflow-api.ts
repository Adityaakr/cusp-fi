/**
 * DFlow API client for Metadata and Trade APIs
 * Docs: https://pond.dflow.net/build
 */

import { DFLOW_METADATA_API, DFLOW_TRADE_API, USDC_MINT_ADDRESS } from "./network-config";

const METADATA_API = DFLOW_METADATA_API;
const TRADE_API = DFLOW_TRADE_API;

// --- DFlow API Types ---

export interface DFlowEvent {
  ticker: string;
  seriesTicker: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  volume: number;
  volume24h: number;
  liquidity: number;
  openInterest: number;
  competition?: string;
  competitionScope?: string;
}

export interface DFlowMarketAccount {
  marketLedger: string;
  yesMint: string;
  noMint: string;
  isInitialized: boolean;
  redemptionStatus: string | null;
  scalarOutcomePct?: number;
}

export interface DFlowMarket {
  ticker: string;
  eventTicker: string;
  marketType: string;
  title: string;
  subtitle: string;
  yesSubTitle: string;
  noSubTitle: string;
  openTime: number;
  closeTime: number;
  expirationTime: number;
  status: string;
  volume: number;
  volume24h?: number;
  volumeFp?: string;
  volume24hFp?: string;
  openInterest: number;
  openInterestFp?: string;
  result?: string;
  yesBid: string | null;
  yesAsk: string | null;
  noBid: string | null;
  noAsk: string | null;
  fractionalTradingEnabled: boolean;
  canCloseEarly: boolean;
  rulesPrimary?: string;
  rulesSecondary?: string;
  accounts: Record<string, DFlowMarketAccount>;
}

export interface DFlowEventsResponse {
  events: DFlowEvent[];
  cursor?: number;
}

export interface DFlowMarketsResponse {
  markets: DFlowMarket[];
  cursor?: number;
}

export interface DFlowTagsResponse {
  tagsByCategories: Record<string, string[] | null>;
}

// --- Normalized types for Cusp UI ---

export interface CuspMarket {
  id: string;
  ticker: string;
  name: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  probability: number;
  volume: number;
  volume24h?: number;
  resolutionDate: string;
  status: string;
  yesMint?: string;
  noMint?: string;
  /** The actual settlement mint used by DFlow for this market (may differ from app USDC mint) */
  settlementMint?: string;
  eventTicker: string;
  /** Estimated yield for high-probability YES positions (resolves to $1) */
  estimatedYield: number;
  /** Human-readable outcome labels (e.g. "Real Madrid" / "Man City" instead of YES/NO) */
  yesLabel: string;
  noLabel: string;
  /** Resolution rules from API */
  rulesPrimary?: string;
  rulesSecondary?: string;
  /** Open interest ($ at stake) */
  openInterest?: number;
  subtitle?: string;
}

// --- API functions ---

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", ...options?.headers },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error || body?.message || JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(detail || `DFlow API error: ${res.status}`);
  }
  return res.json();
}

export async function fetchMarkets(params?: {
  status?: string;
  limit?: number;
  cursor?: number;
  eventTicker?: string;
}): Promise<DFlowMarketsResponse> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.cursor) search.set("cursor", String(params.cursor));
  if (params?.eventTicker) search.set("event_ticker", params.eventTicker);
  const qs = search.toString();
  return fetchJson(`${METADATA_API}/api/v1/markets${qs ? `?${qs}` : ""}`);
}

export async function fetchMarket(ticker: string): Promise<DFlowMarket> {
  return fetchJson(`${METADATA_API}/api/v1/market/${ticker}`);
}

export async function fetchEvents(params?: {
  limit?: number;
  cursor?: number;
  expand?: string;
}): Promise<DFlowEventsResponse> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.cursor) search.set("cursor", String(params.cursor));
  if (params?.expand) search.set("expand", params.expand);
  const qs = search.toString();
  return fetchJson(`${METADATA_API}/api/v1/events${qs ? `?${qs}` : ""}`);
}

export async function fetchTagsByCategories(): Promise<DFlowTagsResponse> {
  return fetchJson(`${METADATA_API}/api/v1/tags_by_categories`);
}

export async function searchEvents(query: string, limit = 20): Promise<DFlowEventsResponse> {
  const search = new URLSearchParams({ q: query, limit: String(limit) });
  return fetchJson(`${METADATA_API}/api/v1/search?${search}`);
}

/** Search markets via DFlow API: search events by query, then fetch markets for each event */
export async function searchMarkets(query: string, limit = 50): Promise<CuspMarket[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { events } = await searchEvents(trimmed, 30);
  if (events.length === 0) return [];

  const marketArrays = await Promise.all(
    events.map((e) =>
      fetchMarkets({ eventTicker: e.ticker, status: "active", limit: 20 }).then((r) =>
        r.markets.map((m) => dflowMarketToCusp(m))
      )
    )
  );

  const seen = new Set<string>();
  const result: CuspMarket[] = [];
  for (const arr of marketArrays) {
    for (const m of arr) {
      if (!seen.has(m.ticker)) {
        seen.add(m.ticker);
        result.push(m);
        if (result.length >= limit) return result;
      }
    }
  }
  return result;
}

// --- Candlesticks ---

export interface DFlowCandlestick {
  end_period_ts: number;
  yes_ask: { open_dollars: string; high_dollars: string; low_dollars: string; close_dollars: string };
  yes_bid?: { open_dollars: string; high_dollars: string; low_dollars: string; close_dollars: string };
  price?: { close_dollars?: string; open_dollars?: string };
  volume: number;
}

export interface DFlowCandlesticksResponse {
  candlesticks: DFlowCandlestick[];
  ticker: string;
}

export async function fetchCandlesticks(
  ticker: string,
  params: { startTs: number; endTs: number; periodInterval: 1 | 60 | 1440 }
): Promise<DFlowCandlesticksResponse> {
  const search = new URLSearchParams({
    startTs: String(params.startTs),
    endTs: String(params.endTs),
    periodInterval: String(params.periodInterval),
  });
  return fetchJson(`${METADATA_API}/api/v1/market/${ticker}/candlesticks?${search}`);
}

// --- Orderbook ---

export interface DFlowOrderbookResponse {
  yes_bids: Record<string, string>;
  no_bids: Record<string, string>;
  yes_asks?: Record<string, string>;
  no_asks?: Record<string, string>;
  sequence?: number;
}

export async function fetchOrderbook(ticker: string): Promise<DFlowOrderbookResponse> {
  return fetchJson(`${METADATA_API}/api/v1/orderbook/${ticker}`);
}

// --- Trade API (Order) ---

const USDC_MINT = USDC_MINT_ADDRESS;

export async function fetchOrderQuote(params: {
  userPublicKey: string;
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number | "auto";
}): Promise<{ transaction: string; inputAmount: number; outputAmount: number }> {
  const search = new URLSearchParams({
    userPublicKey: params.userPublicKey,
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: String(params.amount),
    slippageBps: String(params.slippageBps === "auto" ? "auto" : (params.slippageBps ?? 100)),
  });
  const res = await fetchJson<Record<string, unknown>>(`${TRADE_API}/order?${search}`);
  const tx = (res.transaction ?? res.transactionBase64 ?? res.transaction_base64) as string | undefined;
  if (!tx || typeof tx !== "string") throw new Error("No transaction in order response");
  return {
    transaction: tx,
    inputAmount: (res.inputAmount as number) ?? params.amount,
    outputAmount: (res.outputAmount as number) ?? 0,
  };
}

export { USDC_MINT };

// --- Transform DFlow market to Cusp format ---

function parsePrice(val: string | null): number {
  if (val == null || val === "") return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

/** Map DFlow-style categories to our UI categories */
function inferCategory(eventTicker: string, title: string): string {
  const t = (eventTicker + title).toLowerCase();
  // Crypto: BTC, ETH, SOL, DOGE, XRP, etc.
  if (/btc|eth|sol|doge|xrp|crypto|bitcoin|blockchain/.test(t)) return "Crypto";
  // Economics: Fed, GDP, inflation, employment, etc.
  if (/fed|rate|gdp|inflation|economy|employment|jobs|oil|housing|central bank|bankruptcy|default/.test(t)) return "Economics";
  // Finance: S&P, Nasdaq, stocks, metals, treasuries, etc.
  if (/s&p|nasdaq|stock|spx|dow|treasury|wti|eur\/usd|usd\/jpy|financial|earnings|ipo|kpi/.test(t)) return "Finance";
  // Politics: elections, congress, etc.
  if (/trump|election|senate|congress|mayor|primary|scotus|court|house|republican|democrat|nominee|president/.test(t)) return "Politics";
  // Sports: all major leagues and sports
  if (/championship|nba|nfl|mlb|nhl|soccer|basketball|football|baseball|hockey|golf|tennis|boxing|mma|esports|premier league|champions league|world series|super bowl|finals/.test(t)) return "Sports";
  return "Other";
}

/** Derive NO outcome label when yesSubTitle === noSubTitle (e.g. "A vs B Winner" → NO = the other side) */
function deriveNoLabel(title: string, yesSubTitle: string): string {
  const vsMatch = title.match(/(.+?)\s+vs\.?\s+(.+?)(?:\s+Winner|\?|$)/i) ||
    title.match(/(.+?)\s+vs\.?\s+(.+)/i);
  if (vsMatch) {
    const a = vsMatch[1].trim();
    const b = vsMatch[2].replace(/\s*(Winner|\?|$).*$/i, "").trim();
    const yesNorm = yesSubTitle.toLowerCase();
    if (a.toLowerCase().includes(yesNorm) || yesNorm.includes(a.toLowerCase())) return b;
    if (b.toLowerCase().includes(yesNorm) || yesNorm.includes(b.toLowerCase())) return a;
  }
  return `Not ${yesSubTitle}`;
}

export function dflowMarketToCusp(m: DFlowMarket, settlementMint = USDC_MINT_ADDRESS): CuspMarket {
  // Look up accounts by our settlement mint first; fall back to first available account entry
  let accounts = m.accounts[settlementMint];
  let resolvedSettlementMint: string | undefined = settlementMint;
  if (!accounts && m.accounts) {
    const keys = Object.keys(m.accounts);
    if (keys.length > 0) {
      resolvedSettlementMint = keys[0];
      accounts = m.accounts[resolvedSettlementMint];
    }
  }
  const yesAsk = parsePrice(m.yesAsk);
  const noAsk = parsePrice(m.noAsk);
  const yesBid = parsePrice(m.yesBid);
  const noBid = parsePrice(m.noBid);
  const yesPrice = yesAsk > 0 ? yesAsk : 1 - noBid;
  const noPrice = noAsk > 0 ? noAsk : 1 - yesBid;
  const probability = Math.round((yesPrice || 1 - noPrice) * 100);
  const yesYield = yesPrice >= 0.5 ? ((1 - yesPrice) / yesPrice) * 100 : 0;
  const noYield = noPrice >= 0.5 ? ((1 - noPrice) / noPrice) * 100 : 0;
  const estimatedYield = Math.max(yesYield, noYield);

  const yesLabel = m.yesSubTitle?.trim() || "YES";
  const noLabel =
    m.noSubTitle?.trim() && m.noSubTitle !== m.yesSubTitle
      ? m.noSubTitle.trim()
      : deriveNoLabel(m.title, yesLabel);

  return {
    id: m.ticker,
    ticker: m.ticker,
    name: m.title,
    category: inferCategory(m.eventTicker, m.title),
    yesPrice: yesPrice || 0.5,
    noPrice: noPrice || 0.5,
    probability,
    volume: m.volume,
    volume24h: m.volume24h,
    resolutionDate: new Date(m.expirationTime * 1000).toISOString(),
    status: m.status,
    yesMint: accounts?.yesMint,
    noMint: accounts?.noMint,
    settlementMint: accounts ? resolvedSettlementMint : undefined,
    eventTicker: m.eventTicker,
    estimatedYield,
    yesLabel,
    noLabel,
    rulesPrimary: m.rulesPrimary,
    rulesSecondary: m.rulesSecondary,
    openInterest: m.openInterest,
    subtitle: m.subtitle || undefined,
  };
}
