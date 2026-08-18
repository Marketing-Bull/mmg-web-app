#!/usr/bin/env node
// Pre-deploy validation for this repo. There's no build step, so nothing
// else would catch a syntax typo before it hits production — this does.
//
//   node scripts/validate.mjs
//
// Checks:
//   1. Every .js/.mjs file under api/, lib/, scripts/, assets/js/ parses.
//   2. Every inline <script> block in the root .html pages parses.
//   3. Every .json file under data/ (plus package.json) is well-formed.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import vm from "node:vm";

const JS_DIRS = ["api", "lib", "scripts", "assets/js"];
const JSON_FILES = ["package.json", "vercel.json"];
const JSON_DIRS = ["data"];

let failures = 0;

function ok(label) {
  console.log(`  ok    ${label}`);
}

function fail(label, err) {
  console.log(`  FAIL  ${label}`);
  console.log(`        ${String(err).split("\n")[0]}`);
  failures += 1;
}

function walk(dir, extensions, out = []) {
  if (!existsSync(dir)) return out;
  const wanted = Array.isArray(extensions) ? extensions : [extensions];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, wanted, out);
    else if (wanted.includes(extname(full))) out.push(full);
  }
  return out;
}

console.log("JavaScript files");
const jsFiles = JS_DIRS.flatMap((dir) => walk(dir, [".js", ".mjs"]));
if (!jsFiles.length) console.log("  (none found)");
for (const file of jsFiles) {
  try {
    // node --check honours package.json "type", so ESM parses correctly.
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
    ok(file);
  } catch (err) {
    fail(file, err.stderr ? err.stderr.toString() : err.message);
  }
}

console.log("\nInline page scripts");
const htmlFiles = readdirSync(".").filter((f) => extname(f) === ".html");
let inlineCount = 0;
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  // Only <script> blocks with a body; skip <script src=...> and JSON-LD.
  const blocks = html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g);
  let i = 0;
  for (const block of blocks) {
    const code = block[1];
    if (!code.trim()) continue;
    i += 1;
    inlineCount += 1;
    const label = `${file} (block ${i})`;
    try {
      // Inline page scripts are classic scripts, not modules.
      new vm.Script(code, { filename: label });
      ok(label);
    } catch (err) {
      fail(label, err.message);
    }
  }
}
if (!inlineCount) console.log("  (none found)");

console.log("\nJSON files");
const jsonFiles = [...JSON_FILES.filter((f) => existsSync(f)), ...JSON_DIRS.flatMap((dir) => walk(dir, ".json"))];
if (!jsonFiles.length) console.log("  (none found)");
for (const file of jsonFiles) {
  try {
    JSON.parse(readFileSync(file, "utf8"));
    ok(file);
  } catch (err) {
    fail(file, err.message);
  }
}

// A sponsor whose logo path is a typo, or points at a file that never got
// committed, fails silently on the page — the card just renders as bare text.
// Same for a malformed `bg`, which is dropped by the renderer's sanitiser.
console.log("\nSponsor logos");
const sponsors = JSON.parse(readFileSync("data/sponsors.json", "utf8")).sponsors || [];
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
let missingLogos = 0;
for (const sponsor of sponsors) {
  const label = sponsor.name || sponsor.id;
  const logo = (sponsor.logo || "").trim();
  if (!logo) {
    missingLogos += 1;
    console.log(`  warn  ${label} — no logo yet`);
  } else if (!/^https?:\/\//i.test(logo) && !existsSync(logo)) {
    fail(label, `logo file not found: ${logo}`);
  } else {
    ok(`${label} — ${logo}`);
  }
  const bg = (sponsor.bg || "").trim();
  if (bg && !HEX.test(bg)) fail(label, `bg must be a hex colour like #ffffff, got: ${bg}`);
}
if (missingLogos) {
  console.log(`  ${missingLogos} sponsor(s) still need artwork (warning, not a failure).`);
}

console.log("");
if (failures) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log("All checks passed.");
