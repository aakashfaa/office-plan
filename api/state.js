import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const KEY = "office_state:v1";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const value = (await redis.get(KEY)) ?? null;
      return res.status(200).json({ ok: true, value });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      // expected shape: { desks: [{id,x,y}], layout: {D1:"Name", ...} }
      await redis.set(KEY, body);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
