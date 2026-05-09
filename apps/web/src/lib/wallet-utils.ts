export type WalletTransactionResult = string | { signature?: string; publicKey?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractSignature(result: unknown): string {
  if (typeof result === "string") return result;
  if (!isRecord(result)) return "";

  const signature = result.signature;
  if (typeof signature === "string") return signature;

  const legacyHash = result.hash;
  return typeof legacyHash === "string" ? legacyHash : "";
}
