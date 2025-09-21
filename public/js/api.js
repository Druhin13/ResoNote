// API interaction functions for ResoNote (client-side)

/**
 * @file API client for ResoNote front-end.
 * Provides thin wrappers around fetch with consistent JSON parsing and error handling.
 * No executable logic is altered; only documentation comments are added.
 */

/**
 * @typedef {Object} APIErrorPayload
 * @property {boolean} [success]
 * @property {string} [message]
 * @property {string} [error]
 */

/**
 * @typedef {Object} SimilarityOptions
 * @property {"semantic"|"audio"|"combined"} [similarityType="combined"] Similarity metric to use.
 * @property {number} [semanticWeight=0.5] Weight of semantic similarity in [0,1].
 * @property {number} [audioWeight=0.5] Weight of audio similarity in [0,1].
 */

/**
 * @typedef {Object} GeneratePlaylistOptions
 * @property {number} [minTracks=5] Minimum tracks in the generated playlist.
 * @property {number} [maxTracks=10] Maximum tracks in the generated playlist.
 * @property {"semantic"|"audio"|"combined"} [similarityType="combined"] Similarity metric to use.
 * @property {number} [semanticWeight=0.5] Weight of semantic similarity in [0,1].
 * @property {number} [audioWeight=0.5] Weight of audio similarity in [0,1].
 * @property {number} [diversityFactor=0.3] Controls variety vs. cohesion in [0,1].
 * @property {boolean} [includeSeedTracks=true] Whether to include seeds in the final playlist.
 * @property {boolean} [allowTrackVariations=true] Whether near-duplicate/alternate versions are allowed.
 */

