/*
  Authenticated configuration check for the deployment.

  Every other endpoint hides a missing environment variable behind a graceful
  fallback — the public feeds quietly serve the committed seed, the Instagram
  import just fails at the moment someone tries to use it — so there is no way
  to tell a correctly configured deployment from a half-configured one by
  looking at the site. This says so directly.

  Log in to the content manager, then open /api/admin/status in the same
  browser. It reports whether each variable is *present*; it never returns or
  logs a value, and it never confirms that a value is correct.
*/
import { requireSession } from "../../lib/auth.js";
import { noStore } from "../../lib/http.js";
import { enforceRateLimit, LIMITS } from "../../lib/rateLimit.js";
import { probeBlob } from "../../lib/blobStore.js";

const REQUIRED_ENV = [
  { name: "GHL_WEBHOOK_URL", used: "Contact + newsletter submissions (api/lead.js)" },
  { name: "CONTENT_ADMIN_PASSWORD", used: "Content manager login" },
  { name: "CONTENT_SESSION_SECRET", used: "Signs the content manager session cookie" },
  { name: "BLOB_READ_WRITE_TOKEN", used: "Publishing Events/Sponsors and storing uploads" },
  { name: "IG_APP_ID", used: "Instagram image import" },
  { name: "IG_APP_SECRET", used: "Instagram image import" },
];

export default async function handler(req, res) {
  noStore(res);

  if (!requireSession(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceRateLimit(req, res, LIMITS.adminContent)) return;

  const environment = REQUIRED_ENV.map((entry) => ({
    name: entry.name,
    set: !!process.env[entry.name],
    used: entry.used,
  }));

  const blob = await probeBlob().catch((err) => ({
    configured: !!process.env.BLOB_READ_WRITE_TOKEN,
    reachable: false,
    eventsPublished: false,
    sponsorsPublished: false,
    error: String(err.message || err).slice(0, 200),
  }));

  const missing = environment.filter((entry) => !entry.set).map((entry) => entry.name);

  return res.status(200).json({
    checkedAt: new Date().toISOString(),
    environmentTarget: process.env.VERCEL_ENV || "unknown",
    ready: missing.length === 0 && blob.reachable,
    missing,
    environment,
    blob,
  });
}
