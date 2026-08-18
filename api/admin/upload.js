// Authenticated direct file upload for the content manager (event flyers,
// sponsor logos, recap video clips). POST { filename, contentType, dataBase64, prefix }.
//
// Files travel as a base64 JSON body rather than multipart/direct-to-Blob, so
// there's a hard ceiling here: Vercel serverless functions cap the total
// request body around 4.5MB, and base64 inflates the raw file by ~33%. The
// limits and the accepted formats live in lib/uploadTypes.js.
import { requireSession } from "../../lib/auth.js";
import { readJsonBody, noStore } from "../../lib/http.js";
import { enforceRateLimit, LIMITS } from "../../lib/rateLimit.js";
import { ALLOWED_TYPES, ALLOWED_PREFIXES, MAX_BYTES, MAX_BASE64_LENGTH } from "../../lib/uploadTypes.js";
import { writeMedia } from "../../lib/blobStore.js";

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

  // Browsers report "image/jpeg; charset=..." on occasion; compare the type only.
  const contentType = String(body.contentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const dataBase64 = String(body.dataBase64 || "");
  const prefix = ALLOWED_PREFIXES.includes(body.prefix) ? body.prefix : "uploads";

  const signatureMatches = ALLOWED_TYPES[contentType];
  if (!signatureMatches) {
    return res.status(415).json({
      error: "Unsupported file type. Use JPG, PNG, GIF, or WebP images, or MP4, MOV, or WebM video.",
    });
  }
  if (!dataBase64) {
    return res.status(400).json({ error: "No file data received." });
  }
  if (dataBase64.length > MAX_BASE64_LENGTH) {
    return res.status(413).json({ error: "File is too large — please keep uploads under 3MB." });
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
  if (!signatureMatches(buffer)) {
    return res.status(415).json({ error: "That file doesn't look like a valid " + contentType + " file." });
  }

  try {
    const blob = await writeMedia(buffer, contentType, prefix);
    return res.status(200).json({ url: blob.url });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}
