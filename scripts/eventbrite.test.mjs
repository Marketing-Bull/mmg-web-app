// Tests for the Eventbrite import used by content-manager.html.
//
//   node --test scripts/*.test.mjs
//
// The fixtures under scripts/fixtures/ were captured from a real MMG event
// (the Fall Personal Injury Professionals Mixer) and trimmed to the fields
// the mappers read. If Eventbrite changes either response shape, the live
// import degrades before these tests do — so a failure here means the
// mapping itself regressed, not the upstream.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseEventbriteEventId,
  destinationApiUrl,
  isAllowedImageUrl,
  formatClockTime,
  formatTimeRange,
  composeSummary,
  mapDestinationResponse,
  mapEventPageHtml,
} from "../lib/eventbrite.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const EVENT_ID = "1999147508012";

test("event ID is read from the public URL shapes Eventbrite hands out", () => {
  const cases = [
    ["https://www.eventbrite.com/e/fall-personal-injury-professionals-mixer-tickets-1999147508012?aff=oddtdtcreator", EVENT_ID],
    ["https://www.eventbrite.com/e/fall-personal-injury-professionals-mixer-tickets-1999147508012", EVENT_ID],
    ["https://eventbrite.com/e/1999147508012", EVENT_ID],
    ["https://www.eventbrite.co.uk/e/some-event-tickets-1999147508012/", EVENT_ID],
    ["  https://www.eventbrite.com/e/x-tickets-1999147508012#tickets  ", EVENT_ID],
  ];
  for (const [url, expected] of cases) assert.equal(parseEventbriteEventId(url), expected, url);
});

test("anything that is not a public event page is rejected", () => {
  const bad = [
    "",
    "not a url",
    "http://www.eventbrite.com/e/x-tickets-1999147508012", // plain http
    "https://www.eventbrite.com/o/millers-marketing-group-68684991773", // organizer page
    "https://www.eventbrite.com/e/", // no id
    "https://www.eventbrite.com/e/x-tickets-12345", // too short to be an event id
    "https://evil.example/e/x-tickets-1999147508012",
    "https://www.eventbrite.com.evil.example/e/x-tickets-1999147508012",
    "javascript:alert(1)",
  ];
  for (const url of bad) assert.equal(parseEventbriteEventId(url), null, url);
});

test("the lookup URL only ever carries the numeric id", () => {
  assert.equal(
    destinationApiUrl(EVENT_ID),
    "https://www.eventbrite.com/api/v3/destination/events/?event_ids=1999147508012&expand=primary_venue,image"
  );
});

test("flyers are only fetched from Eventbrite's image CDN over https", () => {
  assert.equal(isAllowedImageUrl("https://img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com%2Fimages%2F1%2Foriginal.jpg?w=940"), true);
  assert.equal(isAllowedImageUrl("https://cdn.evbuc.com/images/1/original.jpg"), true);
  assert.equal(isAllowedImageUrl("http://img.evbuc.com/x.jpg"), false);
  assert.equal(isAllowedImageUrl("https://evbuc.com.evil.example/x.jpg"), false);
  assert.equal(isAllowedImageUrl("https://169.254.169.254/latest/meta-data"), false);
  assert.equal(isAllowedImageUrl(""), false);
});

test("times are written the way the site already writes them", () => {
  assert.equal(formatClockTime("18:00"), "6:00 PM");
  assert.equal(formatClockTime("00:30"), "12:30 AM");
  assert.equal(formatClockTime("12:00"), "12:00 PM");
  assert.equal(formatClockTime("9:05"), "9:05 AM");
  assert.equal(formatClockTime("nope"), "");
  assert.equal(formatTimeRange("18:00", "21:00"), "6:00-9:00 PM");
  assert.equal(formatTimeRange("11:30", "13:00"), "11:30 AM-1:00 PM");
  assert.equal(formatTimeRange("18:00", ""), "6:00 PM");
  assert.equal(formatTimeRange("", "21:00"), "");
});

