// Shared-password login for the content manager. Stateless: sessions are a
// signed, expiring cookie (HMAC-SHA256) rather than a server-side store.
import crypto from "node:crypto";

const COOKIE_NAME = "mmg_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function secret() {
  const value = process.env.CONTENT_SESSION_SECRET;
  if (!value) throw new Error("CONTENT_SESSION_SECRET not set");
  return value;
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || typeof token !== "string" || token.indexOf(".") === -1) return null;
  const [body, mac] = token.split(".");
  let expected;
  try {
    expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  } catch {
    return null;
  }
  const macBuf = Buffer.from(mac || "");
  const expBuf = Buffer.from(expected);
  if (macBuf.length !== expBuf.length || !crypto.timingSafeEqual(macBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// Constant-time-ish comparison so failed attempts don't leak password length/content via timing.
export function checkPassword(candidate) {
  const expected = process.env.CONTENT_ADMIN_PASSWORD;
  if (!expected || typeof candidate !== "string") return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    crypto.timingSafeEqual(Buffer.alloc(b.length), Buffer.alloc(b.length));
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export function createSessionCookie() {
  const token = sign({ exp: Date.now() + SESSION_TTL_MS });
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function parseCookies(req) {
  if (req.cookies) return req.cookies;
  const header = req.headers && req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

export function requireSession(req) {
  const cookies = parseCookies(req);
  return !!verify(cookies[COOKIE_NAME]);
}
