/**
 * Initialize the Cusp Vault on devnet.
 *
 * 1. Calls `initialize` to create vault state + cUSDC mint
 * 2. Calls `init_vault_account` to create the vault's USDC token account
 * 3. Outputs all addresses for .env
 *
 * Usage: npx ts-node scripts/init-vault.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEVNET_RPC = "https://api.devnet.solana.com";
const VAULT_PROGRAM_ID = new PublicKey("EtGTQ9pmcnkYtTdorACENJPBmYVeWo8vrDzH7kU1K7DQ");
const TEST_USDC_MINT = new PublicKey("wt1s1m9T9U4au8XW1J9EqtouHCTaeFKBMRFHYP7axGN");

async function main() {
  console.log("=== Initializing Cusp Vault on Devnet ===\n");

  // Load wallet
  const keypairPath = path.resolve(process.env.HOME || "~", ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  const connection = new Connection(DEVNET_RPC, "confirmed");

  const idlPath = path.resolve(__dirname, "../programs/target/deploy/cusp_vault.json");
  if (!fs.existsSync(idlPath)) {
    console.log("No IDL file found, using raw transactions...\n");
  }

  // Derive PDAs
  const [vaultState, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    VAULT_PROGRAM_ID
  );
  const [cusdcMint, cusdcMintBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("cusdc-mint")],
    VAULT_PROGRAM_ID
  );
  const [vaultUsdcAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault-usdc")],
    VAULT_PROGRAM_ID
  );

  console.log("PDAs:");
  console.log(`  Vault State:        ${vaultState.toBase58()}`);
  console.log(`  cUSDC Mint:         ${cusdcMint.toBase58()}`);
  console.log(`  Vault USDC Account: ${vaultUsdcAccount.toBase58()}`);
  console.log(`  Test USDC Mint:     ${TEST_USDC_MINT.toBase58()}`);
  console.log(`  Admin:              ${wallet.publicKey.toBase58()}\n`);

  // Check if already initialized
  const vaultInfo = await connection.getAccountInfo(vaultState);
  if (vaultInfo) {
    console.log("Vault already initialized! Skipping...\n");
  } else {
    // Use Anchor provider
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(wallet),
      { commitment: "confirmed" }
    );

    // Build initialize instruction manually using Anchor's instruction builder
    const discriminator_init = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]); // anchor discriminator for "initialize"

    const initData = Buffer.concat([
      discriminator_init,
      TEST_USDC_MINT.toBuffer(), // usdc_mint: Pubkey arg
    ]);

    const initIx = new anchor.web3.TransactionInstruction({
      programId: VAULT_PROGRAM_ID,
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },  // admin
        { pubkey: vaultState, isSigner: false, isWritable: true },       // vault_state
        { pubkey: cusdcMint, isSigner: false, isWritable: true },        // cusdc_mint
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // rent
      ],
      data: initData,
    });

    console.log("Step 1: Initializing vault state + cUSDC mint...");
    const tx1 = new anchor.web3.Transaction().add(initIx);
    const sig1 = await provider.sendAndConfirm(tx1, [wallet]);
    console.log(`  TX: ${sig1}\n`);

    // Step 2: init_vault_account
    const discriminator_init_account = Buffer.from([53, 46, 103, 190, 217, 121, 20, 246]); // "init_vault_account"

    const initAccountIx = new anchor.web3.TransactionInstruction({
      programId: VAULT_PROGRAM_ID,
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },     // admin
        { pubkey: vaultState, isSigner: false, isWritable: true },          // vault_state
        { pubkey: TEST_USDC_MINT, isSigner: false, isWritable: false },     // usdc_mint
        { pubkey: vaultUsdcAccount, isSigner: false, isWritable: true },    // vault_usdc_account
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },   // token_program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // rent
      ],
      data: discriminator_init_account,
    });

    console.log("Step 2: Creating vault USDC account...");
    const tx2 = new anchor.web3.Transaction().add(initAccountIx);
    const sig2 = await provider.sendAndConfirm(tx2, [wallet]);
    console.log(`  TX: ${sig2}\n`);
  }

  // Output
  console.log("=== Vault Initialized! ===\n");
  console.log("Add these to your .env:\n");
  console.log(`VITE_CUSDC_MINT=${cusdcMint.toBase58()}`);
  console.log(`VITE_VAULT_USDC_ACCOUNT=${vaultUsdcAccount.toBase58()}`);
  console.log(`VITE_VAULT_PUBLIC_KEY=${vaultState.toBase58()}`);
  console.log(`VITE_TEST_USDC_MINT=${TEST_USDC_MINT.toBase58()}`);

  // Save config
  const config = {
    network: "devnet",
    vaultProgram: VAULT_PROGRAM_ID.toBase58(),
    leverageProgram: "Duyqj2n1CxiVhCN4fgNFf8dbtSeyrZVE3XCBtG6VUgx9",
    vaultState: vaultState.toBase58(),
    cusdcMint: cusdcMint.toBase58(),
    vaultUsdcAccount: vaultUsdcAccount.toBase58(),
    testUsdcMint: TEST_USDC_MINT.toBase58(),
    admin: wallet.publicKey.toBase58(),
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.resolve(__dirname, "../.devnet-config.json"),
    JSON.stringify(config, null, 2)
  );
  console.log("\nConfig saved to .devnet-config.json");
}

main().catch((err) => {
  console.error("Init failed:", err);
  process.exit(1);
});
