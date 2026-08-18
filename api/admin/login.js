// Content manager login. Checks the shared team password (CONTENT_ADMIN_PASSWORD)
// and, on success, sets a signed session cookie. POST /api/admin/login { password }
import { checkPassword, createSessionCookie } from "../../lib/auth.js";
import { readJsonBody, noStore } from "../../lib/http.js";
import { enforceRateLimit, LIMITS } from "../../lib/rateLimit.js";

export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // A single shared password is the whole of the authentication here, so the
  // rate limit is what stands between it and an automated guessing run.
  if (!enforceRateLimit(req, res, LIMITS.adminLogin)) return;

  const body = readJsonBody(req);

  if (!process.env.CONTENT_ADMIN_PASSWORD || !process.env.CONTENT_SESSION_SECRET) {
    return res.status(500).json({ error: "Content manager login is not configured yet." });
  }
  if (!checkPassword(body.password)) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  res.setHeader("Set-Cookie", createSessionCookie());
  return res.status(200).json({ ok: true });
}
