import {
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  CUSDT_MINT_PDA,
  EARN_VAULT_PROGRAM,
  EARN_VAULT_STATE_PDA,
  EARN_VAULT_USDC_ATA_PDA,
  getEarnVaultConnection,
  getEarnVaultState,
  type EarnVaultState,
} from "./solana";

const EARN_VAULT_DEPOSIT_DISCRIMINATOR = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);
const EARN_VAULT_WITHDRAW_DISCRIMINATOR = Buffer.from([183, 18, 70, 156, 148, 109, 161, 34]);

function atomicToUi(amountAtomic: number): number {
  return amountAtomic / 1e6;
}

function uiToAtomic(amountUi: number): number {
  return Math.round(amountUi * 1e6);
}

function estimateCusdtFromState(state: EarnVaultState, usdcAmountUi: number): number {
  if (state.totalCusdtSupply <= 0 || state.totalUsdcBalance <= 0) {
    return usdcAmountUi;
  }

  return (usdcAmountUi * state.totalCusdtSupply) / state.totalUsdcBalance;
}

function estimateUsdcFromState(state: EarnVaultState, cusdtAmountUi: number): number {
  if (state.totalCusdtSupply <= 0 || state.totalUsdcBalance <= 0) {
    return cusdtAmountUi;
  }

  return (cusdtAmountUi * state.totalUsdcBalance) / state.totalCusdtSupply;
}

export interface EarnVaultInstructionBuild {
  tx: VersionedTransaction;
  state: EarnVaultState;
  userCusdtAta: PublicKey;
  userUsdcAta: PublicKey;
}

export async function buildEarnVaultDepositTx(
  walletAddress: string,
  usdcAmountUi: number,
): Promise<EarnVaultInstructionBuild & { estimatedCusdtUi: number }> {
  const connection = getEarnVaultConnection();
  const state = await getEarnVaultState();
  if (!state) throw new Error("Earn vault is not initialized");

  const user = new PublicKey(walletAddress);
  const userUsdcAta = await getAssociatedTokenAddress(
    state.usdcMint,
    user,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const userCusdtAta = await getAssociatedTokenAddress(
    CUSDT_MINT_PDA,
    user,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const instructions: TransactionInstruction[] = [];
  const userCusdtAccount = await connection.getAccountInfo(userCusdtAta);
  if (!userCusdtAccount) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        user,
        userCusdtAta,
        user,
        CUSDT_MINT_PDA,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  const data = Buffer.alloc(16);
  EARN_VAULT_DEPOSIT_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(BigInt(uiToAtomic(usdcAmountUi)), 8);

  instructions.push(
    new TransactionInstruction({
      programId: EARN_VAULT_PROGRAM,
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: EARN_VAULT_STATE_PDA, isSigner: false, isWritable: true },
        { pubkey: CUSDT_MINT_PDA, isSigner: false, isWritable: true },
        { pubkey: state.vaultUsdcAccount || EARN_VAULT_USDC_ATA_PDA, isSigner: false, isWritable: true },
        { pubkey: userUsdcAta, isSigner: false, isWritable: true },
        { pubkey: userCusdtAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    }),
  );

  const { blockhash } = await connection.getLatestBlockhash();
  const tx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: user,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(),
  );

  return {
    tx,
    state,
    userCusdtAta,
    userUsdcAta,
    estimatedCusdtUi: estimateCusdtFromState(state, usdcAmountUi),
  };
}

export async function buildEarnVaultWithdrawTx(
  walletAddress: string,
  cusdtAmountUi: number,
): Promise<EarnVaultInstructionBuild & { estimatedUsdcUi: number }> {
  const connection = getEarnVaultConnection();
  const state = await getEarnVaultState();
  if (!state) throw new Error("Earn vault is not initialized");

  const user = new PublicKey(walletAddress);
  const userUsdcAta = await getAssociatedTokenAddress(
    state.usdcMint,
    user,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const userCusdtAta = await getAssociatedTokenAddress(
    CUSDT_MINT_PDA,
    user,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const instructions: TransactionInstruction[] = [];
  const userUsdcAccount = await connection.getAccountInfo(userUsdcAta);
  if (!userUsdcAccount) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        user,
        userUsdcAta,
        user,
        state.usdcMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  const data = Buffer.alloc(16);
  EARN_VAULT_WITHDRAW_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(BigInt(uiToAtomic(cusdtAmountUi)), 8);

  instructions.push(
    new TransactionInstruction({
      programId: EARN_VAULT_PROGRAM,
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: EARN_VAULT_STATE_PDA, isSigner: false, isWritable: true },
        { pubkey: CUSDT_MINT_PDA, isSigner: false, isWritable: true },
        { pubkey: state.vaultUsdcAccount || EARN_VAULT_USDC_ATA_PDA, isSigner: false, isWritable: true },
        { pubkey: userUsdcAta, isSigner: false, isWritable: true },
        { pubkey: userCusdtAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    }),
  );

  const { blockhash } = await connection.getLatestBlockhash();
  const tx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: user,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(),
  );

  return {
    tx,
    state,
    userCusdtAta,
    userUsdcAta,
    estimatedUsdcUi: estimateUsdcFromState(state, cusdtAmountUi),
  };
}

export function estimateEarnVaultRedeemUsdt(
  state: EarnVaultState | null,
  cusdtAmountUi: number,
): number {
  if (!state || cusdtAmountUi <= 0) return 0;
  const usdcAtomic = uiToAtomic(estimateUsdcFromState(state, cusdtAmountUi));
  return atomicToUi(usdcAtomic);
}
