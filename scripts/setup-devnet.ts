/**
 * Devnet Setup Script
 *
 * 1. Airdrops SOL to your wallet
 * 2. Creates a Test USDC token mint (6 decimals)
 * 3. Mints initial supply to your wallet
 * 4. Outputs the mint address for .env configuration
 *
 * Usage: npx ts-node scripts/setup-devnet.ts
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const DEVNET_RPC = "https://api.devnet.solana.com";
const INITIAL_MINT_AMOUNT = 1_000_000; // 1M Test USDC
const DECIMALS = 6;

async function main() {
  console.log("=== Cusp Devnet Setup ===\n");

  // Load wallet keypair
  const keypairPath = path.resolve(
    process.env.HOME || "~",
    ".config/solana/id.json"
  );
  if (!fs.existsSync(keypairPath)) {
    console.error(
      "No Solana keypair found. Run: solana-keygen new"
    );
    process.exit(1);
  }

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  const connection = new Connection(DEVNET_RPC, "confirmed");

  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);

  // 1. Airdrop SOL
  console.log("\n1. Airdropping 2 SOL...");
  try {
    const sig = await connection.requestAirdrop(
      wallet.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig, "confirmed");
    console.log("   Airdrop confirmed!");
  } catch (e: any) {
    console.log(`   Airdrop failed (may be rate-limited): ${e.message}`);
    console.log("   You can manually airdrop: solana airdrop 2");
  }

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`   Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

  // 2. Create Test USDC Mint
  console.log("\n2. Creating Test USDC mint (6 decimals)...");
  const testUsdcMint = await createMint(
    connection,
    wallet, // payer
    wallet.publicKey, // mint authority
    wallet.publicKey, // freeze authority (optional)
    DECIMALS
  );
  console.log(`   Test USDC Mint: ${testUsdcMint.toBase58()}`);

  // 3. Create token account and mint initial supply
  console.log(`\n3. Minting ${INITIAL_MINT_AMOUNT.toLocaleString()} Test USDC...`);
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet,
    testUsdcMint,
    wallet.publicKey
  );

  await mintTo(
    connection,
    wallet,
    testUsdcMint,
    tokenAccount.address,
    wallet, // mint authority
    INITIAL_MINT_AMOUNT * 10 ** DECIMALS
  );
  console.log(`   Minted to: ${tokenAccount.address.toBase58()}`);
  console.log(`   Balance: ${INITIAL_MINT_AMOUNT.toLocaleString()} USDC`);

  // 4. Output for .env
  console.log("\n=== Setup Complete! ===\n");
  console.log("Add these to your .env:\n");
  console.log(`VITE_PHASE=testnet`);
  console.log(`VITE_TEST_USDC_MINT=${testUsdcMint.toBase58()}`);
  console.log(`VITE_MINT_AUTHORITY=${wallet.publicKey.toBase58()}`);

  // Save mint info for reference
  const mintInfo = {
    testUsdcMint: testUsdcMint.toBase58(),
    mintAuthority: wallet.publicKey.toBase58(),
    tokenAccount: tokenAccount.address.toBase58(),
    initialSupply: INITIAL_MINT_AMOUNT,
    decimals: DECIMALS,
    network: "devnet",
    createdAt: new Date().toISOString(),
  };

  const outputPath = path.resolve(__dirname, "../.devnet-config.json");
  fs.writeFileSync(outputPath, JSON.stringify(mintInfo, null, 2));
  console.log(`\nConfig saved to: .devnet-config.json`);
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
