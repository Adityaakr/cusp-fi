/**
 * Generates the branded Open Graph share image at public/og-image.png (1200x630).
 *
 * The card is composed to match the redesigned landing hero: brand dark-green
 * (#002816) field with a soft plasma glow, the Cusp logo + wordmark top-left, a
 * status pill top-right, and the hero copy bottom-left. No screenshot needed.
 *
 * Run:  pnpm og:image
 * Requires the `sharp` dev dependency.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public", "og-image.png");
const LOGO = join(ROOT, "public", "cusp.png");

const W = 1200;
const H = 630;
const FONT = "Geist, Inter, 'Helvetica Neue', Arial, sans-serif";

// Round the logo into a 56px badge.
const LOGO_SIZE = 56;
const logoBadge = await sharp(LOGO)
  .resize(LOGO_SIZE, LOGO_SIZE)
  .composite([
    {
      input: Buffer.from(
        `<svg><circle cx="${LOGO_SIZE / 2}" cy="${LOGO_SIZE / 2}" r="${LOGO_SIZE / 2}"/></svg>`,
      ),
      blend: "dest-in",
    },
  ])
  .png()
  .toBuffer();

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="30%" cy="38%" r="75%">
      <stop offset="0%" stop-color="#0a5f3a"/>
      <stop offset="45%" stop-color="#04331f"/>
      <stop offset="100%" stop-color="#001a0f"/>
    </radialGradient>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#003a22"/>
      <stop offset="100%" stop-color="#00160d"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#base)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)" opacity="0.55"/>
  <ellipse cx="880" cy="150" rx="360" ry="240" fill="#0f7a4a" opacity="0.22"/>
  <ellipse cx="220" cy="520" rx="320" ry="220" fill="#0a5f3a" opacity="0.18"/>

  <!-- wordmark -->
  <text x="140" y="98" font-family="${FONT}" font-size="30" font-weight="600" fill="#ffffff" letter-spacing="-0.5">Cusp</text>

  <!-- status pill -->
  <rect x="952" y="66" width="176" height="44" rx="22" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.18" stroke-width="1"/>
  <circle cx="982" cy="88" r="4" fill="#ffffff" fill-opacity="0.75"/>
  <text x="1000" y="94" font-family="${FONT}" font-size="17" font-weight="500" fill="#ffffff" fill-opacity="0.82">Private Alpha</text>

  <!-- eyebrow -->
  <text x="80" y="356" font-family="${FONT}" font-size="21" font-weight="500" fill="#ffffff" fill-opacity="0.5" letter-spacing="4">THE OPEN CAPITAL NETWORK</text>

  <!-- heading -->
  <text x="78" y="432" font-family="${FONT}" font-size="72" font-weight="500" fill="#ffffff" letter-spacing="-2">Capital for markets</text>
  <text x="78" y="510" font-family="${FONT}" font-size="72" font-weight="500" fill="#ffffff" letter-spacing="-2">that price the future.</text>

  <!-- description -->
  <text x="80" y="566" font-family="${FONT}" font-size="25" fill="#ffffff" fill-opacity="0.62">Prediction markets created a new asset class. Cusp makes its positions</text>
  <text x="80" y="600" font-family="${FONT}" font-size="25" fill="#ffffff" fill-opacity="0.62">productive through risk-aware vaults, credit, and settlement.</text>
</svg>`;

const png = await sharp(Buffer.from(svg))
  .composite([{ input: logoBadge, left: 72, top: 62 }])
  .png()
  .toBuffer();

writeFileSync(OUT, png);
console.log(`Wrote ${OUT} (${png.length} bytes)`);
