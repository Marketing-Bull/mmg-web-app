// One-time setup: create the Event & Sponsor custom objects + fields in GHL.
// Protected by SETUP_SECRET. GET /api/admin/setup-ghl?key=SECRET
// Idempotent — skips objects/fields that already exist. Returns a JSON log.
//
// GHL custom-object fields live inside a custom-field *folder*. The
// /custom-fields/ create endpoint requires parentId = the folder's id (not the
// object schema id), so we ensure a folder per object first.
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

  async function ensureObject(key, singular, plural, primaryName) {
    const objs = await listObjects();
    const bare = key.replace("custom_objects.", "");
    if (objs.find((o) => o && (o.key === key || o.key === bare))) {
      push(`✓ object ${key} exists`);
      return;
    }
    const r = await ghl("POST", "/objects/", {
      labels: { singular, plural },
      key,
      description: `${singular} records for the MMG website`,
      locationId,
      primaryDisplayPropertyDetails: { key: `${key}.name`, name: primaryName, dataType: "TEXT" },
    });
    if (r.ok && cachedObjects) cachedObjects.push({ key });
    push(`POST /objects/ ${key} -> ${r.status}${r.ok ? "" : " " + JSON.stringify(r.json).slice(0, 300)}`);
  }

  // GET the fields + folders that already exist for a custom object.
  const objectFieldsCache = {};
  async function getObjectFields(objectKey) {
    if (objectFieldsCache[objectKey]) return objectFieldsCache[objectKey];
    const r = await ghl(
      "GET",
      `/custom-fields/object-key/${encodeURIComponent(objectKey)}?locationId=${encodeURIComponent(locationId)}`
    );
    push(`GET /custom-fields/object-key/${objectKey} -> ${r.status}`);
    const fields = asArray(r.json && r.json.fields, "fields").length
      ? r.json.fields
      : asArray(r.json, "fields", "customFields");
    const folders = (r.json && asArray(r.json.folders, "folders").length)
      ? r.json.folders
      : asArray(r.json, "folders");
    const data = {
      fields: Array.isArray(fields) ? fields : [],
      folders: Array.isArray(folders) ? folders : [],
    };
    push(`  existing: ${data.fields.length} field(s), ${data.folders.length} folder(s)`);
    objectFieldsCache[objectKey] = data;
    return data;
  }

  // Reuse the first existing folder, or create one. Returns the folder id.
  async function ensureFolder(objectKey, folderName) {
    const data = await getObjectFields(objectKey);
    if (data.folders.length) {
      const id = extractId(data.folders[0]);
      push(`  ✓ folder exists (${id})`);
      return id;
    }
    const r = await ghl("POST", "/custom-fields/folder/", {
      objectKey,
      name: folderName,
      locationId,
    });
    const id = extractId((r.json && (r.json.folder || r.json)) || {});
    push(`  ${r.ok ? "＋" : "✗"} folder ${folderName} -> ${r.status}${r.ok ? " (" + id + ")" : " " + JSON.stringify(r.json).slice(0, 200)}`);
    if (r.ok && id) data.folders.push({ id, name: folderName });
    return id;
  }

  async function ensureField(objectKey, parentId, field) {
    const data = await getObjectFields(objectKey);
    const exists = data.fields.find(
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
    if (r.ok) data.fields.push({ fieldKey: `${objectKey}.${field.key}`, key: field.key, name: field.name });
    push(`  ${r.ok ? "＋" : "✗"} field ${field.key} (${body.dataType}) -> ${r.status}${r.ok ? "" : " " + JSON.stringify(r.json).slice(0, 200)}`);
  }

  try {
    push("== Event ==");
    await ensureObject(eventsKey, "Event", "Events", "Event Name");
    const eventFolder = await ensureFolder(eventsKey, "Event Details");
    for (const f of EVENT_FIELDS) await ensureField(eventsKey, eventFolder, f);
    push("== Sponsor ==");
    await ensureObject(sponsorsKey, "Sponsor", "Sponsors", "Sponsor Name");
    const sponsorFolder = await ensureFolder(sponsorsKey, "Sponsor Details");
    for (const f of SPONSOR_FIELDS) await ensureField(sponsorsKey, sponsorFolder, f);
    push("Done.");
    return res.status(200).json({ ok: true, log });
  } catch (err) {
    push(`ERROR: ${err.message || err}`);
    return res.status(500).json({ ok: false, log });
  }
}
