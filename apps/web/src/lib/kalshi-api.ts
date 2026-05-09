import { KALSHI_TRADE_API } from "./network-config";
import { resolveMarketCategory, type CuspMarket } from "./dflow-api";

const KALSHI_API = KALSHI_TRADE_API;
const DEFAULT_KALSHI_MARKETS_LIMIT = 1000;

export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  market_type: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  status: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  no_bid_dollars?: string;
  no_ask_dollars?: string;
  last_price_dollars?: string;
  volume_fp?: string;
  volume_24h_fp?: string;
  open_interest_fp?: string;
  can_close_early?: boolean;
  fractional_trading_enabled?: boolean;
  title: string;
  subtitle?: string;
  rules_primary?: string;
  rules_secondary?: string;
  close_time?: string;
  expiration_time?: string;
  expected_expiration_time?: string;
  latest_expiration_time?: string;
}

export interface KalshiMarketsResponse {
  markets: KalshiMarket[];
  cursor?: string;
}

export interface KalshiEvent {
  event_ticker: string;
  series_ticker: string;
  sub_title?: string;
  title: string;
  category?: string;
  product_metadata?: Record<string, unknown>;
  strike_date?: string;
  strike_period?: string;
  markets?: KalshiMarket[];
  last_updated_ts?: string;
}

export interface KalshiEventsResponse {
  events: KalshiEvent[];
  cursor?: string;
}

export interface KalshiTagsByCategoriesResponse {
  tags_by_categories: Record<string, string[] | null>;
}

export interface KalshiSportsFilterScopeList {
  scopes: string[];
}

export interface KalshiSportFilterDetails {
  scopes: string[];
  competitions: Record<string, KalshiSportsFilterScopeList>;
}

export interface KalshiFiltersBySportsResponse {
  filters_by_sports: Record<string, KalshiSportFilterDetails>;
  sport_ordering: string[];
}

export interface KalshiSearchSeriesMarket {
  ticker: string;
  yes_subtitle?: string;
  no_subtitle?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  last_price_dollars?: string;
  previous_price_dollars?: string;
  close_ts?: string;
  expected_expiration_ts?: string;
  open_ts?: string;
  result?: string;
  title?: string;
  volume?: number;
}

export interface KalshiSearchSeriesProductMetadata {
  categories?: string[];
  series_tags?: string[];
  subcategories?: Record<string, string[]>;
  [key: string]: unknown;
}

export interface KalshiSearchSeriesItem {
  type: string;
  series_ticker: string;
  series_title: string;
  event_ticker: string;
  event_subtitle?: string;
  event_title: string;
  category: string;
  product_metadata?: KalshiSearchSeriesProductMetadata;
  product_metadata_derived?: Record<string, unknown>;
  total_series_volume?: number;
  total_volume?: number;
  total_market_count?: number;
  active_market_count?: number;
  markets?: KalshiSearchSeriesMarket[];
}

export interface KalshiSearchSeriesResponse {
  total_results_count: number;
  current_page: KalshiSearchSeriesItem[];
  next_cursor?: string | null;
  hydrated_data?: Record<string, unknown>;
}

export type KalshiSearchSeriesVariant = "trending_open" | "hydrated_open_unopened";

export interface KalshiSearchSeriesParams {
  category: string;
  status?: "open" | "closed" | "settled" | "unopened" | "open,unopened";
  tag?: string;
  competition?: string;
  scope?: string;
  orderBy?: string;
  reverse?: boolean;
  pageSize?: number;
  cursor?: string;
  hydrate?: string[];
  withMilestones?: boolean;
  variant?: KalshiSearchSeriesVariant;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", ...options?.headers },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error?.message || body?.error || body?.message || JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(detail || `Kalshi API error: ${res.status}`);
  }
  return res.json();
}

