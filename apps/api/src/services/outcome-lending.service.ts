import {
  BPS_DENOMINATOR,
  OUTCOME_RISK_TIER_CONFIGS,
  USDC_MINT_MAINNET,
  computeHealthFactor,
  getOutcomeRiskTierForScore,
} from "@cusp/shared/constants";
import type { PoolClient } from "pg";
import { railwayQuery, withRailwayTransaction } from "../db/railway.js";
import {
  getConnection,
  confirmTransaction,
  getMainnetPoolPublicKey,
  getMainnetPoolUsdcBalance,
  getCusdcMint,
  verifySplTokenTransfer,
  verifyUsdcTransfer,
  TOKEN_2022,
  TOKEN_LEGACY,
} from "../solana/connection.js";
import {
  lendUsdcFromMainnetPool,
  transferSplTokenFromMainnetPool,
  transferUsdcFromMainnetPool,
} from "../solana/token-ops.js";
import { PublicKey } from "@solana/web3.js";
import { fetchMarket, fetchMarketByMint } from "./dflow-adapter.service.js";

type OutcomeSide = "YES" | "NO";
type OutcomeTier = "low" | "medium" | "high" | "ineligible";

interface PoolRow {
  id: string;
  slug: string;
  total_deposited: string | number;
  available_liquidity: string | number;
  borrowed_liquidity: string | number;
}

interface SubvaultRow {
  id: string;
  pool_id: string;
  risk_tier: "low" | "medium" | "high";
  current_allocation: string | number;
}

interface MarketRegistryRow {
  id: string;
}

interface CollateralLotRow {
  id: string;
  wallet_address: string;
  snapshot_value_usdc: string | number;
  max_ltv_bps: number;
  liquidation_threshold_bps: number;
  risk_tier: OutcomeTier;
  status: string;
}

interface OutcomeLoanWithRelationsRow {
  id: string;
  wallet_address: string;
  collateral_lot_id: string;
  pool_id: string;
  borrowed_amount_usdc: string | number;
  accrued_interest_usdc: string | number;
  status: string;
  available_liquidity: string | number;
  borrowed_liquidity: string | number;
  current_allocation: string | number | null;
  subvault_id: string | null;
  collateral_mint?: string;
  collateral_quantity?: string | number;
}

interface CollateralPositionWithLoanRow {
  collateral_lot_id: string;
  wallet_address: string;
  market_ticker: string;
  side: OutcomeSide;
  mint: string;
  quantity: string | number;
  snapshot_price: string | number;
  snapshot_value_usdc: string | number;
  max_ltv_bps: number;
  liquidation_threshold_bps: number;
  collateral_status: string;
  deposit_tx_signature: string | null;
  created_at: string;
  updated_at: string;
  loan_id: string | null;
  loan_status: string | null;
  borrowed_amount_usdc: string | number | null;
  accrued_interest_usdc: string | number | null;
  health_factor: string | number | null;
  borrow_tx_signature: string | null;
  expires_at: string | null;
}

export interface WalletOutcomeHoldingResult {
  mint: string;
  ata_address: string;
  balance: number;
  decimals: number;
  ticker: string | null;
  title: string | null;
  side: OutcomeSide | null;
  program: "spl-token" | "token-2022";
  current_price: number | null;
  current_value: number | null;
  probability: number | null;
}

interface RiskAssessment {
  market_ticker: string;
  yes_mint: string;
  no_mint: string;
  side: OutcomeSide;
  side_price: number;
  risk_score: number;
  risk_tier: OutcomeTier;
  max_ltv_bps: number;
  liquidation_threshold_bps: number;
  resolution_time: number | null;
  concentration_bps: number;
}

export interface MainnetPoolDepositResult {
  success: boolean;
  pool_slug?: string;
  amount_usdc?: number;
  available_liquidity?: number;
  error?: string;
}

export interface OutcomeCollateralQuoteResult {
  success: boolean;
  assessment?: RiskAssessment;
  quantity?: number;
  collateral_value_usdc?: number;
  max_borrow_usdc?: number;
  error?: string;
}

export interface RegisterCollateralLotResult {
  success: boolean;
  collateral_lot_id?: string;
  assessment?: RiskAssessment;
  collateral_value_usdc?: number;
  error?: string;
}

export interface OpenOutcomeLoanResult {
  success: boolean;
  loan_id?: string;
  collateral_lot_id?: string;
  borrow_tx_signature?: string;
  borrowed_amount_usdc?: number;
  health_factor?: number;
  risk_tier?: OutcomeTier;
  max_borrow_usdc?: number;
  error?: string;
}

export interface CloseOutcomeLoanResult {
  success: boolean;
  loan_id?: string;
  repaid_amount_usdc?: number;
  collateral_release_tx_signature?: string;
  released_collateral_amount?: number;
  error?: string;
}

export interface MainnetPoolStateResult {
  success: boolean;
  pool_slug?: string;
  pool_public_key?: string;
  asset_mint?: string;
  total_deposited?: number;
  available_liquidity?: number;
  borrowed_liquidity?: number;
  onchain_balance?: number;
  active_loans?: number;
  user_position?: {
    deposited_amount: number;
    available_amount: number;
    locked_amount: number;
    earned_fees: number;
  } | null;
  error?: string;
}

export interface WithdrawMainnetPoolResult {
  success: boolean;
  pool_slug?: string;
  amount_usdc?: number;
  withdraw_tx_signature?: string;
  remaining_available_amount?: number;
  available_liquidity?: number;
  error?: string;
}

export interface OutcomeLoanListItem {
  id: string;
  status: string;
  borrowed_amount_usdc: number;
  health_factor: number | null;
  max_ltv_bps: number;
  liquidation_threshold_bps: number;
  collateral_value_usdc: number;
  market_ticker: string;
  side: OutcomeSide;
  expires_at: string | null;
}

export interface OutcomeCollateralPositionListItem {
  collateral_lot_id: string;
  wallet_address: string;
  market_ticker: string;
  market_title: string;
  side: OutcomeSide;
  mint: string;
  quantity: number;
  snapshot_price: number;
  snapshot_value_usdc: number;
  current_price: number | null;
  current_value: number | null;
  probability: number | null;
  max_ltv_bps: number;
  liquidation_threshold_bps: number;
  collateral_status: string;
  loan_id: string | null;
  loan_status: string | null;
  borrowed_amount_usdc: number;
  accrued_interest_usdc: number;
  health_factor: number | null;
  deposit_tx_signature: string | null;
  borrow_tx_signature: string | null;
  expires_at: string | null;
  custody_wallet: string;
  created_at: string;
  updated_at: string;
}

interface OnchainCustodiedCollateral {
  mint: string;
  quantity: number;
  created_at: string;
  deposit_tx_signature: string;
}

const DEFAULT_POOL_SLUG = "mainnet-outcome-usdc";

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toIsoFromBlockTime(blockTime: number | null | undefined): string {
  if (!blockTime || !Number.isFinite(blockTime)) return new Date().toISOString();
  return new Date(blockTime * 1000).toISOString();
}

function probabilityFromPrice(price: number | null): number | null {
  if (price == null || !Number.isFinite(price)) return null;
  return Math.round(Math.max(0, Math.min(1, price)) * 100);
}

function inferSideFromMint(params: {
  mint: string;
  yesMint: string;
  noMint: string;
}): OutcomeSide | null {
  if (params.mint === params.yesMint) return "YES";
  if (params.mint === params.noMint) return "NO";
  return null;
}

function inferSideFromMarket(market: any, mint: string): OutcomeSide | null {
  const accounts = Object.values(market?.accounts || {}) as Array<Record<string, unknown>>;
  for (const account of accounts) {
    const yesMint = typeof account?.yesMint === "string" ? account.yesMint : "";
    const noMint = typeof account?.noMint === "string" ? account.noMint : "";
    const side = inferSideFromMint({ mint, yesMint, noMint });
    if (side) return side;
  }
  return null;
}

function extractOutcomeMints(market: any): { yesMint: string; noMint: string } {
  const accounts = Object.values(market?.accounts || {}) as Array<Record<string, unknown>>;
  for (const account of accounts) {
    const yesMint = typeof account?.yesMint === "string" ? account.yesMint : "";
    const noMint = typeof account?.noMint === "string" ? account.noMint : "";
    if (yesMint && noMint) return { yesMint, noMint };
  }
  throw new Error("Market is missing YES/NO mints");
}

