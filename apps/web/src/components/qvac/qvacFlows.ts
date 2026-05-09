import type { Asset, TradeSide } from "@cusp/shared";
import type { AnyQvacCommand } from "@cusp/shared";
import {
  Lock,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  BarChart3,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export type StepType = "amount" | "select" | "market_search" | "confirm";

export interface QvacMarketSearchValue {
  ticker: string;
  title: string;
  subtitle?: string;
  category?: string;
  imageUrl?: string;
  yesPrice?: number;
  noPrice?: number;
  yesLabel?: string;
  noLabel?: string;
  volume24h?: number;
  resolutionDate?: string;
}

export interface QvacFlowStep {
  key: string;
  question: string;
  type: StepType;
  options?: Array<{ label: string; value: string; description?: string }>;
  placeholder?: string;
  asset?: Asset;
  min?: number;
  max?: number;
  validation?: (value: unknown) => string | null;
}

export interface QvacFlow {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  category: string;
  steps: QvacFlowStep[];
  buildCommand: (values: Record<string, unknown>, wallet: string) => AnyQvacCommand;
  executor: "hook" | "api";
  hookRef?: string;
}

export function getMarketQueryValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "ticker" in value) {
    const ticker = (value as QvacMarketSearchValue).ticker;
    return typeof ticker === "string" ? ticker : "";
  }
  return "";
}

export function getMarketDisplayValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "title" in value) {
    const title = (value as QvacMarketSearchValue).title;
    return typeof title === "string" && title.trim() ? title : getMarketQueryValue(value);
  }
  return "";
}

const positiveAmount = (v: unknown): string | null => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "Enter a valid positive amount";
  return null;
};

const leverageValidation = (v: unknown): string | null => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1.1 || n > 3) return "Leverage must be between 1.1x and 3x";
  return null;
};

