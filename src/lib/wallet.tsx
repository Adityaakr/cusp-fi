import React, { useMemo, useCallback, createContext, useContext, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { VersionedTransaction } from "@solana/web3.js";
import { MAINNET_RPC_URL } from "@/lib/network-config";
import { X, LogOut, Copy, Check } from "lucide-react";


const WalletModalContext = createContext<{ open: () => void }>({
  open: () => {},
});

export function SolflareProviderWrapper({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={MAINNET_RPC_URL}>
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
  const { publicKey, connected, connecting, select, wallets, connect, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleConnect = async () => {
    const solflare = wallets.find((w) => w.adapter.name === "Solflare");
    if (!solflare) return;
    select(solflare.adapter.name);
    try {
      await connect();
      onClose();
    } catch {}
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
                <img src="/solflare-logo.webp" alt="Solflare" className="w-5 h-5 rounded-sm object-contain" />
                <div>
                  <span className="text-sm font-medium text-foreground block">Solflare</span>
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
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full flex items-center gap-3 p-3 bg-bg-1 border border-border rounded-md hover:border-active hover:bg-bg-3 transition-all text-left disabled:opacity-50"
            >
              <img src="/solflare-logo.webp" alt="Solflare" className="w-5 h-5 rounded-sm object-contain" />
              <span className="text-sm font-medium text-foreground">Solflare</span>
              {connecting && (
                <span className="ml-auto font-mono text-xs text-cusp-teal">Connecting...</span>
              )}
            </button>
            <p className="text-[10px] text-muted-foreground mt-4 text-center">
              By connecting, you agree to the Cusp Terms of Service
            </p>
          </div>
        )}
      </div>
    </div>
  );
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
          signAndSendTransaction: async (tx: VersionedTransaction) => {
            const signature = await sendTransaction(tx, connection);
            return signature;
          },
          signMessage: async (message: Uint8Array) => {
            return await signMessage!(message);
          },
        }
      : undefined;

  return {
    solana,
    isAvailable: connected && !!publicKey && !!signMessage,
  };
}

export function useModal() {
  const ctx = useContext(WalletModalContext);
  return { open: ctx.open };
}

export function ConnectBox() {
  return null;
}
