/*
  One-off setup: create the Event and Sponsor custom objects (and their fields)
  in GHL. Runs in GitHub Actions (.github/workflows/setup-ghl-objects.yml) using
  the GHL_API_TOKEN (needs objects/schema.write) and GHL_LOCATION_ID secrets.

  Idempotent: skips objects/fields that already exist. Logs every request and
  response so we can validate the GHL API shape and iterate from the run logs.
*/
const API = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

const token = process.env.GHL_API_TOKEN;
const locationId = process.env.GHL_LOCATION_ID;
const EVENTS_KEY = process.env.GHL_EVENTS_OBJECT_KEY || "custom_objects.event";
const SPONSORS_KEY = process.env.GHL_SPONSORS_OBJECT_KEY || "custom_objects.sponsor";

if (!token || !locationId) {
  console.error("Missing GHL_API_TOKEN or GHL_LOCATION_ID.");
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  console.log(`${method} ${path} -> ${res.status}`);
  if (!res.ok) {
    console.log("  response:", (typeof json === "string" ? json : JSON.stringify(json)).slice(0, 900));
  }
  return { ok: res.ok, status: res.status, json };
}

function asArray(json, ...keys) {
  for (const k of keys) {
    if (json && Array.isArray(json[k])) return json[k];
  }
  return Array.isArray(json) ? json : [];
}

async function listObjects() {
  const r = await api("GET", `/objects/?locationId=${encodeURIComponent(locationId)}`);
  return asArray(r.json, "objects", "data", "results");
}

async function ensureObject(key, singular, plural, primaryName) {
  const objs = await listObjects();
  const bare = key.replace("custom_objects.", "");
  const found = objs.find((o) => o && (o.key === key || o.key === bare));
  if (found) {
    console.log(`✓ object "${key}" already exists`);
    return found;
  }
  const body = {
    labels: { singular, plural },
    key,
    description: `${singular} records for the MMG website`,
    locationId,
    primaryDisplayPropertyDetails: { key: `${key}.name`, name: primaryName, dataType: "TEXT" },
  };
  const r = await api("POST", "/objects/", body);
  if (!r.ok) throw new Error(`Failed to create object "${key}"`);
  console.log(`＋ created object "${key}"`);
  return (r.json && (r.json.object || r.json)) || {};
}

async function getProperties(key) {
  const r = await api(
    "GET",
    `/objects/${encodeURIComponent(key)}?locationId=${encodeURIComponent(locationId)}&fetchProperties=true`
  );
  const obj = (r.json && (r.json.object || r.json)) || {};
  return asArray(obj, "properties", "customFields", "fields");
}

async function ensureField(objectKey, field) {
  const props = await getProperties(objectKey);
  const exists = props.find(
    (p) =>
      p &&
      (p.fieldKey === `${objectKey}.${field.key}` ||
        p.key === field.key ||
        (p.name || "").toLowerCase() === field.name.toLowerCase())
  );
  if (exists) {
    console.log(`  ✓ field "${field.key}" exists`);
    return;
  }
  const body = {
    locationId,
    name: field.name,
    dataType: field.dataType,
    objectKey,
    showInForms: false,
  };
  if (field.options) {
    body.options = field.options.map((o) => ({ key: o.toLowerCase().replace(/\s+/g, "_"), label: o }));
  }
  let r = await api("POST", "/custom-fields/", body);
  if (!r.ok && field.dataType === "FILE_UPLOAD") {
    console.log(`  …retrying "${field.key}" as TEXT (file upload not accepted)`);
    body.dataType = "TEXT";
    r = await api("POST", "/custom-fields/", body);
  }
  if (r.ok) console.log(`  ＋ field "${field.key}" (${body.dataType})`);
  else console.log(`  ✗ field "${field.key}" failed (${r.status})`);
}

const EVENT_FIELDS = [
  { key: "status", name: "Status", dataType: "SINGLE_OPTIONS", options: ["upcoming", "past"] },
  { key: "date", name: "Date", dataType: "DATE" },
  { key: "cadence", name: "Cadence", dataType: "TEXT" },
  { key: "city", name: "City", dataType: "TEXT" },
  { key: "venue", name: "Venue", dataType: "TEXT" },
  { key: "type", name: "Type", dataType: "TEXT" },
  { key: "summary", name: "Summary", dataType: "LARGE_TEXT" },
  { key: "image_url", name: "Flyer", dataType: "FILE_UPLOAD" },
  { key: "register_url", name: "Register URL", dataType: "TEXT" },
  { key: "register_label", name: "Register Label", dataType: "TEXT" },
  { key: "featured", name: "Featured", dataType: "CHECKBOX" },
  { key: "sort_order", name: "Priority", dataType: "NUMERICAL" },
];

// Sponsors only need name (primary) + logo + a priority for ordering.
const SPONSOR_FIELDS = [
  { key: "logo_url", name: "Logo", dataType: "FILE_UPLOAD" },
  { key: "sort_order", name: "Priority", dataType: "NUMERICAL" },
];

async function main() {
  console.log("== Validating auth (list objects) ==");
  await listObjects();

  console.log("\n== Event ==");
  await ensureObject(EVENTS_KEY, "Event", "Events", "Event Name");
  for (const f of EVENT_FIELDS) await ensureField(EVENTS_KEY, f);

  console.log("\n== Sponsor ==");
  await ensureObject(SPONSORS_KEY, "Sponsor", "Sponsors", "Sponsor Name");
  for (const f of SPONSOR_FIELDS) await ensureField(SPONSORS_KEY, f);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