export const QVAC_FLOWS: QvacFlow[] = [
  {
    id: "vault-deposit",
    label: "Deposit to Vault",
    description: "Supply USDT and earn yield",
    icon: ArrowDownToLine,
    category: "Vault",
    steps: [
      {
        key: "amount_ui",
        question: "How much USDT would you like to deposit?",
        type: "amount",
        asset: "USDT",
        placeholder: "0.00",
        validation: positiveAmount,
      },
    ],
    buildCommand: (values, wallet) => ({
      intent_id: crypto.randomUUID(),
      user_wallet: wallet,
      input_accounting_asset: "USDT" as Asset,
      underlying_asset: "USDT" as Asset,
      execution_asset: "USDT" as const,
      amount_ui: values.amount_ui as number,
      requires_user_confirmation: true,
      service: "vault" as const,
      action: "deposit" as const,
      asset: "USDT" as const,
      mint_receipt: "cUSDT" as const,
    }),
    executor: "hook",
    hookRef: "useMainnetDeposit",
  },
  {
    id: "vault-withdraw",
    label: "Withdraw from Vault",
    description: "Burn cUSDT and receive USDT",
    icon: ArrowUpFromLine,
    category: "Vault",
    steps: [
      {
        key: "amount_ui",
        question: "How much cUSDT would you like to withdraw?",
        type: "amount",
        asset: "cUSDT",
        placeholder: "0.00",
        validation: positiveAmount,
      },
    ],
    buildCommand: (values, wallet) => ({
      intent_id: crypto.randomUUID(),
      user_wallet: wallet,
      input_accounting_asset: "cUSDT" as Asset,
      underlying_asset: "USDT" as Asset,
      execution_asset: "USDT" as const,
      amount_ui: values.amount_ui as number,
      requires_user_confirmation: true,
      service: "vault" as const,
      action: "withdraw" as const,
      asset: "cUSDT" as const,
      receive_asset: "USDT" as const,
    }),
    executor: "hook",
    hookRef: "useWithdraw",
  },
  {
    id: "lend-deposit",
    label: "Lend Deposit",
    description: "Supply cUSDT to earning pools",
    icon: TrendingUp,
    category: "Lending",
    steps: [
      {
        key: "amount_ui",
        question: "How much would you like to lend?",
        type: "amount",
        asset: "cUSDT",
        placeholder: "0.00",
        validation: positiveAmount,
      },
      {
        key: "pool",
        question: "Which lending pool?",
        type: "select",
        options: [
          { label: "Conservative", value: "conservative", description: "Lower risk, stable yield" },
          { label: "Moderate", value: "moderate", description: "Balanced risk and yield" },
          { label: "Growth", value: "growth", description: "Higher risk, higher yield" },
        ],
      },
    ],
    buildCommand: (values, wallet) => ({
      intent_id: crypto.randomUUID(),
      user_wallet: wallet,
      input_accounting_asset: "cUSDT" as Asset,
      underlying_asset: "USDT" as Asset,
      execution_asset: "USDT" as const,
      amount_ui: values.amount_ui as number,
      requires_user_confirmation: true,
      service: "lend" as const,
      action: "deposit" as const,
      input_asset: "cUSDT" as Asset,
      pool: values.pool as string,
    }),
    executor: "hook",
    hookRef: "useKaminoDeposit",
  },
  {
    id: "lend-withdraw",
    label: "Lend Withdraw",
    description: "Withdraw from lending pool",
    icon: ArrowUpFromLine,
    category: "Lending",
    steps: [
      {
        key: "amount_ui",
        question: "How much would you like to withdraw?",
        type: "amount",
        asset: "cUSDT",
        placeholder: "0.00",
        validation: positiveAmount,
      },
      {
        key: "pool",
        question: "Which lending pool?",
        type: "select",
        options: [
          { label: "Conservative", value: "conservative", description: "Withdraw from conservative pool" },
          { label: "Moderate", value: "moderate", description: "Withdraw from moderate pool" },
          { label: "Growth", value: "growth", description: "Withdraw from growth pool" },
        ],
      },
    ],
    buildCommand: (values, wallet) => ({
      intent_id: crypto.randomUUID(),
      user_wallet: wallet,
      input_accounting_asset: "cUSDT" as Asset,
      underlying_asset: "USDT" as Asset,
      execution_asset: "USDT" as const,
      amount_ui: values.amount_ui as number,
      requires_user_confirmation: true,
      service: "lend" as const,
      action: "withdraw" as const,
      input_asset: "cUSDT" as Asset,
      pool: values.pool as string,
    }),
    executor: "hook",
    hookRef: "useKaminoWithdraw",
  },
  {
    id: "borrow-open",
    label: "Open Borrow Position",
    description: "Borrow against your collateral",
    icon: Lock,
    category: "Borrowing",
    steps: [
      {
        key: "collateral_asset",
        question: "What will you use as collateral?",
        type: "select",
        options: [
          { label: "USDT", value: "USDT", description: "Use USDT as collateral" },
          { label: "cUSDT", value: "cUSDT", description: "Use cUSDT as collateral" },
        ],
      },
      {
        key: "borrow_asset",
        question: "What would you like to borrow?",
        type: "select",
        options: [
          { label: "USDT", value: "USDT", description: "Borrow USDT" },
          { label: "USDC", value: "USDC", description: "Borrow USDC" },
        ],
      },
      {
        key: "borrow_amount_ui",
        question: "How much would you like to borrow?",
        type: "amount",
        asset: "USDT",
        placeholder: "0.00",
        validation: positiveAmount,
      },
      {
        key: "amount_ui",
        question: "How much collateral are you providing?",
        type: "amount",
        asset: "USDT",
        placeholder: "0.00",
        validation: positiveAmount,
      },
      {
        key: "risk_mode",
        question: "Choose your risk mode",
        type: "select",
        options: [
          { label: "Safe", value: "safe", description: "Lower risk, higher collateral ratio" },
          { label: "Moderate", value: "moderate", description: "Balanced risk and yield" },
          { label: "Aggressive", value: "aggressive", description: "Higher risk, lower collateral ratio" },
        ],
      },
    ],
    buildCommand: (values, wallet) => ({
      intent_id: crypto.randomUUID(),
      user_wallet: wallet,
      input_accounting_asset: (values.collateral_asset as Asset) || "USDT",
      underlying_asset: "USDT" as Asset,
      execution_asset: "USDT" as const,
      amount_ui: values.amount_ui as number,
      requires_user_confirmation: true,
      service: "borrow" as const,
      action: "open" as const,
      collateral_asset: (values.collateral_asset as Asset) || "USDT",
      borrow_asset: (values.borrow_asset as Asset) || "USDT",
      borrow_amount_ui: values.borrow_amount_ui as number,
      risk_mode: (values.risk_mode as "safe" | "moderate" | "aggressive") || "moderate",
    }),
    executor: "api",
  },
  {
    id: "borrow-close",
    label: "Close Borrow Position",
    description: "Repay and unlock your collateral",
    icon: XCircle,
    category: "Borrowing",
    steps: [
      {
        key: "repay_asset",
        question: "What asset will you repay with?",
        type: "select",
        options: [
          { label: "USDT", value: "USDT", description: "Repay with USDT" },
          { label: "USDC", value: "USDC", description: "Repay with USDC" },
        ],
      },
      {
        key: "repay_amount_ui",
        question: "How much would you like to repay?",
        type: "amount",
        asset: "USDT",
        placeholder: "0.00",
        validation: positiveAmount,
      },
      {
        key: "amount_ui",
        question: "How much collateral to unlock?",
        type: "amount",
        asset: "USDT",
        placeholder: "0.00",
        validation: positiveAmount,
      },
    ],
    buildCommand: (values, wallet) => ({
      intent_id: crypto.randomUUID(),
      user_wallet: wallet,
      input_accounting_asset: (values.repay_asset as Asset) || "USDT",
      underlying_asset: "USDT" as Asset,
      execution_asset: "USDT" as const,
      amount_ui: values.amount_ui as number,
      requires_user_confirmation: true,
      service: "borrow" as const,
      action: "close" as const,
      repay_asset: (values.repay_asset as Asset) || "USDT",
      repay_amount_ui: values.repay_amount_ui as number,
    }),
    executor: "api",
  },
  {
    id: "direct-trade",
    label: "Trade on Market",
    description: "Buy or sell outcome tokens",
    icon: BarChart3,
    category: "Trading",
    steps: [
      {
        key: "market_query",
        question: "Which market?",
        type: "market_search",
        placeholder: "Search markets...",
      },
      {
        key: "side",
        question: "Which side?",
        type: "select",
        options: [
          { label: "Yes", value: "yes", description: "Bet the outcome happens" },
          { label: "No", value: "no", description: "Bet the outcome doesn't happen" },
        ],
      },
      {
        key: "action",
        question: "Buy or sell?",
        type: "select",
        options: [
          { label: "Buy", value: "buy", description: "Purchase outcome tokens" },
          { label: "Sell", value: "sell", description: "Sell outcome tokens" },
        ],
      },
      {
        key: "input_amount_ui",
        question: "How much would you like to trade?",
        type: "amount",
        asset: "USDT",
        placeholder: "0.00",
        validation: positiveAmount,
      },
      {
        key: "max_slippage_bps",
        question: "Maximum slippage tolerance?",
        type: "select",
        options: [
          { label: "0.5%", value: "50", description: "Low slippage tolerance" },
          { label: "1%", value: "100", description: "Standard slippage tolerance" },
          { label: "2%", value: "200", description: "Higher slippage tolerance" },
          { label: "5%", value: "500", description: "Maximum slippage tolerance" },
        ],
      },
    ],
    buildCommand: (values, wallet) => ({
      intent_id: crypto.randomUUID(),
      user_wallet: wallet,
      input_accounting_asset: "USDT" as Asset,
      underlying_asset: "USDT" as Asset,
      execution_asset: "USDT" as const,
      amount_ui: values.input_amount_ui as number,
      requires_user_confirmation: true,
      service: "direct_trade" as const,
      action: (values.action as "buy" | "sell") || "buy",
      input_asset: "USDT" as Asset,
      input_amount_ui: values.input_amount_ui as number,
      market_query: getMarketQueryValue(values.market_query),
      side: (values.side as TradeSide) || "yes",
      max_slippage_bps: Number(values.max_slippage_bps) || 100,
    }),
    executor: "api",
  },
  {
    id: "leverage-trade-open",
    label: "Open Leveraged Position",
    description: "Trade with leverage for amplified exposure",
    icon: TrendingUp,
    category: "Trading",
    steps: [
      {
        key: "market_query",
        question: "Which market?",
        type: "market_search",
        placeholder: "Search markets...",
      },
      {
        key: "side",
        question: "Which side?",
        type: "select",
        options: [
          { label: "Yes", value: "yes", description: "Bet the outcome happens" },
          { label: "No", value: "no", description: "Bet the outcome doesn't happen" },
        ],
      },
      {
        key: "margin_amount_ui",
        question: "How much margin?",
        type: "amount",
        asset: "USDT",
        placeholder: "0.00",
        validation: positiveAmount,
      },
      {
        key: "leverage",
        question: "What leverage?",
        type: "select",
        options: [
          { label: "1.5x", value: "1.5", description: "Conservative leverage" },
          { label: "2x", value: "2", description: "Standard leverage" },
          { label: "2.5x", value: "2.5", description: "Higher leverage" },
          { label: "3x", value: "3", description: "Maximum leverage" },
        ],
        validation: leverageValidation,
      },
      {
        key: "max_slippage_bps",
        question: "Maximum slippage tolerance?",
        type: "select",
        options: [
          { label: "0.5%", value: "50", description: "Low slippage tolerance" },
          { label: "1%", value: "100", description: "Standard slippage tolerance" },
          { label: "2%", value: "200", description: "Higher slippage tolerance" },
        ],
      },
    ],
    buildCommand: (values, wallet) => ({
      intent_id: crypto.randomUUID(),
      user_wallet: wallet,
      input_accounting_asset: "USDT" as Asset,
      underlying_asset: "USDT" as Asset,
      execution_asset: "USDT" as const,
      amount_ui: values.margin_amount_ui as number,
      requires_user_confirmation: true,
      service: "leverage_trade" as const,
      action: "open" as const,
      margin_asset: "cUSDT" as Asset,
      margin_amount_ui: values.margin_amount_ui as number,
      borrow_asset: "USDT" as Asset,
      leverage: Number(values.leverage) || 2,
      market_query: getMarketQueryValue(values.market_query),
      side: (values.side as TradeSide) || "yes",
      max_slippage_bps: Number(values.max_slippage_bps) || 100,
    }),
    executor: "hook",
    hookRef: "useLeveragedTrade",
  },
  {
    id: "leverage-trade-close",
    label: "Close Leveraged Position",
    description: "Close your leveraged position and repay borrowed amount",
    icon: XCircle,
    category: "Trading",
    steps: [
      {
        key: "amount_ui",
        question: "How much of the position to close?",
        type: "amount",
        asset: "USDT",
        placeholder: "0.00",
        validation: positiveAmount,
      },
      {
        key: "market_query",
        question: "Which market is this position on?",
        type: "market_search",
        placeholder: "Search markets...",
      },
    ],
    buildCommand: (values, wallet) => ({
      intent_id: crypto.randomUUID(),
      user_wallet: wallet,
      input_accounting_asset: "USDT" as Asset,
      underlying_asset: "USDT" as Asset,
      execution_asset: "USDT" as const,
      amount_ui: values.amount_ui as number,
      requires_user_confirmation: true,
      service: "leverage_trade" as const,
      action: "close" as const,
      margin_asset: "cUSDT" as Asset,
      margin_amount_ui: values.amount_ui as number,
      borrow_asset: "USDT" as Asset,
      leverage: 1,
      market_query: getMarketQueryValue(values.market_query),
      side: "yes" as TradeSide,
      max_slippage_bps: 100,
    }),
    executor: "api",
  },
];

export function getFlowById(id: string): QvacFlow | undefined {
  return QVAC_FLOWS.find((f) => f.id === id);
}
