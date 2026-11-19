import { ObjectId } from "mongodb";
import { rsvps, send, isAdmin } from "../_lib.js";

const csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default async function handler(req, res) {
  if (!isAdmin(req)) return send(res, 401, { error: "Please log in." });

  let col;
  try { col = await rsvps(); } catch (e) {
    console.error(e.message);
    return send(res, 500, { error: "Database is not reachable. Check MONGODB_URI in Vercel." });
  }

  const url = new URL(req.url, "http://x");

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id || !ObjectId.isValid(id)) return send(res, 400, { error: "Bad id" });
    await col.deleteOne({ _id: new ObjectId(id) });
    return send(res, 200, { ok: true });
  }
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });

  const list = await col.find({}, { projection: { userAgent: 0 } }).sort({ createdAt: -1 }).limit(5000).toArray();

  if (url.searchParams.get("format") === "csv") {
    const head = ["Received", "Name", "Email", "Mobile", "Day", "Interests", "Invited as", "Source", "Times submitted"];
    const rows = list.map((r) => [
      new Date(r.createdAt).toISOString(), r.name, r.email, r.phone, r.day, (r.interests || []).join("; "),
      r.invitedAs, r.source, r.submissions,
    ]);
    const csv = "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="royal-bikers-rsvps-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.setHeader("Cache-Control", "no-store");
    return res.end(csv);
  }

  return send(res, 200, { rsvps: list.map((r) => ({ ...r, _id: String(r._id) })) });
}
