import { useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import type { Position, TradeExecution, UserPortfolio } from "@/hooks/useUserPortfolio";
import type { OutcomeTokenHolding } from "@/hooks/useOutcomeTokenHoldings";

function normalizeOutcomeSide(side: string | null | undefined): "YES" | "NO" | null {
  const normalized = String(side ?? "").trim().toUpperCase();
  if (normalized === "YES" || normalized === "NO") return normalized;
  return null;
}

function isValidMint(mint: string | null | undefined): mint is string {
  if (!mint) return false;
  try {
    new PublicKey(mint);
    return true;
  } catch {
    return false;
  }
}

function latestExecutionByPosition(
  tradeExecutions: TradeExecution[] | undefined
): Map<string, TradeExecution> {
  const byPosition = new Map<string, TradeExecution>();

  for (const execution of tradeExecutions ?? []) {
    if (!execution.position_id) continue;
    if (!byPosition.has(execution.position_id)) {
      byPosition.set(execution.position_id, execution);
    }
  }

  return byPosition;
}

export function useLivePortfolioPositions(
  portfolio: UserPortfolio | null | undefined,
  holdings: OutcomeTokenHolding[] | undefined,
  custodiedMints?: Iterable<string>
) {
  const openPositionsByMint = useMemo(() => {
    const byMint = new Map<string, Position[]>();

    for (const position of portfolio?.positions ?? []) {
      if (position.status !== "open" || !position.outcome_mint) continue;
      const normalizedSide = normalizeOutcomeSide(position.side);
      const normalizedPosition =
        normalizedSide && normalizedSide !== position.side
          ? { ...position, side: normalizedSide }
          : position;

      const existing = byMint.get(position.outcome_mint);
      if (existing) existing.push(normalizedPosition);
      else byMint.set(position.outcome_mint, [normalizedPosition]);
    }

    return byMint;
  }, [portfolio?.positions]);

  const latestExecutionMap = useMemo(
    () => latestExecutionByPosition(portfolio?.trade_executions),
    [portfolio?.trade_executions]
  );

  return useMemo(() => {
    const livePositions: Position[] = [];
    const walletOnlyHoldings: OutcomeTokenHolding[] = [];
    const matchedMints = new Set<string>();
    const custodiedMintSet = new Set(custodiedMints ?? []);

    for (const holding of holdings ?? []) {
      if (holding.balance <= 0) continue;

      const matches = openPositionsByMint.get(holding.mint) ?? [];
      if (matches.length === 0) {
        walletOnlyHoldings.push(holding);
        continue;
      }

      matchedMints.add(holding.mint);

      const latestPosition = matches[0];
      const side = normalizeOutcomeSide(holding.side ?? latestPosition.side) ?? latestPosition.side;
      const trackedQuantity = matches.reduce((sum, position) => sum + Math.max(0, Number(position.quantity) || 0), 0);
      const trackedCost = matches.reduce((sum, position) => sum + Math.max(0, Number(position.usdc_cost) || 0), 0);
      const entryPrice =
        trackedQuantity > 0
          ? trackedCost / trackedQuantity
          : Number(latestPosition.entry_price) || 0;
      const costScale = trackedQuantity > 0 ? Math.min(1, holding.balance / trackedQuantity) : 1;
      const effectiveCost = trackedCost > 0 ? trackedCost * costScale : Number(latestPosition.usdc_cost) || 0;
      const livePrice =
        holding.currentPrice ??
        (side === "YES" ? latestPosition.current_yes_price : latestPosition.current_no_price) ??
        latestPosition.entry_price;
      const liveValue = holding.currentValue ?? (livePrice != null ? holding.balance * livePrice : null);
      const unrealizedPnl = liveValue != null && effectiveCost > 0 ? liveValue - effectiveCost : null;
      const unrealizedPnlPct =
        unrealizedPnl != null && effectiveCost > 0 ? (unrealizedPnl / effectiveCost) * 100 : null;

      livePositions.push({
        ...latestPosition,
        side,
        market_ticker: holding.ticker ?? latestPosition.market_ticker,
        market_title: holding.title ?? latestPosition.market_title ?? latestPosition.market_ticker,
        quantity: holding.balance,
        entry_price: entryPrice,
        usdc_cost: effectiveCost,
        current_yes_price: side === "YES" ? livePrice : latestPosition.current_yes_price ?? null,
        current_no_price: side === "NO" ? livePrice : latestPosition.current_no_price ?? null,
        current_value: liveValue,
        unrealized_pnl: unrealizedPnl,
        unrealized_pnl_pct: unrealizedPnlPct,
      });
    }

    for (const [mint, matches] of openPositionsByMint.entries()) {
      if (matchedMints.has(mint)) continue;
      if (!isValidMint(mint)) continue;
      if (custodiedMintSet.has(mint)) continue;

      const latestPosition = matches[0];
      const latestExecution = latestExecutionMap.get(latestPosition.id);
      const trackedQuantity = matches.reduce((sum, position) => {
        const positionQuantity = Math.max(0, Number(position.quantity) || 0);
        if (positionQuantity > 0) return sum + positionQuantity;

        const execution = latestExecutionMap.get(position.id);
        const executionQuantity = Math.max(0, Number(execution?.output_amount) || 0);
        return sum + executionQuantity;
      }, 0);
      const trackedCost = matches.reduce(
        (sum, position) => sum + Math.max(0, Number(position.usdc_cost) || 0),
        0
      );
      const side = normalizeOutcomeSide(latestPosition.side) ?? latestPosition.side;
      const livePrice =
        side === "YES"
          ? latestPosition.current_yes_price
          : side === "NO"
            ? latestPosition.current_no_price
            : null;
      const currentValue =
        trackedQuantity > 0 && livePrice != null ? trackedQuantity * livePrice : null;
      const entryPrice =
        Number(latestPosition.entry_price) > 0
          ? Number(latestPosition.entry_price)
          : trackedQuantity > 0 && trackedCost > 0
            ? trackedCost / trackedQuantity
            : 0;
      const unrealizedPnl =
        currentValue != null && trackedCost > 0 ? currentValue - trackedCost : null;
      const unrealizedPnlPct =
        unrealizedPnl != null && trackedCost > 0 ? (unrealizedPnl / trackedCost) * 100 : null;

      livePositions.push({
        ...latestPosition,
        side,
        quantity: trackedQuantity,
        usdc_cost: trackedCost,
        entry_price: entryPrice,
        current_value: currentValue,
        unrealized_pnl: unrealizedPnl,
        unrealized_pnl_pct: unrealizedPnlPct,
        status:
          trackedQuantity > 0
            ? latestPosition.status
            : (latestExecution?.status as Position["status"] | undefined) ?? latestPosition.status,
        tx_signature: latestPosition.tx_signature ?? latestExecution?.tx_signature ?? null,
      });
    }

    livePositions.sort((a, b) => {
      const aValue = a.current_value ?? 0;
      const bValue = b.current_value ?? 0;
      if (bValue !== aValue) return bValue - aValue;
      return (a.market_title ?? a.market_ticker).localeCompare(b.market_title ?? b.market_ticker);
    });

    return {
      livePositions,
      walletOnlyHoldings,
      matchedHoldingMints: Array.from(matchedMints),
    };
  }, [custodiedMints, holdings, latestExecutionMap, openPositionsByMint]);
}
