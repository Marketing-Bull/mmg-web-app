// Authenticated Events/Sponsors editing API for content-manager.html.
// GET  -> current content (Blob if published before, else the committed seed)
// POST { type: "events"|"sponsors", items: [...] } -> publish that list live
import fs from "node:fs";
import path from "node:path";
import { requireSession } from "../../lib/auth.js";
import { readEvents, readSponsors, writeEvents, writeSponsors } from "../../lib/blobStore.js";

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
  if (!requireSession(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

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
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    body = body || {};
    const { type, items } = body;
    if (type !== "events" && type !== "sponsors") {
      return res.status(400).json({ error: "type must be 'events' or 'sponsors'" });
    }
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items must be an array" });
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
