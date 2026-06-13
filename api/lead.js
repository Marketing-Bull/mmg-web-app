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

  const isNewsletter = body.form === "newsletter";

  if (!isNewsletter && !(body.phone || "").trim()) {
    return res.status(400).json({ error: "A mobile phone number is required." });
  }

  // Split the single name field into first/last for GHL contact creation.
  const name = (body.name || "").trim();
  const gap = name.indexOf(" ");
  const firstName = gap === -1 ? name : name.slice(0, gap);
  const lastName = gap === -1 ? "" : name.slice(gap + 1);

  // Tags GHL can use to segment the lead.
  const tags = ["MMG Website", isNewsletter ? "Newsletter Signup" : "Website Contact Form"];
  if (!isNewsletter && body.interest) tags.push(String(body.interest));

  const payload = {
    form: isNewsletter ? "newsletter" : "contact",
    name,
    first_name: firstName,
    last_name: lastName,
    company: body.company || "",
    email,
    phone: body.phone || "",
    interest: body.interest || "",
    message: body.message || "",
    tags,
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
