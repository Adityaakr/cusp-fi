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
  /** Present when `withNestedMarkets=true` on GET /api/v1/events */
  markets?: DFlowMarket[];
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

/** GET /api/v1/series — series template row */
export interface DFlowSeries {
  ticker: string;
  title?: string;
  category?: string;
}

export interface DFlowSeriesResponse {
  series: DFlowSeries[];
}

/** Max series tickers per GET /api/v1/events request (DFlow API limit). */
export const DFLOW_SERIES_TICKERS_PER_EVENTS_REQUEST = 25;

const DEFAULT_EVENTS_PAGE_LIMIT = 100;

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
  /** Best YES bid (0–1 dollars) */
  yesBestBid: number;
  /** Best YES ask (0–1 dollars) */
  yesBestAsk: number;
  /** Best NO ask (0–1 dollars) */
  noBestAsk: number;
  /** YES bid–ask spread in dollars; null when one side missing */
  yesSpread: number | null;
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
  /** Comma-separated series tickers (max 25 per request per API docs) */
  seriesTickers?: string | string[];
  withNestedMarkets?: boolean;
  status?: string;
  isInitialized?: boolean;
  sort?: string;
}): Promise<DFlowEventsResponse> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.cursor !== undefined) search.set("cursor", String(params.cursor));
  if (params?.expand) search.set("expand", params.expand);
  if (params?.withNestedMarkets === true) search.set("withNestedMarkets", "true");
  if (params?.seriesTickers !== undefined) {
    const s =
      typeof params.seriesTickers === "string"
        ? params.seriesTickers
        : params.seriesTickers.join(",");
    search.set("seriesTickers", s);
  }
  if (params?.status) search.set("status", params.status);
  if (params?.isInitialized !== undefined) search.set("isInitialized", String(params.isInitialized));
  if (params?.sort) search.set("sort", params.sort);
  const qs = search.toString();
  return fetchJson(`${METADATA_API}/api/v1/events${qs ? `?${qs}` : ""}`);
}

export async function fetchSeries(params?: {
  category?: string;
  tags?: string;
  status?: string;
  isInitialized?: boolean;
}): Promise<DFlowSeriesResponse> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (params?.tags) search.set("tags", params.tags);
  if (params?.status) search.set("status", params.status);
  if (params?.isInitialized !== undefined) search.set("isInitialized", String(params.isInitialized));
  const qs = search.toString();
  return fetchJson(`${METADATA_API}/api/v1/series${qs ? `?${qs}` : ""}`);
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

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    out.push(items.slice(i, i + chunkSize));
  }
  return out;
}

/**
 * Paginate GET /api/v1/events for a fixed set of series tickers (≤25).
 * Uses cursor as skip offset per API docs until a partial page is returned.
 */
export async function fetchAllEventsPages(params: {
  seriesTickers: string[];
  withNestedMarkets?: boolean;
  pageLimit?: number;
}): Promise<DFlowEvent[]> {
  const lim = params.pageLimit ?? DEFAULT_EVENTS_PAGE_LIMIT;
  const combined: DFlowEvent[] = [];
  let skip = 0;
  const seriesJoin = params.seriesTickers.join(",");
  const maxPages = 500;
  for (let page = 0; page < maxPages; page++) {
    const res = await fetchEvents({
      seriesTickers: seriesJoin,
      withNestedMarkets: params.withNestedMarkets ?? true,
      limit: lim,
      cursor: skip,
    });
    const batch = res.events ?? [];
    combined.push(...batch);
    if (batch.length === 0) break;
    if (batch.length < lim) break;
    skip += batch.length;
  }
  return combined;
}

/** Dedupe active markets by ticker; optional per-tag counts using event ticker matching. */
export function countActiveMarketsFromNestedEvents(
  events: DFlowEvent[],
  tagList: string[] | null | undefined
): { totalActive: number; byTag: Record<string, number> } {
  const seenMarketTickers = new Set<string>();
  let totalActive = 0;
  const trimmedTags = (tagList ?? []).map((t) => t.trim()).filter(Boolean);
  const byTag: Record<string, number> = {};
  for (const t of trimmedTags) byTag[t] = 0;

  for (const ev of events) {
    const mkts = ev.markets ?? [];
    for (const m of mkts) {
      if (m.status !== "active") continue;
      if (seenMarketTickers.has(m.ticker)) continue;
      seenMarketTickers.add(m.ticker);
      totalActive += 1;
      for (const tag of trimmedTags) {
        if (eventTickerMatchesTag(ev.ticker, tag)) {
          byTag[tag] = (byTag[tag] ?? 0) + 1;
        }
      }
    }
  }
  return { totalActive, byTag };
}