function sidePriceFromMarket(market: any, side: OutcomeSide): number {
  const yesAsk = toNumber(market?.yesAsk);
  const noAsk = toNumber(market?.noAsk);
  const yesBid = toNumber(market?.yesBid);
  const noBid = toNumber(market?.noBid);
  const yes = yesAsk > 0 ? yesAsk : 1 - noBid;
  const no = noAsk > 0 ? noAsk : 1 - yesBid;
  return side === "YES" ? yes : no;
}

function buildRiskAssessment(params: {
  market: any;
  side: OutcomeSide;
  concentrationBps: number;
}): RiskAssessment {
  const { market, side } = params;
  const { yesMint, noMint } = extractOutcomeMints(market);
  const sidePrice = sidePriceFromMarket(market, side);
  const nowMs = Date.now();
  const resolutionMs = toNumber(market?.expirationTime) > 0 ? toNumber(market.expirationTime) * 1000 : 0;
  const hoursRemaining = resolutionMs > 0 ? Math.max(0, (resolutionMs - nowMs) / (1000 * 60 * 60)) : 0;
  const spread = Math.abs(toNumber(market?.yesAsk) - toNumber(market?.yesBid));
  const volume = Math.max(toNumber(market?.volume24h), toNumber(market?.volume));

  const confidenceScore = Math.max(0, Math.min(40, ((sidePrice - 0.5) / 0.5) * 40));
  const timeScore = Math.max(0, Math.min(20, (hoursRemaining / (24 * 7)) * 20));
  const liquidityScore = Math.max(0, Math.min(20, 12 - spread * 30 + Math.min(8, volume / 50_000)));
  const concentrationScore = Math.max(0, Math.min(10, 10 - (params.concentrationBps / 1000) * 10));
  const marketQualityScore =
    (market?.status === "active" ? 6 : 0) +
    (hoursRemaining >= 24 ? 2 : 0) +
    (sidePrice >= 0.5 ? 2 : 0);

  const riskScore = Math.max(
    0,
    Math.min(
      100,
      confidenceScore + timeScore + liquidityScore + concentrationScore + marketQualityScore
    )
  );

  const riskTier = getOutcomeRiskTierForScore(riskScore);
  const config =
    riskTier === "ineligible" ? null : OUTCOME_RISK_TIER_CONFIGS[riskTier];

  return {
    market_ticker: String(market?.ticker || ""),
    yes_mint: yesMint,
    no_mint: noMint,
    side,
    side_price: sidePrice,
    risk_score: riskScore,
    risk_tier: riskTier,
    max_ltv_bps: config?.maxLtvBps ?? 0,
    liquidation_threshold_bps: config?.liquidationThresholdBps ?? 0,
    resolution_time: resolutionMs > 0 ? Math.floor(resolutionMs / 1000) : null,
    concentration_bps: params.concentrationBps,
  };
}

async function getOrCreateUserId(walletAddress: string, client?: PoolClient): Promise<string> {
  const sql = `
    insert into public.users (wallet_address)
    values ($1)
    on conflict (wallet_address)
    do update set wallet_address = excluded.wallet_address
    returning id
  `;
  const result = client
    ? await client.query<{ id: string }>(sql, [walletAddress])
    : await railwayQuery<{ id: string }>(sql, [walletAddress]);
  if (!result.rows[0]?.id) throw new Error("Failed to get or create user");
  return result.rows[0].id;
}

async function getPool(slug = DEFAULT_POOL_SLUG): Promise<PoolRow> {
  const result = await railwayQuery<PoolRow>(
    `
      select id, slug, total_deposited, available_liquidity, borrowed_liquidity
      from public.lending_pools
      where slug = $1
      limit 1
    `,
    [slug]
  );
  if (!result.rows[0]) throw new Error(`Pool not found: ${slug}`);
  return result.rows[0];
}

async function getLpPosition(poolId: string, walletAddress: string) {
  const result = await railwayQuery<{
    deposited_amount: string | number;
    available_amount: string | number;
    locked_amount: string | number;
    earned_fees: string | number;
  }>(
    `
      select deposited_amount, available_amount, locked_amount, earned_fees
      from public.lp_positions
      where pool_id = $1 and wallet_address = $2
      limit 1
    `,
    [poolId, walletAddress]
  );

  const row = result.rows[0];
  if (!row) return null;
  return {
    deposited_amount: toNumber(row.deposited_amount),
    available_amount: toNumber(row.available_amount),
    locked_amount: toNumber(row.locked_amount),
    earned_fees: toNumber(row.earned_fees),
  };
}

async function getSubvaultForTier(
  poolId: string,
  tier: Exclude<OutcomeTier, "ineligible">,
  client?: PoolClient
): Promise<SubvaultRow> {
  const sql = `
    select id, pool_id, risk_tier, current_allocation
    from public.subvaults
    where pool_id = $1 and risk_tier = $2
    limit 1
  `;
  const result = client
    ? await client.query<SubvaultRow>(sql, [poolId, tier])
    : await railwayQuery<SubvaultRow>(sql, [poolId, tier]);
  if (!result.rows[0]) throw new Error(`Subvault not found for tier ${tier}`);
  return result.rows[0];
}

async function currentConcentrationBps(poolId: string, marketTicker: string): Promise<number> {
  const result = await railwayQuery<{
    total_deposited: string | number;
    market_exposure: string | number;
  }>(
    `
      select
        lp.total_deposited,
        coalesce(sum(case when cl.market_ticker = $2 then ol.borrowed_amount_usdc else 0 end), 0) as market_exposure
      from public.lending_pools lp
      left join public.outcome_loans ol
        on ol.pool_id = lp.id
       and ol.status = 'active'
      left join public.collateral_lots cl
        on cl.id = ol.collateral_lot_id
      where lp.id = $1
      group by lp.total_deposited
    `,
    [poolId, marketTicker]
  );

  const row = result.rows[0];
  if (!row) return 0;
  const totalDeposited = toNumber(row.total_deposited);
  if (totalDeposited <= 0) return 0;
  return Math.round((toNumber(row.market_exposure) / totalDeposited) * BPS_DENOMINATOR);
}

