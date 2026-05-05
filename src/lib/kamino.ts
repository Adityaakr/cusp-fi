import { KAMINO_API_BASE, KAMINO_VAULTS } from "./network-config";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { getMainnetConnection } from "./solana";

const steakhouseUsdc = KAMINO_VAULTS.steakhouseUsdc;

export interface KaminoVaultMetrics {
  address: string;
  name: string;
  tokenMint: string;
  sharesMint: string;
  tvl: number;
  apy: number;
  apyFarmRewards: number;
  sharePrice: number;
  totalShares: number;
  tokenAvailable: number;
  performanceFeeBps: number;
  managementFeeBps: number;
  minDepositAmount: number;
  minWithdrawAmount: number;
}

export interface KaminoUserPosition {
  vaultAddress: string;
  sharesBalance: number;
  tokenValue: number;
  unrealizedPnl: number;
  depositValue: number;
}

export async function fetchVaultMetrics(): Promise<KaminoVaultMetrics> {
  const url = `${KAMINO_API_BASE}/kvaults/vaults`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kamino API error: ${res.status}`);

  const vaults = await res.json();
  const vault = vaults.find(
    (v: Record<string, unknown>) => v.address === steakhouseUsdc.address
  );

  if (!vault) throw new Error("Steakhouse USDC vault not found");

  const state = vault.state ?? vault;
  const stats = vault.vaultStats ?? vault.stats ?? {};

  const apy = vault.apy ?? stats.apy ?? state.apy ?? 0;
  const apyFarmRewards = vault.apyFarmRewards ?? stats.apyFarmRewards ?? state.apyFarmRewards ?? 0;
  const tvl = vault.tvl ?? stats.tvl ?? state.tvl ?? 0;
  const sharePrice = vault.vaultShare ?? stats.vaultShare ?? state.vaultShare ?? 1;
  const totalShares = vault.sharesIssued ?? state.sharesIssued ?? 0;
  const tokenAvailable = vault.tokenAvailable ?? state.tokenAvailable ?? 0;
  const performanceFeeBps = state.performanceFeeBps ?? 500;
  const managementFeeBps = state.managementFeeBps ?? 0;
  const minDepositAmount = state.minDepositAmount ?? 100000;
  const minWithdrawAmount = state.minWithdrawAmount ?? 1000;

  return {
    address: steakhouseUsdc.address,
    name: state.name ?? "Kamino Steakhouse USDC",
    tokenMint: steakhouseUsdc.tokenMint,
    sharesMint: steakhouseUsdc.sharesMint,
    tvl: typeof tvl === "number" ? tvl : parseFloat(String(tvl)) || 0,
    apy: typeof apy === "number" ? apy : parseFloat(String(apy)) || 0,
    apyFarmRewards: typeof apyFarmRewards === "number" ? apyFarmRewards : parseFloat(String(apyFarmRewards)) || 0,
    sharePrice: typeof sharePrice === "number" ? sharePrice : parseFloat(String(sharePrice)) || 1,
    totalShares: typeof totalShares === "number" ? totalShares : parseFloat(String(totalShares)) || 0,
    tokenAvailable: typeof tokenAvailable === "number" ? tokenAvailable : parseFloat(String(tokenAvailable)) || 0,
    performanceFeeBps,
    managementFeeBps,
    minDepositAmount: typeof minDepositAmount === "number" ? minDepositAmount / 1e6 : 0.1,
    minWithdrawAmount: typeof minWithdrawAmount === "number" ? minWithdrawAmount / 1e6 : 0.001,
  };
}

export async function fetchUserPosition(
  walletAddress: string
): Promise<KaminoUserPosition | null> {
  const url = `${KAMINO_API_BASE}/kvaults/users/${walletAddress}/positions`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const positions = await res.json();
  const pos = Array.isArray(positions)
    ? positions.find(
        (p: Record<string, unknown>) =>
          p.vaultAddress === steakhouseUsdc.address ||
          p.kvault === steakhouseUsdc.address
      )
    : null;

  if (!pos) return null;

  return {
    vaultAddress: steakhouseUsdc.address,
    sharesBalance: parseFloat(String(pos.sharesBalance ?? pos.shares ?? 0)) || 0,
    tokenValue: parseFloat(String(pos.tokenValue ?? pos.tokenAmount ?? 0)) || 0,
    unrealizedPnl: parseFloat(String(pos.unrealizedPnl ?? pos.pnl ?? 0)) || 0,
    depositValue: parseFloat(String(pos.depositValue ?? pos.depositedAmount ?? 0)) || 0,
  };
}

export type KaminoTxStatus =
  | "idle"
  | "building"
  | "signing"
  | "confirming"
  | "success"
  | "error";

export async function buildKaminoDepositTx(
  walletAddress: string,
  amount: number
): Promise<VersionedTransaction> {
  const url = `${KAMINO_API_BASE}/ktx/kvault/deposit`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet: walletAddress,
      kvault: steakhouseUsdc.address,
      amount: String(amount),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(err.message ?? `Kamino deposit API error: ${res.status}`);
  }

  const { transaction: encodedTx } = await res.json();
  const txBuffer = Buffer.from(encodedTx, "base64");
  return VersionedTransaction.deserialize(txBuffer);
}

export async function buildKaminoWithdrawTx(
  walletAddress: string,
  sharesAmount: number
): Promise<VersionedTransaction> {
  const url = `${KAMINO_API_BASE}/ktx/kvault/withdraw`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet: walletAddress,
      kvault: steakhouseUsdc.address,
      amount: String(sharesAmount),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(err.message ?? `Kamino withdraw API error: ${res.status}`);
  }

  const { transaction: encodedTx } = await res.json();
  const txBuffer = Buffer.from(encodedTx, "base64");
  return VersionedTransaction.deserialize(txBuffer);
}

export async function signAndSendKaminoTx(
  tx: VersionedTransaction,
  sendTransaction: (tx: VersionedTransaction, connection: unknown) => Promise<string>
): Promise<string> {
  const connection = getMainnetConnection();
  const signature = await sendTransaction(tx, connection);
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

export { steakhouseUsdc as KAMINO_STEAKHOUSE_USDC };