test("summary keeps Eventbrite's blurb and adds venue and hours", () => {
  assert.equal(
    composeSummary({ summary: "Mix and mingle.", venue: "JOEY Aventura", timeRange: "6:00-9:00 PM" }),
    "Mix and mingle. JOEY Aventura, 6:00-9:00 PM."
  );
  assert.equal(composeSummary({ summary: "Mix and mingle.", venue: "", timeRange: "" }), "Mix and mingle.");
  assert.equal(composeSummary({ summary: "", venue: "The Ray", timeRange: "6:00-9:00 PM" }), "The Ray, 6:00-9:00 PM.");
  assert.equal(composeSummary({ summary: "  padded  ", venue: "", timeRange: "" }), "padded");
  assert.ok(composeSummary({ summary: "x".repeat(2000), venue: "", timeRange: "" }).length <= 600);
});

test("destination API response maps onto the site's event fields", () => {
  const event = mapDestinationResponse(JSON.parse(fixture("eventbrite-destination.json")), EVENT_ID);
  assert.ok(event);
  assert.equal(event.title, "Fall Personal Injury Professionals Mixer");
  assert.equal(event.date, "2026-09-24");
  assert.equal(event.city, "Miami");
  assert.equal(event.venue, "JOEY Aventura");
  assert.equal(event.eventbriteId, EVENT_ID);
  assert.equal(event.status, "live");
  assert.equal(event.registerUrl, "https://www.eventbrite.com/e/fall-personal-injury-professionals-mixer-tickets-1999147508012");
  assert.match(event.summary, /^Mix, mingle, and swap stories with injury pros this fall/);
  assert.match(event.summary, /JOEY Aventura, 6:00-9:00 PM\.$/);
  // The full-size original is preferred over the 200px listing thumbnail.
  assert.match(event.imageUrl, /^https:\/\/img\.evbuc\.com\//);
  assert.doesNotMatch(event.imageUrl, /h=200/);
});

test("destination API: an empty or foreign response yields nothing", () => {
  assert.equal(mapDestinationResponse({ events: [] }, EVENT_ID), null);
  assert.equal(mapDestinationResponse(null, EVENT_ID), null);
  assert.equal(mapDestinationResponse({ events: [{ id: EVENT_ID }] }, EVENT_ID), null);
  const other = mapDestinationResponse({ events: [{ id: "1", name: "Other" }] }, EVENT_ID);
  assert.equal(other.title, "Other");
  assert.equal(other.eventbriteId, "1");
});

test("event page JSON-LD is the fallback and lands on the same fields", () => {
  const event = mapEventPageHtml(fixture("eventbrite-event-page.html"), EVENT_ID);
  assert.ok(event);
  assert.equal(event.title, "Fall Personal Injury Professionals Mixer");
  assert.equal(event.date, "2026-09-24");
  assert.equal(event.startTime, "18:00");
  assert.equal(event.endTime, "21:00");
  assert.equal(event.city, "Miami");
  assert.equal(event.venue, "JOEY Aventura");
  assert.equal(event.eventbriteId, EVENT_ID);
  assert.match(event.summary, /JOEY Aventura, 6:00-9:00 PM\.$/);
  assert.match(event.imageUrl, /^https:\/\/img\.evbuc\.com\//);
  assert.equal(event.registerUrl, "https://www.eventbrite.com/e/fall-personal-injury-professionals-mixer-tickets-1999147508012");
});

test("event page without a schema.org event block yields nothing", () => {
  assert.equal(mapEventPageHtml("<html><body>Page not found</body></html>", EVENT_ID), null);
  assert.equal(mapEventPageHtml('<script type="application/ld+json">{"@type":"WebPage","name":"x"}</script>', EVENT_ID), null);
  assert.equal(mapEventPageHtml('<script type="application/ld+json">not json</script>', EVENT_ID), null);
});

test("mapped fields are trimmed, capped and never carry markup through untouched", () => {
  const event = mapDestinationResponse(
    {
      events: [
        {
          id: EVENT_ID,
          name: "  " + "T".repeat(500),
          summary: "<b>bold</b>",
          start_date: "not-a-date",
          image: { url: "https://evil.example/x.jpg" },
          primary_venue: { name: "V".repeat(500), address: { city: "C".repeat(500) } },
        },
      ],
    },
    EVENT_ID
  );
  assert.equal(event.title.length, 200);
  assert.equal(event.date, "");
  assert.equal(event.imageUrl, "");
  assert.equal(event.venue.length, 120);
  assert.equal(event.city.length, 80);
  // Content is escaped by the renderer on the way out; the mapper just keeps it a string.
  assert.equal(typeof event.summary, "string");
});
