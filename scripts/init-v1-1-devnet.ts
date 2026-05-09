/**
 * Initialize the current native-program devnet state.
 *
 * Historical filename retained for convenience. The current native programs
 * expose a single vault and leverage protocol initializer; tiered vault setup
 * and market registration are not implemented on-chain here.
 *
 * Usage: npx ts-node scripts/init-v1-1-devnet.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const VAULT_PROGRAM_ID = new PublicKey(process.env.VAULT_PROGRAM_ID || "EtGTQ9pmcnkYtTdorACENJPBmYVeWo8vrDzH7kU1K7DQ");
const LEVERAGE_PROGRAM_ID = new PublicKey(process.env.LEVERAGE_PROGRAM_ID || "Duyqj2n1CxiVhCN4fgNFf8dbtSeyrZVE3XCBtG6VUgx9");
const TEST_USDC_MINT = new PublicKey(process.env.TEST_USDC_MINT || "wt1s1m9T9U4au8XW1J9EqtouHCTaeFKBMRFHYP7axGN");
const MAX_LEVERAGE_BPS = Number(process.env.MAX_LEVERAGE_BPS || "300");

function discriminator(name: string): Buffer {
  return crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function u16le(value: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(value, 0);
  return b;
}

async function main() {
  console.log("=== Initializing current CUSP devnet state ===\n");

  const repoKeypairPath = path.resolve(__dirname, "../.keys/devnet-admin.json");
  const keypairPath = process.env.WALLET_KEYPAIR
    ? path.resolve(process.env.WALLET_KEYPAIR)
    : fs.existsSync(repoKeypairPath)
      ? repoKeypairPath
      : path.resolve(process.env.HOME || "~", ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  const connection = new Connection(DEVNET_RPC, "confirmed");

  const config: Record<string, unknown> = {
    network: "devnet",
    vaultProgram: VAULT_PROGRAM_ID.toBase58(),
    leverageProgram: LEVERAGE_PROGRAM_ID.toBase58(),
    testUsdcMint: TEST_USDC_MINT.toBase58(),
    admin: wallet.publicKey.toBase58(),
    vaults: {},
    protocolState: "",
    createdAt: new Date().toISOString(),
  };

  const [vaultState] = PublicKey.findProgramAddressSync([Buffer.from("vault")], VAULT_PROGRAM_ID);
  const [cusdcMint] = PublicKey.findProgramAddressSync([Buffer.from("cusdc-mint")], VAULT_PROGRAM_ID);
  const [vaultUsdcAccount] = PublicKey.findProgramAddressSync([Buffer.from("vault-usdc")], VAULT_PROGRAM_ID);
  const [protocolState] = PublicKey.findProgramAddressSync([Buffer.from("protocol")], LEVERAGE_PROGRAM_ID);

  console.log("Vault:");
  console.log(`  Vault State:        ${vaultState.toBase58()}`);
  console.log(`  cUSDC Mint:         ${cusdcMint.toBase58()}`);
  console.log(`  Vault USDC Account: ${vaultUsdcAccount.toBase58()}`);
  console.log("");
  console.log("Leverage:");
  console.log(`  Protocol State:     ${protocolState.toBase58()}`);
  console.log(`  Max Leverage BPS:   ${MAX_LEVERAGE_BPS}`);

  const vaultInfo = await connection.getAccountInfo(vaultState);
  if (!vaultInfo) {
    const initIx = new TransactionInstruction({
      programId: VAULT_PROGRAM_ID,
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: vaultState, isSigner: false, isWritable: true },
        { pubkey: cusdcMint, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([discriminator("initialize"), TEST_USDC_MINT.toBuffer()]),
    });
    const sig = await sendAndConfirmTransaction(connection, new Transaction().add(initIx), [wallet], {
      commitment: "confirmed",
    });
    console.log(`  vault initialize tx: ${sig}`);
  } else {
    console.log("  vault already initialized");
  }

  const vaultUsdcInfo = await connection.getAccountInfo(vaultUsdcAccount);
  if (!vaultUsdcInfo) {
    const initAccountIx = new TransactionInstruction({
      programId: VAULT_PROGRAM_ID,
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: vaultState, isSigner: false, isWritable: true },
        { pubkey: TEST_USDC_MINT, isSigner: false, isWritable: false },
        { pubkey: vaultUsdcAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: discriminator("init_vault_account"),
    });
    const sig = await sendAndConfirmTransaction(connection, new Transaction().add(initAccountIx), [wallet], {
      commitment: "confirmed",
    });
    console.log(`  init_vault_account tx: ${sig}`);
  } else {
    console.log("  vault USDC account already initialized");
  }

  const protocolInfo = await connection.getAccountInfo(protocolState);
  if (!protocolInfo) {
    const initLeverageIx = new TransactionInstruction({
      programId: LEVERAGE_PROGRAM_ID,
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: protocolState, isSigner: false, isWritable: true },
        { pubkey: TEST_USDC_MINT, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([discriminator("initialize"), u16le(MAX_LEVERAGE_BPS)]),
    });
    const sig = await sendAndConfirmTransaction(connection, new Transaction().add(initLeverageIx), [wallet], {
      commitment: "confirmed",
    });
    console.log(`  leverage initialize tx: ${sig}`);
  } else {
    console.log("  leverage protocol already initialized");
  }

  if (process.env.SAMPLE_YES_MINT || process.env.SAMPLE_NO_MINT) {
    console.log("");
    console.log("  SAMPLE_YES_MINT / SAMPLE_NO_MINT ignored.");
    console.log("  Current native leverage program does not expose register_market.");
  }

  (config.vaults as Record<string, unknown>).primary = {
    symbol: "cUSDC",
    vaultState: vaultState.toBase58(),
    cusdcMint: cusdcMint.toBase58(),
    vaultUsdcAccount: vaultUsdcAccount.toBase58(),
  };
  config.protocolState = protocolState.toBase58();

  fs.writeFileSync(path.resolve(__dirname, "../.devnet-config.json"), JSON.stringify(config, null, 2));
  console.log("\nConfig saved to .devnet-config.json");
}

main().catch((err) => {
  console.error("Init failed:", err);
  process.exit(1);
});
