// Regenerates the icon files from lib/brand.ts's key. Run: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const INK = "#1b1c1e";
const BRASS = "#d9b96a";
const keyShapes = `<circle cx="8" cy="14" r="4.5" stroke="${BRASS}" stroke-width="2"/><path d="M11.2 10.8 20 2M16 6l3 3M13.5 8.5l2.5 2.5" stroke="${BRASS}" stroke-width="2" stroke-linecap="round"/>`;
// The key sits on a 24-unit grid (extent about 1.5..20.5 x 2..18.5): centre it and scale it.
const svg = (size, scale, radius) => {
  const s = (size * scale) / 16.5; // scale = share of the tile the key spans
  const tx = size / 2 - 11.75 * s;
  const ty = size / 2 - 10.25 * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${INK}"/><g transform="translate(${tx} ${ty}) scale(${s})" fill="none">${keyShapes}</g></svg>`;
};
mkdirSync("public/icons", { recursive: true });
writeFileSync("app/icon.svg", svg(64, 0.62, 14));
const png = (size, scale, radius, out) => sharp(Buffer.from(svg(size, scale, radius)), { density: 300 }).resize(size, size).png().toFile(out);
await png(180, 0.62, 0, "app/apple-icon.png"); // iOS rounds the corners itself
await png(192, 0.62, 42, "public/icons/icon-192.png");
await png(512, 0.62, 112, "public/icons/icon-512.png");
await png(512, 0.5, 0, "public/icons/icon-maskable-512.png"); // full bleed, key inside the safe zone
await png(16, 0.72, 3, "public/icons/check-16.png");
console.log("icons written");
