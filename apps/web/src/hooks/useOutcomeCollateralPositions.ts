import { useQuery } from "@tanstack/react-query";
import { cuspApiFetch } from "@/lib/cusp-api";

export type OutcomeCollateralPosition = {
  collateral_lot_id: string;
  wallet_address: string;
  market_ticker: string;
  market_title: string;
  side: "YES" | "NO";
  mint: string;
  quantity: number;
  snapshot_price: number;
  snapshot_value_usdc: number;
  current_price: number | null;
  current_value: number | null;
  probability: number | null;
  max_ltv_bps: number;
  liquidation_threshold_bps: number;
  collateral_status: string;
  loan_id: string | null;
  loan_status: string | null;
  borrowed_amount_usdc: number;
  accrued_interest_usdc: number;
  health_factor: number | null;
  deposit_tx_signature: string | null;
  borrow_tx_signature: string | null;
  expires_at: string | null;
  resolution_time: number | null;
  custody_wallet: string;
  created_at: string;
  updated_at: string;
};

type OutcomeCollateralPositionsResponse = {
  success: boolean;
  positions: OutcomeCollateralPosition[];
};

export function useOutcomeCollateralPositions(walletAddress: string | null | undefined) {
  return useQuery({
    queryKey: ["outcomeCollateralPositions", walletAddress],
    queryFn: async (): Promise<OutcomeCollateralPosition[]> => {
      if (!walletAddress) return [];
      const search = new URLSearchParams({ wallet_address: walletAddress }).toString();
      const result = await cuspApiFetch<OutcomeCollateralPositionsResponse>(
        `/api/outcome-collateral/positions?${search}`
      );
      return result.positions ?? [];
    },
    enabled: !!walletAddress,
    refetchInterval: 20_000,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}
