/**
 * Generates the branded Open Graph share image at public/og-image.png (1200x630).
 *
 * Run:  pnpm og:image
 * Requires the `sharp` dev dependency for SVG -> PNG rendering.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "og-image.png");

const WIDTH = 1200;
const HEIGHT = 630;
const TEAL = "#1fd184";
const BG = "#0a0a0a";

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="78%" cy="22%" r="65%">
      <stop offset="0%" stop-color="${TEAL}" stop-opacity="0.35" />
      <stop offset="55%" stop-color="${TEAL}" stop-opacity="0.08" />
      <stop offset="100%" stop-color="${BG}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d0f0e" />
      <stop offset="100%" stop-color="${BG}" />
    </linearGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="none" stroke="${TEAL}" stroke-opacity="0.18" stroke-width="2" />

  <!-- brand mark -->
  <g transform="translate(96, 96)">
    <circle cx="22" cy="22" r="22" fill="none" stroke="${TEAL}" stroke-width="4" />
    <path d="M32 14 A14 14 0 1 0 32 30" fill="none" stroke="${TEAL}" stroke-width="4" stroke-linecap="round" />
    <text x="62" y="34" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff" letter-spacing="1">Cusp</text>
  </g>

  <!-- headline -->
  <text x="96" y="320" font-family="Helvetica, Arial, sans-serif" font-size="76" font-weight="800" fill="#ffffff">The capital markets layer</text>
  <text x="96" y="408" font-family="Helvetica, Arial, sans-serif" font-size="76" font-weight="800" fill="${TEAL}">for prediction markets</text>

  <!-- subline -->
  <text x="98" y="470" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="400" fill="#9aa3a0">Borrow against live positions. Earn on idle capital. Get paid on resolution.</text>

  <!-- footer -->
  <line x1="96" y1="534" x2="1104" y2="534" stroke="#ffffff" stroke-opacity="0.10" stroke-width="1.5" />
  <text x="96" y="578" font-family="Helvetica, Arial, sans-serif" font-size="28" font-weight="600" fill="#ffffff">beta.cusp.fi</text>
  <text x="1104" y="578" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="500" fill="${TEAL}">Built on Solana</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(OUT, png);
console.log(`Wrote ${OUT} (${png.length} bytes)`);
