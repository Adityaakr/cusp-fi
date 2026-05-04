import { useState, useEffect, useCallback } from "react";
import { usePhantom, useSolana } from "@/lib/wallet";
import { checkKycStatus, buildProofDeepLink, buildKycSignMessage } from "@/lib/dflow-proof";
import { supabase } from "@/lib/supabase";
import bs58 from "bs58";

export function useKYC() {
  const [verified, setVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addresses, isConnected } = usePhantom();
  const { solana } = useSolana();

  const solanaAddress = addresses?.find((a) =>
    String(a.addressType || "").toLowerCase().includes("solana")
  )?.address;

  const checkStatus = useCallback(async () => {
    if (!solanaAddress) {
      setVerified(null);
      return;
    }
    setLoading(true);
    try {
      const isVerified = await checkKycStatus(solanaAddress);
      setVerified(isVerified);

      if (supabase && isVerified) {
        await supabase.rpc("get_or_create_user", {
          p_wallet_address: solanaAddress,
        });
        await supabase.rpc("mark_user_kyc_verified", {
          p_wallet_address: solanaAddress,
        });
      }
    } catch {
      setVerified(false);
    } finally {
      setLoading(false);
    }
  }, [solanaAddress]);

  useEffect(() => {
    if (isConnected && solanaAddress) {
      checkStatus();
    } else {
      setVerified(null);
    }
  }, [isConnected, solanaAddress, checkStatus]);

  async function startVerification() {
    if (!solanaAddress || !solana) {
      setError("Connect your wallet first");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { message, timestamp } = buildKycSignMessage();
      const encodedMessage = new TextEncoder().encode(message);
      const signResult = await solana.signMessage(encodedMessage);

      const signatureBytes =
        signResult instanceof Uint8Array ? signResult : signResult.signature;
      const signatureBase58 = bs58.encode(signatureBytes);

      const redirectUri = `${window.location.origin}/auth/callback`;
      const deepLink = buildProofDeepLink({
        walletAddress: solanaAddress,
        signatureBase58,
        timestamp,
        redirectUri,
      });

      window.open(deepLink, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return {
    verified,
    loading,
    error,
    startVerification,
    recheckStatus: checkStatus,
  };
}
