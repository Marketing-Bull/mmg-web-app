/*
  Sync GHL Custom Objects (Event, Sponsor) into data/events.json and
  data/sponsors.json. Intended to run on a schedule via GitHub Actions
  (.github/workflows/sync-ghl.yml). Reads secrets from the environment:

    GHL_API_TOKEN            (required) Private Integration token, objects read scope
    GHL_LOCATION_ID          (required) sub-account location id
    GHL_EVENTS_OBJECT_KEY    (optional) default "custom_objects.event"
    GHL_SPONSORS_OBJECT_KEY  (optional) default "custom_objects.sponsor"

  If the token/location are not set, the script is a no-op (exit 0) so the
  scheduled job stays green until GHL is configured. The committed seed JSON
  remains the source until the first successful sync.
*/
import { writeFile, readFile } from "node:fs/promises";

const API = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

const token = process.env.GHL_API_TOKEN;
const locationId = process.env.GHL_LOCATION_ID;
const EVENTS_KEY = process.env.GHL_EVENTS_OBJECT_KEY || "custom_objects.event";
const SPONSORS_KEY = process.env.GHL_SPONSORS_OBJECT_KEY || "custom_objects.sponsor";

if (!token || !locationId) {
  console.log("GHL_API_TOKEN / GHL_LOCATION_ID not set — skipping sync (keeping seed data).");
  process.exit(0);
}

// Try several key spellings so renamed/prefixed fields still resolve.
function pick(props, ...names) {
  for (const n of names) {
    for (const key of [n, `${EVENTS_KEY}.${n}`, `${SPONSORS_KEY}.${n}`]) {
      if (props[key] !== undefined && props[key] !== null && props[key] !== "") return props[key];
    }
  }
  return "";
}

async function searchRecords(objectKey) {
  const res = await fetch(`${API}/objects/${objectKey}/records/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Version: VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ locationId, page: 1, pageLimit: 100, query: "", searchAfter: [] }),
  });
  if (!res.ok) {
    throw new Error(`GHL search ${objectKey} failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  // Be tolerant about where the records array lives.
  return json.records || json.data || json.results || [];
}

function recordProps(record) {
  return record.properties || record.customFields || record || {};
}

// Robust boolean parse — GHL may return booleans as strings ("false", "0", …).
function toBool(value) {
  if (typeof value === "string") value = value.trim().toLowerCase();
  return value === true || value === 1 || value === "true" || value === "1" || value === "yes";
}

function mapEvent(record) {
  const p = recordProps(record);
  return {
    id: record.id || pick(p, "id") || "",
    title: pick(p, "name", "title"),
    status: (pick(p, "status") || "upcoming").toString().toLowerCase(),
    date: pick(p, "date"),
    cadence: pick(p, "cadence"),
    city: pick(p, "city"),
    venue: pick(p, "venue"),
    type: pick(p, "type"),
    summary: pick(p, "summary", "description"),
    image: pick(p, "image_url", "image"),
    registerUrl: pick(p, "register_url", "registerUrl"),
    registerLabel: pick(p, "register_label") || "Register on Eventbrite",
    featured: toBool(pick(p, "featured")),
    sortOrder: Number(pick(p, "sort_order")) || 0,
  };
}

function mapSponsor(record) {
  const p = recordProps(record);
  return {
    id: record.id || "",
    name: pick(p, "name", "title"),
    logo: pick(p, "logo_url", "logo"),
    url: pick(p, "website_url", "url"),
    tier: pick(p, "tier"),
    sortOrder: Number(pick(p, "sort_order")) || 0,
  };
}

function bySort(a, b) {
  return (a.sortOrder || 0) - (b.sortOrder || 0);
}

async function writeIfChanged(path, next) {
  const body = JSON.stringify(next, null, 2) + "\n";
  let prev = "";
  try {
    prev = await readFile(path, "utf8");
  } catch {
    /* file may not exist yet */
  }
  // Compare ignoring the "updated" timestamp so we don't churn commits.
  const strip = (s) => s.replace(/"updated":\s*"[^"]*"/, '"updated":""');
  if (strip(prev) === strip(body)) {
    console.log(`${path}: no change`);
    return false;
  }
  await writeFile(path, body);
  console.log(`${path}: updated`);
  return true;
}

async function main() {
  const now = new Date().toISOString();

  const eventRecords = await searchRecords(EVENTS_KEY);
  const events = eventRecords.map(mapEvent).filter((e) => e.title).sort(bySort);
  await writeIfChanged("data/events.json", { updated: now, events });

  const sponsorRecords = await searchRecords(SPONSORS_KEY);
  const sponsors = sponsorRecords.map(mapSponsor).filter((s) => s.name).sort(bySort);
  await writeIfChanged("data/sponsors.json", { updated: now, sponsors });

  console.log(`Synced ${events.length} events, ${sponsors.length} sponsors.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
