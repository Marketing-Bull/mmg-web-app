// Small request/response helpers shared by the serverless endpoints.

// Vercel parses JSON bodies for us, but a body can still arrive as a raw
// string (or not at all) depending on the content type the caller sent.
export function readJsonBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body && typeof body === "object" ? body : {};
}

// Trim a submitted string and cap its length, so an oversized field can't be
// forwarded to a downstream service or written into stored content.
export function cleanString(value, maxLength) {
  return String(value == null ? "" : value)
    .trim()
    .slice(0, maxLength);
}

// Admin responses and error responses must never be cached by a browser or by
// Vercel's edge cache.
export function noStore(res) {
  res.setHeader("Cache-Control", "no-store");
}
