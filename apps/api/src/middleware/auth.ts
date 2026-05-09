import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { INVITE_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../config/index.js";

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
}

export interface InviteVerificationResult {
  valid: boolean;
  token?: string;
  error?: string;
}

export async function verifyInviteCode(code: string): Promise<InviteVerificationResult> {
  if (!INVITE_SECRET) {
    return { valid: false, error: "Invite system not configured" };
  }

  const expected = crypto
    .createHmac("sha256", INVITE_SECRET)
    .update(code)
    .digest("hex");

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/invite_codes?code=eq.${encodeURIComponent(code)}&select=*`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      return { valid: false, error: "Invite verification failed" };
    }

    const codesRaw = await res.json() as any;
    const codes = Array.isArray(codesRaw) ? codesRaw : [];
    if (codes.length === 0) {
      return { valid: false, error: "Invalid invite code" };
    }

    const invite = codes[0];
    if (invite.used) {
      return { valid: false, error: "Invite code already used" };
    }

    const token = crypto.randomBytes(32).toString("hex");
    return { valid: true, token };
  } catch {
    return { valid: false, error: "Invite verification failed" };
  }
}
