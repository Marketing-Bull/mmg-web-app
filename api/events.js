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
    if (!date) return event;
    return { ...event, status: date < today ? "past" : "upcoming" };
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  try {
    const events = withCurrentStatus((await readEvents()) || readSeed());
    return res.status(200).json({ updated: new Date().toISOString(), events });
  } catch {
    return res.status(200).json({ updated: new Date().toISOString(), events: withCurrentStatus(readSeed()) });
  }
}
