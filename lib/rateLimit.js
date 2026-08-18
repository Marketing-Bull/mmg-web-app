// Fixed-window rate limiting for the serverless endpoints, held in the
// function instance's own memory.
//
// Scope, stated plainly: Vercel scales these endpoints as independent
// instances, so each one keeps its own counters. A burst spread across N warm
// instances can therefore reach up to N x the limit before anything is
// rejected, and counters reset whenever an instance is recycled.
//
// That is still worth having. The cases this exists for — a script hammering
// the lead form, or a password-guessing run against the content manager — send
// a rapid stream of requests down a small number of warm instances and get
// throttled almost immediately. What it is not is an exact global quota. If MMG
// ever needs one, replace the Map below with a shared store (Vercel KV or
// Upstash); the exported API is designed to stay the same.

const WINDOWS = new Map();

// Ceiling on tracked keys so a spray of unique IPs can't grow the map without
// bound. Expired entries are swept first; if that isn't enough, the oldest
// entries go (insertion order is Map iteration order).
const MAX_TRACKED_KEYS = 5000;

// Vercel sets these itself and overwrites anything the client sent, so they can
// be trusted here in a way a raw X-Forwarded-For on other hosts could not be.
export function clientIp(req) {
  const headers = req.headers || {};
  const direct = headers["x-real-ip"] || headers["x-vercel-forwarded-for"];
  if (direct) return String(direct).split(",")[0].trim();
  const forwarded = headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

function prune(now) {
  for (const [key, entry] of WINDOWS) {
    if (entry.resetAt <= now) WINDOWS.delete(key);
  }
  while (WINDOWS.size > MAX_TRACKED_KEYS) {
    const oldest = WINDOWS.keys().next();
    if (oldest.done) break;
    WINDOWS.delete(oldest.value);
  }
}

// Records a hit and reports where the caller now stands in its window.
export function consume(key, limit, windowMs) {
  const now = Date.now();
  if (WINDOWS.size >= MAX_TRACKED_KEYS) prune(now);

  const entry = WINDOWS.get(key);
  if (!entry || entry.resetAt <= now) {
    WINDOWS.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  entry.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  if (entry.count > limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }
  return { allowed: true, remaining: limit - entry.count, retryAfterSeconds };
}

/*
  Applies one rate-limit rule to a request.

  Returns true when the request may proceed. When it returns false the 429
  response has already been sent, so the handler just returns:

      if (!enforceRateLimit(req, res, LIMITS.lead)) return;
*/
export function enforceRateLimit(req, res, { name, limit, windowMs, message }) {
  const key = `${name}:${clientIp(req)}`;
  const result = consume(key, limit, windowMs);

  res.setHeader("RateLimit-Policy", `${limit};w=${Math.round(windowMs / 1000)}`);
  res.setHeader("RateLimit-Limit", String(limit));
  res.setHeader("RateLimit-Remaining", String(Math.max(0, result.remaining)));

  if (result.allowed) return true;

  res.setHeader("Retry-After", String(result.retryAfterSeconds));
  res.setHeader("Cache-Control", "no-store");
  res.status(429).json({ error: message || "Too many requests. Please wait a moment and try again." });
  return false;
}

// One place to see and tune every limit on the site.
export const LIMITS = {
  // A person submits the consultation or newsletter form once; the allowance
  // covers a retype or a second form without getting in anyone's way.
  lead: {
    name: "lead",
    limit: 5,
    windowMs: 10 * 60 * 1000,
    message: "Too many submissions from this connection. Please wait a few minutes, or email contact@millersmarketinggroup.com.",
  },
  // Password guessing is the threat here, so this is the tightest rule.
  adminLogin: {
    name: "admin-login",
    limit: 8,
    windowMs: 15 * 60 * 1000,
    message: "Too many login attempts. Please wait 15 minutes and try again.",
  },
  // Already behind a valid session; generous enough for a long editing run.
  adminContent: { name: "admin-content", limit: 60, windowMs: 5 * 60 * 1000 },
  // Media handling is the expensive path, so it gets its own smaller budget.
  adminMedia: { name: "admin-media", limit: 30, windowMs: 10 * 60 * 1000 },
};
