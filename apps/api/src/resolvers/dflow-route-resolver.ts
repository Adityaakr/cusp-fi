import type { AnyQvacCommand, Asset } from "@cusp/shared";
import { USDC_MINT_MAINNET, USDT_MINT_MAINNET } from "@cusp/shared/constants";
import { fetchOrderQuote } from "../services/dflow-adapter.service.js";

export interface RouteResolution {
  canExecute: boolean;
  route: string;
  needsSwap: boolean;
  swapFrom?: string;
  swapTo?: string;
  reason?: string;
}

export async function resolveExecutionRoute(
  cmd: AnyQvacCommand
): Promise<RouteResolution> {
  if (cmd.service !== "direct_trade" && cmd.service !== "leverage_trade") {
    return { canExecute: true, route: "internal", needsSwap: false };
  }

  const execAsset = cmd.execution_asset;

  if (execAsset === "USDT") {
    return { canExecute: true, route: "USDT → YES/NO", needsSwap: false };
  }

  if (execAsset === "USDC") {
    return {
      canExecute: true,
      route: "USDT → USDC → YES/NO",
      needsSwap: true,
      swapFrom: USDT_MINT_MAINNET,
      swapTo: USDC_MINT_MAINNET,
    };
  }

  if (execAsset === "CASH") {
    return {
      canExecute: true,
      route: "USDT → CASH → YES/NO",
      needsSwap: true,
      swapFrom: USDT_MINT_MAINNET,
      swapTo: "CASH_MINT",
    };
  }

  // AUTO — try USDT direct first, fallback to USDC
  try {
    const amount = cmd.service === "direct_trade"
      ? cmd.input_amount_ui
      : cmd.margin_amount_ui * cmd.leverage;

    const testQuote = await fetchOrderQuote({
      userPublicKey: cmd.user_wallet,
      inputMint: USDT_MINT_MAINNET,
      outputMint: "TEST",
      amount: Math.round(amount * 1e6),
      slippageBps: "auto",
    });

    return { canExecute: true, route: "USDT → YES/NO (direct)", needsSwap: false };
  } catch {
    return {
      canExecute: true,
      route: "USDT → USDC → YES/NO (swap required)",
      needsSwap: true,
      swapFrom: USDT_MINT_MAINNET,
      swapTo: USDC_MINT_MAINNET,
    };
  }
}
