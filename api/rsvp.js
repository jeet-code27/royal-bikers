import { rsvps, send, readJson } from "./_lib.js";

const DAYS = ["Sat 21", "Sun 22", "Mon 23", "Tue 24", "Wed 25", "Thu 26", "Fri 27", "Sat 28", "Sun 29"];
const TOPICS = ["Ladakh", "Spiti", "Rajasthan", "Kerala", "North-East India", "Nepal", "Bhutan", "Not sure yet"];
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" }, { Allow: "POST" });

  let body;
  try { body = await readJson(req); } catch { return send(res, 413, { error: "Too large" }); }

  // Honeypot: bots fill hidden fields, people don't. Pretend success.
  if (body.website) return send(res, 200, { ok: true });

  const name = clean(body.name, 80);
  const email = clean(body.email, 120).toLowerCase();
  const dayRaw = clean(body.day, 40);
  const day = DAYS.find((d) => dayRaw.startsWith(d)) || "";
  const interests = (Array.isArray(body.interests) ? body.interests : String(body.interests || "").split(","))
    .map((t) => clean(t, 40)).filter((t) => TOPICS.includes(t));

  if (!name) return send(res, 400, { error: "Please add your name." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: "Please check your email address." });
  if (!day) return send(res, 400, { error: "Pick the day you're planning to come." });

  const now = new Date();
  try {
    const col = await rsvps();
    // One RSVP per email: a second submit updates the first instead of duplicating it.
    const r = await col.updateOne(
      { email },
      {
        $set: {
          name, email, day: `${day} Nov 2026`, interests,
          invitedAs: clean(body.invitedAs, 40),
          source: clean(body.source, 40) || "MCL26 invite",
          userAgent: clean(req.headers["user-agent"], 200),
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
        $inc: { submissions: 1 },
      },
      { upsert: true },
    );
    return send(res, 200, { ok: true, updated: r.matchedCount > 0 });
  } catch (e) {
    console.error("RSVP save failed:", e.message);
    return send(res, 500, { error: "Could not save right now. Please try again." });
  }
}
