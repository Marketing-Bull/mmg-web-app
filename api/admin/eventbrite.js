// Turns a pasted Eventbrite event URL into a ready-to-edit site event.
// Reads the event's public details (title, date, times, venue, city,
// summary, flyer), copies the flyer into our own Blob storage so it loads
// fast and survives the listing being edited or delisted, and returns the
// fields for the content manager to drop into a new event. POST { url }.
import { requireSession } from "../../lib/auth.js";
import { readJsonBody, noStore } from "../../lib/http.js";
import { enforceRateLimit, LIMITS } from "../../lib/rateLimit.js";
import { writeMedia } from "../../lib/blobStore.js";
import { ALLOWED_TYPES } from "../../lib/uploadTypes.js";
import {
  parseEventbriteEventId,
  destinationApiUrl,
  mapDestinationResponse,
  mapEventPageHtml,
  isAllowedImageUrl,
} from "../../lib/eventbrite.js";

const REQUEST_TIMEOUT_MS = 15000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PAGE_BYTES = 3 * 1024 * 1024;
// Eventbrite serves the same public page to any browser; a plain fetch with
// no user agent is what its edge occasionally blocks.
const USER_AGENT = "Mozilla/5.0 (compatible; MMG content manager; +https://millersmarketinggroup.com)";

async function fetchUpstream(url, accept) {
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: accept },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

// Undocumented but clean endpoint first, then the page's schema.org block.
async function readEvent(url, eventId) {
  try {
    const res = await fetchUpstream(destinationApiUrl(eventId), "application/json");
    if (res.ok) {
      const mapped = mapDestinationResponse(await res.json(), eventId);
      if (mapped) return { event: mapped, source: "api" };
    }
  } catch {
    /* fall through to the page */
  }

  const pageRes = await fetchUpstream(url, "text/html");
  if (!pageRes.ok) {
    throw new Error(
      pageRes.status === 404
        ? "That Eventbrite event could not be found. Check the link, or the event may be private or unpublished."
        : `Eventbrite returned an error (${pageRes.status}). Try again in a minute.`
    );
  }
  const buffer = Buffer.from(await pageRes.arrayBuffer());
  const mapped = mapEventPageHtml(buffer.subarray(0, MAX_PAGE_BYTES).toString("utf8"), eventId);
  if (!mapped) {
    throw new Error("Could not read that Eventbrite event. Make sure it is a public, published event page.");
  }
  return { event: mapped, source: "page" };
}

// Copy the flyer to Blob. Failure here is reported as a warning rather than
// an error: an event with every field filled and no flyer is still useful,
// and the editor can upload one by hand.
async function importFlyer(imageUrl) {
  if (!isAllowedImageUrl(imageUrl)) return { url: "", warning: "" };
  try {
    const imgRes = await fetchUpstream(imageUrl, "image/*");
    if (!imgRes.ok) return { url: "", warning: "The flyer could not be downloaded from Eventbrite." };
    const contentType = (imgRes.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const check = ALLOWED_TYPES[contentType];
    if (!check || !contentType.startsWith("image/")) {
      return { url: "", warning: "The flyer is in a format the site can't publish." };
    }
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    if (!buffer.length || !check(buffer)) {
      return { url: "", warning: "The flyer image came back unreadable." };
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      return { url: "", warning: "The flyer is too large to import automatically." };
    }
    const blob = await writeMedia(buffer, contentType, "eventbrite");
    return { url: blob.url, warning: "" };
  } catch {
    return { url: "", warning: "The flyer could not be copied to site storage — upload it by hand." };
  }
}

export default async function handler(req, res) {
  noStore(res);

  if (!requireSession(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceRateLimit(req, res, LIMITS.adminMedia)) return;

  const body = readJsonBody(req);
  // Keep the link exactly as pasted (minus any #fragment) for the register
  // button: a share link from Eventbrite carries an ?aff= tag that credits
  // the click to the organizer's own promotion in Eventbrite's reporting.
  const url = String(body.url || "").trim().replace(/#.*$/, "");
  const eventId = parseEventbriteEventId(url);
  if (!eventId) {
    return res.status(400).json({ error: "Paste a public Eventbrite event URL (eventbrite.com/e/...)." });
  }

  let result;
  try {
    result = await readEvent(url, eventId);
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }

  const { event, source } = result;
  const warnings = [];
  if (event.status === "canceled") warnings.push("Eventbrite lists this event as cancelled.");
  if (!event.date) warnings.push("No date was found — set it by hand.");

  const flyer = await importFlyer(event.imageUrl);
  if (flyer.warning) warnings.push(flyer.warning);
  else if (!event.imageUrl) warnings.push("The listing has no flyer image — upload one if you have it.");

  return res.status(200).json({
    event: {
      title: event.title,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      city: event.city,
      venue: event.venue,
      summary: event.summary,
      image: flyer.url,
      registerUrl: url,
      eventbriteId: event.eventbriteId,
    },
    sourceUrl: url,
    source,
    warnings,
  });
}