/**
 * For each non-empty category in tags_by_categories: series → events (nested markets) → active counts.
 * Series category filter uses the same display label as the UI (e.g. Politics).
 */
export async function fetchCategoryNestedMarketCounts(
  tags: DFlowTagsResponse
): Promise<Record<string, { totalActive: number; byTag: Record<string, number> }>> {
  const out: Record<string, { totalActive: number; byTag: Record<string, number> }> = {};
  const entries = Object.entries(tags.tagsByCategories ?? {}).filter(
    ([, list]) => list && list.length > 0
  );
  for (const [catKey, tagList] of entries) {
    const label = toTitleCaseCategory(catKey);
    const rawList = tagList!.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
    const seriesRes = await fetchSeries({ category: label });
    const tickers = (seriesRes.series ?? []).map((s) => s.ticker).filter(Boolean);
    if (tickers.length === 0) {
      out[label] = {
        totalActive: 0,
        byTag: Object.fromEntries(rawList.map((t) => [t, 0])),
      };
      continue;
    }
    const chunks = chunkArray(tickers, DFLOW_SERIES_TICKERS_PER_EVENTS_REQUEST);
    const allEvents: DFlowEvent[] = [];
    for (const chunk of chunks) {
      const evs = await fetchAllEventsPages({
        seriesTickers: chunk,
        withNestedMarkets: true,
      });
      allEvents.push(...evs);
    }
    out[label] = countActiveMarketsFromNestedEvents(allEvents, rawList);
  }
  return out;
}

/** Total active markets via paginated GET /api/v1/markets (authoritative “All” count). */
export async function fetchTotalActiveMarketsCount(options?: { pageLimit?: number }): Promise<number> {
  const limit = options?.pageLimit ?? 500;
  let total = 0;
  let cursor: number | undefined = undefined;
  for (let i = 0; i < 500; i++) {
    const res = await fetchMarkets({ status: "active", limit, cursor });
    total += res.markets.length;
    if (res.markets.length === 0) break;
    if (res.cursor === undefined || res.cursor === null) break;
    cursor = res.cursor;
  }
  return total;
}

/** True if `label` is a DFlow tags_by_categories bucket (not a heuristic-only fallback tab). */
export function isTagsCategoryDisplayLabel(
  displayLabel: string,
  tags: DFlowTagsResponse | null | undefined
): boolean {
  if (!tags?.tagsByCategories) return false;
  return Object.keys(tags.tagsByCategories).some((k) => toTitleCaseCategory(k) === displayLabel);
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

export function toTitleCaseCategory(key: string): string {
  const lower = key.replace(/_/g, " ").trim().toLowerCase();
  const exceptions = new Set(["and", "of", "the", "in", "for", "on", "to", "with"]);
  return lower.replace(/\b\w+/g, (w) =>
    exceptions.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)
  );
}

/** Same rules as tag matching inside `resolveMarketCategory` (prefix / substring on event ticker). */
export function eventTickerMatchesTag(eventTicker: string, tag: string): boolean {
  const raw = typeof tag === "string" ? tag.trim() : "";
  if (!raw) return false;
  const u = raw.toUpperCase();
  const et = eventTicker.toUpperCase();
  return et.startsWith(u) || et.includes(`-${u}`) || et.includes(u);
}

/** Tags listed under the API category whose display label matches (e.g. `politics` → `Politics`). */
export function getTagsListForCategoryLabel(
  tags: DFlowTagsResponse | null | undefined,
  displayLabel: string
): string[] | null {
  if (!tags?.tagsByCategories) return null;
  for (const [catKey, list] of Object.entries(tags.tagsByCategories)) {
    if (toTitleCaseCategory(catKey) !== displayLabel) continue;
    if (!list?.length) return null;
    return list.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim());
  }
  return null;
}

/**
 * Prefer DFlow `tags_by_categories` (prefix / substring match on event ticker),
 * else heuristic buckets (Crypto, Sports, …).
 */
