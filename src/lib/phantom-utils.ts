export type PhantomTransactionResult = string | { signature?: string; publicKey?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractPhantomSignature(result: unknown): string {
  if (typeof result === "string") return result;
  if (!isRecord(result)) return "";

  const signature = result.signature;
  if (typeof signature === "string") return signature;

  // Backward-compatible fallback for older/injected wallet shapes without typing it into call sites.
  const legacyHash = result.hash;
  return typeof legacyHash === "string" ? legacyHash : "";
}
