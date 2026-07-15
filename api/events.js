// Public Events feed: reads the published Blob content, falling back to the
// committed seed file if nothing has been published yet (or Blob errors).
import fs from "node:fs";
import path from "node:path";
import { readEvents } from "../lib/blobStore.js";

function readSeed() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data", "events.json"), "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data.events) ? data.events : [];
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  try {
    const events = (await readEvents()) || readSeed();
    return res.status(200).json({ updated: new Date().toISOString(), events });
  } catch {
    return res.status(200).json({ updated: new Date().toISOString(), events: readSeed() });
  }
}
