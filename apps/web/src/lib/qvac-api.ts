import type { AnyQvacCommand } from "@cusp/shared";
import { cuspApiFetch } from "@/lib/cusp-api";

interface QvacRouteResponse {
  success: boolean;
  intent_id: string;
  execution_plan?: unknown;
  data?: Record<string, unknown>;
  error?: string;
}

export async function previewQvacCommand(command: AnyQvacCommand) {
  return cuspApiFetch<QvacRouteResponse>("/api/qvac", {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export async function executeQvacCommand(
  command: AnyQvacCommand,
  extras?: Record<string, unknown>
) {
  return cuspApiFetch<QvacRouteResponse>("/api/qvac", {
    method: "POST",
    body: JSON.stringify({
      ...command,
      ...extras,
      requires_user_confirmation: false,
    }),
  });
}

export function extractTxSignature(data?: Record<string, unknown>): string | undefined {
  if (!data) return undefined;

  const direct =
    typeof data.tx_signature === "string"
      ? data.tx_signature
      : typeof data.txSignature === "string"
        ? data.txSignature
        : undefined;

  if (direct) return direct;

  const nestedData = data.data;
  if (nestedData && typeof nestedData === "object") {
    const nested = nestedData as Record<string, unknown>;
    return typeof nested.tx_signature === "string"
      ? nested.tx_signature
      : typeof nested.txSignature === "string"
        ? nested.txSignature
        : undefined;
  }

  return undefined;
}
