const PROOF_API = "https://proof.dflow.net";
const PROOF_WEB = "https://dflow.net/proof";

export interface ProofVerification {
  verified: boolean;
}

export async function checkKycStatus(
  walletAddress: string
): Promise<boolean> {
  try {
    const res = await fetch(`${PROOF_API}/verify/${walletAddress}`);
    if (!res.ok) return false;
    const data: ProofVerification = await res.json();
    return data.verified === true;
  } catch {
    return false;
  }
}

export function buildProofDeepLink(params: {
  walletAddress: string;
  signatureBase58: string;
  timestamp: number;
  redirectUri?: string;
  projectId?: string;
}): string {
  const url = new URL(PROOF_WEB);
  url.searchParams.set("wallet", params.walletAddress);
  url.searchParams.set("signature", params.signatureBase58);
  url.searchParams.set("timestamp", String(params.timestamp));
  if (params.redirectUri) {
    url.searchParams.set("redirect_uri", params.redirectUri);
  }
  if (params.projectId) {
    url.searchParams.set("projectId", params.projectId);
  }
  return url.toString();
}

export function buildKycSignMessage(): { message: string; timestamp: number } {
  const timestamp = Date.now();
  return {
    message: `Proof KYC verification: ${timestamp}`,
    timestamp,
  };
}
