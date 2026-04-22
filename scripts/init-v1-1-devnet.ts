/**
 * Initialize CUSP v1.1 devnet state.
 *
 * Creates all three tiered vaults:
 *   0 Conservative -> cUSDC-C
 *   1 Moderate     -> cUSDC-M
 *   2 Growth       -> cUSDC-G
 *
 * If SAMPLE_YES_MINT and SAMPLE_NO_MINT are provided, also registers one sample
 * leverage market config. This script intentionally writes only public addresses
 * to .devnet-config.json.
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
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
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

const TIERS = [
  { id: 0, key: "conservative", symbol: "cUSDC-C" },
  { id: 1, key: "moderate", symbol: "cUSDC-M" },
  { id: 2, key: "growth", symbol: "cUSDC-G" },
] as const;

function discriminator(name: string): Buffer {
  return crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function i64le(value: number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(BigInt(value), 0);
  return b;
}

function u64le(value: number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(value), 0);
  return b;
}

function u16le(value: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(value, 0);
  return b;
}

function tickerBytes(input: string): Buffer {
  const b = Buffer.alloc(32);
  Buffer.from(input).copy(b, 0, 0, Math.min(32, Buffer.byteLength(input)));
  return b;
}

async function main() {
  console.log("=== Initializing CUSP v1.1 devnet ===\n");

  const keypairPath = path.resolve(process.env.HOME || "~", ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  const connection = new Connection(DEVNET_RPC, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), { commitment: "confirmed" });

  const config: Record<string, unknown> = {
    network: "devnet",
    vaultProgram: VAULT_PROGRAM_ID.toBase58(),
    leverageProgram: LEVERAGE_PROGRAM_ID.toBase58(),
    testUsdcMint: TEST_USDC_MINT.toBase58(),
    admin: wallet.publicKey.toBase58(),
    vaults: {},
    markets: {},
    createdAt: new Date().toISOString(),
  };

  for (const tier of TIERS) {
    const tierSeed = Buffer.from([tier.id]);
    const [vaultState] = PublicKey.findProgramAddressSync([Buffer.from("vault"), tierSeed], VAULT_PROGRAM_ID);
    const [cusdcMint] = PublicKey.findProgramAddressSync([Buffer.from("cusdc-mint"), tierSeed], VAULT_PROGRAM_ID);
    const [vaultUsdcAccount] = PublicKey.findProgramAddressSync([Buffer.from("vault-usdc"), tierSeed], VAULT_PROGRAM_ID);

    console.log(`${tier.symbol}:`);
    console.log(`  Vault State:        ${vaultState.toBase58()}`);
    console.log(`  cUSDC Mint:         ${cusdcMint.toBase58()}`);
    console.log(`  Vault USDC Account: ${vaultUsdcAccount.toBase58()}`);

    const vaultInfo = await connection.getAccountInfo(vaultState);
    if (!vaultInfo) {
      const initData = Buffer.concat([
        discriminator("initialize"),
        TEST_USDC_MINT.toBuffer(),
        Buffer.from([tier.id]),
      ]);
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
        data: initData,
      });
      const sig = await provider.sendAndConfirm(new Transaction().add(initIx), [wallet]);
      console.log(`  initialize tx: ${sig}`);
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
      const sig = await provider.sendAndConfirm(new Transaction().add(initAccountIx), [wallet]);
      console.log(`  init_vault_account tx: ${sig}`);
    } else {
      console.log("  vault USDC account already initialized");
    }

    (config.vaults as Record<string, unknown>)[tier.key] = {
      riskTier: tier.id,
      symbol: tier.symbol,
      vaultState: vaultState.toBase58(),
      cusdcMint: cusdcMint.toBase58(),
      vaultUsdcAccount: vaultUsdcAccount.toBase58(),
    };
  }

  const sampleYes = process.env.SAMPLE_YES_MINT;
  const sampleNo = process.env.SAMPLE_NO_MINT;
  if (sampleYes && sampleNo) {
    const ticker = process.env.SAMPLE_MARKET_TICKER || "CUSP-SAMPLE-YES";
    const tickerBuf = tickerBytes(ticker);
    const [protocolState] = PublicKey.findProgramAddressSync([Buffer.from("protocol")], LEVERAGE_PROGRAM_ID);
    const [marketConfig] = PublicKey.findProgramAddressSync([Buffer.from("market"), tickerBuf], LEVERAGE_PROGRAM_ID);
    const resolution = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    console.log("\nSample market:");
    console.log(`  Ticker: ${ticker}`);
    console.log(`  Market Config: ${marketConfig.toBase58()}`);

    const marketInfo = await connection.getAccountInfo(marketConfig);
    if (!marketInfo) {
      const data = Buffer.concat([
        discriminator("register_market"),
        tickerBuf,
        new PublicKey(sampleYes).toBuffer(),
        new PublicKey(sampleNo).toBuffer(),
        TEST_USDC_MINT.toBuffer(),
        Buffer.from([0]),
        u16le(7700),
        i64le(resolution),
        Buffer.from([1]),
      ]);
      const ix = new TransactionInstruction({
        programId: LEVERAGE_PROGRAM_ID,
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: protocolState, isSigner: false, isWritable: false },
          { pubkey: marketConfig, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      });
      const sig = await provider.sendAndConfirm(new Transaction().add(ix), [wallet]);
      console.log(`  register_market tx: ${sig}`);
    } else {
      console.log("  sample market already registered");
    }
    (config.markets as Record<string, unknown>)[ticker] = { marketConfig: marketConfig.toBase58(), fundTier: 0 };
  }

  fs.writeFileSync(path.resolve(__dirname, "../.devnet-config.json"), JSON.stringify(config, null, 2));
  console.log("\nConfig saved to .devnet-config.json");
}

main().catch((err) => {
  console.error("Init failed:", err);
  process.exit(1);
});
