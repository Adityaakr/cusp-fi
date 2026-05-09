import { useMemo } from "react";
import type { Position, UserPortfolio } from "@/hooks/useUserPortfolio";
import type { OutcomeTokenHolding } from "@/hooks/useOutcomeTokenHoldings";

export type BorrowPanelRow = {
  id: string;
  marketLabel: string;
  ticker: string | null;
  side: "YES" | "NO";
  quantity: number;
  decimals: number;
  tokenProgram: "spl-token" | "token-2022";
  /** Implied probability 0–100 */
  probability: number;
  /** Current live unit price of the outcome token ($) */
  currentPrice: number;
  /** Entry / buy price if available from portfolio ($) */
  entryPrice: number | null;
  /** Total collateral value = quantity × currentPrice */
  collateralUsd: number;
  /** Max borrow = collateralValue × MAX_LTV */
  maxBorrowUsd: number;
  /** Suggested safe borrow = collateralValue × SAFE_LTV */
  safeBorrowUsd: number;
  /** Price at which the position hits the liquidation threshold */
  liquidationPrice: number;
  outcomeMint: string;
};

/** Max LTV: borrow up to 30% of collateral value */
const MAX_LTV = 0.30;
/** Suggested safe LTV: 20% */
const SAFE_LTV = 0.20;
/** Liquidation threshold: 40% LTV — above max borrow but below 1:1 */
const LIQUIDATION_LTV = 0.40;

export function useBorrowPanelRows(
  portfolio: UserPortfolio | null | undefined,
  holdings: OutcomeTokenHolding[] | undefined
) {
  const positionByMint = useMemo(() => {
    const m = new Map<string, Position>();
    for (const p of portfolio?.positions ?? []) {
      if (p.status === "open" && p.outcome_mint) m.set(p.outcome_mint, p);
    }
    return m;
  }, [portfolio?.positions]);

  const rows = useMemo((): BorrowPanelRow[] => {
    const list: BorrowPanelRow[] = [];

    for (const h of holdings ?? []) {
      if (h.balance <= 0) continue;
      if (h.side !== "YES" && h.side !== "NO") continue;
      const side: "YES" | "NO" = h.side;
      const ticker = h.ticker;
      const pos = positionByMint.get(h.mint);

      // Current live price
      let unitPrice: number;
      if (h.currentPrice != null) {
        unitPrice = h.currentPrice;
      } else if (pos) {
        unitPrice =
          pos.side === "YES"
            ? Number(pos.current_yes_price ?? pos.entry_price) || 0.5
            : Number(pos.current_no_price ?? pos.entry_price) || 0.5;
      } else {
        unitPrice = 0.5;
      }

      // Entry price from portfolio position
      const entryPrice = pos ? Number(pos.entry_price) || null : null;

      const marketLabel =
        pos?.market_title ?? h.title ?? ticker ?? `${h.mint.slice(0, 4)}…${h.mint.slice(-4)}`;
      const collateralUsd = h.balance * unitPrice;
      const prob =
        h.probability ?? Math.round(Math.max(0, Math.min(1, unitPrice)) * 100);

      // Liquidation price: the token price at which LTV hits liquidation threshold
      // Given a borrow of maxBorrow, liquidation happens when:
      //   borrowAmount / (quantity × liqPrice) >= LIQUIDATION_LTV
      //   liqPrice = borrowAmount / (quantity × LIQUIDATION_LTV)
      // Using max borrow as reference:
      const maxBorrow = Math.max(0, collateralUsd * MAX_LTV);
      const liquidationPrice =
        h.balance > 0 && maxBorrow > 0
          ? maxBorrow / (h.balance * LIQUIDATION_LTV)
          : 0;

      list.push({
        id: `mint:${h.mint}`,
        marketLabel,
        ticker,
        side,
        quantity: h.balance,
        decimals: h.decimals,
        tokenProgram: h.program,
        probability: prob,
        currentPrice: unitPrice,
        entryPrice,
        collateralUsd,
        maxBorrowUsd: maxBorrow,
        safeBorrowUsd: Math.max(0, collateralUsd * SAFE_LTV),
        liquidationPrice,
        outcomeMint: h.mint,
      });
    }

    list.sort((a, b) => b.collateralUsd - a.collateralUsd);
    return list;
  }, [holdings, positionByMint]);

  return {
    rows,
    isPricesLoading: false,
  };
}
