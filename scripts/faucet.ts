/**
 * Faucet Script — Mint test USDC to any wallet address on devnet.
 *
 * Usage:
 *   npx ts-node scripts/faucet.ts <wallet_address> [amount]
 *
 * Examples:
 *   npx ts-node scripts/faucet.ts 7xKX...abc          # mints 1000 USDC
 *   npx ts-node scripts/faucet.ts 7xKX...abc 5000     # mints 5000 USDC
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEVNET_RPC = process.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const DEFAULT_AMOUNT = 1_000; // 1000 USDC
const DECIMALS = 6;
const SOL_TRANSFER_AMOUNT = 0.5; // SOL to transfer for gas fees

async function main() {
  const targetAddress = process.argv[2];
  const amount = parseInt(process.argv[3] || String(DEFAULT_AMOUNT), 10);

  if (!targetAddress) {
    console.error("Usage: npx ts-node scripts/faucet.ts <wallet_address> [amount]");
    process.exit(1);
  }

  // Load devnet config
  const configPath = path.resolve(__dirname, "../.devnet-config.json");
  if (!fs.existsSync(configPath)) {
    console.error("No .devnet-config.json found. Run setup-devnet.ts first.");
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  // Load mint authority keypair
  const keypairPath = path.resolve(
    process.env.HOME || "~",
    ".config/solana/id.json"
  );
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const mintAuthority = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  const connection = new Connection(DEVNET_RPC, "confirmed");
  const targetPubkey = new PublicKey(targetAddress);
  const usdcMint = new PublicKey(config.testUsdcMint);

  console.log(`Minting ${amount} Test USDC to ${targetAddress}...`);

  // Transfer SOL from admin wallet for gas fees
  try {
    const targetBalance = await connection.getBalance(targetPubkey);
    if (targetBalance < SOL_TRANSFER_AMOUNT * LAMPORTS_PER_SOL) {
      console.log(`Transferring ${SOL_TRANSFER_AMOUNT} SOL for gas from admin wallet...`);
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: mintAuthority.publicKey,
          toPubkey: targetPubkey,
          lamports: Math.floor(SOL_TRANSFER_AMOUNT * LAMPORTS_PER_SOL),
        })
      );
      await sendAndConfirmTransaction(connection, tx, [mintAuthority]);
      console.log(`${SOL_TRANSFER_AMOUNT} SOL transferred!`);
    } else {
      console.log(`Target already has ${(targetBalance / LAMPORTS_PER_SOL).toFixed(3)} SOL — skipping transfer.`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`SOL transfer skipped: ${msg}`);
  }

  // Create ATA if needed and mint
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    mintAuthority, // payer
    usdcMint,
    targetPubkey
  );

  await mintTo(
    connection,
    mintAuthority,
    usdcMint,
    ata.address,
    mintAuthority,
    amount * 10 ** DECIMALS
  );

  console.log(`\nDone! ${amount} Test USDC minted to ${ata.address.toBase58()}`);
}

main().catch((err) => {
  console.error("Faucet error:", err);
  process.exit(1);
});
