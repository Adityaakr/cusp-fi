/**
 * Cusp Earn Vault — Mainnet Initialization Script
 *
 * Creates the vault state account, cUSDT mint, and vault USDC ATA.
 *
 * Usage:
 *   npx ts-node scripts/init-earn-vault.ts
 *
 * Prerequisites:
 *   - Run deploy-earn-vault.sh first
 *   - Fund your wallet with SOL on mainnet
 *   - Set VITE_EARN_VAULT_PROGRAM_ID in .env
 *
 * This script:
 *   1. Calls `initialize(usdc_mint, usdt_mint)` — creates VaultState + cUSDT mint
 *   2. Calls `init_vault_account` — creates vault's USDC token account
 *   3. Prints all derived addresses for .env
 */

import {
  Connection,
  PublicKey,
  Keypair,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  MINT_SIZE,
  ACCOUNT_SIZE,
  createInitializeMintInstruction,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// ─── Configuration ──────────────────────────────────────────────────────────

const PROGRAM_ID = new PublicKey(
  process.env.VITE_EARN_VAULT_PROGRAM_ID ||
    "Bs53nqkzB4x81giq2Vc8SC6NLK7euxWThkcuj3UVZZcp"
);

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const USDT_MINT = new PublicKey("Es9vMFrzaCERn2QytQkwT4NSr8F3rzA4XB9vNehqWj6q");

const RPC_URL = "https://api.mainnet-beta.solana.com";

// ─── Anchor discriminators ───────────────────────────────────────────────────

function sha256(input: string): Buffer {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(input).digest();
}

const INITIALIZE_DISCRIMINATOR = sha256("global:initialize").slice(0, 8);
const INIT_VAULT_ACCOUNT_DISCRIMINATOR = sha256("global:init_vault_account").slice(0, 8);

// ─── PDA derivation ──────────────────────────────────────────────────────────

const [VAULT_STATE_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("earn-vault")],
  PROGRAM_ID
);

const [CUSDT_MINT_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("cusdt-mint")],
  PROGRAM_ID
);

const [VAULT_USDC_ATA_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("earn-vault-usdc")],
  PROGRAM_ID
);

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");

  // Load wallet fromCLI or env
  const walletPath = path.join(
    process.env.HOME || "/root",
    ".config/solana/id.json"
  );
  if (!fs.existsSync(walletPath)) {
    console.error("Wallet not found at", walletPath);
    console.error("Create one with: solana-keygen new --outfile ~/.config/solana/id.json");
    process.exit(1);
  }

  const walletKeyPair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  const payer = walletKeyPair.publicKey;

  console.log("══════════════════════════════════════════════════════════════");
  console.log("  Cusp Earn Vault — Mainnet Initialization");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("  Program ID:      ", PROGRAM_ID.toBase58());
  console.log("  Vault State PDA: ", VAULT_STATE_PDA.toBase58());
  console.log("  cUSDT Mint PDA:  ", CUSDT_MINT_PDA.toBase58());
  console.log("  Vault USDC ATA:  ", VAULT_USDC_ATA_PDA.toBase58());
  console.log("  USDC Mint:       ", USDC_MINT.toBase58());
  console.log("  USDT Mint:       ", USDT_MINT.toBase58());
  console.log("  Payer:           ", payer.toBase58());
  console.log("");

  const balance = await connection.getBalance(payer);
  console.log("  Payer balance:   ", balance / 1e9, "SOL");
  console.log("");

  if (balance < 0.5 * 1e9) {
    console.error("  ERROR: Payer needs at least 0.5 SOL for initialization transactions.");
    process.exit(1);
  }

  // Check if vault state already exists
  const vaultAccountInfo = await connection.getAccountInfo(VAULT_STATE_PDA);
  if (vaultAccountInfo) {
    console.log("  Vault state already initialized. Skipping initialize step.");
    console.log("");

    // Still check if vault USDC ATA exists
    const vaultAtaInfo = await connection.getAccountInfo(VAULT_USDC_ATA_PDA);
    if (vaultAtaInfo) {
      console.log("  Vault USDC ATA already exists. Nothing to do.");
      console.log("");
    } else {
      console.log("  Creating vault USDC ATA...");
      await initVaultAccount(connection, walletKeyPair);
    }
  } else {
    console.log("  [1/2] Initializing vault state + cUSDT mint...");
    await initializeVault(connection, walletKeyPair);
    console.log("");

    console.log("  [2/2] Creating vault USDC ATA...");
    await initVaultAccount(connection, walletKeyPair);
    console.log("");
  }

  // Print .env values
  console.log("══════════════════════════════════════════════════════════════");
  console.log("  Add these to your .env file:");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`  VITE_EARN_VAULT_PROGRAM_ID=${PROGRAM_ID.toBase58()}`);
  console.log(`  VITE_EARN_VAULT_STATE=${VAULT_STATE_PDA.toBase58()}`);
  console.log(`  VITE_CUSDT_MINT=${CUSDT_MINT_PDA.toBase58()}`);
  console.log(`  VITE_EARN_VAULT_USDC_ATA=${VAULT_USDC_ATA_PDA.toBase58()}`);
  console.log("══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("  Initial APY should be set via: update_kamino_apy(426) = 4.26%");
  console.log("  (Call this after initialization using the admin wallet)");
  console.log("");
  console.log("  Done! The earn vault is ready for deposits on mainnet.");
}

