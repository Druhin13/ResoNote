/**
 * @file Media controller for resolving Spotify track thumbnails via oEmbed
 * with simple in-memory caching to reduce repeated external requests.
 */

const fetch = require("node-fetch");

/** @constant {number} CACHE_TTL_MS Time-to-live for cache entries (milliseconds). */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
/** @constant {Map<string, {imageUrl: string|null, fetchedAt: number}>} cache In-memory thumbnail cache keyed by track ID. */
const cache = new Map();

/**
 * Fetch a Spotify track thumbnail URL using the public oEmbed endpoint.
 * Throws an Error with an HTTP-like `status` when appropriate.
 *
 * @param {string} trackId Spotify track ID
 * @returns {Promise<string>} Resolved thumbnail URL
 * @throws {Error} When the oEmbed endpoint returns 404 or a non-ok response
 */
async function fetchOEmbedThumbnail(trackId) {
  const trackUrl = `https://open.spotify.com/track/${trackId}`;
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(
    trackUrl
  )}`;
  const r = await fetch(oembedUrl, {
    method: "GET",
    headers: { "User-Agent": "node.js" },
  });
  if (r.status === 404) {
    const err = new Error("Track not found via oEmbed");
    err.status = 404;
    throw err;
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    const err = new Error(
      `oEmbed request failed: ${r.status} ${r.statusText} ${text}`
    );
    err.status = r.status;
    throw err;
  }
  const data = await r.json();
  const thumbnail = data.thumbnail_url;
  if (!thumbnail) {
    const err = new Error("No thumbnail returned by oEmbed");
    err.status = 404;
    throw err;
  }
  return thumbnail;
}

/**
 * Express handler that returns a cached or freshly-fetched image URL for a track.
 * Responds with `{ success, imageUrl, cached }` on success or `{ success:false, error }` on failure.
 *
 * Caching behavior:
 *  - Positive cache: full TTL
 *  - Negative cache: short-lived (stored by backdating fetchedAt) to avoid repeated failing lookups
 *
 * @param {import('express').Request} req Expecting `req.params.id` as the Spotify track ID
 * @param {import('express').Response} res JSON response
 * @returns {Promise<void>}
 */
async function getTrackImage(req, res) {
  try {
    const trackId = req.params.id;
    if (!trackId) {
      return res
        .status(400)
        .json({ success: false, error: "track id is required" });
    }

    const now = Date.now();
    const cached = cache.get(trackId);
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS && cached.imageUrl) {
      return res.json({
        success: true,
        imageUrl: cached.imageUrl,
        cached: true,
      });
    }

    try {
      const imageUrl = await fetchOEmbedThumbnail(trackId);
      cache.set(trackId, { imageUrl, fetchedAt: now });
      return res.json({ success: true, imageUrl, cached: false });
    } catch (err) {
      // store negative cache for shorter period to avoid repeated bad requests
      cache.set(trackId, {
        imageUrl: null,
        fetchedAt: now - (CACHE_TTL_MS - 60 * 1000),
      });
      const status = err.status || 500;
      return res.status(status).json({ success: false, error: err.message });
    }
  } catch (err) {
    console.error("getTrackImage error", err);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

module.exports = {
  getTrackImage,
};
