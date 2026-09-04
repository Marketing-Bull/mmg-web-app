/*
  Public Events API.

  GET /api/events returns MMG's events as JSON, to anyone, from anywhere. It
  is the same feed the homepage renders, and it is documented in llms.txt so
  assistants and other sites can pull the schedule rather than scrape it.

  Reads the published Blob content, falling back to the committed seed file if
  nothing has been published yet (or Blob errors), so the endpoint answers
  even when storage is unreachable.
*/
import fs from "node:fs";
import path from "node:path";
import { readEventsDocument } from "../lib/blobStore.js";

// Being a read-only feed of already-public information, it is open to every
// origin; a browser on any site can call it directly.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function readSeed() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data", "events.json"), "utf8");
    const data = JSON.parse(raw);
    return {
      events: Array.isArray(data.events) ? data.events : [],
      updated: typeof data.updated === "string" ? data.updated : "",
    };
  } catch {
    return { events: [], updated: "" };
  }
}

function eventDateKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function floridaDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function withCurrentStatus(events) {
  const today = floridaDateKey();

  return events.map((event) => {
    const date = eventDateKey(event.date);
    if (!date) return { ...event, status: "undated" };
    return { ...event, status: date < today ? "past" : "upcoming" };
  });
}

export default async function handler(req, res) {
  for (const [key, value] of Object.entries(CORS)) res.setHeader(key, value);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD, OPTIONS");
    return res.status(405).json({ error: "Method not allowed. This endpoint is read-only." });
  }

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  // `updated` is when the content last changed, not when it was requested, so
  // a caller can tell a fresh answer from a repeated one.
  let document;
  try {
    document = (await readEventsDocument()) || readSeed();
  } catch {
    document = readSeed();
  }

  return res.status(200).json({
    updated: document.updated,
    events: withCurrentStatus(document.events),
  });
}
