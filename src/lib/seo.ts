/** Centralized SEO constants for Cusp. */
export const SITE_URL = "https://beta.cusp.fi";
export const SITE_NAME = "Cusp";
export const TWITTER_HANDLE = "@usecusp";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export const DEFAULT_TITLE = "Cusp — The capital markets layer for prediction markets";
export const DEFAULT_DESCRIPTION =
  "Cusp is the capital markets layer for prediction markets on Solana. Borrow against live positions, earn on idle capital, and get paid the moment a market resolves.";

/** Build an absolute canonical URL from a route path (e.g. "/waitlist"). */
export function canonicalUrl(path = "/"): string {
  if (!path || path === "/") return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
