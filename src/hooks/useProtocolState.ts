import { useQuery } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import { getConnection, getMainnetVaultUsdcBalance } from "@/lib/solana";
import { fetchVaultMetrics } from "@/lib/kamino";

const VAULT_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_VAULT_PROGRAM_ID || "EtGTQ9pmcnkYtTdorACENJPBmYVeWo8vrDzH7kU1K7DQ"
);

const [VAULT_STATE] = PublicKey.findProgramAddressSync([Buffer.from("vault")], VAULT_PROGRAM_ID);

export interface ProtocolState {
  total_tvl: number;
  cusdc_exchange_rate: number;
  reserve_usdc: number;
  deployed_usdc: number;
  total_cusdc_supply: number;
  is_paused: boolean;
  /** Vault keypair's mainnet USDT balance — real capital for leveraged trades */
  mainnet_reserve: number;
  /** Unified TVL = devnet vault + mainnet reserve + Kamino vault */
  unified_tvl: number;
  /** Kamino vault TVL (USDC in Steakhouse vault) */
  kamino_reserve: number;
  /** Kamino vault APY */
  kamino_apy: number;
}

/**
 * Deserialize VaultState from on-chain account data.
 *
 * Layout (after 8-byte Anchor discriminator):
 *   admin:              Pubkey  (32 bytes)
 *   usdc_mint:          Pubkey  (32 bytes)
 *   cusdc_mint:         Pubkey  (32 bytes)
 *   vault_usdc_account: Pubkey  (32 bytes)
 *   total_usdc_managed: u64    (8 bytes)
 *   total_cusdc_supply: u64    (8 bytes)
 *   total_deployed:     u64    (8 bytes)
 *   bump:               u8     (1 byte)
 *   cusdc_mint_bump:    u8     (1 byte)
 *   is_paused:          bool   (1 byte)
 */
function parseVaultState(data: Buffer): Omit<ProtocolState, "mainnet_reserve" | "unified_tvl"> {
  const offset = 8; // skip Anchor discriminator
  // Skip 4 pubkeys (4 * 32 = 128 bytes)
  const totalUsdcManaged = Number(data.readBigUInt64LE(offset + 128));
  const totalCusdcSupply = Number(data.readBigUInt64LE(offset + 136));

  // The on-chain struct may or may not include total_deployed depending on
  // which version was deployed.  155 bytes = no total_deployed field.
  const hasDeployed = data.length >= 8 + 128 + 24 + 3; // 163 bytes
  let totalDeployed = 0;
  let isPaused = false;

  if (hasDeployed) {
    // Full struct: total_usdc(8) + total_cusdc(8) + total_deployed(8) + bump(1) + cusdc_bump(1) + paused(1)
    totalDeployed = Number(data.readBigUInt64LE(offset + 144));
    isPaused = data[offset + 154] === 1; // 128 + 24 + 2 bumps
  } else {
    // Older struct without total_deployed: total_usdc(8) + total_cusdc(8) + bump(1) + cusdc_bump(1) + paused(1)
    isPaused = data[offset + 146] === 1; // 128 + 16 + 2 bumps
  }

  // Convert from atomic (6 decimals) to human-readable
  const totalUsdcHuman = totalUsdcManaged / 1e6;
  const totalCusdcHuman = totalCusdcSupply / 1e6;
  const deployedHuman = totalDeployed / 1e6;

  // Exchange rate: total_usdc / total_cusdc (or 1.0 if no supply)
  const exchangeRate =
    totalCusdcHuman > 0 ? totalUsdcHuman / totalCusdcHuman : 1.0;

  return {
    total_tvl: totalUsdcHuman,
    cusdc_exchange_rate: exchangeRate,
    reserve_usdc: totalUsdcHuman - deployedHuman,
    deployed_usdc: deployedHuman,
    total_cusdc_supply: totalCusdcHuman,
    is_paused: isPaused,
  };
}

async function fetchProtocolState(): Promise<ProtocolState | null> {
  const [accountInfoResult, mainnetResult, kaminoResult] = await Promise.allSettled([
    getConnection().getAccountInfo(VAULT_STATE),
    getMainnetVaultUsdcBalance(),
    fetchVaultMetrics(),
  ]);

  const accountInfo = accountInfoResult.status === "fulfilled" ? accountInfoResult.value : null;
  const mainnetReserve = mainnetResult.status === "fulfilled" ? mainnetResult.value : 0;
  const kaminoVault = kaminoResult.status === "fulfilled" ? kaminoResult.value : null;
  const kaminoReserve = kaminoVault?.tvl ?? 0;
  const kaminoApy = kaminoVault?.apy ?? 0;

  console.log("[protocolState] devnet vault found:", !!accountInfo?.data, "| mainnet reserve:", mainnetReserve, "| kamino TVL:", kaminoReserve);

  if (accountInfoResult.status === "rejected") {
    console.warn("[protocolState] Failed to fetch devnet vault:", accountInfoResult.reason);
  }
  if (kaminoResult.status === "rejected") {
    console.warn("[protocolState] Failed to fetch Kamino vault:", kaminoResult.reason);
  }

  if (!accountInfo || !accountInfo.data) {
    return {
      total_tvl: 0,
      cusdc_exchange_rate: 1.0,
      reserve_usdc: 0,
      deployed_usdc: 0,
      total_cusdc_supply: 0,
      is_paused: false,
      mainnet_reserve: mainnetReserve,
      unified_tvl: mainnetReserve + kaminoReserve,
      kamino_reserve: kaminoReserve,
      kamino_apy: kaminoApy,
    };
  }

  try {
    const state = parseVaultState(Buffer.from(accountInfo.data));
    return {
      ...state,
      mainnet_reserve: mainnetReserve,
      unified_tvl: state.total_tvl + mainnetReserve + kaminoReserve,
      kamino_reserve: kaminoReserve,
      kamino_apy: kaminoApy,
    };
  } catch (err) {
    console.warn("[protocolState] Failed to parse vault state, using mainnet reserve only:", err);
    return {
      total_tvl: 0,
      cusdc_exchange_rate: 1.0,
      reserve_usdc: 0,
      deployed_usdc: 0,
      total_cusdc_supply: 0,
      is_paused: false,
      mainnet_reserve: mainnetReserve,
      unified_tvl: mainnetReserve + kaminoReserve,
      kamino_reserve: kaminoReserve,
      kamino_apy: kaminoApy,
    };
  }
}

export function useProtocolState() {
  const query = useQuery({
    queryKey: ["protocolState"],
    queryFn: fetchProtocolState,
    refetchInterval: 30_000,
  });

  const state = query.data;
  const reserveRatio =
    state && state.total_tvl > 0
      ? state.reserve_usdc / state.total_tvl
      : 0;
  const deployedRatio =
    state && state.total_tvl > 0
      ? state.deployed_usdc / state.total_tvl
      : 0;

  if (query.error) {
    console.error("[protocolState] Query error:", query.error);
  }

  return {
    ...query,
    state,
    reserveRatio,
    deployedRatio,
  };
}
