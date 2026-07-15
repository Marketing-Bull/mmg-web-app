// Public Sponsors feed: reads the published Blob content, falling back to the
// committed seed file if nothing has been published yet (or Blob errors).
import fs from "node:fs";
import path from "node:path";
import { readSponsors } from "../lib/blobStore.js";

function readSeed() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data", "sponsors.json"), "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data.sponsors) ? data.sponsors : [];
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  try {
    const sponsors = (await readSponsors()) || readSeed();
    return res.status(200).json({ updated: new Date().toISOString(), sponsors });
  } catch {
    return res.status(200).json({ updated: new Date().toISOString(), sponsors: readSeed() });
  }
}
