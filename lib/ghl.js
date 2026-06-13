// Shared GHL helpers used by the Vercel functions (api/events, api/sponsors,
// api/admin/setup-ghl). Reads credentials from Vercel env (server-side only).
const API = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

export function ghlEnv() {
  return {
    token: process.env.GHL_API_TOKEN,
    locationId: process.env.GHL_LOCATION_ID,
    eventsKey: process.env.GHL_EVENTS_OBJECT_KEY || "custom_objects.event",
    sponsorsKey: process.env.GHL_SPONSORS_OBJECT_KEY || "custom_objects.sponsor",
  };
}

export async function ghl(method, path, body) {
  const { token } = ghlEnv();
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
  return { ok: res.ok, status: res.status, json };
}

function asArray(json, ...keys) {
  for (const k of keys) if (json && Array.isArray(json[k])) return json[k];
  return Array.isArray(json) ? json : [];
}

function props(rec) {
  return rec.properties || rec.customFields || rec || {};
}

function pick(p, key, eventsKey, sponsorsKey, ...names) {
  for (const n of [key, ...names]) {
    for (const k of [n, `${eventsKey}.${n}`, `${sponsorsKey}.${n}`]) {
      if (p[k] !== undefined && p[k] !== null && p[k] !== "") return p[k];
    }
  }
  return "";
}

function toBool(v) {
  if (typeof v === "string") v = v.trim().toLowerCase();
  return v === true || v === 1 || v === "true" || v === "1" || v === "yes";
}

// GHL file-upload fields may return an array of URLs or an object — normalize.
function fileUrl(v) {
  if (!v) return "";
  if (Array.isArray(v)) return v[0]?.url || v[0] || "";
  if (typeof v === "object") return v.url || "";
  return String(v);
}

export async function fetchEvents() {
  const { eventsKey, sponsorsKey } = ghlEnv();
  const r = await ghl("POST", `/objects/${eventsKey}/records/search`, {
    locationId: ghlEnv().locationId,
    page: 1,
    pageLimit: 100,
    query: "",
    searchAfter: [],
  });
  if (!r.ok) throw new Error(`events search ${r.status}`);
  const recs = asArray(r.json, "records", "data", "results");
  return recs
    .map((rec) => {
      const p = props(rec);
      const g = (k, ...alt) => pick(p, k, eventsKey, sponsorsKey, ...alt);
      return {
        id: rec.id || "",
        title: g("name", "title"),
        status: (g("status") || "upcoming").toString().toLowerCase(),
        date: g("date"),
        cadence: g("cadence"),
        city: g("city"),
        venue: g("venue"),
        type: g("type"),
        summary: g("summary", "description"),
        image: fileUrl(g("image_url", "image", "flyer")),
        registerUrl: g("register_url", "registerUrl"),
        registerLabel: g("register_label") || "Register on Eventbrite",
        featured: toBool(g("featured")),
        sortOrder: Number(g("sort_order")) || 0,
      };
    })
    .filter((e) => e.title)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function fetchSponsors() {
  const { eventsKey, sponsorsKey } = ghlEnv();
  const r = await ghl("POST", `/objects/${sponsorsKey}/records/search`, {
    locationId: ghlEnv().locationId,
    page: 1,
    pageLimit: 100,
    query: "",
    searchAfter: [],
  });
  if (!r.ok) throw new Error(`sponsors search ${r.status}`);
  const recs = asArray(r.json, "records", "data", "results");
  return recs
    .map((rec) => {
      const p = props(rec);
      const g = (k, ...alt) => pick(p, k, eventsKey, sponsorsKey, ...alt);
      return {
        id: rec.id || "",
        name: g("name", "title"),
        logo: fileUrl(g("logo_url", "logo")),
        url: g("website_url", "url"),
        tier: g("tier"),
        sortOrder: Number(g("sort_order")) || 0,
      };
    })
    .filter((s) => s.name)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
