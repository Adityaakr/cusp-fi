import { Helmet } from "react-helmet-async";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  DEFAULT_TITLE,
  SITE_NAME,
  TWITTER_HANDLE,
  canonicalUrl,
} from "@/lib/seo";

interface SEOProps {
  /** Page title. Pass the bare page name; the site name is appended automatically. */
  title?: string;
  /** Pass a fully-formed <title> instead of having the site name appended. */
  fullTitle?: string;
  description?: string;
  /** Route path used to build the canonical + og:url, e.g. "/waitlist". */
  path?: string;
  /** Absolute image URL for social cards. Defaults to the branded OG image. */
  image?: string;
  /** When true, instructs crawlers not to index the page (gated/app routes). */
  noindex?: boolean;
}

/**
 * Per-route SEO tags. Renders into <head> via react-helmet-async.
 * Defaults mirror the static tags in index.html so any route is safe to omit fields.
 */
export default function SEO({
  title,
  fullTitle,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  image = DEFAULT_OG_IMAGE,
  noindex = false,
}: SEOProps) {
  const resolvedTitle = fullTitle ?? (title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE);
  const url = canonicalUrl(path);

  return (
    <Helmet prioritizeSeoTags>
      <title>{resolvedTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      )}

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={resolvedTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:creator" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}
