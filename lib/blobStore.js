// Vercel Blob-backed storage for Events/Sponsors content and imported media.
import { put, get } from "@vercel/blob";

const EVENTS_PATH = "content/events.json";
const SPONSORS_PATH = "content/sponsors.json";

async function readJSON(pathname) {
  // useCache: false reads straight from origin storage, so a publish is
  // visible immediately instead of waiting out a CDN cache TTL.
  const result = await get(pathname, { access: "public", useCache: false }).catch(() => null);
  if (!result || result.statusCode !== 200) return null;
  return new Response(result.stream).json();
}

async function writeJSON(pathname, data) {
  return put(pathname, JSON.stringify(data, null, 2) + "\n", {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

export async function readEvents() {
  const data = await readJSON(EVENTS_PATH);
  return data && Array.isArray(data.events) ? data.events : null;
}

export async function readSponsors() {
  const data = await readJSON(SPONSORS_PATH);
  return data && Array.isArray(data.sponsors) ? data.sponsors : null;
}

export async function writeEvents(events) {
  return writeJSON(EVENTS_PATH, { updated: new Date().toISOString(), events });
}

export async function writeSponsors(sponsors) {
  return writeJSON(SPONSORS_PATH, { updated: new Date().toISOString(), sponsors });
}

const EXTENSIONS_BY_CONTENT_TYPE = [
  ["png", "png"],
  ["webp", "webp"],
  ["gif", "gif"],
  ["jpeg", "jpg"],
  ["jpg", "jpg"],
  ["quicktime", "mov"],
  ["mp4", "mp4"],
  ["webm", "webm"],
];

function extensionFor(contentType) {
  const typeStr = String(contentType || "");
  const match = EXTENSIONS_BY_CONTENT_TYPE.find(([needle]) => typeStr.indexOf(needle) !== -1);
  return match ? match[1] : "bin";
}

// Uploaded/imported media gets a unique path each time (new assets, not an
// overwrite-in-place target like the content JSON above).
export async function writeMedia(buffer, contentType, prefix) {
  const pathname = `media/${prefix}/${Date.now()}.${extensionFor(contentType)}`;
  return put(pathname, buffer, { access: "public", contentType });
}

/*
  Reports whether Blob storage is actually reachable with the current
  credentials.

  The readers above deliberately swallow their errors so the public site can
  fall back to the committed seed — which also means a missing token or an
  unconnected store looks exactly like "nothing published yet". This is the
  one place that tells the two apart, for /api/admin/status.
*/
async function probePath(pathname) {
  try {
    const result = await get(pathname, { access: "public", useCache: false });
    return { reachable: true, published: !!result && result.statusCode === 200 };
  } catch (err) {
    if (err && err.name === "BlobNotFoundError") return { reachable: true, published: false };
    return { reachable: false, published: false, error: String(err.message || err).slice(0, 200) };
  }
}

export async function probeBlob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { configured: false, reachable: false, eventsPublished: false, sponsorsPublished: false, error: "BLOB_READ_WRITE_TOKEN is not set" };
  }
  const [events, sponsors] = await Promise.all([probePath(EVENTS_PATH), probePath(SPONSORS_PATH)]);
  return {
    configured: true,
    reachable: events.reachable && sponsors.reachable,
    eventsPublished: events.published,
    sponsorsPublished: sponsors.published,
    error: events.error || sponsors.error || "",
  };
}
