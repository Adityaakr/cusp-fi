import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEVNET_RPC =
  process.env.VITE_DEVNET_RPC_URL ||
  process.env.VITE_SOLANA_RPC_URL ||
  "https://api.devnet.solana.com";
const VAULT_PROGRAM_ID = new PublicKey(
  process.env.VAULT_PROGRAM_ID || "9Jucf5RimpEJnCun98q258zXx9A6n9fP4JHzNzsJ9DBF"
);
const TEST_USDC_MINT = new PublicKey(
  process.env.TEST_USDC_MINT || "3dBvqsis3NVwRzMi2ShVqxkt4TBGjzBZkVFxPFzJmBii"
);

function discriminator(name: string): Buffer {
  return crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

async function main() {
  const amountUi = Number(process.argv[2] || "150");
  if (!Number.isFinite(amountUi) || amountUi <= 0) {
    throw new Error("Usage: tsx scripts/devnet-add-yield.ts <amount_ui>");
  }

  const repoKeypairPath = path.resolve(__dirname, "../.keys/devnet-admin.json");
  const keypairPath = process.env.WALLET_KEYPAIR
    ? path.resolve(process.env.WALLET_KEYPAIR)
    : repoKeypairPath;

  if (!fs.existsSync(keypairPath)) {
    throw new Error(`Missing devnet admin keypair at ${keypairPath}`);
  }

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  const connection = new Connection(DEVNET_RPC, "confirmed");

  const [vaultState] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    VAULT_PROGRAM_ID
  );
  const [vaultUsdcAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault-usdc")],
    VAULT_PROGRAM_ID
  );
  const adminUsdcAta = await getAssociatedTokenAddress(
    TEST_USDC_MINT,
    wallet.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const amountAtomic = Math.round(amountUi * 1e6);
  const data = Buffer.alloc(16);
  discriminator("add_yield").copy(data, 0);
  data.writeBigUInt64LE(BigInt(amountAtomic), 8);

  const ix = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: vaultState, isSigner: false, isWritable: true },
      { pubkey: vaultUsdcAccount, isSigner: false, isWritable: true },
      { pubkey: adminUsdcAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  const signature = await sendAndConfirmTransaction(connection, tx, [wallet], {
    commitment: "confirmed",
  });

  const vaultStateInfo = await connection.getAccountInfo(vaultState);
  if (!vaultStateInfo?.data) {
    throw new Error("Vault state not found after yield add");
  }

  const dataView = Buffer.from(vaultStateInfo.data);
  const offset = 8 + 32 * 4;
  const totalUsdcManaged = Number(dataView.readBigUInt64LE(offset)) / 1e6;
  const totalCusdcSupply = Number(dataView.readBigUInt64LE(offset + 8)) / 1e6;
  const exchangeRate =
    totalCusdcSupply > 0 ? totalUsdcManaged / totalCusdcSupply : 1;

  console.log(JSON.stringify({
    signature,
    amountUi,
    vaultState: vaultState.toBase58(),
    vaultUsdcAccount: vaultUsdcAccount.toBase58(),
    totalUsdcManaged,
    totalCusdcSupply,
    exchangeRate,
  }, null, 2));
}

main().catch((error) => {
  console.error("devnet-add-yield failed:", error);
  process.exit(1);
});
