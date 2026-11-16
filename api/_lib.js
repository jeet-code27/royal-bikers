import { MongoClient } from "mongodb";
import { createHmac, timingSafeEqual } from "node:crypto";

/* ---------- Database ---------- */
// Separate database inside the shared Atlas cluster. Never touches SwagCentral's data.
const DB_NAME = process.env.MONGODB_DB || "royalbikers";
let clientPromise = globalThis._rbMongo;

export async function rsvps() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  if (!clientPromise) {
    clientPromise = globalThis._rbMongo = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 })
      .connect()
      .catch((e) => { globalThis._rbMongo = clientPromise = undefined; throw e; });
  }
  const col = (await clientPromise).db(DB_NAME).collection("rsvps");
  if (!globalThis._rbIndexed) {
    globalThis._rbIndexed = true;
    col.createIndex({ email: 1 }, { unique: true }).catch(() => {});
    col.createIndex({ createdAt: -1 }).catch(() => {});
  }
  return col;
}

/* ---------- HTTP helpers (plain Node, works on Vercel and locally) ---------- */
export function send(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > 20_000) throw new Error("Body too large"); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { return {}; }
}

/* ---------- Admin session (signed cookie) ---------- */
const COOKIE = "rb_admin";
const MAX_AGE = 60 * 60 * 24 * 7;

// Env values pasted into Vercel often pick up spaces, line breaks or wrapping quotes.
const envClean = (v) => String(v ?? "").trim().replace(/^(['"])(.*)\1$/, "$2").trim();

function creds() {
  const u = envClean(process.env.ADMIN_USERNAME), p = envClean(process.env.ADMIN_PASSWORD);
  if (!u || !p) return null;
  return { u, p, secret: process.env.SESSION_SECRET || `${u}:${p}:royalbikers` };
}
function safeEqual(a, b) {
  const ab = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
const sign = (payload, secret) => createHmac("sha256", secret).update(payload).digest("base64url");

export function checkLogin(username, password) {
  const c = creds();
  if (!c) return false;
  const uOk = safeEqual(String(username || "").trim().toLowerCase(), c.u.toLowerCase());
  const pOk = safeEqual(String(password || "").trim(), c.p);
  return uOk && pOk;
}
export const loginConfigured = () => creds() !== null;

function isHttps(req) {
  return (req.headers["x-forwarded-proto"] || "").includes("https");
}
export function sessionCookie(req) {
  const c = creds();
  const payload = Buffer.from(JSON.stringify({ u: c.u, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  return `${COOKIE}=${payload}.${sign(payload, c.secret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${isHttps(req) ? "; Secure" : ""}`;
}
export function clearCookie(req) {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isHttps(req) ? "; Secure" : ""}`;
}
export function isAdmin(req) {
  const c = creds();
  if (!c) return false;
  const raw = (req.headers.cookie || "").split(/;\s*/).find((x) => x.startsWith(COOKIE + "="));
  if (!raw) return false;
  const [payload, sig] = raw.slice(COOKIE.length + 1).split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload, c.secret))) return false;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return u === c.u && exp > Date.now();
  } catch { return false; }
}
