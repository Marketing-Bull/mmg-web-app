// One-time setup: create the Event & Sponsor custom objects + fields in GHL.
// Protected by SETUP_SECRET. GET /api/admin/setup-ghl?key=SECRET
// Idempotent — skips objects/fields that already exist. Returns a JSON log.
import { ghl, ghlEnv } from "../../lib/ghl.js";

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
  // CHECKBOX is not supported by GHL custom fields; use SINGLE_OPTIONS instead.
  { key: "featured", name: "Featured", dataType: "SINGLE_OPTIONS", options: ["yes", "no"] },
  { key: "sort_order", name: "Priority", dataType: "NUMERICAL" },
];

const SPONSOR_FIELDS = [
  { key: "logo_url", name: "Logo", dataType: "FILE_UPLOAD" },
  { key: "sort_order", name: "Priority", dataType: "NUMERICAL" },
];

function asArray(json, ...keys) {
  for (const k of keys) if (json && Array.isArray(json[k])) return json[k];
  return Array.isArray(json) ? json : [];
}

function extractId(obj) {
  return (obj && (obj.id || obj._id || obj.objectId || obj.schemaId)) || null;
}

export default async function handler(req, res) {
  const { token, locationId, eventsKey, sponsorsKey } = ghlEnv();
  const log = [];
  const push = (m) => log.push(m);

  if (!process.env.SETUP_SECRET || req.query.key !== process.env.SETUP_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!token || !locationId) {
    return res.status(500).json({ error: "GHL_API_TOKEN / GHL_LOCATION_ID not set" });
  }

  let cachedObjects = null;
  async function listObjects() {
    if (cachedObjects) return cachedObjects;
    const r = await ghl("GET", `/objects/?locationId=${encodeURIComponent(locationId)}`);
    push(`GET /objects/ -> ${r.status}`);
    cachedObjects = asArray(r.json, "objects", "data", "results");
    return cachedObjects;
  }

  // Fetch the full object schema (includes id + properties) and cache it.
  const objectDataCache = {};
  async function fetchObjectData(key) {
    if (objectDataCache[key]) return objectDataCache[key];
    const r = await ghl(
      "GET",
      `/objects/${encodeURIComponent(key)}?locationId=${encodeURIComponent(locationId)}&fetchProperties=true`
    );
    push(`GET /objects/${key} -> ${r.status}`);
    const raw = (r.json && (r.json.object || r.json)) || {};
    const id = extractId(raw);
    // Log top-level keys so we can identify the ID field shape if needed.
    push(`  schema keys: ${Object.keys(raw).slice(0, 12).join(", ")} | id: ${id || "not found"}`);
    const data = { id, properties: asArray(raw, "properties", "customFields", "fields") };
    objectDataCache[key] = data;
    return data;
  }

  // Returns the GHL database ID of the object schema (needed as parentId for fields).
  async function ensureObject(key, singular, plural, primaryName) {
    const objs = await listObjects();
    const bare = key.replace("custom_objects.", "");
    const existing = objs.find((o) => o && (o.key === key || o.key === bare));
    if (existing) {
      push(`✓ object ${key} exists`);
      const data = await fetchObjectData(key);
      return data.id;
    }
    const r = await ghl("POST", "/objects/", {
      labels: { singular, plural },
      key,
      description: `${singular} records for the MMG website`,
      locationId,
      primaryDisplayPropertyDetails: { key: `${key}.name`, name: primaryName, dataType: "TEXT" },
    });
    push(`POST /objects/ ${key} -> ${r.status}${r.ok ? "" : " " + JSON.stringify(r.json).slice(0, 300)}`);
    if (!r.ok) return null;
    // Fetch the created object to get its real database ID.
    const data = await fetchObjectData(key);
    if (r.ok && cachedObjects) cachedObjects.push({ key, id: data.id });
    return data.id;
  }

  async function ensureField(objectKey, parentId, field) {
    const { properties } = await fetchObjectData(objectKey);
    const exists = properties.find(
      (p) =>
        p &&
        (p.fieldKey === `${objectKey}.${field.key}` ||
          p.key === field.key ||
          (p.name || "").toLowerCase() === field.name.toLowerCase())
    );
    if (exists) {
      push(`  ✓ field ${field.key} exists`);
      return;
    }
    const body = {
      locationId,
      name: field.name,
      dataType: field.dataType,
      objectKey,
      fieldKey: `${objectKey}.${field.key}`,
      showInForms: false,
    };
    if (parentId) body.parentId = parentId;
    if (field.options) body.options = field.options.map((o) => ({ key: o.toLowerCase().replace(/\s+/g, "_"), label: o }));
    let r = await ghl("POST", "/custom-fields/", body);
    // FILE_UPLOAD and LARGE_TEXT fall back to TEXT if rejected.
    if (!r.ok && (field.dataType === "FILE_UPLOAD" || field.dataType === "LARGE_TEXT")) {
      body.dataType = "TEXT";
      r = await ghl("POST", "/custom-fields/", body);
    }
    if (r.ok && objectDataCache[objectKey]) {
      objectDataCache[objectKey].properties.push({
        fieldKey: `${objectKey}.${field.key}`,
        key: field.key,
        name: field.name,
      });
    }
    push(`  ${r.ok ? "＋" : "✗"} field ${field.key} (${body.dataType}) -> ${r.status}${r.ok ? "" : " " + JSON.stringify(r.json).slice(0, 200)}`);
  }

  try {
    push("== Event ==");
    const eventId = await ensureObject(eventsKey, "Event", "Events", "Event Name");
    push(`  Event schema id: ${eventId}`);
    for (const f of EVENT_FIELDS) await ensureField(eventsKey, eventId, f);
    push("== Sponsor ==");
    const sponsorId = await ensureObject(sponsorsKey, "Sponsor", "Sponsors", "Sponsor Name");
    push(`  Sponsor schema id: ${sponsorId}`);
    for (const f of SPONSOR_FIELDS) await ensureField(sponsorsKey, sponsorId, f);
    push("Done.");
    return res.status(200).json({ ok: true, log });
  } catch (err) {
    push(`ERROR: ${err.message || err}`);
    return res.status(500).json({ ok: false, log });
  }
}
