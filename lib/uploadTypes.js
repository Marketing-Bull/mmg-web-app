/*
  What the content manager is allowed to upload.

  Kept separate from api/admin/upload.js so the rules can be read and tested on
  their own, without pulling in Blob storage or its credentials.

  Anything uploaded is served from public Blob storage under the content type we
  hand it, so the list deliberately leaves out SVG and any other format a
  browser will execute script from.

  Each entry also carries a signature check. A declared content type is just a
  string in the request body, so the first bytes of the file are verified to
  match it — an HTML or script payload labelled "image/png" is rejected rather
  than published under a type someone else might later trust.
*/

// 3MB raw file (~4MB once base64-encoded). Vercel caps a serverless request
// body around 4.5MB and the file travels as base64 JSON, so this leaves room.
export const MAX_BYTES = 3 * 1024 * 1024;

export const ALLOWED_PREFIXES = ["flyers", "logos", "recaps"];

export const ALLOWED_TYPES = {
  "image/jpeg": (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/gif": (b) =>
    b.length > 6 && (b.subarray(0, 6).toString("latin1") === "GIF87a" || b.subarray(0, 6).toString("latin1") === "GIF89a"),
  "image/webp": (b) =>
    b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  // MP4 and MOV share the ISO base media layout: a "ftyp" box at offset 4.
  "video/mp4": (b) => b.length > 12 && b.subarray(4, 8).toString("latin1") === "ftyp",
  "video/quicktime": (b) =>
    b.length > 12 && ["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(b.subarray(4, 8).toString("latin1")),
  "video/webm": (b) => b.length > 4 && b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
};

// The base64 body is checked against this before being decoded, so an
// oversized payload is never allocated.
export const MAX_BASE64_LENGTH = Math.ceil(MAX_BYTES / 3) * 4 + 4;
