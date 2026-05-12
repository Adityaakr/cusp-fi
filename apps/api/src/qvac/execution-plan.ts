import type {
  AnyQvacCommand,
  ExecutionPlan,
  ExecutionStep,
  TradePreview,
  Asset,
} from "@cusp/shared";

export function buildExecutionPlan(cmd: AnyQvacCommand): ExecutionPlan {
  const steps: ExecutionStep[] = [];
  let totalExposure = cmd.amount_ui;

  switch (cmd.service) {
    case "vault": {
      if (cmd.action === "deposit") {
        steps.push(
          { step: "deposit", description: "User deposits USDC to vault", asset_in: "USDC", asset_out: "USDC", amount_ui: cmd.amount_ui },
        );
      } else {
        steps.push(
          { step: "withdraw", description: "User burns cUSDC, receives USDC", asset_in: "USDC", asset_out: "USDC", amount_ui: cmd.amount_ui },
        );
      }
      break;
    }

    case "lend": {
      steps.push(
        cmd.action === "withdraw"
          ? { step: "lend_withdraw", description: "Withdraw USDC from the lending pool", asset_in: "USDC", asset_out: "USDC", amount_ui: cmd.amount_ui }
          : { step: "lend_deposit", description: "Supply USDC to the lending pool", asset_in: "USDC", asset_out: "USDC", amount_ui: cmd.amount_ui },
      );
      break;
    }

    case "borrow": {
      if (cmd.action === "open") {
        const borrowed = cmd.borrow_amount_ui;
        totalExposure = cmd.amount_ui + borrowed;
        steps.push(
          { step: "lock_collateral", description: "Lock cUSDT as collateral", asset_in: "cUSDT", asset_out: "cUSDT", amount_ui: cmd.amount_ui },
          { step: "borrow", description: `Borrow ${borrowed} USDC against collateral`, asset_in: "cUSDT", asset_out: "USDC", amount_ui: borrowed },
        );
      } else {
        steps.push(
          { step: "repay", description: "Repay borrowed USDC", asset_in: "USDC", asset_out: "cUSDT", amount_ui: cmd.repay_amount_ui },
          { step: "unlock_collateral", description: "Unlock cUSDT collateral", asset_in: "cUSDT", asset_out: "cUSDT", amount_ui: cmd.amount_ui },
        );
      }
      break;
    }

    case "direct_trade": {
      steps.push(
        { step: "unwrap", description: "Burn/lock cUSDT, release USDC", asset_in: "cUSDT", asset_out: "USDC", amount_ui: cmd.input_amount_ui },
        { step: "route_check", description: "Check if USDC routes directly to DFlow", asset_in: "USDC", asset_out: "USDC", amount_ui: cmd.input_amount_ui },
        { step: "execute_trade", description: `Buy ${cmd.side.toUpperCase()} on ${cmd.market_query}`, asset_in: "USDC", asset_out: "YES_OUTCOME_TOKEN", amount_ui: cmd.input_amount_ui },
      );
      totalExposure = cmd.input_amount_ui;
      break;
    }

    case "leverage_trade": {
      if (cmd.action === "open") {
        const borrowed = cmd.margin_amount_ui * (cmd.leverage - 1);
        totalExposure = cmd.margin_amount_ui + borrowed;
        steps.push(
          { step: "lock_margin", description: `Burn/lock ${cmd.margin_amount_ui} cUSDT as margin`, asset_in: "cUSDT", asset_out: "cUSDT", amount_ui: cmd.margin_amount_ui },
          { step: "borrow", description: `Borrow ${borrowed.toFixed(2)} USDC from lending pool`, asset_in: "cUSDT", asset_out: "USDC", amount_ui: borrowed },
          { step: "route", description: "Route USDC through DFlow", asset_in: "USDC", asset_out: "USDC", amount_ui: totalExposure },
          { step: "execute", description: `Buy ${cmd.side.toUpperCase()} on ${cmd.market_query} (${cmd.leverage}x)`, asset_in: "USDC", asset_out: "YES_OUTCOME_TOKEN", amount_ui: totalExposure },
        );
      } else {
        steps.push(
          { step: "close_position", description: "Close leveraged position", asset_in: "YES_OUTCOME_TOKEN", asset_out: "USDC", amount_ui: cmd.amount_ui },
          { step: "repay_borrow", description: "Repay borrowed USDC", asset_in: "USDC", asset_out: "USDC", amount_ui: cmd.amount_ui },
        );
      }
      break;
    }
  }

  const preview: TradePreview = {
    action: `${cmd.action} ${cmd.service}`,
    margin_asset: "margin_asset" in cmd ? (cmd.margin_asset as Asset) : "cUSDT",
    margin_amount_ui: "margin_amount_ui" in cmd ? (cmd.margin_amount_ui as number) : cmd.amount_ui,
    borrowed_amount_ui: cmd.service === "leverage_trade" && cmd.action === "open"
      ? cmd.margin_amount_ui * (cmd.leverage - 1)
      : 0,
    total_exposure_ui: totalExposure,
    execution_route: getExecutionRoute(cmd),
    max_slippage_bps: "max_slippage_bps" in cmd ? (cmd.max_slippage_bps as number) : 0,
  };

  return {
    intent_id: cmd.intent_id,
    steps,
    total_exposure_ui: totalExposure,
    preview,
  };
}

function getExecutionRoute(cmd: AnyQvacCommand): string {
  if (cmd.service === "direct_trade" || cmd.service === "leverage_trade") {
    const executionAsset = cmd.execution_asset;
    if (executionAsset === "USDT") return "USDC → YES/NO";
    if (executionAsset === "USDC") return "USDC → YES/NO";
    if (executionAsset === "CASH") return "USDC → CASH → YES/NO";
    return "USDC → AUTO → YES/NO";
  }
  return "internal";
}
