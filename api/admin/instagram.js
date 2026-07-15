// Turns a pasted Instagram post/reel URL into a fast, self-hosted image.
// Uses Instagram's oEmbed (Graph API) to resolve the post's thumbnail, then
// copies that image into our own Blob storage so it loads fast and doesn't
// break if the original post is edited or removed. POST { url }.
import { requireSession } from "../../lib/auth.js";
import { writeMedia } from "../../lib/blobStore.js";

const GRAPH_VERSION = "v21.0";
const INSTAGRAM_URL_RE = /^https:\/\/(www\.)?instagram\.com\/(p|reel|reels)\/[^/?#]+/i;

function igToken() {
  const appId = process.env.IG_APP_ID;
  const appSecret = process.env.IG_APP_SECRET;
  if (!appId || !appSecret) return null;
  return `${appId}|${appSecret}`;
}

export default async function handler(req, res) {
  if (!requireSession(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
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
      `https://graph.facebook.com/${GRAPH_VERSION}/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${encodeURIComponent(token)}`
    );
    const oembed = await oembedRes.json().catch(() => ({}));
    if (!oembedRes.ok || !oembed.thumbnail_url) {
      const message = (oembed.error && oembed.error.message) || "Could not read that Instagram post.";
      return res.status(502).json({ error: message });
    }

    const imgRes = await fetch(oembed.thumbnail_url);
    if (!imgRes.ok) {
      return res.status(502).json({ error: "Could not download the Instagram image." });
    }
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await imgRes.arrayBuffer());
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