export function resolveMarketCategory(
  eventTicker: string,
  title: string,
  tags: DFlowTagsResponse | null | undefined
): string {
  if (tags?.tagsByCategories && Object.keys(tags.tagsByCategories).length > 0) {
    let best: { len: number; label: string } | null = null;
    for (const [catKey, list] of Object.entries(tags.tagsByCategories)) {
      if (!list?.length) continue;
      for (const tag of list) {
        if (!eventTickerMatchesTag(eventTicker, tag)) continue;
        const len = tag.trim().toUpperCase().length;
        const label = toTitleCaseCategory(catKey);
        if (!best || len > best.len) best = { len, label };
      }
    }
    if (best) return best.label;
  }
  return inferCategory(eventTicker, title);
}

const FALLBACK_CATEGORY_TABS = ["Crypto", "Sports", "Politics", "Economics", "Finance", "Entertainment", "Science & Tech", "Health", "Climate & Weather", "Other"];

/** Category pills: All + DFlow API categories (when present) + heuristic buckets not already listed. */
export function buildCategoryTabList(tags: DFlowTagsResponse | null | undefined): string[] {
  const out: string[] = ["All"];
  const seen = new Set<string>(["All"]);
  if (tags?.tagsByCategories && Object.keys(tags.tagsByCategories).length > 0) {
    const fromApi = Object.keys(tags.tagsByCategories)
      .filter((k) => (tags.tagsByCategories[k]?.length ?? 0) > 0)
      .map((k) => toTitleCaseCategory(k))
      .sort((a, b) => a.localeCompare(b));
    for (const label of fromApi) {
      if (!seen.has(label)) {
        seen.add(label);
        out.push(label);
      }
    }
  }
  for (const label of FALLBACK_CATEGORY_TABS) {
    if (!seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}

/** Map DFlow-style categories to our UI categories */
function inferCategory(eventTicker: string, title: string): string {
  const t = (eventTicker + title).toLowerCase();
  // Climate & Weather: temperature, snow, rain, hurricane, natural disaster, etc.
  if (/climate|weather|temperature|snow|rain|hurrican|tornado|drought|flood|wildfire|earthquake|storm|natural disaster|highest temp|kxhigh|kxlow|kxrain|kxsnow|kxwind/.test(t)) return "Climate & Weather";
  // Crypto: BTC, ETH, SOL, DOGE, XRP, etc.
  if (/btc|eth|sol|doge|xrp|crypto|bitcoin|blockchain/.test(t)) return "Crypto";
  // Economics: Fed, GDP, inflation, employment, etc.
  if (/fed|rate|gdp|inflation|economy|employment|jobs|oil|housing|central bank|bankruptcy|default/.test(t)) return "Economics";
  // Finance: S&P, Nasdaq, stocks, metals, treasuries, etc.
  if (/s&p|nasdaq|stock|spx|dow|treasury|wti|eur\/usd|usd\/jpy|financial|earnings|ipo|kpi/.test(t)) return "Finance";
  // Politics: elections, congress, etc.
  if (/trump|election|senate|congress|mayor|primary|scotus|court|house|republican|democrat|nominee|president/.test(t)) return "Politics";
  // Science & Tech: AI, space, medicine, energy
  if (/ai|space|spacex|nasa|medicine|energy|quantum|tech|nuclear|fusion/.test(t)) return "Science & Tech";
  // Sports: all major leagues and sports
  if (/championship|nba|nfl|mlb|nhl|soccer|basketball|football|baseball|hockey|golf|tennis|boxing|mma|esports|premier league|champions league|world series|super bowl|finals|stanley cup|world cup|f1|formula/.test(t)) return "Sports";
  // Entertainment: movies, music, awards, TV, etc.
  if (/oscar|grammy|movie|box office|music|album|tv show|streaming|netflix|disney|game of thrones|emmy|golden globe|celebrity|award/.test(t)) return "Entertainment";
  // Health: diseases, FDA, etc.
  if (/health|disease|fda|vaccine|outbreak|pandemic|bird flu|flu|cancer/.test(t)) return "Health";
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

  const yesSpread =
    yesAsk > 0 && yesBid > 0 ? Math.round((yesAsk - yesBid) * 10_000) / 10_000 : null;

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
    yesBestBid: yesBid,
    yesBestAsk: yesAsk > 0 ? yesAsk : 1 - noBid,
    noBestAsk: noAsk > 0 ? noAsk : 1 - yesBid,
    yesSpread,
  };
}
