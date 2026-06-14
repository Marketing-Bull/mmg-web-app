// Returns Sponsors from GHL custom objects as JSON, cached at the edge.
import { fetchSponsors, ghlEnv } from "../lib/ghl.js";

export default async function handler(req, res) {
  const { token, locationId } = ghlEnv();
  if (!token || !locationId) {
    return res.status(503).json({ error: "GHL not configured", sponsors: [] });
  }
  try {
    const sponsors = await fetchSponsors();
    // Cache ~6 hours at the edge; serve stale while revalidating.
    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=43200");
    return res.status(200).json({ updated: new Date().toISOString(), sponsors });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err), sponsors: [] });
  }
}
