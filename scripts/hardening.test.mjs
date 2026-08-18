// Tests for the rate limiting and upload validation added for launch.
//
//   node --test scripts/*.test.mjs
//
// Runs in CI alongside scripts/validate.mjs. These are the pieces where a
// quiet regression would matter — an upload allowlist that stops rejecting
// mislabelled files, or a limiter that stops counting — so they are pinned
// here rather than left to be re-checked by hand.
import test from "node:test";
import assert from "node:assert/strict";
import { clientIp, consume, enforceRateLimit, LIMITS } from "../lib/rateLimit.js";
import { readJsonBody, cleanString } from "../lib/http.js";
import { ALLOWED_TYPES, MAX_BYTES, MAX_BASE64_LENGTH } from "../lib/uploadTypes.js";

function fakeRes() {
  return {
    headers: {},
    statusCode: 0,
    body: null,
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const fakeReq = (ip, headers = {}) => ({ headers: { "x-real-ip": ip, ...headers } });

test("rate limiter allows up to the limit, then rejects", () => {
  const rule = { name: `t-${Math.random()}`, limit: 3, windowMs: 60000 };
  const req = fakeReq("203.0.113.10");

  for (let i = 0; i < rule.limit; i++) {
    const res = fakeRes();
    assert.equal(enforceRateLimit(req, res, rule), true, `request ${i + 1} should pass`);
    assert.equal(res.headers["ratelimit-remaining"], String(rule.limit - i - 1));
  }

  const blocked = fakeRes();
  assert.equal(enforceRateLimit(req, blocked, rule), false);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.headers["cache-control"], "no-store");
  assert.ok(Number(blocked.headers["retry-after"]) > 0);
  assert.match(blocked.body.error, /too many/i);
});

test("rate limiter counts each client separately", () => {
  const rule = { name: `t-${Math.random()}`, limit: 1, windowMs: 60000 };
  assert.equal(enforceRateLimit(fakeReq("198.51.100.1"), fakeRes(), rule), true);
  assert.equal(enforceRateLimit(fakeReq("198.51.100.2"), fakeRes(), rule), true);
  assert.equal(enforceRateLimit(fakeReq("198.51.100.1"), fakeRes(), rule), false);
});

test("rate limiter window expires", async () => {
  const key = `expiry-${Math.random()}`;
  assert.equal(consume(key, 1, 40).allowed, true);
  assert.equal(consume(key, 1, 40).allowed, false);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(consume(key, 1, 40).allowed, true, "a new window should start after the old one expires");
});

test("client IP prefers the headers Vercel sets itself", () => {
  assert.equal(clientIp({ headers: { "x-real-ip": "203.0.113.7" } }), "203.0.113.7");
  assert.equal(clientIp({ headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.1" } }), "203.0.113.8");
  assert.equal(clientIp({ headers: {} }), "unknown");
});

test("every configured limit is sane", () => {
  for (const [name, rule] of Object.entries(LIMITS)) {
    assert.ok(rule.limit > 0, `${name} needs a positive limit`);
    assert.ok(rule.windowMs >= 1000, `${name} needs a real window`);
    assert.equal(typeof rule.name, "string");
  }
  assert.ok(LIMITS.adminLogin.limit <= 10, "login attempts must stay tightly capped");
});

test("upload allowlist accepts real file signatures", () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
  const gif = Buffer.concat([Buffer.from("GIF89a", "latin1"), Buffer.alloc(16)]);
  const webp = Buffer.concat([Buffer.from("RIFF", "latin1"), Buffer.alloc(4), Buffer.from("WEBP", "latin1"), Buffer.alloc(8)]);
  const mp4 = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypisom", "latin1"), Buffer.alloc(8)]);
  const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(16)]);

  assert.ok(ALLOWED_TYPES["image/png"](png));
  assert.ok(ALLOWED_TYPES["image/jpeg"](jpeg));
  assert.ok(ALLOWED_TYPES["image/gif"](gif));
  assert.ok(ALLOWED_TYPES["image/webp"](webp));
  assert.ok(ALLOWED_TYPES["video/mp4"](mp4));
  assert.ok(ALLOWED_TYPES["video/quicktime"](mp4));
  assert.ok(ALLOWED_TYPES["video/webm"](webm));
});

test("upload allowlist rejects mislabelled and scriptable files", () => {
  const html = Buffer.from('<script>alert(1)</script>', "latin1");
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>', "latin1");

  // A script payload claiming to be an image never passes the signature check.
  for (const type of Object.keys(ALLOWED_TYPES)) {
    assert.equal(ALLOWED_TYPES[type](html), false, `${type} must reject an HTML payload`);
    assert.equal(ALLOWED_TYPES[type](svg), false, `${type} must reject an SVG payload`);
  }

  // SVG is deliberately absent: browsers execute script inside it.
  assert.equal(ALLOWED_TYPES["image/svg+xml"], undefined);
  assert.equal(ALLOWED_TYPES["text/html"], undefined);
  assert.equal(ALLOWED_TYPES["application/pdf"], undefined);
});

test("upload size ceiling stays under the platform body limit", () => {
  // Vercel caps a serverless request body around 4.5MB and base64 inflates by ~33%.
  assert.ok(MAX_BASE64_LENGTH < 4.5 * 1024 * 1024);
  assert.ok(MAX_BASE64_LENGTH > MAX_BYTES, "the base64 ceiling must allow for encoding overhead");
});

test("request helpers normalise input", () => {
  assert.deepEqual(readJsonBody({ body: '{"a":1}' }), { a: 1 });
  assert.deepEqual(readJsonBody({ body: "not json" }), {});
  assert.deepEqual(readJsonBody({ body: null }), {});
  assert.deepEqual(readJsonBody({ body: { a: 1 } }), { a: 1 });

  assert.equal(cleanString("  hello  ", 10), "hello");
  assert.equal(cleanString("x".repeat(50), 10).length, 10);
  assert.equal(cleanString(undefined, 10), "");
  assert.equal(cleanString(42, 10), "42");
});
