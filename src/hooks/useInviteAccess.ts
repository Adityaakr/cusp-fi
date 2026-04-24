import { useState, useEffect, useCallback, useRef } from "react";
import { usePhantom } from "@phantom/react-sdk";
import { getSupabase } from "@/lib/supabase";

function extractSolanaAddress(
  addresses: ReturnType<typeof usePhantom>["addresses"]
): string | null {
  return (
    addresses?.find((a) =>
      String(a.addressType || "").toLowerCase().includes("solana")
    )?.address ??
    addresses?.[0]?.address ??
    null
  );
}

export function useInviteAccess() {
  const { isConnected, addresses } = usePhantom();
  const walletAddress = extractSolanaAddress(addresses);

  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const lastCheckedWallet = useRef<string | null>(null);

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setHasAccess(false);
      lastCheckedWallet.current = null;
      return;
    }

    if (walletAddress === lastCheckedWallet.current) return;
    lastCheckedWallet.current = walletAddress;

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc("check_wallet_access", {
          p_wallet_address: walletAddress,
        });
        if (!cancelled) {
          setHasAccess(error ? false : !!data);
        }
      } catch {
        if (!cancelled) setHasAccess(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isConnected, walletAddress]);

  const verifyCode = useCallback(
    async (code: string): Promise<{ ok: boolean; error?: string }> => {
      if (!walletAddress) {
        return { ok: false, error: "Connect your wallet first." };
      }
      const trimmed = code.trim();
      if (!trimmed) {
        return { ok: false, error: "Please enter an invite code." };
      }
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc("verify_invite_code", {
          p_wallet_address: walletAddress,
          p_code: trimmed,
        });
        if (error) {
          return { ok: false, error: "Verification failed. Try again." };
        }
        if (data) {
          setHasAccess(true);
          return { ok: true };
        }
        return { ok: false, error: "Invalid invite code. Please try again." };
      } catch {
        return { ok: false, error: "Network error. Please try again." };
      }
    },
    [walletAddress]
  );

  return {
    hasAccess,
    isLoading,
    isConnected,
    walletAddress,
    verifyCode,
  };
}
