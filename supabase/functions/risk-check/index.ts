/**
 * risk-check — lightweight standalone (no heavy Solana SDK imports).
 * Uses DB protocol_state for liquidity checks + DFlow API for market status.
 * Falls back to on-chain RPC vault balance when DB state looks stale.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MIN_MARGIN_USDC = 1;
const MAX_LEVERAGE = 3;
const MAX_POS_RATIO = 0.08;
const MIN_TVL_DENOMINATOR_USDC = 500;
const MIN_RESERVE_RATIO = 0.2;
const HARD_EXPIRY_HOURS = 2;
const KALSHI_MAINTENANCE_DAY = 4;
const KALSHI_MAINTENANCE_START = 3;
const KALSHI_MAINTENANCE_END = 5;

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

function isKalshiMaintenance(): boolean {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return (
    et.getDay() === KALSHI_MAINTENANCE_DAY &&
    et.getHours() >= KALSHI_MAINTENANCE_START &&
    et.getHours() < KALSHI_MAINTENANCE_END
  );
}

/**
 * Fetch mainnet vault USDC balance via Solana RPC (JSON-RPC getTokenAccountsByOwner).
 * Used as a fallback when the DB protocol_state looks stale or empty.
 */
async function fetchOnChainVaultBalance(): Promise<number> {
  const rpcUrl = Deno.env.get("SOLANA_RPC_URL");
  const vaultKpRaw = Deno.env.get("VAULT_KEYPAIR");
  if (!rpcUrl || !vaultKpRaw) return 0;

  try {
    const kpBytes: number[] = JSON.parse(vaultKpRaw);
    // ed25519 public key is bytes 32-63 of the 64-byte keypair
    const pubkeyBytes = kpBytes.slice(32, 64);
    const pubkeyBase58 = encodeBase58(new Uint8Array(pubkeyBytes));

    const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [
        pubkeyBase58,
        { mint: USDC_MINT },
        { encoding: "jsonParsed", programId: TOKEN_PROGRAM },
      ],
    };

    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    const accounts = json?.result?.value ?? [];
    let total = 0;
    for (const acct of accounts) {
      const info = acct?.account?.data?.parsed?.info;
      if (info?.tokenAmount?.uiAmount != null) {
        total += info.tokenAmount.uiAmount;
      }
    }
    console.log("[risk-check] On-chain vault USDC balance:", total);
    return total;
  } catch (err) {
    console.warn("[risk-check] On-chain vault balance fetch failed:", err);
    return 0;
  }
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { market_ticker, margin_usdc, leverage } = await req.json();

    if (!market_ticker || typeof market_ticker !== "string") {
      return new Response(
        JSON.stringify({
          approved: false,
          errors: ["market_ticker is required"],
          market_status: null,
          effective_leverage: 1,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const errors: string[] = [];

    if (isKalshiMaintenance()) {
      errors.push("Trading paused during Kalshi maintenance (Thu 3-5 AM ET)");
    }

    const marginParsed = parseMarginUsdc(margin_usdc);
    if (!marginParsed.ok) {
      errors.push(marginParsed.error);
    }

    const levRaw = Number(leverage);
    if (!Number.isFinite(levRaw) || levRaw < 1) {
      errors.push("leverage must be a number >= 1");
    } else if (levRaw > MAX_LEVERAGE) {
      errors.push(`Maximum leverage is ${MAX_LEVERAGE}x`);
    }

    const effLev = effectiveLeverage(leverage);

    // Fetch market info from DFlow
    const METADATA_API = Deno.env.get("DFLOW_METADATA_API") || "https://prediction-markets-api.dflow.net";
    const apiKey = Deno.env.get("DFLOW_API_KEY");

    if (!apiKey) {
      console.error("[risk-check] DFLOW_API_KEY is not set");
    }

    const dflowHeaders: Record<string, string> = {};
    if (apiKey) dflowHeaders["x-api-key"] = apiKey;

    let marketStatus = "unknown";
    let hoursToExpiry = Infinity;

    try {
      const marketRes = await fetch(`${METADATA_API}/api/v1/market/${market_ticker}`, { headers: dflowHeaders });

      if (!marketRes.ok) {
        const body = await marketRes.text().catch(() => "");
        console.error(`[risk-check] DFlow market fetch failed: ${marketRes.status} ${body}`);
        errors.push(`Market data unavailable (DFlow API returned ${marketRes.status})`);
      } else {
        const market = await marketRes.json();
        marketStatus = market.status ?? "unknown";

        if (market.status !== "active") {
          errors.push(`Market is ${market.status}, not active`);
        }

        const expirationMs = (market.expirationTime ?? 0) * 1000;
        hoursToExpiry = (expirationMs - Date.now()) / (1000 * 60 * 60);
        if (hoursToExpiry < HARD_EXPIRY_HOURS) {
          errors.push(`Market expires in ${hoursToExpiry.toFixed(1)}h, minimum ${HARD_EXPIRY_HOURS}h required`);
        }
      }
    } catch (marketErr) {
      console.error("[risk-check] DFlow market fetch exception:", marketErr);
      errors.push("Market data unavailable (DFlow API unreachable)");
    }

    // Check pool liquidity — DB first, on-chain fallback if DB shows 0
    if (marginParsed.ok) {
      const margin = marginParsed.margin;
      const totalUsdc = margin * effLev;
      const borrowedUsdc = margin * (effLev - 1);

      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      let vaultBalance = 0;

      try {
        const stateRes = await fetch(
          `${SUPABASE_URL}/rest/v1/protocol_state?id=eq.1&select=reserve_usdc,total_tvl`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
        );
        const states = await stateRes.json();
        vaultBalance = Number(states?.[0]?.reserve_usdc) || 0;
        console.log("[risk-check] DB vault balance:", vaultBalance);
      } catch (dbErr) {
        console.warn("[risk-check] DB protocol_state fetch failed:", dbErr);
      }

      // Fallback: if DB shows 0 or very low, check on-chain directly
      if (vaultBalance <= 0) {
        console.log("[risk-check] DB balance is 0, falling back to on-chain RPC");
        vaultBalance = await fetchOnChainVaultBalance();
      }

      if (vaultBalance <= 0) {
        errors.push("Vault balance unavailable — please try again shortly");
      } else {
        const maxNotional = maxAllowedPositionUsdc(vaultBalance);
        if (totalUsdc > maxNotional) {
          errors.push(`Position size ($${totalUsdc.toFixed(2)}) exceeds protocol limit ($${maxNotional.toFixed(2)}) for the current pool`);
        }

        const availableAfterBorrow = vaultBalance - borrowedUsdc;
        const ratioAfter = vaultBalance > 0 ? availableAfterBorrow / vaultBalance : 0;
        if (ratioAfter < MIN_RESERVE_RATIO) {
          errors.push(`Insufficient pool liquidity (pool: $${Number(vaultBalance).toFixed(2)}, need to borrow: $${borrowedUsdc.toFixed(2)})`);
        }
      }
    }

    const approved = errors.length === 0;

    return new Response(
      JSON.stringify({
        approved,
        errors,
        market_status: marketStatus,
        effective_leverage: effLev,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[risk-check] Unhandled error:", err);
    return new Response(
      JSON.stringify({
        approved: false,
        error: err instanceof Error ? err.message : "Internal risk check error",
        errors: [err instanceof Error ? err.message : "Internal risk check error"],
        market_status: null,
        effective_leverage: 1,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
