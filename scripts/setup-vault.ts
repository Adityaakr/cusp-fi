/**
 * Cusp Vault Setup Script
 *
 * Generates a vault keypair, creates the cUSDC SPL Token mint,
 * and sets up the vault's USDC token account on Solana mainnet.
 *
 * Usage:
 *   npx ts-node scripts/setup-vault.ts
 *
 * Prerequisites:
 *   - Fund the generated vault address with ~0.05 SOL for rent + tx fees
 *   - Save the keypair JSON securely (it's the mint authority!)
 */

import {
  Connection,
  Keypair,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USDC_MINT_PUBKEY = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");

  console.log("=== Cusp Vault Setup ===\n");
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Network: mainnet-beta\n`);

  // Step 1: Generate or load vault keypair
  const keypairPath = path.join(__dirname, "..", "vault-keypair.json");
  let vaultKeypair: Keypair;

  if (fs.existsSync(keypairPath)) {
    console.log("Loading existing vault keypair...");
    const raw = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    vaultKeypair = Keypair.fromSecretKey(Uint8Array.from(raw));
  } else {
    console.log("Generating new vault keypair...");
    vaultKeypair = Keypair.generate();
    fs.writeFileSync(
      keypairPath,
      JSON.stringify(Array.from(vaultKeypair.secretKey))
    );
    console.log(`  Saved to: ${keypairPath}`);
    console.log(
      "  *** BACK UP THIS FILE SECURELY -- it controls the vault ***"
    );
  }

  const vaultPubkey = vaultKeypair.publicKey.toBase58();
  console.log(`\nVault public key: ${vaultPubkey}`);

  // Step 2: Check SOL balance
  const balance = await connection.getBalance(vaultKeypair.publicKey);
  const solBalance = balance / LAMPORTS_PER_SOL;
  console.log(`SOL balance: ${solBalance} SOL`);

  if (solBalance < 0.005) {
    console.log(`\n*** ACTION REQUIRED ***`);
    console.log(`Fund this address with at least 0.05 SOL:`);
    console.log(`  ${vaultPubkey}`);
    console.log(
      `\nThen re-run this script to create the cUSDC mint and USDC account.\n`
    );

    printEnvVars(vaultPubkey, "", "");
    return;
  }

  // Step 3: Create cUSDC mint
  console.log("\nCreating cUSDC token mint (6 decimals)...");
  const cusdcMint = await createMint(
    connection,
    vaultKeypair,
    vaultKeypair.publicKey, // mint authority
    vaultKeypair.publicKey, // freeze authority
    6, // decimals (same as USDC)
    undefined,
    undefined,
    TOKEN_PROGRAM_ID
  );
  console.log(`  cUSDC mint: ${cusdcMint.toBase58()}`);

  // Step 4: Create vault's USDC ATA
  console.log("\nCreating vault USDC token account...");
  const { PublicKey } = await import("@solana/web3.js");
  const usdcMint = new PublicKey(USDC_MINT_PUBKEY);
  const vaultUsdcAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    vaultKeypair,
    usdcMint,
    vaultKeypair.publicKey
  );
  console.log(`  Vault USDC ATA: ${vaultUsdcAccount.address.toBase58()}`);

  // Step 5: Create vault's cUSDC ATA (for tracking)
  console.log("\nCreating vault cUSDC token account...");
  const vaultCusdcAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    vaultKeypair,
    cusdcMint,
    vaultKeypair.publicKey
  );
  console.log(`  Vault cUSDC ATA: ${vaultCusdcAccount.address.toBase58()}`);

  // Output
  console.log("\n=== Setup Complete ===\n");
  printEnvVars(
    vaultPubkey,
    cusdcMint.toBase58(),
    vaultUsdcAccount.address.toBase58()
  );

  console.log("\n--- Supabase secrets (set in Dashboard > Edge Functions > Secrets) ---");
  console.log(`VAULT_KEYPAIR=${JSON.stringify(Array.from(vaultKeypair.secretKey))}`);
  console.log(`CUSDC_MINT=${cusdcMint.toBase58()}`);
  console.log(`SOLANA_RPC_URL=${RPC_URL}`);
}

function printEnvVars(
  vaultPubkey: string,
  cusdcMint: string,
  vaultUsdcAccount: string
) {
  console.log("--- Add to .env ---");
  console.log(`VITE_VAULT_PUBLIC_KEY=${vaultPubkey}`);
  console.log(`VITE_CUSDC_MINT=${cusdcMint}`);
  console.log(`VITE_VAULT_USDC_ACCOUNT=${vaultUsdcAccount}`);
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
