import { corsHeaders, handleCors } from "../_shared/cors.ts";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getInviteConfig() {
  const inviteCode = Deno.env.get("CUSP_INVITE_CODE");
  const inviteSecret = Deno.env.get("CUSP_INVITE_SECRET");
  if (!inviteCode || !inviteSecret) {
    throw new Error("Invite access is not configured");
  }
  return { inviteCode, inviteSecret };
}

function normalizeCode(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const left = enc.encode(a);
  const right = enc.encode(b);
  const max = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < max; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

function toBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(signature);
}

async function issueToken(secret: string): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const nonce = crypto.randomUUID();
  const payload = `${expiresAt}.${nonce}`;
  const signature = await sign(payload, secret);
  return { token: `${payload}.${signature}`, expiresAt };
}

async function verifyToken(token: unknown, secret: string): Promise<boolean> {
  if (typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [expiresRaw, nonce, signature] = parts;
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = await sign(`${expiresRaw}.${nonce}`, secret);
  return timingSafeEqual(signature, expected);
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const { inviteCode, inviteSecret } = getInviteConfig();
    const body = await req.json().catch(() => ({}));

    if (await verifyToken(body?.token, inviteSecret)) {
      return json({ ok: true });
    }

    const code = normalizeCode(body?.code);
    if (!code || !timingSafeEqual(code, inviteCode)) {
      return json({ ok: false, error: "Invalid invite code" }, 401);
    }

    const { token, expiresAt } = await issueToken(inviteSecret);
    return json({ ok: true, token, expiresAt });
  } catch (err) {
    console.error("[verify-invite]", err);
    return json({ ok: false, error: "Invite access unavailable" }, 500);
  }
});
