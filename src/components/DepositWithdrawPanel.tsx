import { useState } from "react";
import { usePhantom } from "@/lib/wallet";
import { useWithdraw } from "@/hooks/useWithdraw";
import { useMainnetDeposit } from "@/hooks/useMainnetDeposit";
import { useProtocolState } from "@/hooks/useProtocolState";
import { useUserPortfolio } from "@/hooks/useUserPortfolio";
import { SOLANA_NETWORK } from "@/lib/network-config";
import { Loader2, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

type Tab = "trading" | "withdraw";

const DepositWithdrawPanel = () => {
  const [tab, setTab] = useState<Tab>("trading");
  const [amount, setAmount] = useState("");
  const { isConnected } = usePhantom();
  const { state } = useProtocolState();
  const {
    deposit: mainnetDeposit,
    status: mainnetDepositStatus,
    error: mainnetDepositError,
    txSignature: mainnetDepositTx,
    reset: resetMainnetDeposit,
  } = useMainnetDeposit();
  const {
    withdraw,
    status: withdrawStatus,
    error: withdrawError,
    txSignature: withdrawTx,
    reset: resetWithdraw,
  } = useWithdraw();
  const { data: portfolio } = useUserPortfolio();

  const numAmount = parseFloat(amount) || 0;
  const exchangeRate = state?.cusdc_exchange_rate ?? 1.0;

  const depositStatus = mainnetDepositStatus;
  const depositError = mainnetDepositError;
  const depositTx = mainnetDepositTx;

  const isProcessing =
    (depositStatus !== "idle" && depositStatus !== "success" && depositStatus !== "error") ||
    (withdrawStatus !== "idle" && withdrawStatus !== "success" && withdrawStatus !== "error");

  const resetAll = () => {
    resetMainnetDeposit();
    resetWithdraw();
  };

  const handleAction = async () => {
    if (numAmount <= 0) return;
    resetAll();
    if (tab === "trading") {
      await mainnetDeposit(numAmount);
    } else {
      await withdraw(numAmount);
    }
    setAmount("");
  };

  const activeStatus = tab === "withdraw" ? withdrawStatus : depositStatus;
  const activeError = tab === "withdraw" ? withdrawError : depositError;
  const activeTx = tab === "withdraw" ? withdrawTx : depositTx;
  const explorerCluster = SOLANA_NETWORK === "devnet" ? "?cluster=devnet" : "";

  const statusLabel =
    activeStatus === "building"
      ? "Building transaction..."
      : activeStatus === "signing"
        ? "Sign in wallet..."
        : activeStatus === "confirming"
          ? "Confirming on-chain..."
          : null;

  const displayBalance =
    tab === "withdraw"
      ? portfolio?.total_cusdc ?? 0
      : portfolio?.mainnet_usdc_balance ?? 0;

  const balanceLabel =
    tab === "withdraw" ? "cUSDC Balance" : "Mainnet USDC";

  const balanceUnit = tab === "withdraw" ? "cUSDC" : "USDC";

  return (
    <div className="bg-bg-1 border border-border rounded-lg overflow-hidden">
      <div className="flex border-b border-border">
        {([
          { key: "trading" as Tab, label: "Trading" },
          { key: "withdraw" as Tab, label: "Withdraw" },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); resetAll(); }}
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
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {tab === "trading"
            ? "Deposit mainnet USDC to the trading pool. Used as margin for leveraged prediction market trades."
            : "Burn cUSDC to withdraw USDC from the vault at the current exchange rate."}
        </p>
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
            {tab === "withdraw" ? "Withdraw cUSDC" : "Deposit USDC"}
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
                  <span className="font-mono text-foreground">Instant (on-chain)</span>
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
            {tab === "withdraw" ? "Withdrawal processed!" : "Deposit successful!"}
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
                ? "Withdraw"
                : "Deposit to Trading Pool"}
        </button>
      </div>
    </div>
  );
};

export default DepositWithdrawPanel;
