import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildSchemaNodes,
  checkStaticEvents,
  readStaticBlock,
  syncStaticEvents,
} from "./sync-static-events.mjs";

const HTML = () => readFileSync("index.html", "utf8");
const EVENTS = () => JSON.parse(readFileSync("data/events.json", "utf8")).events;

const base = {
  id: "x",
  title: "Test Mixer",
  status: "upcoming",
  date: "2026-12-10",
  startTime: "18:00",
  endTime: "20:00",
  city: "Miami",
  venue: "The Venue",
  summary: "A summary.",
  image: "",
  registerUrl: "https://www.eventbrite.com/e/test-tickets-123456",
};

test("the committed event schema in index.html matches data/events.json", () => {
  const result = checkStaticEvents(HTML(), EVENTS());
  assert.ok(result.inStep, "index.html event schema is out of step; run: node scripts/sync-static-events.mjs");
});

test("changing the data without re-syncing is caught", () => {
  const changed = EVENTS().map((e) => (e.title === "Personal Injury Attorneys Networking Event" ? { ...e, venue: "Somewhere Else" } : e));
  assert.equal(checkStaticEvents(HTML(), changed).inStep, false);
});

test("check is judged at the date the block was built, so time passing alone does not fail it", () => {
  // Far in the future every event is past, yet the block still matches the
  // data it was built from: only the stale flag is raised.
  const result = checkStaticEvents(HTML(), EVENTS(), "2030-01-01");
  assert.ok(result.inStep);
  assert.ok(result.stale);
});

test("sync is idempotent and replaces the block rather than adding another", () => {
  const once = syncStaticEvents(HTML(), EVENTS(), "2026-10-02");
  const twice = syncStaticEvents(once, EVENTS(), "2026-10-02");
  assert.equal(once, twice);
  assert.equal((twice.match(/data-event-schema/g) || []).length, 1);
});

test("with no upcoming events the block is removed rather than left describing the past", () => {
  const html = syncStaticEvents(HTML(), EVENTS(), "2030-01-01");
  assert.equal(readStaticBlock(html), null);
  assert.doesNotMatch(html, /data-event-schema/);
});

test("the static copy is built by content.js's own builder", () => {
  const block = readStaticBlock(HTML());
  assert.deepEqual(block.data, buildSchemaNodes(EVENTS(), block.generated));
});

test("UTC offset follows daylight saving", () => {
  const [summer] = buildSchemaNodes([{ ...base, date: "2026-07-10" }], "2026-07-01");
  const [winter] = buildSchemaNodes([{ ...base, date: "2026-12-10" }], "2026-12-01");
  assert.equal(summer.startDate, "2026-07-10T18:00:00-04:00");
  assert.equal(winter.startDate, "2026-12-10T18:00:00-05:00");
});

test("address carries street, state and ZIP when stored, and nothing is invented when not", () => {
  const [full] = buildSchemaNodes(
    [{ ...base, streetAddress: "1 Main St", state: "FL", postalCode: "33101" }],
    "2026-12-01"
  );
  assert.deepEqual(full.location.address, {
    "@type": "PostalAddress",
    addressCountry: "US",
    streetAddress: "1 Main St",
    addressLocality: "Miami",
    addressRegion: "FL",
    postalCode: "33101",
  });

  const [bare] = buildSchemaNodes([base], "2026-12-01");
  assert.deepEqual(bare.location.address, {
    "@type": "PostalAddress",
    addressCountry: "US",
    addressLocality: "Miami",
  });
});

test("past and undated events are never described", () => {
  const nodes = buildSchemaNodes(
    [
      { ...base, title: "Past", date: "2026-01-01" },
      { ...base, title: "Undated", date: "" },
      { ...base, title: "Ahead", date: "2026-12-10" },
    ],
    "2026-12-01"
  );
  assert.deepEqual(nodes.map((n) => n.name), ["Ahead"]);
});

test("markup in a summary cannot close the script tag", () => {
  const html = syncStaticEvents(HTML(), [{ ...base, summary: "</script><b>x</b>" }], "2026-12-01");
  assert.doesNotMatch(html, /<\/script><b>/);
  assert.match(html, /\\u003c\/script>/);
});
