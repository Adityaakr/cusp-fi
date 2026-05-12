import { z } from "zod";

export const AssetSchema = z.enum([
  "USDT",
  "cUSDT",
  "USDC",
  "CASH",
  "YES_OUTCOME_TOKEN",
  "NO_OUTCOME_TOKEN",
]);

export const ExecutionAssetSchema = z.enum(["USDT", "USDC", "CASH", "AUTO"]);

export const TradeSideSchema = z.enum(["yes", "no"]);

export const RiskModeSchema = z.enum(["safe", "moderate", "aggressive"]);

export const QvacCommandBaseSchema = z.object({
  intent_id: z.string().min(1),
  user_wallet: z.string().min(32),
  input_accounting_asset: AssetSchema,
  underlying_asset: AssetSchema,
  execution_asset: ExecutionAssetSchema,
  amount_ui: z.number().positive(),
  requires_user_confirmation: z.boolean(),
});

export const VaultDepositCommandSchema = QvacCommandBaseSchema.extend({
  service: z.literal("vault"),
  action: z.literal("deposit"),
  asset: z.literal("USDT"),
  mint_receipt: z.literal("cUSDT"),
});

export const VaultWithdrawCommandSchema = QvacCommandBaseSchema.extend({
  service: z.literal("vault"),
  action: z.literal("withdraw"),
  asset: z.literal("cUSDT"),
  receive_asset: z.literal("USDT"),
});

export const LendDepositCommandSchema = QvacCommandBaseSchema.extend({
  service: z.literal("lend"),
  action: z.literal("deposit"),
  input_asset: AssetSchema,
  pool: z.string().min(1),
});

export const LendWithdrawCommandSchema = QvacCommandBaseSchema.extend({
  service: z.literal("lend"),
  action: z.literal("withdraw"),
  input_asset: AssetSchema,
  pool: z.string().min(1),
});

export const BorrowOpenCommandSchema = QvacCommandBaseSchema.extend({
  service: z.literal("borrow"),
  action: z.literal("open"),
  collateral_asset: AssetSchema,
  borrow_asset: AssetSchema,
  borrow_amount_ui: z.number().positive(),
  risk_mode: RiskModeSchema,
});

export const BorrowCloseCommandSchema = QvacCommandBaseSchema.extend({
  service: z.literal("borrow"),
  action: z.literal("close"),
  repay_asset: AssetSchema,
  repay_amount_ui: z.number().positive(),
});

export const DirectTradeCommandSchema = QvacCommandBaseSchema.extend({
  service: z.literal("direct_trade"),
  action: z.enum(["buy", "sell"]),
  input_asset: AssetSchema,
  input_amount_ui: z.number().positive(),
  market_query: z.string().min(1),
  side: TradeSideSchema,
  max_slippage_bps: z.number().int().min(0).max(10_000),
});

export const LeverageTradeCommandSchema = QvacCommandBaseSchema.extend({
  service: z.literal("leverage_trade"),
  action: z.enum(["open", "close"]),
  margin_asset: AssetSchema,
  margin_amount_ui: z.number().positive(),
  borrow_asset: AssetSchema,
  leverage: z.number().min(1.1).max(3),
  market_query: z.string().min(1),
  side: TradeSideSchema,
  max_slippage_bps: z.number().int().min(0).max(10_000),
});

export const AnyQvacCommandSchema = z.union([
  VaultDepositCommandSchema,
  VaultWithdrawCommandSchema,
  LendDepositCommandSchema,
  LendWithdrawCommandSchema,
  BorrowOpenCommandSchema,
  BorrowCloseCommandSchema,
  DirectTradeCommandSchema,
  LeverageTradeCommandSchema,
]);
