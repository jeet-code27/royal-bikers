import { send, readJson, checkLogin, loginConfigured, sessionCookie, clearCookie, isAdmin } from "../_lib.js";

export default async function handler(req, res) {
  if (req.method === "GET") return send(res, 200, { loggedIn: isAdmin(req), configured: loginConfigured() });
  if (req.method === "DELETE") return send(res, 200, { ok: true }, { "Set-Cookie": clearCookie(req) });
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });

  if (!loginConfigured()) return send(res, 500, { error: "Admin login is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD in Vercel." });
  const { username, password } = await readJson(req).catch(() => ({}));
  if (!checkLogin(username, password)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return send(res, 401, { error: "Wrong username or password." });
  }
  return send(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(req) });
}
