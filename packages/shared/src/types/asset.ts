export type Asset =
  | "USDT"
  | "cUSDT"
  | "USDC"
  | "CASH"
  | "YES_OUTCOME_TOKEN"
  | "NO_OUTCOME_TOKEN";

export type RiskTier = "conservative" | "moderate" | "growth";
export type MarketEligibility = RiskTier | "ineligible";
export type TradeSide = "yes" | "no";
export type ExecutionAsset = "USDT" | "USDC" | "CASH" | "AUTO";

export interface QvacCommandBase {
  intent_id: string;
  user_wallet: string;
  input_accounting_asset: Asset;
  underlying_asset: Asset;
  execution_asset: ExecutionAsset;
  amount_ui: number;
  requires_user_confirmation: boolean;
}

export type ServiceName =
  | "vault"
  | "lend"
  | "borrow"
  | "direct_trade"
  | "leverage_trade";

export type ServiceAction =
  | "deposit"
  | "withdraw"
  | "open"
  | "close"
  | "buy"
  | "sell";

export interface QvacCommand extends QvacCommandBase {
  service: ServiceName;
  action: ServiceAction;
}

export interface VaultDepositCommand extends QvacCommandBase {
  service: "vault";
  action: "deposit";
  asset: "USDT";
  mint_receipt: "cUSDT";
}

export interface VaultWithdrawCommand extends QvacCommandBase {
  service: "vault";
  action: "withdraw";
  asset: "cUSDT";
  receive_asset: "USDT";
}

export interface LendDepositCommand extends QvacCommandBase {
  service: "lend";
  action: "deposit";
  input_asset: Asset;
  pool: string;
}

export interface LendWithdrawCommand extends QvacCommandBase {
  service: "lend";
  action: "withdraw";
  input_asset: Asset;
  pool: string;
}

export interface BorrowOpenCommand extends QvacCommandBase {
  service: "borrow";
  action: "open";
  collateral_asset: Asset;
  borrow_asset: Asset;
  borrow_amount_ui: number;
  risk_mode: "safe" | "moderate" | "aggressive";
}

export interface BorrowCloseCommand extends QvacCommandBase {
  service: "borrow";
  action: "close";
  repay_asset: Asset;
  repay_amount_ui: number;
}

export interface DirectTradeCommand extends QvacCommandBase {
  service: "direct_trade";
  action: "buy" | "sell";
  input_asset: Asset;
  input_amount_ui: number;
  market_query: string;
  side: TradeSide;
  max_slippage_bps: number;
}

export interface LeverageTradeCommand extends QvacCommandBase {
  service: "leverage_trade";
  action: "open" | "close";
  margin_asset: Asset;
  margin_amount_ui: number;
  borrow_asset: Asset;
  leverage: number;
  market_query: string;
  side: TradeSide;
  max_slippage_bps: number;
}

export type AnyQvacCommand =
  | VaultDepositCommand
  | VaultWithdrawCommand
  | LendDepositCommand
  | LendWithdrawCommand
  | BorrowOpenCommand
  | BorrowCloseCommand
  | DirectTradeCommand
  | LeverageTradeCommand;

export interface ExecutionStep {
  step: string;
  description: string;
  asset_in: Asset;
  asset_out: Asset;
  amount_ui: number;
}

export interface ExecutionPlan {
  intent_id: string;
  steps: ExecutionStep[];
  total_exposure_ui: number;
  preview: TradePreview;
}

export interface TradePreview {
  action: string;
  margin_asset: Asset;
  margin_amount_ui: number;
  borrowed_amount_ui: number;
  total_exposure_ui: number;
  execution_route: string;
  max_slippage_bps: number;
  liquidation_threshold?: string;
  health_factor?: number;
}

export interface FundConfig {
  tier: RiskTier;
  label: string;
  shortLabel: "C" | "M" | "G";
  cusdcSymbol: "cUSDT-C" | "cUSDT-M" | "cUSDT-G";
  interestCapBps: number;
  targetApyRange: [number, number];
  minReserveBps: number;
  description: string;
  marketRule: string;
}

export interface MarketConfig {
  ticker: string;
  yesMint?: string;
  noMint?: string;
  settlementMint?: string;
  fundTier: MarketEligibility;
  earlyClosureEnabled: boolean;
  baseLiquidationThresholdBps: number;
  resolutionTime: number;
}

export interface EarlyClosureState {
  enabled: boolean;
  active: boolean;
  resolutionTime: number;
  secondsRemaining: number;
  windowSeconds: number;
  baseLiquidationThresholdBps: number;
  effectiveLiquidationThresholdBps: number;
  progressPct: number;
  warningLevel: "none" | "t7" | "t3" | "t1" | "resolved";
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
  settlementMint?: string;
  eventTicker: string;
  estimatedYield: number;
  yesLabel: string;
  noLabel: string;
  rulesPrimary?: string;
  rulesSecondary?: string;
  openInterest?: number;
  subtitle?: string;
  yesBestBid: number;
  yesBestAsk: number;
  noBestAsk: number;
  yesSpread: number | null;
}
