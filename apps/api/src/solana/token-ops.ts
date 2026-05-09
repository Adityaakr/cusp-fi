import {
  getAssociatedTokenAddress,
  createMintToInstruction,
  createBurnInstruction,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
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
import {
  getConnection,
  getVaultKeypair,
  getCusdcMint,
  getMainnetPoolKeypair,
  USDC_MINT,
  USDT_MINT,
  getTokenProgramForMint,
} from "./connection.js";

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
  return transferUsdcFromAuthority(getVaultKeypair(), walletAddress, usdcAmount);
}

export async function transferUsdcFromMainnetPool(
  walletAddress: string,
  usdcAmount: number
): Promise<string> {
  return transferUsdcFromAuthority(getMainnetPoolKeypair(), walletAddress, usdcAmount);
}

async function transferUsdcFromAuthority(
  authorityKeypair: Keypair,
  walletAddress: string,
  usdcAmount: number
): Promise<string> {
  const connection = getConnection();
  const userPubkey = new PublicKey(walletAddress);
  const authorityUsdcAta = await getAssociatedTokenAddress(USDC_MINT, authorityKeypair.publicKey);
  const userUsdcAta = await getAssociatedTokenAddress(USDC_MINT, userPubkey);

  const atomicAmount = Math.round(usdcAmount * 1e6);
  const tx = new Transaction();

  const userAtaInfo = await connection.getAccountInfo(userUsdcAta);
  if (!userAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        authorityKeypair.publicKey,
        userUsdcAta,
        userPubkey,
        USDC_MINT
      )
    );
  }

  tx.add(
    createTransferInstruction(
      authorityUsdcAta,
      userUsdcAta,
      authorityKeypair.publicKey,
      atomicAmount
    )
  );

  return sendAndConfirmTransaction(connection, tx, [authorityKeypair]);
}

export async function lendUsdcToUser(
  walletAddress: string,
  usdcAmount: number
): Promise<{ signature: string; warning: string }> {
  return lendUsdcFromAuthority(getVaultKeypair(), walletAddress, usdcAmount);
}

export async function lendUsdcFromMainnetPool(
  walletAddress: string,
  usdcAmount: number
): Promise<{ signature: string; warning: string }> {
  return lendUsdcFromAuthority(getMainnetPoolKeypair(), walletAddress, usdcAmount);
}

export async function transferSplTokenFromMainnetPool(params: {
  walletAddress: string;
  mint: PublicKey;
  amountUi: number;
}): Promise<{ signature: string; warning: string }> {
  return transferSplTokenFromAuthority({
    authorityKeypair: getMainnetPoolKeypair(),
    walletAddress: params.walletAddress,
    mint: params.mint,
    amountUi: params.amountUi,
  });
}

async function lendUsdcFromAuthority(
  authorityKeypair: Keypair,
  walletAddress: string,
  usdcAmount: number
): Promise<{ signature: string; warning: string }> {
  const connection = getConnection();
  const userPubkey = new PublicKey(walletAddress);
  const borrowedAtomic = Math.round(usdcAmount * 1e6);

  const authoritySol = await connection.getBalance(authorityKeypair.publicKey);
  if (authoritySol < 10_000) {
    return {
      signature: "",
      warning: `Authority wallet has insufficient SOL for fees. Lending skipped.`,
    };
  }

  const authorityAta = await getAssociatedTokenAddress(USDC_MINT, authorityKeypair.publicKey);
  const userAta = await getAssociatedTokenAddress(USDC_MINT, userPubkey);

  const instructions: TransactionInstruction[] = [];
  const userAtaInfo = await connection.getAccountInfo(userAta);
  if (!userAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        authorityKeypair.publicKey,
        userAta,
        userPubkey,
        USDC_MINT
      )
    );
  }

  instructions.push(
    createTransferInstruction(authorityAta, userAta, authorityKeypair.publicKey, borrowedAtomic)
  );

  const { blockhash } = await connection.getLatestBlockhash();
  const messageV0 = new TransactionMessage({
    payerKey: authorityKeypair.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  tx.sign([authorityKeypair]);

  const signature = await connection.sendTransaction(tx);
  return { signature, warning: "" };
}

async function transferSplTokenFromAuthority(params: {
  authorityKeypair: Keypair;
  walletAddress: string;
  mint: PublicKey;
  amountUi: number;
}): Promise<{ signature: string; warning: string }> {
  const connection = getConnection();
  const userPubkey = new PublicKey(params.walletAddress);
  const authoritySol = await connection.getBalance(params.authorityKeypair.publicKey);
  if (authoritySol < 10_000) {
    return {
      signature: "",
      warning: "Authority wallet has insufficient SOL for fees. Transfer skipped.",
    };
  }

  const tokenProgramId = await getTokenProgramForMint(params.mint);
  const atomicAmount = Math.round(params.amountUi * 1e6);
  const authorityAta = await getAssociatedTokenAddress(
    params.mint,
    params.authorityKeypair.publicKey,
    true,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const userAta = await getAssociatedTokenAddress(
    params.mint,
    userPubkey,
    false,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const instructions: TransactionInstruction[] = [];
  const userAtaInfo = await connection.getAccountInfo(userAta);
  if (!userAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        params.authorityKeypair.publicKey,
        userAta,
        userPubkey,
        params.mint,
        tokenProgramId,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  instructions.push(
    createTransferInstruction(
      authorityAta,
      userAta,
      params.authorityKeypair.publicKey,
      atomicAmount,
      [],
      tokenProgramId.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
    )
  );

  const { blockhash } = await connection.getLatestBlockhash();
  const messageV0 = new TransactionMessage({
    payerKey: params.authorityKeypair.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  tx.sign([params.authorityKeypair]);
  const signature = await connection.sendTransaction(tx);

  return { signature, warning: "" };
}
