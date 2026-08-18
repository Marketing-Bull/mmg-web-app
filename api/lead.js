// Vercel serverless function: receives contact + newsletter submissions and
// forwards them to a GoHighLevel (GHL) inbound webhook.
//
// The webhook URL is read from the GHL_WEBHOOK_URL environment variable
// (set it in Vercel → Project → Settings → Environment Variables) so the
// URL is never exposed in client-side code.
import { readJsonBody, cleanString, noStore } from "../lib/http.js";
import { enforceRateLimit, LIMITS } from "../lib/rateLimit.js";

// Caps applied before anything is forwarded to GHL. Generous for a real
// person, small enough that the endpoint can't be used to push bulk text
// into the CRM.
const MAX_LENGTHS = {
  name: 120,
  company: 160,
  email: 200,
  phone: 40,
  interest: 120,
  message: 4000,
  page: 500,
};

export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceRateLimit(req, res, LIMITS.lead)) return;

  const webhook = process.env.GHL_WEBHOOK_URL;
  if (!webhook) {
    return res.status(500).json({ error: "Lead webhook is not configured." });
  }

  const body = readJsonBody(req);

  // Honeypot: a filled hidden field means a bot — accept silently, send nothing.
  if (body._gotcha) {
    return res.status(200).json({ ok: true });
  }

  const email = cleanString(body.email, MAX_LENGTHS.email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "A valid email is required." });
  }

  const isNewsletter = body.form === "newsletter";
  const phone = cleanString(body.phone, MAX_LENGTHS.phone);

  if (!isNewsletter && !phone) {
    return res.status(400).json({ error: "A mobile phone number is required." });
  }

  // Split the single name field into first/last for GHL contact creation.
  const name = cleanString(body.name, MAX_LENGTHS.name);
  const gap = name.indexOf(" ");
  const firstName = gap === -1 ? name : name.slice(0, gap);
  const lastName = gap === -1 ? "" : name.slice(gap + 1);

  const interest = cleanString(body.interest, MAX_LENGTHS.interest);

  // Tags GHL can use to segment the lead and keep contact/newsletter flows separate.
  const tags = ["MMG Website", isNewsletter ? "MMG Newsletter Signup" : "MMG Consultation Request"];
  if (!isNewsletter && interest) tags.push(interest);

  const payload = {
    form: isNewsletter ? "newsletter" : "contact",
    name,
    first_name: firstName,
    last_name: lastName,
    company: cleanString(body.company, MAX_LENGTHS.company),
    email,
    phone,
    interest,
    message: cleanString(body.message, MAX_LENGTHS.message),
    tags,
    source: "millersmarketinggroup.com",
    page: cleanString(body.page, MAX_LENGTHS.page),
    submitted_at: new Date().toISOString(),
  };

  try {
    const upstream = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Without a timeout a stalled webhook holds the function open until the
      // platform kills it, and the visitor sees the form hang.
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) {
      return res.status(502).json({ error: "Upstream webhook error." });
    }
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ error: "Could not reach the lead webhook." });
  }
}
