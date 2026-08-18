// Turns a pasted Instagram post/reel URL into a fast, self-hosted image.
// Uses Instagram's oEmbed (Graph API) to resolve the post's thumbnail, then
// copies that image into our own Blob storage so it loads fast and doesn't
// break if the original post is edited or removed. POST { url }.
import { requireSession } from "../../lib/auth.js";
import { readJsonBody, noStore } from "../../lib/http.js";
import { enforceRateLimit, LIMITS } from "../../lib/rateLimit.js";
import { writeMedia } from "../../lib/blobStore.js";

const GRAPH_VERSION = "v21.0";
const INSTAGRAM_URL_RE = /^https:\/\/(www\.)?instagram\.com\/(p|reel|reels)\/[^/?#]+/i;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// The thumbnail URL comes back from Meta's own API, so it should always be one
// of their CDNs. Pinning the host keeps this endpoint from being turned into a
// fetcher for arbitrary URLs if that response is ever manipulated.
const ALLOWED_IMAGE_HOSTS = /(^|\.)(cdninstagram\.com|fbcdn\.net|instagram\.com)$/i;

function igToken() {
  const appId = process.env.IG_APP_ID;
  const appSecret = process.env.IG_APP_SECRET;
  if (!appId || !appSecret) return null;
  return `${appId}|${appSecret}`;
}

export default async function handler(req, res) {
  noStore(res);

  if (!requireSession(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceRateLimit(req, res, LIMITS.adminMedia)) return;

  const body = readJsonBody(req);

  const url = String(body.url || "").trim();
  if (!INSTAGRAM_URL_RE.test(url)) {
    return res.status(400).json({ error: "Paste a public Instagram post or reel URL (instagram.com/p/... or /reel/...)." });
  }

  const token = igToken();
  if (!token) {
    return res.status(500).json({ error: "IG_APP_ID / IG_APP_SECRET not configured." });
  }

  try {
    const oembedRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
    );
    const oembed = await oembedRes.json().catch(() => ({}));
    if (!oembedRes.ok || !oembed.thumbnail_url) {
      const message = (oembed.error && oembed.error.message) || "Could not read that Instagram post.";
      return res.status(502).json({ error: message });
    }

    let thumbnail;
    try {
      thumbnail = new URL(oembed.thumbnail_url);
    } catch {
      return res.status(502).json({ error: "Instagram returned an image address we couldn't read." });
    }
    if (thumbnail.protocol !== "https:" || !ALLOWED_IMAGE_HOSTS.test(thumbnail.hostname)) {
      return res.status(502).json({ error: "Instagram returned an image from an unexpected host." });
    }

    const imgRes = await fetch(thumbnail.href, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!imgRes.ok) {
      return res.status(502).json({ error: "Could not download the Instagram image." });
    }
    const contentType = (imgRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim().toLowerCase();
    if (!/^image\/(jpeg|png|webp|gif)$/.test(contentType)) {
      return res.status(502).json({ error: "That Instagram post's image is in a format we can't publish." });
    }
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    if (!buffer.length) {
      return res.status(502).json({ error: "The Instagram image came back empty." });
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: "That Instagram image is too large to import." });
    }
    const blob = await writeMedia(buffer, contentType, "instagram");

    return res.status(200).json({
      imageUrl: blob.url,
      sourceUrl: url,
      authorName: oembed.author_name || "",
    });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}
