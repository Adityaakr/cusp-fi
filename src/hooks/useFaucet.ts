import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePhantom, useSolana } from "@phantom/react-sdk";
import { getConnection } from "@/lib/solana";
import { isTestnet, SOLANA_NETWORK } from "@/lib/network-config";
import {
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

export type FaucetStatus = "idle" | "airdropping" | "success" | "error";

/**
 * Devnet faucet — airdrops SOL to the connected wallet.
 * Test USDC must be minted separately via scripts/faucet.ts (mint authority required).
 */
export function useFaucet() {
  const [status, setStatus] = useState<FaucetStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const { addresses } = usePhantom();
  const queryClient = useQueryClient();

  const solanaAddress = addresses?.find((a) =>
    String(a.addressType || "").toLowerCase().includes("solana")
  )?.address;

  const isAvailable = isTestnet;

  async function requestAirdrop() {
    if (!solanaAddress || !isAvailable) return;

    setError(null);
    setStatus("airdropping");

    try {
      const connection = getConnection();
      const pubkey = new PublicKey(solanaAddress);

      // Airdrop 2 SOL
      const sig = await connection.requestAirdrop(pubkey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");

      setStatus("success");
      queryClient.invalidateQueries({ queryKey: ["userPortfolio"] });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes("rate limit")
            ? "Rate limited — try again in a minute"
            : err.message
          : "Airdrop failed"
      );
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setError(null);
  }

  return { requestAirdrop, status, error, isAvailable, reset };
}
