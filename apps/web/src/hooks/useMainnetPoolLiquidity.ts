import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePhantom, useSolana } from "@/lib/wallet";
import { cuspApiFetch } from "@/lib/cusp-api";
import { getMainnetConnection, MAINNET_USDC } from "@/lib/solana";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";

type LiquidityActionStatus = "idle" | "submitting" | "success" | "error";

type DepositResponse = {
  success: boolean;
  available_liquidity?: number;
  error?: string;
};

type WithdrawResponse = {
  success: boolean;
  amount_usdc?: number;
  withdraw_tx_signature?: string;
  remaining_available_amount?: number;
  error?: string;
};

export function useMainnetPoolLiquidity(poolPublicKey: string | null | undefined) {
  const [status, setStatus] = useState<LiquidityActionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { addresses } = usePhantom();
  const { solana } = useSolana();

  const walletAddress =
    addresses?.find((address) => String(address.addressType || "").toLowerCase().includes("solana"))
      ?.address ?? null;

  const invalidate = useCallback(async () => {
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ["lendingPool"] }),
      queryClient.invalidateQueries({ queryKey: ["userPortfolio"] }),
      queryClient.invalidateQueries({ queryKey: ["outcomeLoans"] }),
    ]);
  }, [queryClient]);

  const supply = useCallback(async (amountUsdc: number) => {
    console.info("[mainnet-pool][supply] start", {
      walletAddress,
      poolPublicKey,
      amountUsdc,
      hasSolanaProvider: Boolean(solana),
    });

    if (!solana || !walletAddress) {
      console.warn("[mainnet-pool][supply] blocked: wallet not connected", {
        walletAddress,
        hasSolanaProvider: Boolean(solana),
      });
      setError("Connect your wallet first");
      setStatus("error");
      return null;
    }
    if (!poolPublicKey) {
      console.warn("[mainnet-pool][supply] blocked: pool public key missing");
      setError("Mainnet pool wallet is not configured");
      setStatus("error");
      return null;
    }
    if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
      console.warn("[mainnet-pool][supply] blocked: invalid amount", { amountUsdc });
      setError("Enter a valid USDC amount");
      setStatus("error");
      return null;
    }

    setStatus("submitting");
    setError(null);
    setTxSignature(null);

    try {
      const connection = getMainnetConnection();
      const userPubkey = new PublicKey(walletAddress);
      const poolPubkey = new PublicKey(poolPublicKey);
      const userAta = await getAssociatedTokenAddress(
        MAINNET_USDC,
        userPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const poolAta = await getAssociatedTokenAddress(
        MAINNET_USDC,
        poolPubkey,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const userTokenAccount = await getAccount(connection, userAta).catch(() => null);
      if (!userTokenAccount) {
        console.warn("[mainnet-pool][supply] no user USDC token account", {
          walletAddress,
          userAta: userAta.toBase58(),
        });
        throw new Error("No mainnet USDC token account found in the connected wallet.");
      }

      const userBalance = Number(userTokenAccount.amount) / 1e6;
      console.info("[mainnet-pool][supply] token accounts ready", {
        userAta: userAta.toBase58(),
        poolAta: poolAta.toBase58(),
        userBalance,
        requestedAmount: amountUsdc,
      });
      if (userBalance + 1e-9 < amountUsdc) {
        throw new Error(
          `Insufficient mainnet USDC. Wallet has ${userBalance.toFixed(2)} USDC, tried to supply ${amountUsdc.toFixed(2)} USDC.`
        );
      }

      const tx = new Transaction();
      tx.feePayer = userPubkey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      console.info("[mainnet-pool][supply] blockhash fetched", {
        blockhash,
        lastValidBlockHeight,
      });

      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          userPubkey,
          poolAta,
          poolPubkey,
          MAINNET_USDC,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );

      tx.add(
        createTransferInstruction(
          userAta,
          poolAta,
          userPubkey,
          Math.round(amountUsdc * 1e6),
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const signature = await solana.signAndSendTransaction(tx, connection);
      console.info("[mainnet-pool][supply] wallet submitted transaction", {
        signature,
        amountUsdc,
      });
      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed"
      );
      console.info("[mainnet-pool][supply] transaction confirmed", { signature });

      const result = await cuspApiFetch<DepositResponse>("/api/mainnet-pool/deposit", {
        method: "POST",
        body: JSON.stringify({
          wallet_address: walletAddress,
          tx_signature: signature,
          amount_usdc: amountUsdc,
        }),
      });
      console.info("[mainnet-pool][supply] backend registration response", {
        signature,
        result,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to register pool deposit");
      }

      setTxSignature(signature);
      setStatus("success");
      await invalidate();
      console.info("[mainnet-pool][supply] success", {
        signature,
        amountUsdc,
      });
      return signature;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Pool deposit failed";
      console.error("[mainnet-pool][supply] failed", {
        walletAddress,
        poolPublicKey,
        amountUsdc,
        error: err,
        message,
      });
      if (message.toLowerCase().includes("walletsendtransactionerror")) {
        setError("Wallet rejected the mainnet USDC supply transaction. Confirm the wallet is on mainnet and approve the transaction.");
      } else {
        setError(message);
      }
      setStatus("error");
      return null;
    }
  }, [invalidate, poolPublicKey, solana, walletAddress]);

  const withdraw = useCallback(async (amountUsdc: number) => {
    console.info("[mainnet-pool][withdraw] start", {
      walletAddress,
      amountUsdc,
    });
    if (!walletAddress) {
      console.warn("[mainnet-pool][withdraw] blocked: wallet not connected");
      setError("Connect your wallet first");
      setStatus("error");
      return null;
    }
    if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
      console.warn("[mainnet-pool][withdraw] blocked: invalid amount", { amountUsdc });
      setError("Enter a valid USDC amount");
      setStatus("error");
      return null;
    }

    setStatus("submitting");
    setError(null);
    setTxSignature(null);

    try {
      const result = await cuspApiFetch<WithdrawResponse>("/api/mainnet-pool/withdraw", {
        method: "POST",
        body: JSON.stringify({
          wallet_address: walletAddress,
          amount_usdc: amountUsdc,
        }),
      });
      console.info("[mainnet-pool][withdraw] backend response", { result });

      if (!result.success || !result.withdraw_tx_signature) {
        throw new Error(result.error || "Pool withdraw failed");
      }

      setTxSignature(result.withdraw_tx_signature);
      setStatus("success");
      await invalidate();
      console.info("[mainnet-pool][withdraw] success", {
        txSignature: result.withdraw_tx_signature,
        amountUsdc,
      });
      return result.withdraw_tx_signature;
    } catch (err) {
      console.error("[mainnet-pool][withdraw] failed", {
        walletAddress,
        amountUsdc,
        error: err,
      });
      setError(err instanceof Error ? err.message : "Pool withdraw failed");
      setStatus("error");
      return null;
    }
  }, [invalidate, walletAddress]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setTxSignature(null);
  }, []);

  return {
    supply,
    withdraw,
    status,
    error,
    txSignature,
    reset,
  };
}
