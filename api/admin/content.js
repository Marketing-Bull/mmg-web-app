// Authenticated Events/Sponsors editing API for content-manager.html.
// GET  -> current content (Blob if published before, else the committed seed)
// POST { type: "events"|"sponsors", items: [...] } -> publish that list live
import fs from "node:fs";
import path from "node:path";
import { requireSession } from "../../lib/auth.js";
import { readJsonBody, noStore } from "../../lib/http.js";
import { enforceRateLimit, LIMITS } from "../../lib/rateLimit.js";
import { readEvents, readSponsors, writeEvents, writeSponsors } from "../../lib/blobStore.js";

// A publish that exceeds either of these is a bug or an abuse attempt, not an
// editing session — Blob is billed by what it stores.
const MAX_ITEMS = 500;
const MAX_PAYLOAD_BYTES = 512 * 1024;

function readSeed(file, key) {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data", file), "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data[key]) ? data[key] : [];
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  noStore(res);

  if (!requireSession(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!enforceRateLimit(req, res, LIMITS.adminContent)) return;

  if (req.method === "GET") {
    try {
      const [events, sponsors] = await Promise.all([readEvents(), readSponsors()]);
      return res.status(200).json({
        events: events || readSeed("events.json", "events"),
        sponsors: sponsors || readSeed("sponsors.json", "sponsors"),
      });
    } catch (err) {
      return res.status(502).json({ error: String(err.message || err) });
    }
  }

  if (req.method === "POST") {
    const body = readJsonBody(req);
    const { type, items } = body;
    if (type !== "events" && type !== "sponsors") {
      return res.status(400).json({ error: "type must be 'events' or 'sponsors'" });
    }
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items must be an array" });
    }
    if (items.length > MAX_ITEMS) {
      return res.status(413).json({ error: `Too many items to publish (limit ${MAX_ITEMS}).` });
    }
    if (Buffer.byteLength(JSON.stringify(items)) > MAX_PAYLOAD_BYTES) {
      return res.status(413).json({ error: "That content is too large to publish." });
    }
    try {
      const blob = type === "events" ? await writeEvents(items) : await writeSponsors(items);
      return res.status(200).json({ ok: true, updated: new Date().toISOString(), url: blob.url });
    } catch (err) {
      return res.status(502).json({ error: String(err.message || err) });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
