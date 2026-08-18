// Authenticated direct file upload for the content manager (event flyers,
// sponsor logos, recap video clips). POST { filename, contentType, dataBase64, prefix }.
//
// Files travel as a base64 JSON body rather than multipart/direct-to-Blob, so
// there's a hard ceiling here: Vercel serverless functions cap the total
// request body around 4.5MB, and base64 inflates the raw file by ~33%. The
// MAX_BYTES below is set with headroom under that ceiling.
import { requireSession } from "../../lib/auth.js";
import { readJsonBody, noStore } from "../../lib/http.js";
import { enforceRateLimit, LIMITS } from "../../lib/rateLimit.js";
import { writeMedia } from "../../lib/blobStore.js";

export const MAX_BYTES = 3 * 1024 * 1024; // 3MB raw file (~4MB once base64-encoded)
const ALLOWED_PREFIXES = ["flyers", "logos", "recaps"];

/*
  An explicit allowlist of the formats the site actually displays.

  Anything uploaded here is served from public Blob storage under the content
  type we hand it, so the list deliberately leaves out SVG and any other format
  a browser will execute script from.

  Each entry also carries a signature check. A declared content type is just a
  string in the request body, so the first bytes of the file are verified to
  match it — an HTML or script payload labelled "image/png" is rejected rather
  than published under a type someone else might later trust.
*/
export const ALLOWED_TYPES = {
  "image/jpeg": (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/gif": (b) => b.length > 6 && (b.subarray(0, 6).toString("latin1") === "GIF87a" || b.subarray(0, 6).toString("latin1") === "GIF89a"),
  "image/webp": (b) =>
    b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  // MP4 and MOV share the ISO base media layout: a "ftyp" box at offset 4.
  "video/mp4": (b) => b.length > 12 && b.subarray(4, 8).toString("latin1") === "ftyp",
  "video/quicktime": (b) =>
    b.length > 12 && ["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(b.subarray(4, 8).toString("latin1")),
  "video/webm": (b) => b.length > 4 && b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
};

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
  // Checked before decoding so an oversized payload is never allocated.
  if (dataBase64.length > Math.ceil(MAX_BYTES / 3) * 4 + 4) {
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
