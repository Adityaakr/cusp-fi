import type { RiskTier } from "@cusp/shared";

export interface DFlowMergeRequest {
  userPublicKey: string;
  marketId: string;
  yesMint: string;
  noMint: string;
  amount: number;
}

export interface DFlowRedeemRequest {
  userPublicKey: string;
  marketId: string;
  amount: number;
  settlementMint?: string;
}

export interface DFlowLiquidationPlan {
  marketId: string;
  collateralMint: string;
  oppositeMint: string;
  collateralAmount: number;
  side: "YES" | "NO";
  fundTier: RiskTier;
}

export interface MarketConfig {
  ticker: string;
  yesMint?: string;
  noMint?: string;
  settlementMint?: string;
  fundTier: RiskTier | "ineligible";
  earlyClosureEnabled: boolean;
  baseLiquidationThresholdBps: number;
  resolutionTime: number;
}
