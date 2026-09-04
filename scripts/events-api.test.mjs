// Tests for the public Events API (api/events.js).
//
//   node --test scripts/*.test.mjs
//
// This endpoint is documented in llms.txt and README as a public, stable
// feed, so its contract is pinned here: open CORS, read-only methods, and an
// `updated` field that reports when the content changed rather than when it
// was asked for. Without a Blob token these run against the committed seed,
// which is the same path production takes when storage is unreachable.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import handler from "../api/events.js";

const seed = JSON.parse(readFileSync(new URL("../data/events.json", import.meta.url), "utf8"));

function fakeRes() {
  return {
    headers: {},
    statusCode: 0,
    body: null,
    ended: false,
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = String(value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

const call = async (method) => {
  const res = fakeRes();
  await handler({ method, headers: {} }, res);
  return res;
};

test("GET returns the events feed to any origin", async () => {
  const res = await call("GET");
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["access-control-allow-origin"], "*");
  assert.ok(Array.isArray(res.body.events));
  assert.ok(res.body.events.length > 0);
});

test("responses are edge-cached rather than recomputed per visitor", async () => {
  const res = await call("GET");
  assert.match(res.headers["cache-control"], /s-maxage=\d+/);
  assert.match(res.headers["cache-control"], /stale-while-revalidate/);
});

test("a browser preflight is answered without a body", async () => {
  const res = await call("OPTIONS");
  assert.equal(res.statusCode, 204);
  assert.equal(res.ended, true);
  assert.equal(res.body, null);
  assert.equal(res.headers["access-control-allow-origin"], "*");
  assert.match(res.headers["access-control-allow-methods"], /GET/);
});

test("the feed is read-only: writes are refused, and say so", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const res = await call(method);
    assert.equal(res.statusCode, 405, `${method} should be rejected`);
    assert.match(res.headers.allow, /GET/);
    assert.match(res.body.error, /read-only/i);
  }
});

test("HEAD is allowed alongside GET", async () => {
  const res = await call("HEAD");
  assert.equal(res.statusCode, 200);
});

test("`updated` reports when the content changed, not when it was requested", async () => {
  const res = await call("GET");
  // Falls back to the seed here, so it should be the seed's own timestamp —
  // emphatically not `now`, which is what a caller polling for changes would
  // otherwise see move on every request.
  assert.equal(res.body.updated, seed.updated);
  assert.notEqual(res.body.updated, new Date().toISOString());
  assert.ok(!Number.isNaN(Date.parse(res.body.updated)), "should parse as a date");
});

test("every event carries a status recomputed from its date", async () => {
  const res = await call("GET");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

  for (const event of res.body.events) {
    assert.ok(["upcoming", "past", "undated"].includes(event.status), `bad status: ${event.status}`);
    const date = String(event.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      assert.equal(event.status, "undated");
    } else {
      assert.equal(event.status, date < today ? "past" : "upcoming", `${event.title} on ${date}`);
    }
  }
});

test("the stored status in the seed is never trusted over the date", async () => {
  const res = await call("GET");
  const byId = new Map(res.body.events.map((event) => [event.id, event]));
  // The seed ships hand-set statuses; the API must recompute them, so a
  // record left marked "upcoming" after its date passes is corrected.
  for (const stored of seed.events) {
    const served = byId.get(stored.id);
    assert.ok(served, `${stored.id} should be served`);
    const date = String(stored.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) assert.equal(served.status, "undated");
  }
});
