// Vercel serverless function: receives contact + newsletter submissions and
// forwards them to a GoHighLevel (GHL) inbound webhook.
//
// The webhook URL is read from the GHL_WEBHOOK_URL environment variable
// (set it in Vercel → Project → Settings → Environment Variables) so the
// URL is never exposed in client-side code.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhook = process.env.GHL_WEBHOOK_URL;
  if (!webhook) {
    return res.status(500).json({ error: "Lead webhook is not configured." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};

  // Honeypot: a filled hidden field means a bot — accept silently, send nothing.
  if (body._gotcha) {
    return res.status(200).json({ ok: true });
  }

  const email = (body.email || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "A valid email is required." });
  }

  const payload = {
    form: body.form === "newsletter" ? "newsletter" : "contact",
    name: body.name || "",
    company: body.company || "",
    email,
    phone: body.phone || "",
    interest: body.interest || "",
    message: body.message || "",
    source: "millersmarketinggroup.com",
    page: body.page || "",
    submitted_at: new Date().toISOString(),
  };

  try {
    const upstream = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!upstream.ok) {
      return res.status(502).json({ error: "Upstream webhook error." });
    }
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ error: "Could not reach the lead webhook." });
  }
}
