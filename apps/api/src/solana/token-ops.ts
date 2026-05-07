import {
  getAssociatedTokenAddress,
  createMintToInstruction,
  createBurnInstruction,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Transaction,
  sendAndConfirmTransaction,
  PublicKey,
  Keypair,
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
} from "@solana/web3.js";
import { getConnection, getVaultKeypair, getCusdcMint, USDC_MINT, USDT_MINT } from "./connection.js";

export async function mintCusdcToUser(
  walletAddress: string,
  cusdcAmount: number
): Promise<string> {
  const connection = getConnection();
  const vaultKeypair = getVaultKeypair();
  const cusdcMint = getCusdcMint();
  const userPubkey = new PublicKey(walletAddress);
  const userCusdcAta = await getAssociatedTokenAddress(cusdcMint, userPubkey);

  const tx = new Transaction();

  const accountInfo = await connection.getAccountInfo(userCusdcAta);
  if (!accountInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        vaultKeypair.publicKey,
        userCusdcAta,
        userPubkey,
        cusdcMint
      )
    );
  }

  const atomicAmount = Math.round(cusdcAmount * 1e6);
  tx.add(
    createMintToInstruction(
      cusdcMint,
      userCusdcAta,
      vaultKeypair.publicKey,
      atomicAmount
    )
  );

  return sendAndConfirmTransaction(connection, tx, [vaultKeypair]);
}

export async function burnCusdcFromUser(
  walletAddress: string,
  cusdcAmount: number
): Promise<string> {
  const connection = getConnection();
  const vaultKeypair = getVaultKeypair();
  const cusdcMint = getCusdcMint();
  const userPubkey = new PublicKey(walletAddress);
  const userCusdcAta = await getAssociatedTokenAddress(cusdcMint, userPubkey);

  const atomicAmount = Math.round(cusdcAmount * 1e6);
  const tx = new Transaction();
  tx.add(
    createBurnInstruction(
      userCusdcAta,
      cusdcMint,
      vaultKeypair.publicKey,
      atomicAmount
    )
  );

  return sendAndConfirmTransaction(connection, tx, [vaultKeypair]);
}

export async function transferUsdcFromVault(
  walletAddress: string,
  usdcAmount: number
): Promise<string> {
  const connection = getConnection();
  const vaultKeypair = getVaultKeypair();
  const userPubkey = new PublicKey(walletAddress);
  const vaultUsdcAta = await getAssociatedTokenAddress(USDC_MINT, vaultKeypair.publicKey);
  const userUsdcAta = await getAssociatedTokenAddress(USDC_MINT, userPubkey);

  const atomicAmount = Math.round(usdcAmount * 1e6);
  const tx = new Transaction();

  const userAtaInfo = await connection.getAccountInfo(userUsdcAta);
  if (!userAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        vaultKeypair.publicKey,
        userUsdcAta,
        userPubkey,
        USDC_MINT
      )
    );
  }

  tx.add(
    createTransferInstruction(
      vaultUsdcAta,
      userUsdcAta,
      vaultKeypair.publicKey,
      atomicAmount
    )
  );

  return sendAndConfirmTransaction(connection, tx, [vaultKeypair]);
}

export async function lendUsdcToUser(
  walletAddress: string,
  usdcAmount: number
): Promise<{ signature: string; warning: string }> {
  const connection = getConnection();
  const vaultKeypair = getVaultKeypair();
  const userPubkey = new PublicKey(walletAddress);
  const borrowedAtomic = Math.round(usdcAmount * 1e6);

  const vaultSol = await connection.getBalance(vaultKeypair.publicKey);
  if (vaultSol < 10_000) {
    return {
      signature: "",
      warning: `Vault has insufficient SOL for fees. Lending skipped.`,
    };
  }

  const vaultAta = await getAssociatedTokenAddress(USDC_MINT, vaultKeypair.publicKey);
  const userAta = await getAssociatedTokenAddress(USDC_MINT, userPubkey);

  const instructions: TransactionInstruction[] = [];
  const userAtaInfo = await connection.getAccountInfo(userAta);
  if (!userAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        vaultKeypair.publicKey,
        userAta,
        userPubkey,
        USDC_MINT
      )
    );
  }

  instructions.push(
    createTransferInstruction(vaultAta, userAta, vaultKeypair.publicKey, borrowedAtomic)
  );

  const { blockhash } = await connection.getLatestBlockhash();
  const messageV0 = new TransactionMessage({
    payerKey: vaultKeypair.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  tx.sign([vaultKeypair]);

  const signature = await connection.sendTransaction(tx);
  return { signature, warning: "" };
}
