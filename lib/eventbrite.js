/*
  Reads a public Eventbrite event so the content manager can create a site
  event from a pasted URL instead of retyping every field.

  Two sources, tried in order by api/admin/eventbrite.js:

  1. The unauthenticated "destination" endpoint the Eventbrite event page
     itself calls. It returns clean fields (separate date/time, timezone, venue
     name and city, full-size flyer) but it is not part of Eventbrite's
     documented API, so it could change without notice.
  2. The schema.org JSON-LD block embedded in the event page, which Eventbrite
     publishes for search engines and is far less likely to move.

  Everything here is pure (no network, no storage) so it can be tested on
  fixtures captured from a real event.
*/
import { cleanString } from "./http.js";

// Public event pages look like
//   https://www.eventbrite.com/e/<slug>-tickets-<id>?aff=...
// The numeric ID at the end of the path is all that is needed. Country
// storefronts (eventbrite.co.uk, eventbrite.ca, ...) use the same layout.
const EVENT_URL_RE = /^https:\/\/(?:www\.)?eventbrite\.(?:com|[a-z]{2}(?:\.[a-z]{2})?)\/e\/(?:[^/?#]*?-)?(\d{6,20})(?:[/?#]|$)/i;

// Flyers come from Eventbrite's own image CDN. Pinning the host keeps the
// endpoint from being turned into a fetcher for arbitrary URLs if either
// upstream response is ever manipulated.
const ALLOWED_IMAGE_HOSTS = /(^|\.)evbuc\.com$/i;

const MAX = { title: 200, summary: 600, city: 80, venue: 120, url: 500 };

export function parseEventbriteEventId(url) {
  const match = String(url || "").trim().match(EVENT_URL_RE);
  return match ? match[1] : null;
}

export function destinationApiUrl(eventId) {
  return `https://www.eventbrite.com/api/v3/destination/events/?event_ids=${encodeURIComponent(eventId)}&expand=primary_venue,image`;
}

export function isAllowedImageUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || ""));
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && ALLOWED_IMAGE_HOSTS.test(parsed.hostname);
}

// "18:00" -> "6:00 PM". Returns "" for anything that isn't HH:MM.
export function formatClockTime(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const hours = Number(match[1]);
  if (hours > 23) return "";
  const suffix = hours >= 12 ? "PM" : "AM";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${match[2]} ${suffix}`;
}

// "18:00" + "21:00" -> "6:00-9:00 PM", matching how the site already writes
// times in event summaries. Different periods keep both: "11:30 AM-1:00 PM".
export function formatTimeRange(start, end) {
  const from = formatClockTime(start);
  const to = formatClockTime(end);
  if (!from) return "";
  if (!to || to === from) return from;
  const [fromClock, fromPeriod] = from.split(" ");
  const [, toPeriod] = to.split(" ");
  return fromPeriod === toPeriod ? `${fromClock}-${to}` : `${from}-${to}`;
}

// Eventbrite's one-line summary plus the venue and hours, in the same shape
// as the summaries already on the site. The editor can rewrite it freely.
export function composeSummary({ summary, venue, timeRange }) {
  const lead = cleanString(summary, MAX.summary);
  const where = [cleanString(venue, MAX.venue), timeRange].filter(Boolean).join(", ");
  const parts = [lead, where ? `${where}.` : ""].filter(Boolean);
  return cleanString(parts.join(" "), MAX.summary);
}

function finish(fields) {
  return {
    title: cleanString(fields.title, MAX.title),
    date: fields.date || "",
    startTime: fields.startTime || "",
    endTime: fields.endTime || "",
    timezone: fields.timezone || "",
    city: cleanString(fields.city, MAX.city),
    venue: cleanString(fields.venue, MAX.venue),
    summary: composeSummary({
      summary: fields.summary,
      venue: fields.venue,
      timeRange: formatTimeRange(fields.startTime, fields.endTime),
    }),
    imageUrl: isAllowedImageUrl(fields.imageUrl) ? String(fields.imageUrl) : "",
    registerUrl: cleanString(fields.registerUrl, MAX.url),
    eventbriteId: String(fields.eventbriteId || ""),
    status: fields.status || "",
  };
}

// Source 1: the destination endpoint's JSON ({ events: [ ... ] }).
export function mapDestinationResponse(payload, eventId) {
  const events = payload && Array.isArray(payload.events) ? payload.events : [];
  const event = events.find((e) => e && String(e.id) === String(eventId)) || events[0];
  if (!event || !event.name) return null;

  const venue = event.primary_venue || {};
  const address = venue.address || {};
  const image = event.image || {};
  const original = image.original && image.original.url;

  return finish({
    title: event.name,
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(event.start_date || "")) ? event.start_date : "",
    startTime: event.start_time,
    endTime: event.end_time,
    timezone: event.timezone,
    city: address.city,
    venue: venue.name,
    summary: event.summary,
    imageUrl: original || image.url,
    registerUrl: event.url,
    eventbriteId: event.id || eventId,
    status: event.status,
  });
}

// Source 2: the schema.org Event block in the event page's HTML.
export function mapEventPageHtml(html, eventId) {
  const blocks = String(html || "").matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  let event = null;
  for (const block of blocks) {
    let data;
    try {
      data = JSON.parse(block[1]);
    } catch {
      continue;
    }
    const items = Array.isArray(data) ? data : [data];
    event = items.find((item) => item && /Event$/i.test(String(item["@type"] || "")) && item.name);
    if (event) break;
  }
  if (!event) return null;

  // "2026-09-24T18:00:00-04:00" is the event's local wall-clock time with
  // its offset attached, so the date and time can be read straight off it.
  const startMatch = String(event.startDate || "").match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
  const endMatch = String(event.endDate || "").match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
  const location = event.location && !Array.isArray(event.location) ? event.location : (event.location || [])[0] || {};
  const address = location.address && typeof location.address === "object" ? location.address : {};
  const image = Array.isArray(event.image) ? event.image[0] : event.image;

  return finish({
    title: event.name,
    date: startMatch ? startMatch[1] : "",
    startTime: startMatch ? startMatch[2] : "",
    endTime: endMatch ? endMatch[2] : "",
    city: address.addressLocality,
    venue: location.name,
    summary: event.description,
    imageUrl: typeof image === "string" ? image : image && image.url,
    registerUrl: event.url,
    eventbriteId: eventId,
    status: /Cancelled/i.test(String(event.eventStatus || "")) ? "canceled" : "",
  });
}
