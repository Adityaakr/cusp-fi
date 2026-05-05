import { useQuery } from "@tanstack/react-query";
import { fetchVaultMetrics, fetchUserPosition } from "@/lib/kamino";
import { usePhantom } from "@/lib/wallet";

export function useKaminoVault() {
  const query = useQuery({
    queryKey: ["kaminoVault"],
    queryFn: fetchVaultMetrics,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return {
    ...query,
    vault: query.data ?? null,
    apy: query.data?.apy ?? 0,
    tvl: query.data?.tvl ?? 0,
    sharePrice: query.data?.sharePrice ?? 1,
  };
}

export function useKaminoPosition() {
  const { addresses } = usePhantom();
  const solanaAddress = addresses?.find((a) =>
    String(a.addressType || "").toLowerCase().includes("solana")
  )?.address;

  const query = useQuery({
    queryKey: ["kaminoPosition", solanaAddress],
    queryFn: () => fetchUserPosition(solanaAddress!),
    enabled: !!solanaAddress,
    refetchInterval: 30_000,
  });

  return {
    ...query,
    position: query.data ?? null,
    sharesBalance: query.data?.sharesBalance ?? 0,
    tokenValue: query.data?.tokenValue ?? 0,
  };
}