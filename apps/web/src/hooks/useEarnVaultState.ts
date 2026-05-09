import { useQuery } from "@tanstack/react-query";
import { usePhantom } from "@/lib/wallet";
import { CUSDT_MINT_PDA, getEarnVaultConnection, getEarnVaultState, type EarnVaultState } from "@/lib/solana";
import { getAccount, getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

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

export interface EarnVaultPosition {
  sharesBalance: number;
  tokenValue: number;
}

async function fetchEarnVaultPosition(walletAddress: string): Promise<EarnVaultPosition | null> {
  const [state, userCusdtAta, connection] = await Promise.all([
    getEarnVaultState(),
    getAssociatedTokenAddress(
      CUSDT_MINT_PDA,
      new PublicKey(walletAddress),
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
    Promise.resolve(getEarnVaultConnection()),
  ]);

  if (!state) return null;

  try {
    const account = await getAccount(connection, userCusdtAta);
    const sharesBalance = Number(account.amount) / 1e6;
    return {
      sharesBalance,
      tokenValue: sharesBalance * state.exchangeRate,
    };
  } catch {
    return {
      sharesBalance: 0,
      tokenValue: 0,
    };
  }
}

export function useEarnVaultPosition() {
  const { addresses } = usePhantom();
  const solanaAddress = addresses?.find((a) =>
    String(a.addressType || "").toLowerCase().includes("solana")
  )?.address;

  const query = useQuery({
    queryKey: ["earnVaultPosition", solanaAddress],
    queryFn: () => fetchEarnVaultPosition(solanaAddress!),
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
