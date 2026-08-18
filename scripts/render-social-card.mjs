#!/usr/bin/env node
// Renders scripts/social-card.html to assets/brand/social-card.png — the image
// social platforms show when a millersmarketinggroup.com link is pasted.
//
//   node scripts/render-social-card.mjs
//
// Edit the copy in scripts/social-card.html, re-run this, commit the new PNG.
// Requires Playwright's Chromium (`npx playwright install chromium` once) and
// network access to fonts.googleapis.com so the card uses the real brand faces
// rather than fallbacks.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = join(ROOT, "scripts", "social-card.html");
const OUTPUT = join(ROOT, "assets", "brand", "social-card.jpg");
const WIDTH = 1200;
const HEIGHT = 630;

// Same families the site loads in its own <head>.
const FONTS_CSS_URL =
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600&display=swap";
// A desktop UA makes Google Fonts serve woff2 rather than older formats.
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// Chromium here has no direct network access, so the webfonts are downloaded in
// Node and inlined as data: URIs before the page is loaded.
async function inlineFontFaces() {
  const res = await fetch(FONTS_CSS_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Google Fonts CSS request failed: ${res.status}`);
  let css = await res.text();

  // Only the latin subset is needed; skipping the rest keeps the render quick.
  css = css
    .split("@font-face")
    .filter((block, i) => i === 0 || !/unicode-range:[^;]*U\+0100/.test(block))
    .join("@font-face");

  const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]))];
  const dataUris = new Map();
  await Promise.all(
    urls.map(async (url) => {
      const fontRes = await fetch(url, { headers: { "User-Agent": UA } });
      if (!fontRes.ok) throw new Error(`Font download failed (${fontRes.status}): ${url}`);
      const base64 = Buffer.from(await fontRes.arrayBuffer()).toString("base64");
      dataUris.set(url, `data:font/woff2;base64,${base64}`);
    })
  );

  for (const [url, dataUri] of dataUris) css = css.split(url).join(dataUri);
  return css;
}

function loadChromium() {
  // Playwright is a developer tool for this one script, not a site dependency,
  // so it is resolved from wherever it happens to be installed.
  const require = createRequire(import.meta.url);
  for (const specifier of ["playwright", "playwright-core", "@playwright/test"]) {
    try {
      return require(specifier).chromium;
    } catch {
      /* try the next one */
    }
  }
  throw new Error("Playwright not found. Install it first: npm i -g playwright && npx playwright install chromium");
}

const fontFaces = await inlineFontFaces();
const html = readFileSync(TEMPLATE, "utf8").replace("/* __FONT_FACES__ */", fontFaces);

// The page is written next to the template so its relative image paths
// (../assets/brand/...) still resolve.
const tempPage = join(ROOT, "scripts", ".social-card.render.html");
writeFileSync(tempPage, html);

const chromium = loadChromium();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(tempPage).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  mkdirSync(dirname(OUTPUT), { recursive: true });
  // JPEG rather than PNG: a photo-backed card compresses to a fraction of the
  // size, and WhatsApp/iMessage skip previews for images that are slow to fetch.
  await page.screenshot({
    path: OUTPUT,
    type: "jpeg",
    quality: 92,
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });
  console.log(`Wrote ${OUTPUT} (${WIDTH}x${HEIGHT})`);
} finally {
  await browser.close();
  const { unlinkSync } = await import("node:fs");
  try {
    unlinkSync(tempPage);
  } catch {
    /* already gone */
  }
}
