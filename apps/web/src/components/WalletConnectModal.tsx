import { useState } from "react";
import { X } from "lucide-react";

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const wallets = [
  { name: "Solflare", icon: "\u2600\uFE0F" },
  { name: "Phantom", icon: "\uD83D\uDC7B" },
  { name: "Backpack", icon: "\uD83C\uDF92" },
  { name: "Ledger", icon: "\uD83D\uDD10" },
];

const WalletConnectModal = ({ isOpen, onClose }: WalletConnectModalProps) => {
  const [connecting, setConnecting] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnect = (wallet: string) => {
    setConnecting(wallet);
    setTimeout(() => {
      setConnecting(null);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-2 border border-border rounded-lg p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-medium text-foreground">Connect Wallet</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          {wallets.map((wallet) => (
            <button
              key={wallet.name}
              onClick={() => handleConnect(wallet.name)}
              disabled={connecting !== null}
              className="w-full flex items-center gap-3 p-3 bg-bg-1 border border-border rounded-md hover:border-active hover:bg-bg-3 transition-all text-left disabled:opacity-50"
            >
              <span className="text-xl">{wallet.icon}</span>
              <span className="text-sm font-medium text-foreground">{wallet.name}</span>
              {connecting === wallet.name && (
                <span className="ml-auto font-mono text-xs text-cusp-teal">Connecting...</span>
              )}
            </button>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground mt-4 text-center">
          By connecting, you agree to the Cusp Terms of Service
        </p>
      </div>
    </div>
  );
};

export default WalletConnectModal;
