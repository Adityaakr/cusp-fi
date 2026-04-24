const STORAGE_API_KEY = "cusp_api_key";
const STORAGE_INVITE_KEY = "cusp_invite_code";

export const INVITE_CODE = "CUSPBETA";

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

export function hasInviteAccess(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_INVITE_KEY) === INVITE_CODE;
  } catch {
    return false;
  }
}

export function setInviteCode(code: string): boolean {
  if (typeof window === "undefined") return false;
  const normalized = code.trim();
  if (normalized !== INVITE_CODE) return false;
  try {
    window.localStorage.setItem(STORAGE_INVITE_KEY, normalized);
    return true;
  } catch {
    return false;
  }
}

export function clearInviteCode(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_INVITE_KEY);
  } catch {
    // noop
  }
}
