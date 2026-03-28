/**
 * open-position — Lends borrowed USDC from vault to user's wallet.
 * The user then places the DFlow trade from their own (verified) wallet.
 *
 * Uses manual SPL token helpers to avoid importing the heavy @solana/spl-token library.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "https://esm.sh/@solana/web3.js@1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

const MIN_MARGIN_USDC = 1;
const MAX_LEVERAGE = 3;
const MAX_POS_RATIO = 0.08;
const MIN_TVL_DENOMINATOR_USDC = 500;

// --- Manual SPL token helpers (avoids heavy @solana/spl-token import) ---

function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey, allowOwnerOffCurve = false): PublicKey {
  const seeds = [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()];
  const [address] = PublicKey.findProgramAddressSync(seeds, ASSOCIATED_TOKEN_PROGRAM_ID);
  return address;
}

function createAssociatedTokenAccountInstruction(
  payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: new Uint8Array(0),
  });
}

function createTransferInstruction(
  source: PublicKey, destination: PublicKey, owner: PublicKey, amount: number
): TransactionInstruction {
  // SPL Token Transfer instruction: index 3, then u64 amount (little-endian)
  const data = new Uint8Array(9);
  data[0] = 3; // Transfer instruction index
  const view = new DataView(data.buffer);
  view.setBigUint64(1, BigInt(amount), true); // little-endian
  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  });
}

// --- Protocol helpers ---

function maxAllowedPositionUsdc(tvlRaw: unknown): number {
  const tvl = Number(tvlRaw);
  const denom = Math.max(Number.isFinite(tvl) ? tvl : 0, MIN_TVL_DENOMINATOR_USDC);
  return denom * MAX_POS_RATIO;
}

function parseMarginUsdc(input: unknown):
  | { ok: true; margin: number }
  | { ok: false; error: string } {
  if (input === null || input === undefined) return { ok: false, error: "margin_usdc is required" };
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return { ok: false, error: "margin_usdc must be a finite number" };
  if (n < MIN_MARGIN_USDC) return { ok: false, error: `Minimum margin is ${MIN_MARGIN_USDC} USDC` };
  if (n > 1_000_000) return { ok: false, error: "margin_usdc exceeds maximum allowed" };
  return { ok: true, margin: n };
}

function effectiveLeverage(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_LEVERAGE);
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function encodeBase58(bytes: Uint8Array): string {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let str = "";
  for (const b of bytes) {
    if (b === 0) str += "1";
    else break;
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    str += BASE58_ALPHABET[digits[i]];
  }
  return str;
}

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let step = "parse-request";

  try {
    const body = await req.json();
    const { wallet_address, market_ticker, side, margin_usdc, leverage, output_mint } = body;

    if (!wallet_address || !market_ticker || !side || !output_mint) {
      return jsonResp({ error: "Missing required fields" }, 400);
    }

    const marginParsed = parseMarginUsdc(margin_usdc);
    if (!marginParsed.ok) {
      return jsonResp({ error: marginParsed.error }, 400);
    }
    const margin = marginParsed.margin;
    const effectiveLev = effectiveLeverage(leverage);
    const borrowedUsdc = margin * (effectiveLev - 1);
    const totalUsdc = margin + borrowedUsdc;

    // --- Environment ---
    step = "read-env";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const RPC_URL = Deno.env.get("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";
    const VAULT_KEYPAIR_RAW = Deno.env.get("VAULT_KEYPAIR");

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return jsonResp({ error: "Server misconfigured: missing SUPABASE_URL or SERVICE_ROLE_KEY" }, 500);
    }
    if (!VAULT_KEYPAIR_RAW) {
      return jsonResp({ error: "Server misconfigured: missing VAULT_KEYPAIR" }, 500);
    }

    const sbHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: "return=representation",
    };

    // --- Protocol state ---
    step = "read-protocol-state";
    const stateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/protocol_state?id=eq.1&select=*`,
      { headers: sbHeaders }
    );
    if (!stateRes.ok) {
      const t = await stateRes.text().catch(() => "");
      console.error("[open-position] protocol_state fetch failed:", stateRes.status, t);
      return jsonResp({ error: `DB error reading protocol state: ${stateRes.status}` }, 500);
    }
    const states = await stateRes.json();
    const state = states?.[0];
    if (!state) {
      return jsonResp({ error: "Protocol state not initialized" }, 500);
    }

    // --- Liquidity checks (DB + on-chain fallback) ---
    step = "liquidity-check";
    let vaultReserve = Number(state.reserve_usdc) || 0;

    // If DB shows 0, read the vault's actual on-chain USDC balance
    if (vaultReserve <= 0 && VAULT_KEYPAIR_RAW) {
      step = "on-chain-balance-fallback";
      try {
        const kpBytes: number[] = JSON.parse(VAULT_KEYPAIR_RAW);
        const pubkeyBytes = kpBytes.slice(32, 64);
        const pubkeyBase58 = encodeBase58(new Uint8Array(pubkeyBytes));
        const rpcBody = {
          jsonrpc: "2.0", id: 1,
          method: "getTokenAccountsByOwner",
          params: [pubkeyBase58, { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
            { encoding: "jsonParsed", programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }],
        };
        const rpcRes = await fetch(RPC_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rpcBody),
        });
        const rpcJson = await rpcRes.json();
        for (const acct of rpcJson?.result?.value ?? []) {
          const amt = acct?.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
          if (amt != null) vaultReserve += amt;
        }
        console.log("[open-position] On-chain vault reserve:", vaultReserve);
      } catch (rpcErr) {
        console.warn("[open-position] On-chain balance check failed:", rpcErr);
      }
      step = "liquidity-check";
    }

    const maxNotional = maxAllowedPositionUsdc(vaultReserve > 0 ? vaultReserve : state.total_tvl);
    if (totalUsdc > maxNotional) {
      return jsonResp({
        error: `Position notional $${totalUsdc.toFixed(2)} exceeds protocol limit $${maxNotional.toFixed(2)}`,
      }, 400);
    }

    const availableForBorrow = vaultReserve * 0.8;
    if (borrowedUsdc > availableForBorrow) {
      return jsonResp({
        error: `Insufficient pool liquidity (pool: $${vaultReserve.toFixed(2)}, max borrow: $${availableForBorrow.toFixed(2)}, requested: $${borrowedUsdc.toFixed(2)})`,
      }, 400);
    }

    // --- Parse vault keypair ---
    step = "parse-vault-keypair";
    let vaultKeypair: InstanceType<typeof Keypair>;
    try {
      const kpArray = JSON.parse(VAULT_KEYPAIR_RAW);
      vaultKeypair = Keypair.fromSecretKey(Uint8Array.from(kpArray));
    } catch (kpErr) {
      console.error("[open-position] Failed to parse VAULT_KEYPAIR:", kpErr);
      return jsonResp({ error: "Server misconfigured: invalid VAULT_KEYPAIR format" }, 500);
    }
    console.log("[open-position] Vault pubkey:", vaultKeypair.publicKey.toBase58());

    // --- Solana connection ---
    step = "solana-connect";
    const connection = new Connection(RPC_URL, "confirmed");
    const userPubkey = new PublicKey(wallet_address);
    const borrowedAtomic = Math.round(borrowedUsdc * 1e6);

    let lendSignature = "";
    let lendWarning = "";

    if (borrowedAtomic > 0) {
      try {
        step = "check-vault-sol";
        const vaultSol = await connection.getBalance(vaultKeypair.publicKey);
        console.log("[open-position] Vault SOL balance:", vaultSol / 1e9, "SOL");

        if (vaultSol < 10_000) {
          lendWarning = `Vault has insufficient SOL for fees (${(vaultSol / 1e9).toFixed(6)} SOL). Lending skipped — position recorded, user trades with own funds.`;
          console.warn("[open-position]", lendWarning);
        } else {
          step = "derive-atas";
          const vaultAta = getAssociatedTokenAddress(USDC_MINT, vaultKeypair.publicKey, true);
          const userAta = getAssociatedTokenAddress(USDC_MINT, userPubkey, false);
          console.log("[open-position] Vault ATA:", vaultAta.toBase58(), "User ATA:", userAta.toBase58());

          // Verify vault actually has the USDC to lend
          step = "check-vault-usdc";
          const vaultAtaInfo = await connection.getAccountInfo(vaultAta);
          if (!vaultAtaInfo) {
            lendWarning = "Vault USDC account not found on-chain. Lending skipped.";
            console.warn("[open-position]", lendWarning);
          } else {
            const instructions: TransactionInstruction[] = [];

            step = "check-user-ata";
            const userAtaInfo = await connection.getAccountInfo(userAta);
            if (!userAtaInfo) {
              console.log("[open-position] Creating user USDC ATA");
              instructions.push(
                createAssociatedTokenAccountInstruction(
                  vaultKeypair.publicKey, userAta, userPubkey, USDC_MINT
                )
              );
            }

            instructions.push(
              createTransferInstruction(vaultAta, userAta, vaultKeypair.publicKey, borrowedAtomic)
            );

            step = "build-tx";
            const { blockhash } = await connection.getLatestBlockhash();
            const messageV0 = new TransactionMessage({
              payerKey: vaultKeypair.publicKey,
              recentBlockhash: blockhash,
              instructions,
            }).compileToV0Message();

            const tx = new VersionedTransaction(messageV0);
            tx.sign([vaultKeypair]);

            step = "send-tx";
            lendSignature = await connection.sendTransaction(tx);
            console.log("[open-position] Lend tx sent:", lendSignature);
          }
        }
      } catch (txErr) {
        const msg = txErr instanceof Error ? txErr.message : String(txErr);
        console.error("[open-position] Lending failed (non-fatal):", msg);
        lendWarning = `Vault lending failed: ${msg}. Position recorded — user trades with own funds.`;
      }
    }

    // --- Record position in database ---
    step = "create-user";
    const userIdRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_or_create_user`, {
      method: "POST",
      headers: sbHeaders,
      body: JSON.stringify({ p_wallet_address: wallet_address }),
    });
    if (!userIdRes.ok) {
      const t = await userIdRes.text().catch(() => "");
      console.error("[open-position] get_or_create_user failed:", userIdRes.status, t);
      return jsonResp({ error: `DB error creating user: ${userIdRes.status}` }, 500);
    }
    const userId = await userIdRes.json();
    console.log("[open-position] User ID:", userId);

    step = "insert-position";
    const posRes = await fetch(`${SUPABASE_URL}/rest/v1/positions`, {
      method: "POST",
      headers: sbHeaders,
      body: JSON.stringify({
        position_type: effectiveLev > 1 ? "leveraged" : "direct",
        user_id: userId,
        market_ticker,
        side,
        entry_price: 0,
        quantity: 0,
        usdc_cost: totalUsdc,
        outcome_mint: output_mint,
        status: "open",
      }),
    });
    if (!posRes.ok) {
      const t = await posRes.text().catch(() => "");
      console.error("[open-position] insert position failed:", posRes.status, t);
      return jsonResp({ error: `DB error recording position: ${posRes.status} ${t}` }, 500);
    }
    const position = (await posRes.json())?.[0];

    step = "insert-leveraged-trade";
    if (effectiveLev > 1 && position) {
      const ltRes = await fetch(`${SUPABASE_URL}/rest/v1/leveraged_trades`, {
        method: "POST",
        headers: sbHeaders,
        body: JSON.stringify({
          user_id: userId,
          position_id: position.id,
          margin_usdc: margin,
          borrowed_usdc: borrowedUsdc,
          leverage: effectiveLev,
          health_factor: 2.0,
          borrow_rate_bps: 500,
        }),
      });
      if (!ltRes.ok) {
        const t = await ltRes.text().catch(() => "");
        console.error("[open-position] insert leveraged_trade failed:", ltRes.status, t);
      }
    }

    // --- Update protocol state (use actual on-chain balance when lending succeeded) ---
    step = "update-protocol-state";
    const actualBorrowed = lendSignature ? borrowedUsdc : 0;
    const newReserve = Math.max(0, vaultReserve - actualBorrowed);
    await fetch(`${SUPABASE_URL}/rest/v1/protocol_state?id=eq.1`, {
      method: "PATCH",
      headers: sbHeaders,
      body: JSON.stringify({
        deployed_usdc: Number(state.deployed_usdc) + actualBorrowed,
        reserve_usdc: newReserve,
        total_tvl: newReserve + Number(state.deployed_usdc) + actualBorrowed,
        updated_at: new Date().toISOString(),
      }),
    });

    console.log("[open-position] Success: position", position?.id, "lend", lendSignature || "(skipped)");

    return jsonResp({
      success: true,
      position_id: position?.id,
      lend_signature: lendSignature,
      lend_warning: lendWarning || undefined,
      total_usdc: totalUsdc,
      borrowed_usdc: borrowedUsdc,
      leverage: effectiveLev,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown open-position error";
    console.error(`[open-position] Error at step "${step}":`, message, err);
    return jsonResp({ error: `${message} (step: ${step})` }, 500);
  }
});
