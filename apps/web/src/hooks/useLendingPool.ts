import { useQuery } from "@tanstack/react-query";
import { cuspApiFetch } from "@/lib/cusp-api";
import { isTestnet } from "@/lib/network-config";

export type PoolStatus = "devnet_demo" | "capped_beta" | "mainnet_live";

export interface LendingPoolState {
  poolStatus: PoolStatus;
  poolStatusLabel: string;
  asset: "USDC";
  totalPoolSize: number;
  availableLiquidity: number;
  totalBorrowed: number;
  utilizationRate: number;
  lenderApyPlaceholder: number;
  borrowRateApr: number;
  activeLoans: number;
  poolPublicKey: string | null;
  poolReady: boolean;
  onchainBalance: number;
  userPosition?: {
    depositedAmount: number;
    availableAmount: number;
    lockedAmount: number;
    earnedFees: number;
  } | null;
}

const BASE_BORROW_APR = 8.0;
const TARGET_LENDER_APY = 19.4;

type PoolApiResponse = {
  success: boolean;
  pool_slug?: string;
  pool_public_key?: string;
  total_deposited?: number;
  available_liquidity?: number;
  borrowed_liquidity?: number;
  onchain_balance?: number;
  active_loans?: number;
  user_position?: {
    deposited_amount: number;
    available_amount: number;
    locked_amount: number;
    earned_fees: number;
  } | null;
};

async function fetchLendingPoolState(walletAddress?: string | null): Promise<LendingPoolState> {
  const search = new URLSearchParams();
  if (walletAddress) search.set("wallet_address", walletAddress);
  const result = await cuspApiFetch<PoolApiResponse>(
    `/api/mainnet-pool/state${search.toString() ? `?${search.toString()}` : ""}`
  );

  const totalPoolSize = Number(result.total_deposited ?? 0);
  const totalBorrowed = Number(result.borrowed_liquidity ?? 0);
  const availableLiquidity = Number(result.available_liquidity ?? 0);
  const utilizationRate = totalPoolSize > 0 ? totalBorrowed / totalPoolSize : 0;
  const lenderApyPlaceholder = TARGET_LENDER_APY;
  const poolReady = Boolean(result.pool_public_key);

  return {
    poolStatus: poolReady ? (isTestnet ? "capped_beta" : "mainnet_live") : "capped_beta",
    poolStatusLabel: poolReady
      ? isTestnet
        ? "Mainnet Beta Pool"
        : "Mainnet Live Pool"
      : "Pool Setup Pending",
    asset: "USDC",
    totalPoolSize,
    availableLiquidity,
    totalBorrowed,
    utilizationRate,
    lenderApyPlaceholder,
    borrowRateApr: BASE_BORROW_APR,
    activeLoans: Number(result.active_loans ?? 0),
    poolPublicKey: result.pool_public_key ?? null,
    poolReady,
    onchainBalance: Number(result.onchain_balance ?? 0),
    userPosition: result.user_position
      ? {
          depositedAmount: Number(result.user_position.deposited_amount ?? 0),
          availableAmount: Number(result.user_position.available_amount ?? 0),
          lockedAmount: Number(result.user_position.locked_amount ?? 0),
          earnedFees: Number(result.user_position.earned_fees ?? 0),
        }
      : null,
  };
}

export function useLendingPool(walletAddress?: string | null) {
  return useQuery({
    queryKey: ["lendingPool", walletAddress ?? "anon"],
    queryFn: () => fetchLendingPoolState(walletAddress),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
}