export async function listWalletOutcomeHoldings(
  walletAddress: string
): Promise<WalletOutcomeHoldingResult[]> {
  if (!walletAddress) return [];

  const owner = new PublicKey(walletAddress);
  const connection = getConnection();
  const excludedMints = new Set<string>([
    USDC_MINT_MAINNET,
    "Es9vMFrzaCERn2QytQkwT4NSr8F3rzA4XB9vNehqWj6q",
    "So11111111111111111111111111111111111111112",
  ]);

  try {
    const cusdc = new PublicKey(getCusdcMintSafely()).toBase58();
    if (cusdc) excludedMints.add(cusdc);
  } catch {
    // optional in environments that only use mainnet outcome lending
  }

  const tokenPrograms: Array<{
    key: PublicKey;
    label: "spl-token" | "token-2022";
  }> = [
    { key: TOKEN_LEGACY, label: "spl-token" },
    { key: TOKEN_2022, label: "token-2022" },
  ];

  const accountRows: Array<{
    mint: string;
    ataAddress: string;
    balance: number;
    decimals: number;
    program: "spl-token" | "token-2022";
  }> = [];

  for (const tokenProgram of tokenPrograms) {
    let response;
    try {
      response = await connection.getParsedTokenAccountsByOwner(
        owner,
        { programId: tokenProgram.key },
        "confirmed"
      );
    } catch (error) {
      console.warn(
        `[outcome-holdings] Failed to scan ${tokenProgram.label} accounts for ${walletAddress}:`,
        error
      );
      continue;
    }

    for (const account of response.value) {
      const parsed: any = account.account.data;
      const info = parsed?.parsed?.info;
      const tokenAmount = info?.tokenAmount;
      const mint = typeof info?.mint === "string" ? info.mint : "";
      if (!mint || excludedMints.has(mint)) continue;

      const decimals =
        typeof tokenAmount?.decimals === "number" ? tokenAmount.decimals : 0;
      const uiAmount =
        typeof tokenAmount?.uiAmount === "number"
          ? tokenAmount.uiAmount
          : Number(tokenAmount?.amount ?? 0) / 10 ** decimals;
      const balance = Number.isFinite(uiAmount) ? uiAmount : 0;
      if (balance <= 0) continue;

      accountRows.push({
        mint,
        ataAddress: account.pubkey.toBase58(),
        balance,
        decimals,
        program: tokenProgram.label,
      });
    }
  }

  const marketMetaByMint = new Map<
    string,
    {
      ticker: string | null;
      title: string | null;
      side: OutcomeSide | null;
      currentPrice: number | null;
      probability: number | null;
    } | null
  >();

  for (const mint of [...new Set(accountRows.map((row) => row.mint))]) {
    try {
      const market = await fetchMarketByMint(mint);
      const side = inferSideFromMarket(market, mint);
      const currentPrice = side ? sidePriceFromMarket(market, side) : null;
      marketMetaByMint.set(mint, {
        ticker: String(market?.ticker || ""),
        title: String(market?.title || market?.ticker || "Prediction outcome"),
        side,
        currentPrice,
        probability: probabilityFromPrice(currentPrice),
      });
    } catch {
      marketMetaByMint.set(mint, null);
    }
  }

  const holdingsByMint = new Map<string, WalletOutcomeHoldingResult>();

  for (const account of accountRows) {
    const meta = marketMetaByMint.get(account.mint);

    const existing = holdingsByMint.get(account.mint);
    if (existing) {
      existing.balance += account.balance;
      existing.current_value =
        existing.current_price != null ? existing.balance * existing.current_price : null;
      continue;
    }

    holdingsByMint.set(account.mint, {
      mint: account.mint,
      ata_address: account.ataAddress,
      balance: account.balance,
      decimals: account.decimals,
      ticker: meta?.ticker ?? null,
      title: meta?.title ?? null,
      side: meta?.side ?? null,
      program: account.program,
      current_price: meta?.currentPrice ?? null,
      current_value:
        meta?.currentPrice != null ? account.balance * meta.currentPrice : null,
      probability: meta?.probability ?? null,
    });
  }

  return [...holdingsByMint.values()].sort((a, b) => {
    const aValue = a.current_value ?? 0;
    const bValue = b.current_value ?? 0;
    if (bValue !== aValue) return bValue - aValue;
    return (a.title ?? a.ticker ?? "").localeCompare(b.title ?? b.ticker ?? "");
  });
}

export interface OutcomeMarketByMintLookupResult {
  success: boolean;
  found: boolean;
  market: {
    ticker: string;
    title: string;
    side: OutcomeSide | null;
    current_price: number | null;
    probability: number | null;
    yes_mint: string | null;
    no_mint: string | null;
  } | null;
  error?: string;
}

export async function resolveOutcomeMarketByMint(
  mint: string
): Promise<OutcomeMarketByMintLookupResult> {
  if (!mint) {
    return {
      success: false,
      found: false,
      market: null,
      error: "mint is required",
    };
  }

  try {
    const market = await fetchMarketByMint(mint);
    const side = inferSideFromMarket(market, mint);
    const currentPrice = side ? sidePriceFromMarket(market, side) : null;
    const { yesMint, noMint } = extractOutcomeMints(market);

    return {
      success: true,
      found: true,
      market: {
        ticker: String(market?.ticker || ""),
        title: String(market?.title || market?.ticker || "Prediction outcome"),
        side,
        current_price: currentPrice,
        probability: probabilityFromPrice(currentPrice),
        yes_mint: yesMint || null,
        no_mint: noMint || null,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown market lookup failure";
    if (message.includes("404")) {
      return {
        success: true,
        found: false,
        market: null,
      };
    }

    return {
      success: false,
      found: false,
      market: null,
      error: message,
    };
  }
}

function getCusdcMintSafely(): string {
  try {
    return getCusdcMint().toBase58();
  } catch {
    return "";
  }
}

async function upsertMarketRegistry(
  assessment: RiskAssessment,
  market: any,
  poolId: string,
  client?: PoolClient
): Promise<MarketRegistryRow> {
  const targetSubvault =
    assessment.risk_tier === "ineligible"
      ? null
      : await getSubvaultForTier(poolId, assessment.risk_tier, client);

  const sql = `
    insert into public.market_registry (
      market_ticker,
      event_ticker,
      yes_mint,
      no_mint,
      resolution_time,
      status,
      category,
      settlement_mint,
      current_risk_score,
      current_risk_tier,
      max_ltv_bps,
      liquidation_threshold_bps,
      max_pool_allocation_bps,
      subvault_id,
      metadata
    )
    values (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15::jsonb
    )
    on conflict (market_ticker)
    do update set
      event_ticker = excluded.event_ticker,
      yes_mint = excluded.yes_mint,
      no_mint = excluded.no_mint,
      resolution_time = excluded.resolution_time,
      status = excluded.status,
      category = excluded.category,
      settlement_mint = excluded.settlement_mint,
      current_risk_score = excluded.current_risk_score,
      current_risk_tier = excluded.current_risk_tier,
      max_ltv_bps = excluded.max_ltv_bps,
      liquidation_threshold_bps = excluded.liquidation_threshold_bps,
      max_pool_allocation_bps = excluded.max_pool_allocation_bps,
      subvault_id = excluded.subvault_id,
      metadata = excluded.metadata
    returning id
  `;
  const values = [
    assessment.market_ticker,
    market?.eventTicker ?? null,
    assessment.yes_mint,
    assessment.no_mint,
    assessment.resolution_time,
    market?.status ?? "unknown",
    market?.seriesTicker ?? market?.category ?? null,
    USDC_MINT_MAINNET,
    assessment.risk_score,
    assessment.risk_tier,
    assessment.max_ltv_bps,
    assessment.liquidation_threshold_bps,
    assessment.risk_tier === "ineligible"
      ? 0
      : OUTCOME_RISK_TIER_CONFIGS[assessment.risk_tier].maxPoolAllocationBps,
    targetSubvault?.id ?? null,
    JSON.stringify({
      title: market?.title ?? null,
      subtitle: market?.subtitle ?? null,
      volume: market?.volume ?? null,
      volume24h: market?.volume24h ?? null,
    }),
  ];
  const result = client
    ? await client.query<MarketRegistryRow>(sql, values)
    : await railwayQuery<MarketRegistryRow>(sql, values);

  if (!result.rows[0]) throw new Error("Failed to upsert market registry");
  return result.rows[0];
}

export async function quoteOutcomeCollateral(params: {
  market_ticker?: string;
  outcome_mint?: string;
  side: OutcomeSide;
  quantity: number;
  pool_slug?: string;
}): Promise<OutcomeCollateralQuoteResult> {
  const quantity = toNumber(params.quantity);
  if (quantity <= 0) {
    return { success: false, error: "quantity must be greater than zero" };
  }

  const pool = await getPool(params.pool_slug);
  const market =
    params.market_ticker
      ? await fetchMarket(params.market_ticker)
      : params.outcome_mint
        ? await fetchMarketByMint(params.outcome_mint)
        : null;

  if (!market) {
    return { success: false, error: "market_ticker or outcome_mint is required" };
  }

  const concentrationBps = await currentConcentrationBps(pool.id, String(market.ticker));
  const assessment = buildRiskAssessment({
    market,
    side: params.side,
    concentrationBps,
  });
  const collateralValueUsdc = quantity * assessment.side_price;
  const maxBorrowUsdc = collateralValueUsdc * (assessment.max_ltv_bps / BPS_DENOMINATOR);

  return {
    success: true,
    assessment,
    quantity,
    collateral_value_usdc: collateralValueUsdc,
    max_borrow_usdc: maxBorrowUsdc,
  };
}

export async function getMainnetPoolState(params?: {
  wallet_address?: string;
  pool_slug?: string;
}): Promise<MainnetPoolStateResult> {
  const pool = await getPool(params?.pool_slug);
  let poolPublicKey: string | null = null;
  let onchainBalance = 0;
  try {
    poolPublicKey = getMainnetPoolPublicKey().toBase58();
    onchainBalance = await getMainnetPoolUsdcBalance();
  } catch {
    poolPublicKey = null;
    onchainBalance = 0;
  }
  const loansResult = await railwayQuery<{ count: string }>(
    `
      select count(*)::text as count
      from public.outcome_loans
      where pool_id = $1 and status = 'active'
    `,
    [pool.id]
  );
  const userPosition =
    params?.wallet_address ? await getLpPosition(pool.id, params.wallet_address) : null;

  return {
    success: true,
    pool_slug: pool.slug,
    pool_public_key: poolPublicKey,
    asset_mint: USDC_MINT_MAINNET,
    total_deposited: toNumber(pool.total_deposited),
    available_liquidity: toNumber(pool.available_liquidity),
    borrowed_liquidity: toNumber(pool.borrowed_liquidity),
    onchain_balance: onchainBalance,
    active_loans: Number(loansResult.rows[0]?.count ?? 0),
    user_position: userPosition,
  };
}

export async function listOutcomeLoans(params: {
  wallet_address: string;
}): Promise<OutcomeLoanListItem[]> {
  if (!params.wallet_address) return [];

  const result = await railwayQuery<{
    id: string;
    status: string;
    borrowed_amount_usdc: string | number;
    health_factor: string | number | null;
    max_ltv_bps: number;
    liquidation_threshold_bps: number;
    expires_at: string | null;
    market_ticker: string;
    side: OutcomeSide;
    snapshot_value_usdc: string | number;
  }>(
    `
      select
        ol.id,
        ol.status,
        ol.borrowed_amount_usdc,
        ol.health_factor,
        ol.max_ltv_bps,
        ol.liquidation_threshold_bps,
        ol.expires_at,
        cl.market_ticker,
        cl.side,
        cl.snapshot_value_usdc
      from public.outcome_loans ol
      join public.collateral_lots cl on cl.id = ol.collateral_lot_id
      where ol.wallet_address = $1
        and ol.status in ('active', 'pending')
      order by ol.opened_at desc
    `,
    [params.wallet_address]
  );

  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    borrowed_amount_usdc: toNumber(row.borrowed_amount_usdc),
    health_factor: row.health_factor != null ? toNumber(row.health_factor) : null,
    max_ltv_bps: row.max_ltv_bps,
    liquidation_threshold_bps: row.liquidation_threshold_bps,
    collateral_value_usdc: toNumber(row.snapshot_value_usdc),
    market_ticker: row.market_ticker,
    side: row.side,
    expires_at: row.expires_at,
  }));
}