export async function fetchKalshiMarkets(params?: {
  status?: "unopened" | "open" | "paused" | "closed" | "settled";
  limit?: number;
  cursor?: string;
  tickers?: string | string[];
  eventTicker?: string;
  seriesTicker?: string;
}): Promise<KalshiMarketsResponse> {
  const search = new URLSearchParams();
  search.set("limit", String(Math.max(1, Math.min(params?.limit ?? DEFAULT_KALSHI_MARKETS_LIMIT, 1000))));
  if (params?.status) search.set("status", params.status);
  if (params?.cursor) search.set("cursor", params.cursor);
  if (params?.eventTicker) search.set("event_ticker", params.eventTicker);
  if (params?.seriesTicker) search.set("series_ticker", params.seriesTicker);
  if (params?.tickers) {
    search.set("tickers", Array.isArray(params.tickers) ? params.tickers.join(",") : params.tickers);
  }
  return fetchJson(`${KALSHI_API}/markets?${search}`);
}

export async function fetchKalshiEvents(params?: {
  status?: "unopened" | "open" | "closed" | "settled";
  limit?: number;
  cursor?: string;
  withNestedMarkets?: boolean;
  withMilestones?: boolean;
  seriesTicker?: string;
  minCloseTs?: number;
  minUpdatedTs?: number;
}): Promise<KalshiEventsResponse> {
  const search = new URLSearchParams();
  search.set("limit", String(Math.max(1, Math.min(params?.limit ?? 200, 200))));
  if (params?.status) search.set("status", params.status);
  if (params?.cursor) search.set("cursor", params.cursor);
  if (params?.withNestedMarkets) search.set("with_nested_markets", "true");
  if (params?.withMilestones) search.set("with_milestones", "true");
  if (params?.seriesTicker) search.set("series_ticker", params.seriesTicker);
  if (params?.minCloseTs !== undefined) search.set("min_close_ts", String(params.minCloseTs));
  if (params?.minUpdatedTs !== undefined) search.set("min_updated_ts", String(params.minUpdatedTs));
  return fetchJson(`${KALSHI_API}/events?${search}`);
}

export async function fetchKalshiMarket(ticker: string): Promise<KalshiMarket> {
  const res = await fetchKalshiMarkets({ tickers: ticker, limit: 1 });
  const market = res.markets[0];
  if (!market) throw new Error(`Kalshi market not found: ${ticker}`);
  return market;
}

export async function fetchKalshiTagsByCategories(): Promise<KalshiTagsByCategoriesResponse> {
  return fetchJson(`${KALSHI_API}/search/tags_by_categories`);
}

export async function fetchKalshiSportsFilters(): Promise<KalshiFiltersBySportsResponse> {
  return fetchJson(`${KALSHI_API}/search/filters_by_sport`);
}

export async function fetchKalshiSearchSeries(params: {
  category: string;
  status?: "open" | "closed" | "settled" | "unopened" | "open,unopened";
  tag?: string;
  competition?: string;
  scope?: string;
  orderBy?: string;
  reverse?: boolean;
  pageSize?: number;
  cursor?: string;
  hydrate?: string[];
  withMilestones?: boolean;
}): Promise<KalshiSearchSeriesResponse> {
  const search = new URLSearchParams();
  search.set("category", params.category);
  search.set("status", params.status ?? "open");
  search.set("order_by", params.orderBy ?? "trending");
  search.set("reverse", String(params.reverse ?? false));
  search.set("page_size", String(Math.max(1, Math.min(params.pageSize ?? 100, 200))));
  if (params.tag?.trim()) search.append("tag", params.tag.trim());
  if (params.competition?.trim()) search.set("competition", params.competition.trim());
  if (params.scope?.trim()) search.set("scope", params.scope.trim());
  if (params.cursor?.trim()) search.set("cursor", params.cursor.trim());
  const hydrate = (params.hydrate ?? ["milestones", "structured_targets"]).filter(Boolean);
  if (hydrate.length > 0) search.set("hydrate", hydrate.join(","));
  if (params.withMilestones ?? true) search.set("with_milestones", "true");
  return fetchJson(`${KALSHI_API}/v1/search/series?${search}`);
}

