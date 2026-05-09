import { useMemo, useState } from "react";
import { usePhantom } from "@/lib/wallet";
import { useUserPortfolio } from "@/hooks/useUserPortfolio";
import { useLendingPool, type LendingPoolState } from "@/hooks/useLendingPool";
import { useMainnetPoolLiquidity } from "@/hooks/useMainnetPoolLiquidity";
import { ExternalLink, Info, Loader2 } from "lucide-react";

type PoolMode = "supply" | "withdraw";

function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function MainnetPoolPanel({
  poolState,
}: {
  poolState: LendingPoolState | undefined;
}) {
  const [mode, setMode] = useState<PoolMode>("supply");
  const [amount, setAmount] = useState("");
  const { addresses, isConnected } = usePhantom();
  const { data: portfolio } = useUserPortfolio();
  const wallet =
    addresses?.find((address) => String(address.addressType || "").toLowerCase().includes("solana"))
      ?.address ?? null;
  const { supply, withdraw, status, error, txSignature, reset } = useMainnetPoolLiquidity(
    poolState?.poolPublicKey
  );
  const numericAmount = parseFloat(amount) || 0;
  const supplyBalance = portfolio?.mainnet_usdc_balance ?? 0;
  const withdrawBalance = poolState?.userPosition?.availableAmount ?? 0;
  const ctaDisabled =
    !isConnected ||
    !poolState?.poolPublicKey ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    status === "submitting" ||
    (mode === "supply" ? numericAmount > supplyBalance : numericAmount > withdrawBalance);

  const helperText = useMemo(() => {
    if (mode === "supply") {
      return "Supply real mainnet USDC into the outcome lending pool. Your LP balance stays withdrawable while liquidity is available.";
    }
    return "Withdraw your available LP USDC back to your wallet. Borrowed liquidity stays locked until loans are repaid.";
  }, [mode]);

  const handleSubmit = async () => {
    if (ctaDisabled) return;
    reset();
    if (mode === "supply") await supply(numericAmount);
    else await withdraw(numericAmount);
    setAmount("");
  };

  if (!poolState?.poolPublicKey) {
    return (
      <div className="bg-bg-1 border border-cusp-teal/25 rounded-xl p-4">
        <h4 className="text-xs font-medium text-cusp-teal uppercase tracking-wider mb-2">
          Mainnet LP Pool
        </h4>
        <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
          The borrow/lend backend is wired, but the dedicated mainnet pool signer has not been configured yet.
          Once that pool wallet is set, this section will allow real USDC supply and withdraw.
        </p>
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div className="rounded-md border border-border bg-bg-2 p-3">
            <span className="text-muted-foreground block mb-1">Wallet USDC</span>
            <span className="font-mono text-foreground">{supplyBalance.toFixed(2)} USDC</span>
          </div>
          <div className="rounded-md border border-border bg-bg-2 p-3">
            <span className="text-muted-foreground block mb-1">Pool liquidity</span>
            <span className="font-mono text-foreground">0.00 USDC</span>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-1.5 text-[10px] text-cusp-amber/90">
          <Info className="size-3 shrink-0 mt-px" />
          Mainnet LP actions stay disabled until the pool wallet is configured.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-1 border border-cusp-teal/25 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-medium text-cusp-teal uppercase tracking-wider">
          Mainnet LP Pool
        </h4>
        {poolState?.poolPublicKey ? (
          <a
            href={`https://solscan.io/account/${poolState.poolPublicKey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-cusp-teal hover:underline inline-flex items-center gap-1"
          >
            {shortenAddress(poolState.poolPublicKey)} <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>

      <div className="flex items-center bg-bg-2 rounded-md p-0.5 border border-border mb-3">
        {(["supply", "withdraw"] as const).map((nextMode) => (
          <button
            key={nextMode}
            type="button"
            onClick={() => {
              setMode(nextMode);
              setAmount("");
              reset();
            }}
            className={`flex-1 px-2.5 py-1 text-[10px] font-semibold rounded-[5px] transition-all ${
              mode === nextMode
                ? "bg-cusp-teal text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {nextMode === "supply" ? "Supply" : "Withdraw"}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{helperText}</p>

      <div className="grid grid-cols-2 gap-3 mb-3 text-[11px]">
        <div className="rounded-md border border-border bg-bg-2 p-3">
          <span className="text-muted-foreground block mb-1">
            {mode === "supply" ? "Wallet USDC" : "LP available"}
          </span>
          <span className="font-mono text-foreground">
            {(mode === "supply" ? supplyBalance : withdrawBalance).toFixed(2)} USDC
          </span>
        </div>
        <div className="rounded-md border border-border bg-bg-2 p-3">
          <span className="text-muted-foreground block mb-1">Pool liquidity</span>
          <span className="font-mono text-foreground">
            {(poolState?.availableLiquidity ?? 0).toFixed(2)} USDC
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              if (status !== "idle") reset();
            }}
            placeholder="0.00"
            className="w-full bg-bg-2 border border-border rounded-md px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-active transition-colors"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
            USDC
          </span>
        </div>

        {error && <p className="text-[11px] text-cusp-red">{error}</p>}
        {txSignature && (
          <a
            href={`https://solscan.io/tx/${txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-cusp-teal hover:underline inline-flex items-center gap-1"
          >
            View transaction <ExternalLink className="size-3" />
          </a>
        )}

        <button
          type="button"
          disabled={ctaDisabled}
          onClick={handleSubmit}
          className="w-full py-2.5 bg-cusp-teal text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {status === "submitting" && <Loader2 className="size-4 animate-spin" />}
          {mode === "supply" ? "Supply USDC" : "Withdraw USDC"}
        </button>
      </div>

      {!poolState?.poolPublicKey && (
        <div className="mt-3 flex items-start gap-1.5 text-[10px] text-cusp-amber/90">
          <Info className="size-3 shrink-0 mt-px" />
          Pool wallet is not configured yet, so deposits and withdraws are disabled.
        </div>
      )}
      {wallet && poolState?.userPosition && (
        <div className="mt-3 text-[10px] text-muted-foreground">
          LP position: {poolState.userPosition.depositedAmount.toFixed(2)} deposited ·{" "}
          {poolState.userPosition.lockedAmount.toFixed(2)} locked
        </div>
      )}
    </div>
  );
}