const API = (function () {
  const baseUrl = "/api";

  /**
   * Safely parse a Response body as JSON, returning a fallback payload if invalid.
   * @private
   * @param {Response} response Fetch response.
   * @returns {Promise<unknown|APIErrorPayload>} Parsed JSON or a fallback error-shaped object.
   */
  async function safeJson(response) {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      // Return a fallback object when server returned non-JSON
      return { success: false, message: `Invalid JSON response: ${text}` };
    }
  }

  /**
   * Normalize fetch responses: parse JSON, surface HTTP errors, and respect {success:false}.
   * @private
   * @param {Response} response Fetch response.
   * @returns {Promise<any>} Parsed payload if successful.
   * @throws {Error} When HTTP status is not ok or payload indicates failure.
   */
  async function handleResponse(response) {
    const data = await safeJson(response);
    if (!response.ok) {
      const message =
        data && (data.message || data.error)
          ? data.message || data.error
          : `HTTP ${response.status}`;
      const err = new Error(message);
      err.response = response;
      err.data = data;
      throw err;
    }
    // Some endpoints might return { success: true, ... } or raw payload
    if (data && typeof data.success !== "undefined") {
      if (!data.success) {
        const err = new Error(
          data.message || data.error || "API returned success: false"
        );
        err.data = data;
        throw err;
      }
      return data;
    }
    return data;
  }

  return {
    /**
     * Search for tracks by free-text query.
     * Accepts multiple server response shapes and normalizes to an array of tracks.
     * @param {string} query Search query string.
     * @param {number} [limit=10] Max number of results to request.
     * @returns {Promise<any[]>} Array of matching tracks, or an empty array if none/invalid.
     */
    async searchTracks(query, limit = 10) {
      if (!query || query.trim() === "") return [];
      const url = `${baseUrl}/playlists/search?query=${encodeURIComponent(
        query
      )}&limit=${Number(limit) || 10}`;
      const res = await fetch(url);
      const data = await handleResponse(res);
      // Accept either { results: [...] } or raw array
      if (Array.isArray(data)) return data;
      if (data.results) return data.results;
      if (data.tracks) return data.tracks;
      return [];
    },

    /**
     * Get a random track from the server.
     * Handles defensive cases where the server returns arrays or alternate keys.
     * @returns {Promise<any>} A single track object.
     * @throws {Error} If no track can be resolved from the response.
     */
    async getRandomTrack() {
      const url = `${baseUrl}/playlists/random-track`;
      const res = await fetch(url);
      const data = await handleResponse(res);
      let track = data.track;
      // Defensive handling: server might return { track: [ ... ] } or { tracks: [...] } or raw
      if (!track) {
        if (Array.isArray(data)) track = data.length ? data[0] : null;
        else if (Array.isArray(data.tracks))
          track = data.tracks.length ? data.tracks[0] : null;
        else if (Array.isArray(data.result))
          track = data.result.length ? data.result[0] : null;
      }
      // If still array, pick first
      if (Array.isArray(track)) track = track.length ? track[0] : null;
      if (!track) {
        const err = new Error("No random track returned from server");
        err.data = data;
        throw err;
      }
      return track;
    },

    /**
     * Fetch enriched details for a specific track.
     * @param {string} trackId Track identifier (e.g., Spotify ID).
     * @returns {Promise<any>} Track detail object.
     */
    async getTrackDetails(trackId) {
      const url = `${baseUrl}/playlists/tracks/${encodeURIComponent(
        trackId
      )}/details`;
      const res = await fetch(url);
      const data = await handleResponse(res);
      if (data.track) return data.track;
      return data;
    },

    /**
     * Compute similarity between two tracks.
     * @param {string} trackId1 First track ID.
     * @param {string} trackId2 Second track ID.
     * @param {SimilarityOptions} [options={}] Similarity configuration.
     * @returns {Promise<any>} Similarity payload (scores, breakdowns, etc.).
     */
    async getSimilarityDetails(trackId1, trackId2, options = {}) {
      const params = new URLSearchParams({
        similarityType: options.similarityType || "combined",
        semanticWeight:
          typeof options.semanticWeight !== "undefined"
            ? options.semanticWeight
            : 0.5,
        audioWeight:
          typeof options.audioWeight !== "undefined"
            ? options.audioWeight
            : 0.5,
      });
      const url = `${baseUrl}/playlists/similarity?track1=${encodeURIComponent(
        trackId1
      )}&track2=${encodeURIComponent(trackId2)}&${params.toString()}`;
      const res = await fetch(url);
      const data = await handleResponse(res);
      return data;
    },

    /**
     * Generate a playlist from seed track IDs and tuning options.
     * @param {string[]} trackIds Array of seed track IDs.
     * @param {GeneratePlaylistOptions} [options={}] Generation parameters.
     * @returns {Promise<any>} Playlist object or raw payload if server differs.
     */
    async generatePlaylist(trackIds, options = {}) {
      const payload = {
        trackIds: Array.isArray(trackIds) ? trackIds : [],
        minTracks: Number(options.minTracks) || 5,
        maxTracks: Number(options.maxTracks) || 10,
        similarityType: options.similarityType || "combined",
        semanticWeight:
          typeof options.semanticWeight !== "undefined"
            ? options.semanticWeight
            : 0.5,
        audioWeight:
          typeof options.audioWeight !== "undefined"
            ? options.audioWeight
            : 0.5,
        diversityFactor:
          typeof options.diversityFactor !== "undefined"
            ? options.diversityFactor
            : 0.3,
        includeSeedTracks:
          typeof options.includeSeedTracks !== "undefined"
            ? options.includeSeedTracks
            : true,
        allowTrackVariations:
          typeof options.allowTrackVariations !== "undefined"
            ? options.allowTrackVariations
            : true,
      };
      const res = await fetch(`${baseUrl}/playlists/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await handleResponse(res);
      // Expect { success: true, playlist: {...} }
      if (data.playlist) return data.playlist;
      return data;
    },

    /**
     * Retrieve an album/track image URL for display.
     * Returns null when unavailable so the UI can fall back to placeholders.
     * @param {string} trackId Track identifier.
     * @returns {Promise<string|null>} Resolved image URL or null if not found.
     */
    async getTrackImage(trackId) {
      try {
        const res = await fetch(
          `${baseUrl}/track/${encodeURIComponent(trackId)}/image`
        );
        // If endpoint returns 404 or not ok, return null (frontend can use placeholder)
        if (!res.ok) return null;
        const data = await safeJson(res);
        if (data && data.success && data.imageUrl) return data.imageUrl;
        // Support responses like { imageUrl: '...' } without success
        if (data && data.imageUrl) return data.imageUrl;
        return null;
      } catch (err) {
        console.warn("getTrackImage error", err);
        return null;
      }
    },
  };
})();

/**
 * Global exposure for convenience in UI code and debugging.
 * @type {{searchTracks: function(string, number=): Promise<any[]>, getRandomTrack: function(): Promise<any>, getTrackDetails: function(string): Promise<any>, getSimilarityDetails: function(string, string, SimilarityOptions=): Promise<any>, generatePlaylist: function(string[], GeneratePlaylistOptions=): Promise<any>, getTrackImage: function(string): Promise<string|null>}}
 */
// Expose globally
window.API = API;
