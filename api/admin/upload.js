// Authenticated direct file upload for the content manager (event flyers,
// sponsor logos, recap video clips). POST { filename, contentType, dataBase64, prefix }.
//
// Files travel as a base64 JSON body rather than multipart/direct-to-Blob, so
// there's a hard ceiling here: Vercel serverless functions cap the total
// request body around 4.5MB, and base64 inflates the raw file by ~33%. The
// MAX_BYTES below is set with headroom under that ceiling.
import { requireSession } from "../../lib/auth.js";
import { writeMedia } from "../../lib/blobStore.js";

const MAX_BYTES = 3 * 1024 * 1024; // 3MB raw file (~4MB once base64-encoded)
const ALLOWED_PREFIXES = ["flyers", "logos", "recaps"];

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

  const contentType = String(body.contentType || "");
  const dataBase64 = String(body.dataBase64 || "");
  const prefix = ALLOWED_PREFIXES.includes(body.prefix) ? body.prefix : "uploads";

  if (!/^(image|video)\//.test(contentType)) {
    return res.status(400).json({ error: "Only image or video files are supported." });
  }
  if (!dataBase64) {
    return res.status(400).json({ error: "No file data received." });
  }

  let buffer;
  try {
    buffer = Buffer.from(dataBase64, "base64");
  } catch {
    return res.status(400).json({ error: "Could not read that file." });
  }
  if (buffer.length > MAX_BYTES) {
    return res.status(413).json({ error: "File is too large — please keep uploads under 3MB." });
  }
  if (!buffer.length) {
    return res.status(400).json({ error: "That file is empty." });
  }

  try {
    const blob = await writeMedia(buffer, contentType, prefix);
    return res.status(200).json({ url: blob.url });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}
