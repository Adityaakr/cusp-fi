import { useQuery } from "@tanstack/react-query";
import { cuspApiFetch } from "@/lib/cusp-api";

export type OutcomeLoanRow = {
  id: string;
  status: string;
  borrowed_amount_usdc: number;
  health_factor: number | null;
  max_ltv_bps: number;
  liquidation_threshold_bps: number;
  collateral_value_usdc: number;
  market_ticker: string;
  side: "YES" | "NO";
  expires_at: string | null;
  resolution_time: number | null;
};

export function useOutcomeLoans(walletAddress: string | null | undefined) {
  return useQuery({
    queryKey: ["outcomeLoans", walletAddress],
    queryFn: async (): Promise<OutcomeLoanRow[]> => {
      if (!walletAddress) return [];
      const search = new URLSearchParams({ wallet_address: walletAddress }).toString();
      const result = await cuspApiFetch<{ success: boolean; loans: OutcomeLoanRow[] }>(
        `/api/outcome-loans?${search}`
      );
      return result.loans ?? [];
    },
    enabled: !!walletAddress,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
