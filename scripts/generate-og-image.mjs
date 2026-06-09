/**
 * Generates the branded Open Graph share image at public/og-image.png (1200x630).
 *
 * The card IS the real hero — so the fonts, plasma, logo, nav and CTAs all match
 * the live site exactly (no re-typeset text). Capture it once:
 *   1) pnpm dev
 *   2) open the landing page "/" and screenshot the hero (a wide, high-DPI grab)
 *   3) save it as scripts/assets/og-hero.png
 *
 * This script crops that capture to the 1200x630 OG aspect with a slight upward
 * bias so the top nav (logo) and the headline both survive the crop.
 *
 * Run:  pnpm og:image
 * Requires the `sharp` dev dependency.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, existsSync } from "node:fs";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public", "og-image.png");
const LOGO = join(ROOT, "public", "cusp.png");
const HERO = join(__dirname, "assets", "og-hero.png");

const WIDTH = 1200;
const HEIGHT = 630;
const RATIO = WIDTH / HEIGHT;
const TOP_BIAS = 0.12; // keep more of the top (nav/logo) than the bottom

if (!existsSync(HERO)) {
  console.error(
    `\nMissing hero capture: ${HERO}\n\n` +
      `Capture it first:\n` +
      `  1) pnpm dev\n` +
      `  2) open "/" and screenshot the hero (wide, high-DPI)\n` +
      `  3) save it as scripts/assets/og-hero.png\n`
  );
  process.exit(1);
}

// Keep the logo bytes valid PNG (source artwork was JPEG named .png, which breaks
// under the site's nosniff header). Idempotent — safe to run every time.
const logoMeta = await sharp(LOGO).metadata();
if (logoMeta.format !== "png") {
  const fixed = await sharp(LOGO).png().toBuffer();
  writeFileSync(LOGO, fixed);
  console.log(`Re-encoded logo ${logoMeta.format} -> png (${fixed.length} bytes)`);
}

// Crop the hero to the OG aspect ratio. Prefer using the full width and trimming
// height (with an upward bias); fall back to trimming width if the source is tall.
const { width: W, height: H } = await sharp(HERO).metadata();
let extract;
const cropH = Math.round(W / RATIO);
if (cropH <= H) {
  const top = Math.round((H - cropH) * TOP_BIAS);
  extract = { left: 0, top, width: W, height: cropH };
} else {
  const cropW = Math.round(H * RATIO);
  extract = { left: Math.round((W - cropW) / 2), top: 0, width: cropW, height: H };
}

const png = await sharp(HERO)
  .extract(extract)
  .resize(WIDTH, HEIGHT)
  .png()
  .toBuffer();

writeFileSync(OUT, png);
console.log(`Wrote ${OUT} (${png.length} bytes)`);
