import { CUSP_API_BASE } from "./network-config";

function buildUrl(path: string): string {
  if (!CUSP_API_BASE) return path;
  return `${CUSP_API_BASE}${path}`;
}

export async function cuspApiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error =
      typeof payload?.error === "string"
        ? payload.error
        : `API error: ${response.status}`;
    throw new Error(error);
  }

  return payload as T;
}

export function cuspApiUrl(path: string): string {
  return buildUrl(path);
}
