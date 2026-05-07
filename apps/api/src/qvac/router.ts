import type { AnyQvacCommand, ExecutionPlan, TradePreview, Asset } from "@cusp/shared";
import { AnyQvacCommandSchema } from "@cusp/shared/schemas";
import { processDeposit, processWithdrawal } from "../services/vault.service.js";
import { processLendDeposit, processLendWithdrawal } from "../services/lend.service.js";
import { processBorrowOpen, processBorrowClose } from "../services/borrow.service.js";
import { processDirectTrade } from "../services/direct-trade.service.js";
import { processLeverageTradeOpen, processLeverageTradeClose } from "../services/leverage-trade.service.js";
import { performRiskCheck } from "../services/risk-engine.service.js";
import { resolveExecutionRoute } from "../resolvers/dflow-route-resolver.js";
import { buildExecutionPlan } from "./execution-plan.js";

export interface QvacRouterResult {
  success: boolean;
  intent_id: string;
  preview?: TradePreview;
  execution_plan?: ExecutionPlan;
  data?: Record<string, unknown>;
  error?: string;
}

export async function routeQvacCommand(
  rawCommand: unknown
): Promise<QvacRouterResult> {
  const parsed = AnyQvacCommandSchema.safeParse(rawCommand);
  if (!parsed.success) {
    return {
      success: false,
      intent_id: "unknown",
      error: `Invalid command: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
    };
  }

  const cmd = parsed.data as AnyQvacCommand;
  const intent_id = cmd.intent_id;

  if (cmd.requires_user_confirmation) {
    const plan = buildExecutionPlan(cmd as AnyQvacCommand);
    const routeInfo = await resolveExecutionRoute(cmd as AnyQvacCommand);
    if (!routeInfo.canExecute) {
      return {
        success: false,
        intent_id,
        error: routeInfo.reason || "Execution route not available",
      };
    }
    return {
      success: true,
      intent_id,
      preview: plan.preview,
      execution_plan: plan,
    };
  }

  try {
    switch (cmd.service) {
      case "vault": {
        if (cmd.action === "deposit") {
          const result = await processDeposit({
            wallet_address: cmd.user_wallet,
            tx_signature: (rawCommand as any).tx_signature || "",
            amount_usdc: cmd.amount_ui,
          });
          return { success: result.success, intent_id, data: result as any, error: result.error };
        }
        if (cmd.action === "withdraw") {
          const result = await processWithdrawal({
            wallet_address: cmd.user_wallet,
            cusdc_amount: cmd.amount_ui,
          });
          return { success: result.success, intent_id, data: result as any, error: result.error };
        }
        break;
      }

      case "lend": {
        if (cmd.action === "deposit") {
          const result = await processLendDeposit({
            wallet_address: cmd.user_wallet,
            input_asset: cmd.input_asset || "cUSDT",
            amount_ui: cmd.amount_ui,
            pool: cmd.pool,
          });
          return { success: result.success, intent_id, data: result as any, error: result.error };
        }
        if (cmd.action === "withdraw") {
          const result = await processLendWithdrawal({
            wallet_address: cmd.user_wallet,
            input_asset: cmd.input_asset || "cUSDT",
            amount_ui: cmd.amount_ui,
            pool: cmd.pool,
          });
          return { success: result.success, intent_id, data: result as any, error: result.error };
        }
        break;
      }

      case "borrow": {
        if (cmd.action === "open") {
          const result = await processBorrowOpen({
            wallet_address: cmd.user_wallet,
            collateral_asset: cmd.collateral_asset,
            borrow_asset: cmd.borrow_asset,
            borrow_amount_ui: cmd.borrow_amount_ui,
            risk_mode: cmd.risk_mode,
            amount_ui: cmd.amount_ui,
          });
          return { success: result.success, intent_id, data: result as any, error: result.error };
        }
        if (cmd.action === "close") {
          const result = await processBorrowClose({
            wallet_address: cmd.user_wallet,
            repay_asset: cmd.repay_asset,
            repay_amount_ui: cmd.repay_amount_ui,
          });
          return { success: result.success, intent_id, data: result as any, error: result.error };
        }
        break;
      }

      case "direct_trade": {
        const riskResult = await performRiskCheck({
          market_ticker: cmd.market_query,
          margin_usdc: cmd.input_amount_ui,
          leverage: 1,
        });
        if (!riskResult.approved) {
          return { success: false, intent_id, error: riskResult.errors.join("; ") };
        }

        const result = await processDirectTrade({
          wallet_address: cmd.user_wallet,
          input_asset: cmd.input_asset,
          input_amount_ui: cmd.input_amount_ui,
          market_query: cmd.market_query,
          side: cmd.side,
          max_slippage_bps: cmd.max_slippage_bps,
        });
        return { success: result.success, intent_id, data: result as any, error: result.error };
      }

      case "leverage_trade": {
        if (cmd.action === "open") {
          const riskResult = await performRiskCheck({
            market_ticker: cmd.market_query,
            margin_usdc: cmd.margin_amount_ui,
            leverage: cmd.leverage,
          });
          if (!riskResult.approved) {
            return { success: false, intent_id, error: riskResult.errors.join("; ") };
          }

          const result = await processLeverageTradeOpen({
            wallet_address: cmd.user_wallet,
            margin_amount_ui: cmd.margin_amount_ui,
            leverage: cmd.leverage,
            market_query: cmd.market_query,
            side: cmd.side,
            max_slippage_bps: cmd.max_slippage_bps,
          });
          return { success: result.success, intent_id, data: result as any, error: result.error };
        }
        if (cmd.action === "close") {
          const result = await processLeverageTradeClose({
            position_id: (rawCommand as any).position_id || "",
            wallet_address: cmd.user_wallet,
          });
          return { success: result.success, intent_id, data: result as any, error: result.error };
        }
        break;
      }
    }

    return { success: false, intent_id, error: `Unknown service/action: ${cmd.service}/${cmd.action}` };
  } catch (err) {
    return {
      success: false,
      intent_id,
      error: err instanceof Error ? err.message : "Internal router error",
    };
  }
}