export async function searchKalshiMarketsByQuery(query: string, limit: number = 25): Promise<KalshiSearchSeriesResponse> {
  const search = new URLSearchParams();
  search.set("query", query);
  search.set("order_by", "querymatch");
  search.set("page_size", String(limit));
  search.set("fuzzy_threshold", "4");
  search.set("experiment_key", "shd");
  search.set("with_milestones", "true");
  return fetchJson(`${KALSHI_API}/v1/search/series?${search}`);
}

export async function fetchAllKalshiSearchSeries(params: {
  category: string;
  status?: "open" | "closed" | "settled" | "unopened" | "open,unopened";
  tag?: string;
  competition?: string;
  scope?: string;
  orderBy?: string;
  reverse?: boolean;
  pageSize?: number;
  hydrate?: string[];
  withMilestones?: boolean;
  maxPages?: number;
}): Promise<KalshiSearchSeriesItem[]> {
  const all: KalshiSearchSeriesItem[] = [];
  let cursor: string | undefined;
  const maxPages = params.maxPages ?? 500;

  for (let page = 0; page < maxPages; page += 1) {
    const res = await fetchKalshiSearchSeries({
      ...params,
      cursor,
    });
    const batch = res.current_page ?? [];
    all.push(...batch);
    const nextCursor = res.next_cursor ?? undefined;
    if (!nextCursor || batch.length === 0) break;
    cursor = nextCursor;
  }

  return all;
}

