import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePhantom, useSolana } from "@/lib/wallet";
import { cuspApiFetch } from "@/lib/cusp-api";
import { getMainnetConnection } from "@/lib/solana";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";

export type CreateLoanArgs = {
  walletAddress: string;
  marketTicker: string;
  side: "YES" | "NO";
  outcomeMint: string;
  tokenQuantity: number;
  tokenDecimals: number;
  tokenProgram: "spl-token" | "token-2022";
  currentPrice: number;
  collateralValueUsdc: number;
  borrowAmountUsdc: number;
  maxLtvBps: number;
  liquidationThresholdBps: number;
  poolPublicKey: string;
};

export type CreateLoanStatus = "idle" | "creating" | "success" | "error";

type CollateralDepositResponse = {
  success: boolean;
  loan_id?: string;
  collateral_lot_id?: string;
  borrow_tx_signature?: string;
  error?: string;
};

export function useCreateOutcomeLoan() {
  const [status, setStatus] = useState<CreateLoanStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loanId, setLoanId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { addresses } = usePhantom();
  const { solana } = useSolana();

  const connectedWallet =
    addresses?.find((address) => String(address.addressType || "").toLowerCase().includes("solana"))
      ?.address ?? null;

  const createLoan = useCallback(async (args: CreateLoanArgs) => {
    if (!solana || !connectedWallet || connectedWallet !== args.walletAddress) {
      setError("Connect the borrowing wallet first");
      setStatus("error");
      return null;
    }

    setStatus("creating");
    setError(null);
    setLoanId(null);

    try {
      const connection = getMainnetConnection();
      const userPubkey = new PublicKey(args.walletAddress);
      const poolPubkey = new PublicKey(args.poolPublicKey);
      const mint = new PublicKey(args.outcomeMint);
      const tokenProgramId =
        args.tokenProgram === "token-2022" ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

      const userAta = await getAssociatedTokenAddress(
        mint,
        userPubkey,
        false,
        tokenProgramId,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const poolAta = await getAssociatedTokenAddress(
        mint,
        poolPubkey,
        true,
        tokenProgramId,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const collateralTx = new Transaction();
      const poolAtaInfo = await connection.getAccountInfo(poolAta);
      if (!poolAtaInfo) {
        collateralTx.add(
          createAssociatedTokenAccountInstruction(
            userPubkey,
            poolAta,
            poolPubkey,
            mint,
            tokenProgramId,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      const amountAtomic = Math.round(args.tokenQuantity * 10 ** args.tokenDecimals);
      collateralTx.add(
        createTransferInstruction(
          userAta,
          poolAta,
          userPubkey,
          amountAtomic,
          [],
          tokenProgramId
        )
      );

      const collateralSignature = await solana.signAndSendTransaction(collateralTx, connection);
      await connection.confirmTransaction(collateralSignature, "confirmed");

      const loanResult = await cuspApiFetch<CollateralDepositResponse>(
        "/api/outcome-loans/create",
        {
          method: "POST",
          body: JSON.stringify({
            wallet_address: args.walletAddress,
            tx_signature: collateralSignature,
            market_ticker: args.marketTicker,
            outcome_mint: args.outcomeMint,
            side: args.side,
            quantity: args.tokenQuantity,
            requested_borrow_usdc: args.borrowAmountUsdc,
            escrow_token_account: poolAta.toBase58(),
            interest_bps: 800,
            expiry_hours: 168,
          }),
        }
      );

      if (!loanResult.success || !loanResult.loan_id) {
        throw new Error(loanResult.error || "Loan create failed");
      }

      setLoanId(loanResult.loan_id);
      setStatus("success");

      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["outcomeLoans"] }),
        queryClient.invalidateQueries({ queryKey: ["outcomeCollateralPositions"] }),
        queryClient.invalidateQueries({ queryKey: ["lendingPool"] }),
        queryClient.invalidateQueries({ queryKey: ["userPortfolio"] }),
        queryClient.invalidateQueries({ queryKey: ["outcomeTokenHoldings"] }),
      ]);

      return loanResult.loan_id;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Borrow failed";
      console.error("[createOutcomeLoan]", message);
      setError(message);
      setStatus("error");
      return null;
    }
  }, [connectedWallet, queryClient, solana]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setLoanId(null);
  }, []);

  return { createLoan, status, error, loanId, reset };
}
