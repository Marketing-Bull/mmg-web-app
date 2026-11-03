#!/usr/bin/env node
/*
  Lists upcoming Eventbrite events from MMG's organizer page that are not yet in
  data/events.json. Used by .github/workflows/eventbrite-check.yml as a free
  pre-check, so the (paid) model step only runs when there is something to add.

    node scripts/eventbrite-new-events.mjs [out.json]

  Writes the new events, with everything the model needs (address, times,
  signed flyer URL), to out.json (default: new-events.json) and, when running
  in GitHub Actions, sets the `count` and `ids` step outputs. Exits 0 either way.
*/
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const ORGANIZER_URL = "https://www.eventbrite.com/o/andrew-miller-121315094544";
const UA = "Mozilla/5.0 (compatible; mmg-web-app-event-check)";

export function parseUpcoming(html) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("__NEXT_DATA__ not found on the organizer page");
  const props = JSON.parse(match[1])?.props?.pageProps;
  if (!props || props.upcomingEventsFailed) throw new Error("Eventbrite did not return upcomingEvents");
  return props.upcomingEvents || [];
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// An Eventbrite event counts as known if its ID appears in any registerUrl or
// an event with the same title and date exists (past events have their
// registerUrl cleared, so the ID alone is not enough).
export function isKnown(listing, events) {
  return events.some(
    (e) =>
      String(e.registerUrl || "").includes(listing.id) ||
      (norm(e.title) === norm(listing.name) && e.date === listing.start_date),
  );
}

async function getJson(url) {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function details(id) {
  const data = await getJson(
    `https://www.eventbrite.com/api/v3/destination/events/?event_ids=${id}&expand=primary_venue,image`,
  );
  const e = data.events?.[0];
  if (!e) throw new Error(`no destination data for ${id}`);
  const v = e.primary_venue?.address || {};
  return {
    eventbriteId: String(e.id),
    title: e.name,
    date: e.start_date,
    startTime: e.start_time,
    endTime: e.end_time && e.end_time !== e.start_time ? e.end_time : "",
    url: e.url,
    ebSummary: e.summary || "",
    venue: e.primary_venue?.name || "",
    streetAddress: v.address_1 || "",
    city: v.city || "",
    state: v.region || "",
    postalCode: v.postal_code || "",
    flyerUrl: e.image?.original?.url || e.image?.url || "",
  };
}

async function main() {
  const out = process.argv[2] || "new-events.json";
  const known = JSON.parse(readFileSync("data/events.json", "utf8")).events;
  const html = await (await fetch(ORGANIZER_URL, { headers: { "user-agent": UA } })).text();
  const fresh = parseUpcoming(html).filter((l) => !l.is_cancelled && !isKnown(l, known));
  const result = [];
  for (const l of fresh) result.push(await details(l.id));
  writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  console.log(`${result.length} new event(s): ${result.map((r) => `${r.title} (${r.date})`).join("; ") || "none"}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `count=${result.length}\nids=${result.map((r) => r.eventbriteId).join("-")}\n`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