async function listOnchainCustodiedCollateral(walletAddress: string): Promise<OnchainCustodiedCollateral[]> {
  if (!walletAddress) return [];

  const connection = getConnection();
  const wallet = new PublicKey(walletAddress);
  const pool = getMainnetPoolPublicKey();
  const excludedMints = new Set<string>([
    USDC_MINT_MAINNET,
    "Es9vMFrzaCERn2QytQkwT4NSr8F3rzA4XB9vNehqWj6q",
  ]);

  try {
    const cusdc = getCusdcMint().toBase58();
    if (cusdc) excludedMints.add(cusdc);
  } catch {
    // optional
  }

  const tokenPrograms: PublicKey[] = [TOKEN_LEGACY, TOKEN_2022];
  const poolBalances = new Map<string, number>();
  for (const tokenProgram of tokenPrograms) {
    try {
      const accounts = await connection.getParsedTokenAccountsByOwner(pool, { programId: tokenProgram });
      for (const account of accounts.value) {
        const info = (account.account.data as any)?.parsed?.info;
        const mint = String(info?.mint ?? "");
        const balance = Number(info?.tokenAmount?.uiAmount ?? 0);
        if (!mint || balance <= 0) continue;
        poolBalances.set(mint, (poolBalances.get(mint) ?? 0) + balance);
      }
    } catch {
      // ignore one program failure
    }
  }

  const signatures = await connection.getSignaturesForAddress(wallet, { limit: 30 });
  const deposits = new Map<string, OnchainCustodiedCollateral>();

  for (const signatureInfo of signatures) {
    if (signatureInfo.err) continue;

    const tx = await connection.getParsedTransaction(signatureInfo.signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (!tx || tx.meta?.err) continue;

    const preTokenBalances = tx.meta.preTokenBalances ?? [];
    const postTokenBalances = tx.meta.postTokenBalances ?? [];

    for (const postBalance of postTokenBalances) {
      const mint = postBalance.mint;
      if (!mint || excludedMints.has(mint)) continue;
      if (postBalance.owner !== pool.toBase58()) continue;
      if ((poolBalances.get(mint) ?? 0) <= 0) continue;

      const preBalance = preTokenBalances.find(
        (balance) => balance.accountIndex === postBalance.accountIndex
      );
      const preAmount = preBalance?.uiTokenAmount?.uiAmount ?? 0;
      const postAmount = postBalance.uiTokenAmount?.uiAmount ?? 0;
      const diff = postAmount - preAmount;
      if (!(diff > 0)) continue;

      const senderBalance = preTokenBalances.find(
        (balance) => balance.mint === mint && balance.owner === walletAddress
      );
      if (!senderBalance) continue;

      const existing = deposits.get(mint);
      const candidate: OnchainCustodiedCollateral = {
        mint,
        quantity: diff,
        created_at: toIsoFromBlockTime(signatureInfo.blockTime),
        deposit_tx_signature: signatureInfo.signature,
      };

      if (!existing || candidate.created_at > existing.created_at) {
        deposits.set(mint, candidate);
      }
    }
  }

  return Array.from(deposits.values());
}

export async function listOutcomeCollateralPositions(params: {
  wallet_address: string;
}): Promise<OutcomeCollateralPositionListItem[]> {
  if (!params.wallet_address) return [];

  const result = await railwayQuery<CollateralPositionWithLoanRow>(
    `
      select
        cl.id as collateral_lot_id,
        cl.wallet_address,
        cl.market_ticker,
        cl.side,
        cl.mint,
        cl.quantity,
        cl.snapshot_price,
        cl.snapshot_value_usdc,
        cl.max_ltv_bps,
        cl.liquidation_threshold_bps,
        cl.status as collateral_status,
        cl.deposit_tx_signature,
        cl.created_at,
        cl.updated_at,
        ol.id as loan_id,
        ol.status as loan_status,
        ol.borrowed_amount_usdc,
        ol.accrued_interest_usdc,
        ol.health_factor,
        ol.borrow_tx_signature,
        ol.expires_at
      from public.collateral_lots cl
      left join public.outcome_loans ol on ol.collateral_lot_id = cl.id
      where cl.wallet_address = $1
        and (
          cl.status in ('pending', 'confirmed', 'locked')
          or coalesce(ol.status, '') in ('pending', 'active', 'liquidating')
        )
      order by greatest(
        extract(epoch from cl.updated_at),
        extract(epoch from coalesce(ol.updated_at, cl.updated_at))
      ) desc
    `,
    [params.wallet_address]
  );

  const custodyWallet = getMainnetPoolPublicKey().toBase58();

  if (result.rows.length > 0) {
    return Promise.all(
      result.rows.map(async (row) => {
        let market: any = null;
        try {
          market = await fetchMarket(row.market_ticker);
        } catch {
          try {
            market = await fetchMarketByMint(row.mint);
          } catch {
            market = null;
          }
        }

        const currentPrice = market
          ? sidePriceFromMarket(market, row.side)
          : null;
        const quantity = toNumber(row.quantity);
        const currentValue =
          currentPrice != null && quantity > 0
            ? quantity * currentPrice
            : null;

        return {
          collateral_lot_id: row.collateral_lot_id,
          wallet_address: row.wallet_address,
          market_ticker: row.market_ticker,
          market_title: String(market?.title || market?.name || row.market_ticker),
          side: row.side,
          mint: row.mint,
          quantity,
          snapshot_price: toNumber(row.snapshot_price),
          snapshot_value_usdc: toNumber(row.snapshot_value_usdc),
          current_price: currentPrice,
          current_value: currentValue,
          probability: probabilityFromPrice(currentPrice),
          max_ltv_bps: row.max_ltv_bps,
          liquidation_threshold_bps: row.liquidation_threshold_bps,
          collateral_status: row.collateral_status,
          loan_id: row.loan_id,
          loan_status: row.loan_status,
          borrowed_amount_usdc: toNumber(row.borrowed_amount_usdc),
          accrued_interest_usdc: toNumber(row.accrued_interest_usdc),
          health_factor: row.health_factor != null ? toNumber(row.health_factor) : null,
          deposit_tx_signature: row.deposit_tx_signature,
          borrow_tx_signature: row.borrow_tx_signature,
          expires_at: row.expires_at,
          custody_wallet: custodyWallet,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      })
    );
  }

  const onchainCustodied = await listOnchainCustodiedCollateral(params.wallet_address);
  return Promise.all(
    onchainCustodied.map(async (row) => {
      let market: any = null;
      try {
        market = await fetchMarketByMint(row.mint);
      } catch {
        market = null;
      }

      const currentPrice = market
        ? sidePriceFromMarket(
            market,
            inferSideFromMarket(market, row.mint) ?? "YES"
          )
        : null;
      const side = inferSideFromMarket(market, row.mint) ?? "YES";
      const quantity = toNumber(row.quantity);
      const currentValue =
        currentPrice != null && quantity > 0
          ? quantity * currentPrice
          : null;

      return {
        collateral_lot_id: `onchain-${row.deposit_tx_signature}-${row.mint}`,
        wallet_address: params.wallet_address,
        market_ticker: String(market?.ticker || row.mint),
        market_title: String(market?.title || market?.name || market?.ticker || row.mint),
        side,
        mint: row.mint,
        quantity,
        snapshot_price: currentPrice ?? 0,
        snapshot_value_usdc: currentValue ?? 0,
        current_price: currentPrice,
        current_value: currentValue,
        probability: probabilityFromPrice(currentPrice),
        max_ltv_bps: 0,
        liquidation_threshold_bps: 0,
        collateral_status: "confirmed",
        loan_id: null,
        loan_status: null,
        borrowed_amount_usdc: 0,
        accrued_interest_usdc: 0,
        health_factor: null,
        deposit_tx_signature: row.deposit_tx_signature,
        borrow_tx_signature: null,
        expires_at: null,
        custody_wallet: custodyWallet,
        created_at: row.created_at,
        updated_at: row.created_at,
      };
    })
  );
}

export async function registerMainnetPoolDeposit(params: {
  wallet_address: string;
  tx_signature: string;
  amount_usdc: number;
  pool_slug?: string;
}): Promise<MainnetPoolDepositResult> {
  const { wallet_address, tx_signature } = params;
  const amountUsdc = toNumber(params.amount_usdc);
  if (!wallet_address || !tx_signature || amountUsdc <= 0) {
    return { success: false, error: "wallet_address, tx_signature, and amount_usdc are required" };
  }

  const confirmed = await confirmTransaction(tx_signature);
  if (!confirmed) {
    return { success: false, error: "Deposit transaction not confirmed" };
  }

  const validTransfer = await verifyUsdcTransfer(
    tx_signature,
    getMainnetPoolPublicKey(),
    amountUsdc
  );
  if (!validTransfer) {
    return { success: false, error: "USDC transfer verification failed for mainnet pool" };
  }

  const pool = await getPool(params.pool_slug);
  const result = await withRailwayTransaction(async (client) => {
    const userId = await getOrCreateUserId(wallet_address, client);
    const updatedPool = await client.query<{
      available_liquidity: string | number;
    }>(
      `
        update public.lending_pools
        set
          total_deposited = total_deposited + $2,
          available_liquidity = available_liquidity + $2
        where id = $1
        returning available_liquidity
      `,
      [pool.id, amountUsdc]
    );

    await client.query(
      `
        insert into public.lp_positions (
          pool_id,
          user_id,
          wallet_address,
          deposited_amount,
          available_amount
        )
        values ($1, $2, $3, $4, $4)
        on conflict (pool_id, user_id)
        do update set
          deposited_amount = public.lp_positions.deposited_amount + excluded.deposited_amount,
          available_amount = public.lp_positions.available_amount + excluded.available_amount,
          wallet_address = excluded.wallet_address
      `,
      [pool.id, userId, wallet_address, amountUsdc]
    );

    return updatedPool.rows[0];
  });

  return {
    success: true,
    pool_slug: pool.slug,
    amount_usdc: amountUsdc,
    available_liquidity: toNumber(result?.available_liquidity),
  };
}

async function findExistingLoanAttemptByDepositSignature(params: {
  wallet_address: string;
  deposit_tx_signature: string;
}) {
  const result = await railwayQuery<{
    collateral_lot_id: string;
    collateral_status: string;
    loan_id: string | null;
    loan_status: string | null;
    borrowed_amount_usdc: string | number | null;
    health_factor: string | number | null;
    risk_tier: OutcomeTier;
    max_ltv_bps: number;
    snapshot_value_usdc: string | number;
    borrow_tx_signature: string | null;
  }>(
    `
      select
        cl.id as collateral_lot_id,
        cl.status as collateral_status,
        cl.risk_tier,
        cl.max_ltv_bps,
        cl.snapshot_value_usdc,
        ol.id as loan_id,
        ol.status as loan_status,
        ol.borrowed_amount_usdc,
        ol.health_factor,
        ol.borrow_tx_signature
      from public.collateral_lots cl
      left join public.outcome_loans ol on ol.collateral_lot_id = cl.id
      where cl.wallet_address = $1
        and cl.deposit_tx_signature = $2
      order by cl.created_at desc
      limit 1
    `,
    [params.wallet_address, params.deposit_tx_signature]
  );

  return result.rows[0] ?? null;
}

async function releaseCollateralBackToUser(params: {
  wallet_address: string;
  mint: string;
  quantity: number;
}): Promise<{ signature: string; warning: string }> {
  const releaseResult = await transferSplTokenFromMainnetPool({
    walletAddress: params.wallet_address,
    mint: new PublicKey(params.mint),
    amountUi: params.quantity,
  });

  if (releaseResult.signature) {
    await confirmTransaction(releaseResult.signature).catch(() => false);
  }

  return releaseResult;
}

export async function registerOutcomeCollateralLot(params: {
  wallet_address: string;
  tx_signature: string;
  market_ticker?: string;
  outcome_mint?: string;
  side: OutcomeSide;
  quantity: number;
  escrow_token_account?: string;
  pool_slug?: string;
}): Promise<RegisterCollateralLotResult> {
  const { wallet_address, tx_signature, side } = params;
  const quantity = toNumber(params.quantity);
  if (!wallet_address || !tx_signature || quantity <= 0) {
    return { success: false, error: "wallet_address, tx_signature, and quantity are required" };
  }

  const confirmed = await confirmTransaction(tx_signature);
  if (!confirmed) {
    return { success: false, error: "Collateral deposit transaction not confirmed" };
  }

  const quote = await quoteOutcomeCollateral({
    market_ticker: params.market_ticker,
    outcome_mint: params.outcome_mint,
    side,
    quantity,
    pool_slug: params.pool_slug,
  });
  if (!quote.success || !quote.assessment) {
    return { success: false, error: quote.error ?? "Failed to quote collateral" };
  }

  const expectedMint =
    side === "YES" ? quote.assessment.yes_mint : quote.assessment.no_mint;
  const validTransfer = await verifySplTokenTransfer({
    signature: tx_signature,
    mint: new PublicKey(expectedMint),
    expectedRecipient: getMainnetPoolPublicKey(),
    expectedAmountUi: quantity,
  });
  if (!validTransfer) {
    return { success: false, error: "Outcome token transfer verification failed for pool custody" };
  }

  const pool = await getPool(params.pool_slug);
  const market = await fetchMarket(quote.assessment.market_ticker);
  const result = await withRailwayTransaction(async (client) => {
    const userId = await getOrCreateUserId(wallet_address, client);
    const marketRow = await upsertMarketRegistry(quote.assessment!, market, pool.id, client);

    const insertedLot = await client.query<{ id: string }>(
      `
        insert into public.collateral_lots (
          user_id,
          wallet_address,
          market_registry_id,
          market_ticker,
          side,
          mint,
          quantity,
          escrow_token_account,
          deposit_tx_signature,
          snapshot_price,
          snapshot_value_usdc,
          risk_score,
          risk_tier,
          max_ltv_bps,
          liquidation_threshold_bps,
          status,
          metadata
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, 'confirmed', $16::jsonb
        )
        returning id
      `,
      [
        userId,
        wallet_address,
        marketRow.id,
        quote.assessment.market_ticker,
        side,
        side === "YES" ? quote.assessment.yes_mint : quote.assessment.no_mint,
        quantity,
        params.escrow_token_account ?? null,
        tx_signature,
        quote.assessment.side_price,
        quote.collateral_value_usdc,
        quote.assessment.risk_score,
        quote.assessment.risk_tier,
        quote.assessment.max_ltv_bps,
        quote.assessment.liquidation_threshold_bps,
        JSON.stringify({ max_borrow_usdc: quote.max_borrow_usdc }),
      ]
    );

    const lotId = insertedLot.rows[0]?.id;
    if (!lotId) throw new Error("Failed to insert collateral lot");

    await client.query(
      `
        insert into public.collateral_price_snapshots (
          collateral_lot_id,
          market_ticker,
          price,
          value_usdc,
          risk_score
        )
        values ($1, $2, $3, $4, $5)
      `,
      [
        lotId,
        quote.assessment.market_ticker,
        quote.assessment.side_price,
        quote.collateral_value_usdc,
        quote.assessment.risk_score,
      ]
    );

    return lotId;
  });

  return {
    success: true,
    collateral_lot_id: result,
    assessment: quote.assessment,
    collateral_value_usdc: quote.collateral_value_usdc,
  };
}

export async function createOutcomeLoanFromCollateralTransfer(params: {
  wallet_address: string;
  tx_signature: string;
  market_ticker?: string;
  outcome_mint?: string;
  side: OutcomeSide;
  quantity: number;
  requested_borrow_usdc: number;
  escrow_token_account?: string;
  pool_slug?: string;
  interest_bps?: number;
  expiry_hours?: number;
}): Promise<OpenOutcomeLoanResult> {
  const { wallet_address, tx_signature, side } = params;
  const quantity = toNumber(params.quantity);
  const requestedBorrowUsdc = toNumber(params.requested_borrow_usdc);
  if (!wallet_address || !tx_signature || quantity <= 0 || requestedBorrowUsdc <= 0) {
    return {
      success: false,
      error:
        "wallet_address, tx_signature, quantity, and requested_borrow_usdc are required",
    };
  }

  const existingAttempt = await findExistingLoanAttemptByDepositSignature({
    wallet_address,
    deposit_tx_signature: tx_signature,
  });
  if (existingAttempt?.loan_id) {
    return {
      success: true,
      loan_id: existingAttempt.loan_id,
      collateral_lot_id: existingAttempt.collateral_lot_id,
      borrow_tx_signature: existingAttempt.borrow_tx_signature ?? undefined,
      borrowed_amount_usdc: toNumber(existingAttempt.borrowed_amount_usdc),
      health_factor:
        existingAttempt.health_factor != null
          ? toNumber(existingAttempt.health_factor)
          : null,
      risk_tier: existingAttempt.risk_tier,
      max_borrow_usdc:
        toNumber(existingAttempt.snapshot_value_usdc) *
        (toNumber(existingAttempt.max_ltv_bps) / BPS_DENOMINATOR),
    };
  }

  const confirmed = await confirmTransaction(tx_signature);
  if (!confirmed) {
    return { success: false, error: "Collateral deposit transaction not confirmed" };
  }

  const quote = await quoteOutcomeCollateral({
    market_ticker: params.market_ticker,
    outcome_mint: params.outcome_mint,
    side,
    quantity,
    pool_slug: params.pool_slug,
  });
  if (!quote.success || !quote.assessment) {
    return { success: false, error: quote.error ?? "Failed to quote collateral" };
  }

  const expectedMint =
    side === "YES" ? quote.assessment.yes_mint : quote.assessment.no_mint;
  const validTransfer = await verifySplTokenTransfer({
    signature: tx_signature,
    mint: new PublicKey(expectedMint),
    expectedRecipient: getMainnetPoolPublicKey(),
    expectedAmountUi: quantity,
  });
  if (!validTransfer) {
    return {
      success: false,
      error: "Outcome token transfer verification failed for pool custody",
    };
  }

  const pool = await getPool(params.pool_slug);
  const market = await fetchMarket(quote.assessment.market_ticker);
  const riskTier = quote.assessment.risk_tier;
  if (riskTier === "ineligible") {
    return { success: false, error: "Collateral is not eligible for borrowing" };
  }

  const maxBorrowUsdc =
    toNumber(quote.collateral_value_usdc) *
    (toNumber(quote.assessment.max_ltv_bps) / BPS_DENOMINATOR);
  if (requestedBorrowUsdc > maxBorrowUsdc) {
    return {
      success: false,
      error: `Requested borrow exceeds max borrow of $${maxBorrowUsdc.toFixed(2)}`,
    };
  }

  const poolBalance = Math.max(
    toNumber(pool.available_liquidity),
    await getMainnetPoolUsdcBalance()
  );
  if (requestedBorrowUsdc > poolBalance * 0.8) {
    return {
      success: false,
      error: `Insufficient pool liquidity (available borrow buffer: $${(poolBalance * 0.8).toFixed(2)})`,
    };
  }

  const healthFactor = computeHealthFactor({
    collateralValue: toNumber(quote.collateral_value_usdc),
    borrowedAmount: requestedBorrowUsdc,
    effectiveThresholdBps: toNumber(quote.assessment.liquidation_threshold_bps),
  });
  if (healthFactor < 1) {
    return {
      success: false,
      error: `Health factor ${healthFactor.toFixed(2)} is below 1.0`,
    };
  }

  const interestBps = Number.isFinite(Number(params.interest_bps))
    ? Math.max(0, Math.floor(Number(params.interest_bps)))
    : 500;
  const expiryHours = Number.isFinite(Number(params.expiry_hours))
    ? Math.max(1, Math.floor(Number(params.expiry_hours)))
    : 168;

  const pendingRecord = await withRailwayTransaction(async (client) => {
    const userId = await getOrCreateUserId(wallet_address, client);
    const marketRow = await upsertMarketRegistry(quote.assessment!, market, pool.id, client);
    const subvault = await getSubvaultForTier(
      pool.id,
      riskTier as Exclude<OutcomeTier, "ineligible">,
      client
    );

    const insertedLot = await client.query<{ id: string }>(
      `
        insert into public.collateral_lots (
          user_id,
          wallet_address,
          market_registry_id,
          market_ticker,
          side,
          mint,
          quantity,
          escrow_token_account,
          deposit_tx_signature,
          snapshot_price,
          snapshot_value_usdc,
          risk_score,
          risk_tier,
          max_ltv_bps,
          liquidation_threshold_bps,
          status,
          metadata
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, 'confirmed', $16::jsonb
        )
        returning id
      `,
      [
        userId,
        wallet_address,
        marketRow.id,
        quote.assessment.market_ticker,
        side,
        expectedMint,
        quantity,
        params.escrow_token_account ?? null,
        tx_signature,
        quote.assessment.side_price,
        quote.collateral_value_usdc,
        quote.assessment.risk_score,
        quote.assessment.risk_tier,
        quote.assessment.max_ltv_bps,
        quote.assessment.liquidation_threshold_bps,
        JSON.stringify({
          max_borrow_usdc: quote.max_borrow_usdc,
          creation_mode: "atomic_borrow",
        }),
      ]
    );

    const collateralLotId = insertedLot.rows[0]?.id;
    if (!collateralLotId) throw new Error("Failed to insert collateral lot");

    await client.query(
      `
        insert into public.collateral_price_snapshots (
          collateral_lot_id,
          market_ticker,
          price,
          value_usdc,
          risk_score
        )
        values ($1, $2, $3, $4, $5)
      `,
      [
        collateralLotId,
        quote.assessment.market_ticker,
        quote.assessment.side_price,
        quote.collateral_value_usdc,
        quote.assessment.risk_score,
      ]
    );

    const insertedLoan = await client.query<{ id: string }>(
      `
        insert into public.outcome_loans (
          user_id,
          wallet_address,
          pool_id,
          subvault_id,
          collateral_lot_id,
          principal_usdc,
          borrowed_amount_usdc,
          interest_bps,
          max_ltv_bps,
          liquidation_threshold_bps,
          health_factor,
          expires_at,
          status,
          metadata
        )
        values (
          $1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10,
          now() + ($11 || ' hours')::interval,
          'pending',
          $12::jsonb
        )
        returning id
      `,
      [
        userId,
        wallet_address,
        pool.id,
        subvault.id,
        collateralLotId,
        requestedBorrowUsdc,
        interestBps,
        quote.assessment.max_ltv_bps,
        quote.assessment.liquidation_threshold_bps,
        healthFactor,
        expiryHours,
        JSON.stringify({
          collateral_deposit_tx_signature: tx_signature,
          payout_pending: true,
        }),
      ]
    );

    const loanId = insertedLoan.rows[0]?.id;
    if (!loanId) throw new Error("Failed to insert pending outcome loan");

    return { collateralLotId, loanId, subvaultId: subvault.id };
  });

  const payout = await lendUsdcFromMainnetPool(wallet_address, requestedBorrowUsdc);
  if (!payout.signature) {
    const releaseResult = await releaseCollateralBackToUser({
      wallet_address,
      mint: expectedMint,
      quantity,
    });

    await withRailwayTransaction(async (client) => {
      await client.query(`delete from public.outcome_loans where id = $1`, [pendingRecord.loanId]);
      if (releaseResult.signature) {
        await client.query(`delete from public.collateral_lots where id = $1`, [pendingRecord.collateralLotId]);
      } else {
        await client.query(
          `
            update public.collateral_lots
            set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
              'recovery_needed', true,
              'recovery_reason', 'borrow_payout_failed',
              'recovery_warning', $2
            )
            where id = $1
          `,
          [pendingRecord.collateralLotId, payout.warning || "Pool payout failed"]
        );
      }
    });

    return {
      success: false,
      error: releaseResult.signature
        ? payout.warning || "Pool payout failed and collateral was returned"
        : `${payout.warning || "Pool payout failed"}. Collateral return also needs recovery.`,
    };
  }

  const payoutConfirmed = await confirmTransaction(payout.signature);
  const payoutVerified =
    payoutConfirmed &&
    (await verifyUsdcTransfer(
      payout.signature,
      new PublicKey(wallet_address),
      requestedBorrowUsdc
    ));

  if (!payoutVerified) {
    const releaseResult = await releaseCollateralBackToUser({
      wallet_address,
      mint: expectedMint,
      quantity,
    });

    await withRailwayTransaction(async (client) => {
      await client.query(`delete from public.outcome_loans where id = $1`, [pendingRecord.loanId]);
      if (releaseResult.signature) {
        await client.query(`delete from public.collateral_lots where id = $1`, [pendingRecord.collateralLotId]);
      } else {
        await client.query(
          `
            update public.collateral_lots
            set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
              'recovery_needed', true,
              'recovery_reason', 'borrow_payout_unverified',
              'payout_tx_signature', $2
            )
            where id = $1
          `,
          [pendingRecord.collateralLotId, payout.signature]
        );
      }
    });

    return {
      success: false,
      error: releaseResult.signature
        ? "Borrow payout could not be verified and collateral was returned"
        : "Borrow payout could not be verified and collateral requires manual recovery",
    };
  }

  try {
    await withRailwayTransaction(async (client) => {
      await client.query(
        `
          update public.outcome_loans
          set
            status = 'active',
            borrow_tx_signature = $2,
            metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('payout_pending', false)
          where id = $1
        `,
        [pendingRecord.loanId, payout.signature]
      );

      await client.query(
        `update public.collateral_lots set status = 'locked' where id = $1`,
        [pendingRecord.collateralLotId]
      );

      await client.query(
        `
          update public.lending_pools
          set
            available_liquidity = greatest(0, available_liquidity - $2),
            borrowed_liquidity = borrowed_liquidity + $2
          where id = $1
        `,
        [pool.id, requestedBorrowUsdc]
      );

      await client.query(
        `
          update public.subvaults
          set current_allocation = current_allocation + $2
          where id = $1
        `,
        [pendingRecord.subvaultId, requestedBorrowUsdc]
      );
    });
  } catch (error) {
    await railwayQuery(
      `
        update public.outcome_loans
        set
          borrow_tx_signature = $2,
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'payout_pending', false,
            'finalization_error', $3
          )
        where id = $1
      `,
      [
        pendingRecord.loanId,
        payout.signature,
        error instanceof Error ? error.message : "Finalization failed",
      ]
    ).catch(() => undefined);
  }

  return {
    success: true,
    loan_id: pendingRecord.loanId,
    collateral_lot_id: pendingRecord.collateralLotId,
    borrow_tx_signature: payout.signature,
    borrowed_amount_usdc: requestedBorrowUsdc,
    health_factor: healthFactor,
    risk_tier: quote.assessment.risk_tier,
    max_borrow_usdc: maxBorrowUsdc,
  };
}

export async function openOutcomeLoan(params: {
  wallet_address: string;
  collateral_lot_id: string;
  requested_borrow_usdc: number;
  pool_slug?: string;
  interest_bps?: number;
  expiry_hours?: number;
}): Promise<OpenOutcomeLoanResult> {
  const requestedBorrowUsdc = toNumber(params.requested_borrow_usdc);
  if (!params.wallet_address || !params.collateral_lot_id || requestedBorrowUsdc <= 0) {
    return { success: false, error: "wallet_address, collateral_lot_id, and requested_borrow_usdc are required" };
  }

  const pool = await getPool(params.pool_slug);
  const lotResult = await railwayQuery<CollateralLotRow>(
    `
      select id, wallet_address, snapshot_value_usdc, max_ltv_bps, liquidation_threshold_bps, risk_tier, status
      from public.collateral_lots
      where id = $1
      limit 1
    `,
    [params.collateral_lot_id]
  );
  const collateralLot = lotResult.rows[0];
  if (!collateralLot) {
    return { success: false, error: "Collateral lot not found" };
  }
  if (collateralLot.wallet_address !== params.wallet_address) {
    return { success: false, error: "Collateral lot does not belong to wallet" };
  }
  if (collateralLot.status !== "confirmed") {
    return { success: false, error: `Collateral lot is ${collateralLot.status}, not available to borrow` };
  }
  if (collateralLot.risk_tier === "ineligible") {
    return { success: false, error: "Collateral is not eligible for borrowing" };
  }

  const maxBorrowUsdc =
    toNumber(collateralLot.snapshot_value_usdc) *
    (toNumber(collateralLot.max_ltv_bps) / BPS_DENOMINATOR);
  if (requestedBorrowUsdc > maxBorrowUsdc) {
    return {
      success: false,
      error: `Requested borrow exceeds max borrow of $${maxBorrowUsdc.toFixed(2)}`,
    };
  }

  const poolBalance = Math.max(
    toNumber(pool.available_liquidity),
    await getMainnetPoolUsdcBalance()
  );
  if (requestedBorrowUsdc > poolBalance * 0.8) {
    return {
      success: false,
      error: `Insufficient pool liquidity (available borrow buffer: $${(poolBalance * 0.8).toFixed(2)})`,
    };
  }

  const healthFactor = computeHealthFactor({
    collateralValue: toNumber(collateralLot.snapshot_value_usdc),
    borrowedAmount: requestedBorrowUsdc,
    effectiveThresholdBps: toNumber(collateralLot.liquidation_threshold_bps),
  });
  if (healthFactor < 1) {
    return {
      success: false,
      error: `Health factor ${healthFactor.toFixed(2)} is below 1.0`,
    };
  }

  const transferResult = await lendUsdcFromMainnetPool(
    params.wallet_address,
    requestedBorrowUsdc
  );
  if (!transferResult.signature) {
    return { success: false, error: transferResult.warning || "Pool transfer failed" };
  }

  const result = await withRailwayTransaction(async (client) => {
    const userId = await getOrCreateUserId(params.wallet_address, client);
    const subvault = await getSubvaultForTier(pool.id, collateralLot.risk_tier as Exclude<OutcomeTier, "ineligible">, client);
    const interestBps = Number.isFinite(Number(params.interest_bps))
      ? Math.max(0, Math.floor(Number(params.interest_bps)))
      : 500;
    const expiryHours = Number.isFinite(Number(params.expiry_hours))
      ? Math.max(1, Math.floor(Number(params.expiry_hours)))
      : 168;

    const insertedLoan = await client.query<{ id: string }>(
      `
        insert into public.outcome_loans (
          user_id,
          wallet_address,
          pool_id,
          subvault_id,
          collateral_lot_id,
          principal_usdc,
          borrowed_amount_usdc,
          interest_bps,
          max_ltv_bps,
          liquidation_threshold_bps,
          health_factor,
          borrow_tx_signature,
          expires_at,
          status
        )
        values (
          $1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11,
          now() + ($12 || ' hours')::interval,
          'active'
        )
        returning id
      `,
      [
        userId,
        params.wallet_address,
        pool.id,
        subvault.id,
        collateralLot.id,
        requestedBorrowUsdc,
        interestBps,
        collateralLot.max_ltv_bps,
        collateralLot.liquidation_threshold_bps,
        healthFactor,
        transferResult.signature,
        expiryHours,
      ]
    );

    await client.query(
      `update public.collateral_lots set status = 'locked' where id = $1`,
      [collateralLot.id]
    );

    await client.query(
      `
        update public.lending_pools
        set
          available_liquidity = greatest(0, available_liquidity - $2),
          borrowed_liquidity = borrowed_liquidity + $2
        where id = $1
      `,
      [pool.id, requestedBorrowUsdc]
    );

    await client.query(
      `
        update public.subvaults
        set current_allocation = current_allocation + $2
        where id = $1
      `,
      [subvault.id, requestedBorrowUsdc]
    );

    return insertedLoan.rows[0]?.id;
  });

  if (!result) throw new Error("Failed to create outcome loan");

  return {
    success: true,
    loan_id: result,
    borrow_tx_signature: transferResult.signature,
    borrowed_amount_usdc: requestedBorrowUsdc,
    health_factor: healthFactor,
    risk_tier: collateralLot.risk_tier,
    max_borrow_usdc: maxBorrowUsdc,
  };
}

export async function withdrawMainnetPoolLiquidity(params: {
  wallet_address: string;
  amount_usdc: number;
  pool_slug?: string;
}): Promise<WithdrawMainnetPoolResult> {
  const amountUsdc = toNumber(params.amount_usdc);
  if (!params.wallet_address || amountUsdc <= 0) {
    return { success: false, error: "wallet_address and amount_usdc are required" };
  }

  const pool = await getPool(params.pool_slug);
  const userPosition = await getLpPosition(pool.id, params.wallet_address);
  if (!userPosition) {
    return { success: false, error: "No pool deposit found for this wallet" };
  }
  if (amountUsdc > userPosition.available_amount) {
    return {
      success: false,
      error: `Withdraw exceeds available LP balance of $${userPosition.available_amount.toFixed(2)}`,
    };
  }

  const poolAvailable = Math.min(
    toNumber(pool.available_liquidity),
    await getMainnetPoolUsdcBalance()
  );
  if (amountUsdc > poolAvailable) {
    return {
      success: false,
      error: `Pool cannot withdraw $${amountUsdc.toFixed(2)} right now. Available: $${poolAvailable.toFixed(2)}`,
    };
  }

  const transferResult = await transferUsdcFromMainnetPool(params.wallet_address, amountUsdc);
  if (!transferResult) {
    return { success: false, error: "Pool withdraw transfer failed" };
  }

  const updated = await withRailwayTransaction(async (client) => {
    await client.query(
      `
        update public.lending_pools
        set
          total_deposited = greatest(0, total_deposited - $2),
          available_liquidity = greatest(0, available_liquidity - $2)
        where id = $1
      `,
      [pool.id, amountUsdc]
    );

    const lpResult = await client.query<{
      available_amount: string | number;
    }>(
      `
        update public.lp_positions
        set
          deposited_amount = greatest(0, deposited_amount - $3),
          available_amount = greatest(0, available_amount - $3)
        where pool_id = $1 and wallet_address = $2
        returning available_amount
      `,
      [pool.id, params.wallet_address, amountUsdc]
    );

    const poolResult = await client.query<{
      available_liquidity: string | number;
    }>(
      `select available_liquidity from public.lending_pools where id = $1 limit 1`,
      [pool.id]
    );

    return {
      remainingAvailableAmount: toNumber(lpResult.rows[0]?.available_amount),
      availableLiquidity: toNumber(poolResult.rows[0]?.available_liquidity),
    };
  });

  return {
    success: true,
    pool_slug: pool.slug,
    amount_usdc: amountUsdc,
    withdraw_tx_signature: transferResult,
    remaining_available_amount: updated.remainingAvailableAmount,
    available_liquidity: updated.availableLiquidity,
  };
}

export async function closeOutcomeLoan(params: {
  wallet_address: string;
  loan_id: string;
  repay_tx_signature: string;
}): Promise<CloseOutcomeLoanResult> {
  if (!params.wallet_address || !params.loan_id || !params.repay_tx_signature) {
    return { success: false, error: "wallet_address, loan_id, and repay_tx_signature are required" };
  }

  const loanResult = await railwayQuery<OutcomeLoanWithRelationsRow>(
    `
      select
        ol.id,
        ol.wallet_address,
        ol.collateral_lot_id,
        ol.pool_id,
        ol.borrowed_amount_usdc,
        ol.accrued_interest_usdc,
        ol.status,
        lp.available_liquidity,
        lp.borrowed_liquidity,
        sv.current_allocation,
        sv.id as subvault_id,
        cl.mint as collateral_mint,
        cl.quantity as collateral_quantity
      from public.outcome_loans ol
      join public.lending_pools lp on lp.id = ol.pool_id
      join public.collateral_lots cl on cl.id = ol.collateral_lot_id
      left join public.subvaults sv on sv.id = ol.subvault_id
      where ol.id = $1
      limit 1
    `,
    [params.loan_id]
  );
  const loan = loanResult.rows[0];
  if (!loan) {
    return { success: false, error: "Outcome loan not found" };
  }
  if (loan.wallet_address !== params.wallet_address) {
    return { success: false, error: "Loan does not belong to wallet" };
  }
  if (loan.status !== "active") {
    return { success: false, error: `Loan is ${loan.status}, not active` };
  }

  const confirmed = await confirmTransaction(params.repay_tx_signature);
  if (!confirmed) {
    return { success: false, error: "Repayment transaction not confirmed" };
  }

  const repayAmountUsdc =
    toNumber(loan.borrowed_amount_usdc) + toNumber(loan.accrued_interest_usdc);
  const validRepayment = await verifyUsdcTransfer(
    params.repay_tx_signature,
    getMainnetPoolPublicKey(),
    repayAmountUsdc
  );
  if (!validRepayment) {
    return { success: false, error: "Repayment transfer verification failed" };
  }

  const releaseResult = await transferSplTokenFromMainnetPool({
    walletAddress: params.wallet_address,
    mint: new PublicKey(String(loan.collateral_mint)),
    amountUi: toNumber(loan.collateral_quantity),
  });
  if (!releaseResult.signature) {
    return { success: false, error: releaseResult.warning || "Collateral release failed" };
  }

  await withRailwayTransaction(async (client) => {
    await client.query(
      `
        update public.outcome_loans
        set
          status = 'repaid',
          repay_tx_signature = $2,
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('collateral_release_tx_signature', $3),
          closed_at = now()
        where id = $1
      `,
      [loan.id, params.repay_tx_signature, releaseResult.signature]
    );

    await client.query(
      `update public.collateral_lots set status = 'released' where id = $1`,
      [loan.collateral_lot_id]
    );

    await client.query(
      `
        update public.lending_pools
        set
          available_liquidity = available_liquidity + $2,
          borrowed_liquidity = greatest(0, borrowed_liquidity - $3)
        where id = $1
      `,
      [loan.pool_id, repayAmountUsdc, toNumber(loan.borrowed_amount_usdc)]
    );

    if (loan.subvault_id) {
      await client.query(
        `
          update public.subvaults
          set current_allocation = greatest(0, current_allocation - $2)
          where id = $1
        `,
        [loan.subvault_id, toNumber(loan.borrowed_amount_usdc)]
      );
    }
  });

  return {
    success: true,
    loan_id: loan.id,
    repaid_amount_usdc: repayAmountUsdc,
    collateral_release_tx_signature: releaseResult.signature,
    released_collateral_amount: toNumber(loan.collateral_quantity),
  };
}
