import { useState } from "react";
import { usePhantom } from "@/lib/wallet";
import { useMainnetDeposit } from "@/hooks/useMainnetDeposit";
import { useDeposit } from "@/hooks/useDeposit";
import { useWithdraw } from "@/hooks/useWithdraw";
import { useKaminoVault } from "@/hooks/useKaminoVault";
import { useProtocolState } from "@/hooks/useProtocolState";
import { useUserPortfolio } from "@/hooks/useUserPortfolio";
import { SOLANA_NETWORK, isTestnet } from "@/lib/network-config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  Info,
} from "lucide-react";

type Tab = "trading" | "earn" | "withdraw";

const DepositWithdrawPanel = () => {
  const [tab, setTab] = useState<Tab>(isTestnet ? "earn" : "trading");
  const [amount, setAmount] = useState("");
  const { isConnected } = usePhantom();
  const { state } = useProtocolState();
  const { vault: kaminoVault, apy: kaminoApy } = useKaminoVault();
  const {
    deposit: vaultDeposit,
    status: vaultDepositStatus,
    error: vaultDepositError,
    txSignature: vaultDepositTx,
    reset: resetVaultDeposit,
  } = useDeposit();
  const {
    withdraw: vaultWithdraw,
    status: vaultWithdrawStatus,
    error: vaultWithdrawError,
    txSignature: vaultWithdrawTx,
    reset: resetVaultWithdraw,
  } = useWithdraw();
  const {
    deposit: mainnetDeposit,
    status: mainnetDepositStatus,
    error: mainnetDepositError,
    txSignature: mainnetDepositTx,
    reset: resetMainnetDeposit,
  } = useMainnetDeposit();
  const { data: portfolio } = useUserPortfolio();

  const numAmount = parseFloat(amount) || 0;
  const exchangeRate = state?.cusdc_exchange_rate ?? 1.0;

  const isProcessing =
    (vaultDepositStatus !== "idle" && vaultDepositStatus !== "success" && vaultDepositStatus !== "error") ||
    (vaultWithdrawStatus !== "idle" && vaultWithdrawStatus !== "success" && vaultWithdrawStatus !== "error") ||
    (mainnetDepositStatus !== "idle" && mainnetDepositStatus !== "success" && mainnetDepositStatus !== "error");

  const resetAll = () => {
    resetMainnetDeposit();
    resetVaultDeposit();
    resetVaultWithdraw();
  };

  const handleAction = async () => {
    if (numAmount <= 0) return;
    resetAll();
    if (isTestnet) {
      if (tab === "earn") {
        await vaultDeposit(numAmount);
      } else {
        await vaultWithdraw(numAmount);
      }
    } else if (tab === "trading") {
      await mainnetDeposit(numAmount);
    } else {
      if (tab === "earn") {
        await vaultDeposit(numAmount);
      } else {
        await vaultWithdraw(numAmount);
      }
    }
    setAmount("");
  };

  const activeStatus =
    tab === "trading"
      ? mainnetDepositStatus
      : tab === "withdraw"
        ? vaultWithdrawStatus
        : vaultDepositStatus;
  const activeError =
    tab === "trading"
      ? mainnetDepositError
      : tab === "withdraw"
        ? vaultWithdrawError
        : vaultDepositError;
  const activeTx =
    tab === "trading"
      ? mainnetDepositTx
      : tab === "withdraw"
        ? vaultWithdrawTx
        : vaultDepositTx;
  const explorerCluster = SOLANA_NETWORK === "devnet" ? "?cluster=devnet" : "";

  const demoStatusLabel =
    activeStatus === "building"
      ? "Building transaction..."
      : activeStatus === "signing"
        ? "Sign in wallet..."
        : activeStatus === "confirming"
          ? "Confirming on-chain..."
          : null;

  const statusLabel =
    demoStatusLabel
      ? demoStatusLabel
      : activeStatus === "building"
        ? "Building transaction..."
        : activeStatus === "signing"
          ? "Sign in wallet..."
          : activeStatus === "confirming"
            ? "Confirming on-chain..."
            : null;

  const displayBalance =
    tab === "withdraw"
      ? (portfolio?.total_cusdc ?? 0)
      : tab === "earn"
        ? (isTestnet ? (portfolio?.usdc_balance ?? 0) : (portfolio?.mainnet_usdc_balance ?? 0))
        : (portfolio?.mainnet_usdt_balance ?? 0);

  const balanceLabel =
    tab === "withdraw" ? "cUSDC Balance" : tab === "earn" ? (isTestnet ? "Devnet USDC Balance" : "USDC Balance") : "USDT Balance";

  const balanceUnit = tab === "withdraw" ? "cUSDC" : tab === "earn" ? "USDC" : "USDT";

  return (
    <div className="bg-bg-1 border border-border rounded-lg overflow-hidden">
      <div className="flex border-b border-border">
        {(isTestnet
          ? ([
              { key: "earn" as Tab, label: "Vault Demo" },
              { key: "withdraw" as Tab, label: "Withdraw" },
            ] as Array<{ key: Tab; label: string }>)
          : ([
              { key: "trading" as Tab, label: "Trading" },
              { key: "earn" as Tab, label: `Vault${kaminoApy > 0 ? ` ${kaminoApy.toFixed(1)}%` : ""}` },
              { key: "withdraw" as Tab, label: "Withdraw" },
            ] as Array<{ key: Tab; label: string }>)).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); resetAll(); setAmount(""); }}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              tab === key
                ? "text-cusp-teal border-b-2 border-cusp-teal bg-bg-2"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-3 pb-0">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {isTestnet
              ? tab === "earn"
                ? "Live devnet demo: deposit devnet USDC into the deployed Cusp vault contract and mint cUSDC. Production routing to Kamino is shown as strategy preview only."
                : "Live devnet demo: burn cUSDC and redeem devnet USDC from the deployed Cusp vault contract."
              : tab === "trading"
                ? "Deposit USDT to the trading pool. Used as margin for leveraged prediction market trades."
              : tab === "earn"
                  ? `Deposit USDC into the Cusp vault and receive cUSDC. Vault yield is managed through Kamino at ~${kaminoApy.toFixed(1)}% APY.`
                  : "Burn cUSDC and withdraw USDC from the Cusp vault."}
          </p>
          {isTestnet && (
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-cusp-teal hover:bg-bg-2 transition-colors"
                >
                  <Info className="size-3" />
                  Prod Flow
                </button>
              </DialogTrigger>
              <DialogContent className="bg-bg-1 border-border max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Production Flow Preview</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-xs text-muted-foreground">
                  <p>Production UX will be one managed flow:</p>
                  <p className="font-mono text-foreground">Deposit USDC → Cusp vault → cUSDC receipts → Strategy capital managed via Kamino</p>
                  <p>For devnet, the live piece we can honestly demo today is the deployed Cusp vault contract using devnet USDC and cUSDC receipts.</p>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {isConnected && portfolio && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{balanceLabel}</span>
            <button
              onClick={() => setAmount(String(displayBalance))}
              className="font-mono text-foreground hover:text-cusp-teal transition-colors"
              title="Click to use max"
            >
              {displayBalance.toLocaleString(undefined, {
                maximumFractionDigits: tab === "withdraw" ? 4 : 2,
              })}{" "}
              {balanceUnit}
              <span className="ml-1 text-[10px] text-cusp-teal uppercase">max</span>
            </button>
          </div>
        )}

        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">
            {tab === "withdraw" ? "Withdraw cUSDC" : tab === "earn" ? "Deposit USDC" : "Deposit USDT"}
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={isProcessing}
              className="w-full bg-bg-2 border border-border rounded-md px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-active transition-colors disabled:opacity-50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
              {balanceUnit}
            </span>
          </div>
        </div>

        {numAmount > 0 && (
          <div className="space-y-2 p-3 bg-bg-2 rounded-md">
            {tab === "trading" ? (
              <>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Network</span>
                  <span className="font-mono text-foreground">Solana Mainnet</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Destination</span>
                  <span className="font-mono text-foreground">Cusp Trading Pool</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Available for</span>
                  <span className="font-mono text-cusp-amber">Leveraged trades</span>
                </div>
              </>
            ) : tab === "earn" ? (
              <>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Network</span>
                  <span className="font-mono text-foreground">{isTestnet ? "Solana Devnet" : "Solana Mainnet"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Flow</span>
                  <span className="font-mono text-foreground flex items-center gap-1">
                    {isTestnet ? (
                      <>
                        USDC <ArrowRight className="size-2.5" /> Cusp Vault <ArrowRight className="size-2.5" /> cUSDC
                      </>
                    ) : (
                      <>
                        USDC <ArrowRight className="size-2.5" /> Cusp Vault <ArrowRight className="size-2.5" /> cUSDC
                      </>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Est. APY</span>
                  <span className="font-mono text-cusp-teal">{kaminoApy.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{isTestnet ? "Demo Mode" : "Perf. Fee"}</span>
                  <span className="font-mono text-foreground">{isTestnet ? "Live contract" : kaminoVault ? `${(kaminoVault.performanceFeeBps / 100).toFixed(1)}%` : "5.0%"}</span>
                </div>
                {(portfolio?.total_cusdc ?? 0) > 0 && (
                  <div className="flex justify-between text-xs pt-1 border-t border-border">
                    <span className="text-muted-foreground">Current position</span>
                    <span className="font-mono text-cusp-teal">${((portfolio?.total_cusdc ?? 0) * exchangeRate).toFixed(2)}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">You'll receive</span>
                  <span className="font-mono text-foreground">
                    {(numAmount * exchangeRate).toFixed(4)} USDC
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-mono text-foreground">Live vault redemption</span>
                </div>
              </>
            )}
          </div>
        )}

        {statusLabel && (
          <div className="flex items-center gap-2 text-xs text-cusp-teal">
            <Loader2 className="size-3 animate-spin" />
            {statusLabel}
          </div>
        )}

        {activeStatus === "success" && (
          <div className="flex items-center gap-2 text-xs text-cusp-green">
            <CheckCircle className="size-3" />
            {isTestnet
              ? tab === "withdraw"
                ? "Devnet withdrawal processed!"
                : "Devnet vault deposit successful!"
              : tab === "withdraw"
                ? "Vault withdrawal processed!"
                : tab === "earn"
                  ? "Vault deposit successful!"
                  : "Deposit successful!"}
            {activeTx && (
              <a
                href={`https://solscan.io/tx/${activeTx}${explorerCluster}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-cusp-teal hover:underline"
              >
                View <ExternalLink className="size-2.5" />
              </a>
            )}
          </div>
        )}

        {activeError && (
          <div className="flex items-center gap-2 text-xs text-cusp-red">
            <AlertCircle className="size-3" />
            {activeError}
          </div>
        )}

        <button
          onClick={handleAction}
          disabled={!isConnected || isProcessing || numAmount <= 0}
          className="w-full py-2.5 bg-cusp-teal text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity glow-teal-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!isConnected
            ? "Connect Wallet"
            : isProcessing
              ? "Processing..."
              : tab === "withdraw"
                ? "Withdraw USDC"
                : tab === "earn"
                  ? isTestnet ? "Deposit to Devnet Vault" : "Deposit to Vault"
                  : "Deposit to Trading Pool"}
        </button>
      </div>
    </div>
  );
};

export default DepositWithdrawPanel;