function parseDollars(value: string | undefined): number {
  if (!value) return 0;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function parseAmount(value: string | undefined): number {
  if (!value) return 0;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function resolveExpiration(m: KalshiMarket): string {
  const raw =
    m.expiration_time ??
    m.expected_expiration_time ??
    m.latest_expiration_time ??
    m.close_time;
  if (!raw) return new Date().toISOString();
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? new Date(ts).toISOString() : new Date().toISOString();
}

function resolveSearchMarketExpiration(market: KalshiSearchSeriesMarket): string {
  const raw = market.expected_expiration_ts ?? market.close_ts ?? market.open_ts;
  if (!raw) return new Date().toISOString();
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? new Date(ts).toISOString() : new Date().toISOString();
}

function deriveSearchMarketTags(
  item: KalshiSearchSeriesItem,
  categoryLabel: string
): string[] {
  const subcategories = item.product_metadata?.subcategories ?? {};
  const exact = subcategories[categoryLabel];
  if (exact?.length) {
    return exact
      .map((tag) => normalizeTaxonomyLabel(tag))
      .filter(Boolean);
  }
  const normalizedCategory = normalizeTaxonomyLabel(categoryLabel).toLowerCase();
  for (const [key, values] of Object.entries(subcategories)) {
    if (normalizeTaxonomyLabel(key).toLowerCase() !== normalizedCategory) continue;
    return (values ?? [])
      .map((tag) => normalizeTaxonomyLabel(tag))
      .filter(Boolean);
  }
  return (item.product_metadata?.series_tags ?? [])
    .map((tag) => normalizeTaxonomyLabel(tag))
    .filter(Boolean);
}

export function buildKalshiTagMarketCounts(
  items: KalshiSearchSeriesItem[],
  categoryLabel: string
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const tags = [...new Set(deriveSearchMarketTags(item, categoryLabel))];
    const marketCount = item.active_market_count ?? item.markets?.length ?? 0;
    for (const tag of tags) {
      counts[tag] = (counts[tag] ?? 0) + marketCount;
    }
  }
  return counts;
}

export function kalshiSearchItemsToMarkets(
  items: KalshiSearchSeriesItem[],
  options?: {
    primaryTag?: string | null;
  }
): CuspMarket[] {
  const seen = new Set<string>();
  const markets: CuspMarket[] = [];

  for (const item of items) {
    const category = normalizeTaxonomyLabel(item.category);
    for (const market of item.markets ?? []) {
      if (seen.has(market.ticker)) continue;
      seen.add(market.ticker);

      const yesBid = parseDollars(market.yes_bid_dollars);
      const yesAsk = parseDollars(market.yes_ask_dollars);
      const lastPrice = parseDollars(market.last_price_dollars);
      const yesPrice = yesAsk > 0 ? yesAsk : lastPrice > 0 ? lastPrice : 0.5;
      const noPrice = yesBid > 0 ? 1 - yesBid : lastPrice > 0 ? 1 - lastPrice : 0.5;
      const probability = Math.round((yesPrice || 1 - noPrice || 0.5) * 100);
      const yesYield = yesPrice >= 0.5 ? ((1 - yesPrice) / yesPrice) * 100 : 0;
      const noYield = noPrice >= 0.5 ? ((1 - noPrice) / noPrice) * 100 : 0;

      markets.push({
        id: market.ticker,
        ticker: market.ticker,
        name: market.title?.trim() || item.event_title,
        category,
        subCategory: options?.primaryTag?.trim() || undefined,
        sourceTag: options?.primaryTag?.trim() || undefined,
        yesPrice: yesPrice || 0.5,
        noPrice: noPrice || 0.5,
        probability,
        volume: market.volume ?? item.total_volume ?? 0,
        volume24h: market.volume ?? item.total_volume ?? 0,
        resolutionDate: resolveSearchMarketExpiration(market),
        status: market.result ? "settled" : "open",
        eventTicker: item.event_ticker,
        estimatedYield: Math.max(yesYield, noYield),
        yesLabel: market.yes_subtitle?.trim() || "YES",
        noLabel: market.no_subtitle?.trim() || "NO",
        subtitle: item.event_subtitle || item.series_title,
        yesBestBid: yesBid,
        yesBestAsk: yesAsk > 0 ? yesAsk : lastPrice,
        noBestAsk: yesBid > 0 ? 1 - yesBid : lastPrice > 0 ? 1 - lastPrice : 0.5,
        yesSpread:
          yesAsk > 0 && yesBid > 0
            ? Math.round((yesAsk - yesBid) * 10_000) / 10_000
            : null,
      });
    }
  }

  return markets;
}

export function inferKalshiSubCategory(m: Pick<KalshiMarket, "ticker" | "event_ticker" | "title">): string | undefined {
  const text = `${m.ticker} ${m.event_ticker} ${m.title}`;
  if (matchesAnyAlias(text, tagAliases("basketball"))) return "Basketball";
  if (matchesAnyAlias(text, tagAliases("football"))) return "Football";
  if (matchesAnyAlias(text, tagAliases("baseball"))) return "Baseball";
  if (matchesAnyAlias(text, tagAliases("hockey"))) return "Hockey";
  if (matchesAnyAlias(text, tagAliases("soccer"))) return "Soccer";
  if (matchesAnyAlias(text, tagAliases("tennis"))) return "Tennis";
  if (matchesAnyAlias(text, tagAliases("golf"))) return "Golf";
  if (matchesAnyAlias(text, ["mma", "ufc", "boxing"])) return "Combat Sports";
  if (matchesAnyAlias(text, ["f1", "formula 1", "nascar"])) return "Motorsports";
  if (matchesAnyAlias(text, tagAliases("bitcoin"))) return "Bitcoin";
  if (matchesAnyAlias(text, tagAliases("ethereum"))) return "Ethereum";
  if (matchesAnyAlias(text, tagAliases("solana"))) return "Solana";
  if (matchesAnyAlias(text, ["doge", "xrp", "crypto"])) return "Crypto Other";
  return undefined;
}

function normalizeTaxonomyLabel(value: string): string {
  return value.replace(/[_-]+/g, " ").trim();
}

function tagAliases(tag: string): string[] {
  const t = tag.toLowerCase();
  const aliases: Record<string, string[]> = {
    basketball: ["basketball", "nba", "wnba", "ncaamb", "ncaawb"],
    football: ["football", "nfl", "ncaaf", "super bowl"],
    baseball: ["baseball", "mlb", "world series"],
    hockey: ["hockey", "nhl", "stanley cup"],
    soccer: ["soccer", "premier league", "champions league", "world cup"],
    tennis: ["tennis", "wimbledon", "french open", "australian open"],
    golf: ["golf", "masters", "pga"],
    bitcoin: ["bitcoin", "btc"],
    ethereum: ["ethereum", "eth"],
    solana: ["solana", "sol"],
  };
  return aliases[t] ?? [t];
}

function tokenize(value: string): string[] {
  return value
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

function matchesAlias(text: string, alias: string): boolean {
  const normalizedAlias = alias.trim().toUpperCase();
  if (!normalizedAlias) return false;
  const normalizedText = text.toUpperCase();

  if (normalizedAlias.includes(" ")) {
    const phrasePattern = normalizedAlias.split(/\s+/).map(escapeRegExp).join("\\s+");
    return new RegExp(`\\b${phrasePattern}\\b`).test(normalizedText);
  }

  const tokens = tokenize(normalizedText);
  return tokens.some((token) => {
    if (token === normalizedAlias) return true;
    if (token === `KX${normalizedAlias}`) return true;
    if (token.startsWith(`KX${normalizedAlias}`)) return true;
    if (normalizedAlias.length >= 4 && token.startsWith(normalizedAlias)) return true;
    return false;
  });
}

function matchesAnyAlias(text: string, aliases: string[]): boolean {
  return aliases.some((alias) => matchesAlias(text, alias));
}

function aliasScore(alias: string): number {
  return alias.replace(/\s+/g, "").length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function marketText(market: CuspMarket): string {
  return [
    market.ticker,
    market.eventTicker,
    market.name,
    market.subtitle,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function eventText(event: KalshiEvent): string {
  const metadataValues = Object.values(event.product_metadata ?? {})
    .filter((value): value is string | number | boolean => {
      const t = typeof value;
      return t === "string" || t === "number" || t === "boolean";
    })
    .join(" ");
  return [
    event.event_ticker,
    event.series_ticker,
    event.title,
    event.sub_title,
    event.category,
    metadataValues,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function tagsForCategoryLabel(
  tagsByCategories: Record<string, string[] | null> | undefined,
  categoryLabel: string | undefined
): string[] | null {
  if (!tagsByCategories || !categoryLabel) return null;
  const normalizedLabel = normalizeTaxonomyLabel(categoryLabel).toLowerCase();
  for (const [key, tags] of Object.entries(tagsByCategories)) {
    if (normalizeTaxonomyLabel(key).toLowerCase() === normalizedLabel) {
      return tags ?? null;
    }
  }
  return null;
}

export function applyKalshiTaxonomy(
  market: CuspMarket,
  tagsByCategories: Record<string, string[] | null> | undefined,
  extraText = ""
): CuspMarket {
  if (!tagsByCategories || Object.keys(tagsByCategories).length === 0) return market;

  const text = `${marketText(market)} ${extraText.toLowerCase()}`;
  let bestMatch: { category: string; tag: string; score: number } | null = null;

  for (const [rawCategory, rawTags] of Object.entries(tagsByCategories)) {
    const category = normalizeTaxonomyLabel(rawCategory);
    const tags = (rawTags ?? []).filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);

    for (const rawTag of tags) {
      const tag = normalizeTaxonomyLabel(rawTag);
      const aliases = tagAliases(tag);
      if (!matchesAnyAlias(text, aliases)) continue;
      const score = Math.max(...aliases.map(aliasScore));
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { category, tag, score };
      }
    }
  }

  if (!bestMatch) return market;
  return {
    ...market,
    category: bestMatch.category,
    subCategory: bestMatch.tag,
    sourceTag: bestMatch.tag,
  };
}

function inferSubCategoryFromEvent(
  event: KalshiEvent,
  market: KalshiMarket,
  tagsByCategories: Record<string, string[] | null> | undefined
): string | undefined {
  const text = `${eventText(event)} ${market.ticker} ${market.title}`.toLowerCase();
  const categoryKey = Object.keys(tagsByCategories ?? {}).find(
    (key) =>
      normalizeTaxonomyLabel(key).toLowerCase() ===
      normalizeTaxonomyLabel(event.category ?? "").toLowerCase()
  );
  const candidateTags = categoryKey ? tagsByCategories?.[categoryKey] ?? [] : [];
  let best: { tag: string; score: number } | null = null;
  for (const rawTag of candidateTags ?? []) {
    if (!rawTag) continue;
    const tag = normalizeTaxonomyLabel(rawTag);
    const aliases = tagAliases(tag);
    if (!matchesAnyAlias(text, aliases)) continue;
    const score = Math.max(...aliases.map(aliasScore));
    if (!best || score > best.score) best = { tag, score };
  }
  if (best) return best.tag;

  const metadata = event.product_metadata ?? {};
  for (const key of ["league", "sport", "competition", "tournament", "asset", "ticker_type"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return normalizeTaxonomyLabel(value);
  }

  return inferKalshiSubCategory(market);
}

export function kalshiMarketToCusp(m: KalshiMarket): CuspMarket {
  const yesBid = parseDollars(m.yes_bid_dollars);
  const yesAsk = parseDollars(m.yes_ask_dollars);
  const noBid = parseDollars(m.no_bid_dollars);
  const noAsk = parseDollars(m.no_ask_dollars);
  const lastPrice = parseDollars(m.last_price_dollars);
  const yesPrice = yesAsk > 0 ? yesAsk : lastPrice > 0 ? lastPrice : 1 - noBid;
  const noPrice = noAsk > 0 ? noAsk : 1 - yesBid;
  const probability = Math.round((yesPrice || 1 - noPrice || 0.5) * 100);
  const yesYield = yesPrice >= 0.5 ? ((1 - yesPrice) / yesPrice) * 100 : 0;
  const noYield = noPrice >= 0.5 ? ((1 - noPrice) / noPrice) * 100 : 0;
  const category = resolveMarketCategory(m.event_ticker, m.title, undefined);
  const subCategory = inferKalshiSubCategory(m);

  return {
    id: m.ticker,
    ticker: m.ticker,
    name: m.title,
    category,
    subCategory,
    sourceTag: subCategory,
    yesPrice: yesPrice || 0.5,
    noPrice: noPrice || 0.5,
    probability,
    volume: parseAmount(m.volume_fp),
    volume24h: parseAmount(m.volume_24h_fp),
    resolutionDate: resolveExpiration(m),
    status: m.status,
    eventTicker: m.event_ticker,
    estimatedYield: Math.max(yesYield, noYield),
    yesLabel: m.yes_sub_title?.trim() || "YES",
    noLabel: m.no_sub_title?.trim() || "NO",
    rulesPrimary: m.rules_primary,
    rulesSecondary: m.rules_secondary,
    openInterest: parseAmount(m.open_interest_fp),
    subtitle: m.subtitle || undefined,
    yesBestBid: yesBid,
    yesBestAsk: yesAsk > 0 ? yesAsk : lastPrice,
    noBestAsk: noAsk > 0 ? noAsk : 1 - yesBid,
    yesSpread:
      yesAsk > 0 && yesBid > 0
        ? Math.round((yesAsk - yesBid) * 10_000) / 10_000
        : null,
  };
}

export function kalshiEventMarketToCusp(
  event: KalshiEvent,
  market: KalshiMarket,
  tagsByCategories?: Record<string, string[] | null>
): CuspMarket {
  const base = kalshiMarketToCusp(market);
  const category = event.category ? normalizeTaxonomyLabel(event.category) : base.category;
  const subCategory = inferSubCategoryFromEvent(event, market, tagsByCategories);
  const withEventContext: CuspMarket = {
    ...base,
    category,
    subCategory: subCategory ?? base.subCategory,
    sourceTag: subCategory ?? base.sourceTag,
    subtitle: base.subtitle || event.sub_title || event.title,
  };

  return applyKalshiTaxonomy(
    withEventContext,
    category ? { [category]: tagsForCategoryLabel(tagsByCategories, category) } : undefined,
    eventText(event)
  );
}