async function initializeVault(connection: Connection, payer: Keypair) {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhashAndContext("confirmed");

  const rent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  const vaultStateSpace = 8 + 8 + 32 * 5 + 8 * 4 + 8 * 2 + 1 + 1 + 1 + 8; // ~232 bytes
  const vaultStateRent = await connection.getMinimumBalanceForRentExemption(vaultStateSpace);

  // initialize instruction data:
  // 8 bytes discriminator + 32 bytes usdc_mint + 32 bytes usdt_mint = 72 bytes
  const data = Buffer.alloc(72);
  INITIALIZE_DISCRIMINATOR.copy(data, 0);
  USDC_MINT.toBuffer().copy(data, 8);
  USDT_MINT.toBuffer().copy(data, 40);

  const instructions: TransactionInstruction[] = [
    // Create vault state account
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubKey: VAULT_STATE_PDA,
      space: vaultStateSpace,
      lamports: vaultStateRent,
      programId: PROGRAM_ID,
    }),
    // Create cUSDT mint account
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubKey: CUSDT_MINT_PDA,
      space: MINT_SIZE,
      lamports: rent,
      programId: PROGRAM_ID,
    }),
    // initialize instruction
    new TransactionInstruction({
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: VAULT_STATE_PDA, isSigner: false, isWritable: true },
        { pubkey: CUSDT_MINT_PDA, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    }),
  ];

  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  tx.sign([payer]);

  const sig = await connection.sendTransaction(tx, {
    skipPreflight: false,
    maxRetries: 3,
  });

  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "finalized"
  );

  console.log("  ✓ Vault initialized. Signature:", sig);
}

async function initVaultAccount(connection: Connection, payer: Keypair) {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhashAndContext("confirmed");

  const rent = await connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE);

  // init_vault_account instruction data:
  // 8 bytes discriminator only = 8 bytes
  const data = Buffer.alloc(8);
  INIT_VAULT_ACCOUNT_DISCRIMINATOR.copy(data, 0);

  const instructions: TransactionInstruction[] = [
    // Create vault USDC ATA
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubKey: VAULT_USDC_ATA_PDA,
      space: ACCOUNT_SIZE,
      lamports: rent,
      programId: PROGRAM_ID,
    }),
    // init_vault_account instruction
    new TransactionInstruction({
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: VAULT_STATE_PDA, isSigner: false, isWritable: true },
        { pubkey: USDC_MINT, isSigner: false, isWritable: false },
        { pubkey: VAULT_USDC_ATA_PDA, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    }),
  ];

  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  tx.sign([payer]);

  const sig = await connection.sendTransaction(tx, {
    skipPreflight: false,
    maxRetries: 3,
  });

  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "finalized"
  );

  console.log("  ✓ Vault USDC ATA created. Signature:", sig);
}

main().catch((err) => {
  console.error("Initialization failed:", err);
  process.exit(1);
});