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
          {
            step: "deposit",
            description: `User deposits ${cmd.asset} to vault`,
            asset_in: cmd.asset,
            asset_out: cmd.mint_receipt,
            amount_ui: cmd.amount_ui,
          },
        );
      } else {
        steps.push(
          {
            step: "withdraw",
            description: `User burns ${cmd.asset}, receives ${cmd.receive_asset}`,
            asset_in: cmd.asset,
            asset_out: cmd.receive_asset,
            amount_ui: cmd.amount_ui,
          },
        );
      }
      break;
    }

    case "lend": {
      steps.push(
        cmd.action === "withdraw"
          ? {
              step: "lend_withdraw",
              description: `Withdraw ${cmd.input_asset} from the lending pool`,
              asset_in: cmd.input_asset,
              asset_out: cmd.input_asset,
              amount_ui: cmd.amount_ui,
            }
          : {
              step: "lend_deposit",
              description: `Supply ${cmd.input_asset} to the lending pool`,
              asset_in: cmd.input_asset,
              asset_out: cmd.input_asset,
              amount_ui: cmd.amount_ui,
            },
      );
      break;
    }

    case "borrow": {
      if (cmd.action === "open") {
        const borrowed = cmd.borrow_amount_ui;
        totalExposure = cmd.amount_ui + borrowed;
        steps.push(
          { step: "lock_collateral", description: "Lock cUSDT as collateral", asset_in: "cUSDT", asset_out: "cUSDT", amount_ui: cmd.amount_ui },
          {
            step: "borrow",
            description: `Borrow ${borrowed} ${cmd.borrow_asset} against collateral`,
            asset_in: cmd.collateral_asset,
            asset_out: cmd.borrow_asset,
            amount_ui: borrowed,
          },
        );
      } else {
        steps.push(
          {
            step: "repay",
            description: `Repay borrowed ${cmd.repay_asset}`,
            asset_in: cmd.repay_asset,
            asset_out: "cUSDT",
            amount_ui: cmd.repay_amount_ui,
          },
          {
            step: "unlock_collateral",
            description: "Unlock cUSDT collateral",
            asset_in: "cUSDT",
            asset_out: "cUSDT",
            amount_ui: cmd.amount_ui,
          },
        );
      }
      break;
    }

    case "direct_trade": {
      if (cmd.input_asset === "cUSDT") {
        steps.push({
          step: "unwrap",
          description: "Burn/lock cUSDT, release USDC",
          asset_in: "cUSDT",
          asset_out: "USDC",
          amount_ui: cmd.input_amount_ui,
        });
      }
      steps.push(
        {
          step: "route_check",
          description: `Check if ${cmd.execution_asset} routes directly to DFlow`,
          asset_in: cmd.input_asset,
          asset_out: cmd.execution_asset === "AUTO" ? cmd.input_asset : cmd.execution_asset,
          amount_ui: cmd.input_amount_ui,
        },
        {
          step: "execute_trade",
          description: `${cmd.action === "sell" ? "Sell" : "Buy"} ${cmd.side.toUpperCase()} on ${cmd.market_query}`,
          asset_in: cmd.execution_asset === "AUTO" ? cmd.input_asset : cmd.execution_asset,
          asset_out: "YES_OUTCOME_TOKEN",
          amount_ui: cmd.input_amount_ui,
        },
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
          {
            step: "borrow",
            description: `Borrow ${borrowed.toFixed(2)} ${cmd.borrow_asset} from lending pool`,
            asset_in: cmd.margin_asset,
            asset_out: cmd.borrow_asset,
            amount_ui: borrowed,
          },
          {
            step: "route",
            description: `Route ${cmd.execution_asset} through DFlow`,
            asset_in: cmd.borrow_asset,
            asset_out: cmd.execution_asset === "AUTO" ? cmd.borrow_asset : cmd.execution_asset,
            amount_ui: totalExposure,
          },
          {
            step: "execute",
            description: `Buy ${cmd.side.toUpperCase()} on ${cmd.market_query} (${cmd.leverage}x)`,
            asset_in: cmd.execution_asset === "AUTO" ? cmd.borrow_asset : cmd.execution_asset,
            asset_out: "YES_OUTCOME_TOKEN",
            amount_ui: totalExposure,
          },
        );
      } else {
        steps.push(
          {
            step: "close_position",
            description: "Close leveraged position",
            asset_in: "YES_OUTCOME_TOKEN",
            asset_out: cmd.borrow_asset,
            amount_ui: cmd.amount_ui,
          },
          {
            step: "repay_borrow",
            description: `Repay borrowed ${cmd.borrow_asset}`,
            asset_in: cmd.borrow_asset,
            asset_out: cmd.borrow_asset,
            amount_ui: cmd.amount_ui,
          },
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
    if (executionAsset === "USDT") return "USDT → YES/NO";
    if (executionAsset === "USDC") return "USDC → YES/NO";
    if (executionAsset === "CASH") return "USDC → CASH → YES/NO";
    return `${"input_asset" in cmd ? cmd.input_asset : cmd.borrow_asset} → AUTO → YES/NO`;
  }
  return "internal";
}
