import { supabase } from "@/lib/supabase";

const STORAGE_API_KEY = "cusp_api_key";
const STORAGE_ACCESS_TOKEN = "cusp_invite_access_token";

const API_KEY_LENGTH = 10;
const API_KEY_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateApiKey(length = API_KEY_LENGTH): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < length; i++) {
      out += API_KEY_ALPHABET[bytes[i] % API_KEY_ALPHABET.length];
    }
    return out;
  }
  let out = "";
  for (let i = 0; i < length; i++) {
    out += API_KEY_ALPHABET[Math.floor(Math.random() * API_KEY_ALPHABET.length)];
  }
  return out;
}

export function getOrCreateApiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(STORAGE_API_KEY);
    if (existing && existing.length > 0 && existing.length <= API_KEY_LENGTH) {
      return existing;
    }
    const fresh = generateApiKey();
    window.localStorage.setItem(STORAGE_API_KEY, fresh);
    return fresh;
  } catch {
    return generateApiKey();
  }
}

export function isInviteGateBypassed(): boolean {
  return import.meta.env.VITE_SKIP_INVITE_GATE === "true";
}

export function getInviteAccessToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_ACCESS_TOKEN) ?? "";
  } catch {
    return "";
  }
}

export async function hasInviteAccess(): Promise<boolean> {
  const token = getInviteAccessToken();
  if (!token) return false;
  if (!supabase) return false;

  try {
    const { data, error } = await supabase.functions.invoke("verify-invite", {
      body: { token },
    });
    if (error || !data?.ok) {
      clearInviteCode();
      return false;
    }
    return true;
  } catch {
    clearInviteCode();
    return false;
  }
}

export async function setInviteCode(code: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!supabase) return false;

  try {
    const { data, error } = await supabase.functions.invoke("verify-invite", {
      body: { code: code.trim() },
    });
    const token = typeof data?.token === "string" ? data.token : "";
    if (error || !data?.ok || !token) return false;
    window.localStorage.setItem(STORAGE_ACCESS_TOKEN, token);
    return true;
  } catch {
    return false;
  }
}

export function clearInviteCode(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_ACCESS_TOKEN);
  } catch {
    // noop
  }
}
