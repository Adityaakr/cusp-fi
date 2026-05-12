import React, { useMemo, useCallback, createContext, useContext, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { SOLANA_RPC_URL } from "@/lib/network-config";
import { X, LogOut, Copy, Check } from "lucide-react";


const WalletModalContext = createContext<{ open: () => void }>({
  open: () => {},
});

export function SolflareProviderWrapper({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      // Keep the wallet adapter network-neutral. /vault uses devnet while
      // /markets and /lend send mainnet transactions from the same app session.
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={SOLANA_RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function WalletModalProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  return (
    <WalletModalContext.Provider value={{ open }}>
      {children}
      <WalletModal isOpen={visible} onClose={close} />
    </WalletModalContext.Provider>
  );
}

function WalletModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { publicKey, connected, connecting, select, wallets, wallet, connect, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);
  const [pendingWalletName, setPendingWalletName] = useState<string | null>(null);

  const supportedWallets = wallets.filter(
    (entry) => entry.adapter.name === "Phantom" || entry.adapter.name === "Solflare"
  );

  if (!isOpen) return null;

  const handleConnect = async (walletName: string) => {
    const target = supportedWallets.find((w) => w.adapter.name === walletName);
    if (!target || connecting) return;

    try {
      setPendingWalletName(target.adapter.name);

      if (wallet?.adapter.name && wallet.adapter.name !== target.adapter.name && connected) {
        await disconnect().catch(() => undefined);
      }

      if (wallet?.adapter.name !== target.adapter.name) {
        select(target.adapter.name);
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }

      await connect();
      onClose();
    } catch {
      // ignore wallet popup / user rejection here; UI stays interactive
    } finally {
      setPendingWalletName(null);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch {}
    onClose();
  };

  const handleCopy = async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const truncatedAddr = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";
  const connectedWalletName = wallet?.adapter.name ?? "Wallet";

  const walletAccent = (name: string) => {
    if (name === "Phantom") return "bg-[#AB9FF2] text-[#2b214f]";
    return "bg-cusp-teal/20 text-cusp-teal";
  };

  const walletBadge = (name: string) => {
    if (name === "Phantom") return "P";
    return "S";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-2 border border-border rounded-lg p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-medium text-foreground">
            {connected ? "Wallet" : "Connect Wallet"}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {connected ? (
          <div className="space-y-4">
            <div className="bg-bg-1 border border-border rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {connectedWalletName === "Solflare" ? (
                  <img src="/solflare-logo.webp" alt="Solflare" className="w-5 h-5 rounded-sm object-contain" />
                ) : (
                  <div className={`flex size-5 items-center justify-center rounded-full text-[10px] font-semibold ${walletAccent(connectedWalletName)}`}>
                    {walletBadge(connectedWalletName)}
                  </div>
                )}
                <div>
                  <span className="text-sm font-medium text-foreground block">{connectedWalletName}</span>
                  <span className="font-mono text-xs text-muted-foreground">{truncatedAddr}</span>
                </div>
              </div>
              <button
                onClick={handleCopy}
                className="text-muted-foreground hover:text-cusp-teal transition-colors p-1"
                title="Copy address"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center gap-3 p-3 bg-bg-1 border border-border rounded-md hover:border-cusp-red/40 hover:bg-bg-3 transition-all text-left"
            >
              <LogOut size={16} className="text-cusp-red" />
              <span className="text-sm font-medium text-cusp-red">Disconnect</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {supportedWallets.map(({ adapter }) => (
              <button
                key={adapter.name}
                onClick={() => handleConnect(adapter.name)}
                disabled={connecting}
                className="w-full flex items-center gap-3 p-3 bg-bg-1 border border-border rounded-md hover:border-active hover:bg-bg-3 transition-all text-left disabled:opacity-50"
              >
                {adapter.name === "Solflare" ? (
                  <img src="/solflare-logo.webp" alt="Solflare" className="w-5 h-5 rounded-sm object-contain" />
                ) : (
                  <div className={`flex size-5 items-center justify-center rounded-full text-[10px] font-semibold ${walletAccent(adapter.name)}`}>
                    {walletBadge(adapter.name)}
                  </div>
                )}
                <span className="text-sm font-medium text-foreground">{adapter.name}</span>
                {(connecting || pendingWalletName === adapter.name) && (
                  <span className="ml-auto font-mono text-xs text-cusp-teal">Connecting...</span>
                )}
              </button>
            ))}
            <p className="text-[10px] text-muted-foreground mt-4 text-center">
              By connecting, you agree to the Cusp Terms of Service
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function flattenWalletError(error: unknown): string {
  const seen = new Set<unknown>();

  const collect = (value: unknown): string[] => {
    if (!value || seen.has(value)) return [];
    if (typeof value !== "object") {
      return typeof value === "string" && value.trim() ? [value.trim()] : [];
    }

    seen.add(value);
    const candidate = value as {
      name?: string;
      message?: string;
      cause?: unknown;
      error?: unknown;
      logs?: unknown;
    };

    const parts: string[] = [];
    if (candidate.message && candidate.message.trim()) parts.push(candidate.message.trim());
    if (Array.isArray(candidate.logs)) {
      for (const log of candidate.logs) {
        if (typeof log === "string" && log.trim()) parts.push(log.trim());
      }
    }

    parts.push(...collect(candidate.cause));
    parts.push(...collect(candidate.error));
    return parts;
  };

  const messages = [...new Set(collect(error).filter(Boolean))];
  return messages.join(" | ") || "Wallet transaction failed";
}

export function usePhantom() {
  const { publicKey, connected, connecting } = useWallet();

  return {
    isConnected: connected,
    isLoading: connecting,
    addresses: publicKey
      ? [{ address: publicKey.toBase58(), addressType: "solana" }]
      : undefined,
  };
}

export function useSolana() {
  const { publicKey, connected, sendTransaction, signMessage } = useWallet();
  const { connection } = useConnection();

  const solana =
    publicKey && connected
      ? {
          signAndSendTransaction: async (
        tx: Transaction | VersionedTransaction,
        targetConnection?: Connection
      ) => {
            try {
              return await sendTransaction(tx, targetConnection ?? connection);
            } catch (error) {
              throw new Error(flattenWalletError(error));
            }
          },
          signMessage: async (message: Uint8Array) => {
            return await signMessage!(message);
          },
        }
      : undefined;

  return {
    solana,
    isAvailable: connected && !!publicKey,
  };
}

export function useModal() {
  const ctx = useContext(WalletModalContext);
  return { open: ctx.open };
}

export function ConnectBox() {
  return null;
}
