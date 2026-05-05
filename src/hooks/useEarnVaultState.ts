import { useQuery } from "@tanstack/react-query";
import { getEarnVaultState, type EarnVaultState } from "@/lib/solana";

export function useEarnVaultState() {
  const query = useQuery<EarnVaultState | null>({
    queryKey: ["earnVaultState"],
    queryFn: getEarnVaultState,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const state = query.data;

  return {
    ...query,
    state,
    totalUsdcBalance: state?.totalUsdcBalance ?? 0,
    totalCusdtSupply: state?.totalCusdtSupply ?? 0,
    exchangeRate: state?.exchangeRate ?? 1.0,
    kaminoApyBps: state?.kaminoApyBps ?? 0,
    kaminoApy: state ? state.kaminoApyBps / 100 : 0,
    performanceFeeBps: state?.performanceFeeBps ?? 500,
    isPaused: state?.isPaused ?? false,
    cusdtMint: state?.cusdtMint ?? null,
    vaultUsdcAccount: state?.vaultUsdcAccount ?? null,
  };
}