// public/js/api.js
// API interaction functions for ResoNote (client-side)
const API = (function () {
  const baseUrl = '/api';

  async function safeJson(response) {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      // Return a fallback object when server returned non-JSON
      return { success: false, message: `Invalid JSON response: ${text}` };
    }
  }

  async function handleResponse(response) {
    const data = await safeJson(response);
    if (!response.ok) {
      const message = data && (data.message || data.error) ? (data.message || data.error) : `HTTP ${response.status}`;
      const err = new Error(message);
      err.response = response;
      err.data = data;
      throw err;
    }
    // Some endpoints might return { success: true, ... } or raw payload
    if (data && typeof data.success !== 'undefined') {
      if (!data.success) {
        const err = new Error(data.message || data.error || 'API returned success: false');
        err.data = data;
        throw err;
      }
      return data;
    }
    return data;
  }

  return {
    async searchTracks(query, limit = 10) {
      if (!query || query.trim() === '') return [];
      const url = `${baseUrl}/playlists/search?query=${encodeURIComponent(query)}&limit=${Number(limit) || 10}`;
      const res = await fetch(url);
      const data = await handleResponse(res);
      // Accept either { results: [...] } or raw array
      if (Array.isArray(data)) return data;
      if (data.results) return data.results;
      if (data.tracks) return data.tracks;
      return [];
    },

    async getRandomTrack() {
      const url = `${baseUrl}/playlists/random-track`;
      const res = await fetch(url);
      const data = await handleResponse(res);
      let track = data.track;
      // Defensive handling: server might return { track: [ ... ] } or { tracks: [...] } or raw
      if (!track) {
        if (Array.isArray(data)) track = data.length ? data[0] : null;
        else if (Array.isArray(data.tracks)) track = data.tracks.length ? data.tracks[0] : null;
        else if (Array.isArray(data.result)) track = data.result.length ? data.result[0] : null;
      }
      // If still array, pick first
      if (Array.isArray(track)) track = track.length ? track[0] : null;
      if (!track) {
        const err = new Error('No random track returned from server');
        err.data = data;
        throw err;
      }
      return track;
    },

    async getTrackDetails(trackId) {
      const url = `${baseUrl}/playlists/tracks/${encodeURIComponent(trackId)}/details`;
      const res = await fetch(url);
      const data = await handleResponse(res);
      if (data.track) return data.track;
      return data;
    },

    async getSimilarityDetails(trackId1, trackId2, options = {}) {
      const params = new URLSearchParams({
        similarityType: options.similarityType || 'combined',
        semanticWeight: typeof options.semanticWeight !== 'undefined' ? options.semanticWeight : 0.5,
        audioWeight: typeof options.audioWeight !== 'undefined' ? options.audioWeight : 0.5
      });
      const url = `${baseUrl}/playlists/similarity?track1=${encodeURIComponent(trackId1)}&track2=${encodeURIComponent(trackId2)}&${params.toString()}`;
      const res = await fetch(url);
      const data = await handleResponse(res);
      return data;
    },

    async generatePlaylist(trackIds, options = {}) {
      const payload = {
        trackIds: Array.isArray(trackIds) ? trackIds : [],
        minTracks: Number(options.minTracks) || 10,
        maxTracks: Number(options.maxTracks) || 30,
        similarityType: options.similarityType || 'combined',
        semanticWeight: typeof options.semanticWeight !== 'undefined' ? options.semanticWeight : 0.5,
        audioWeight: typeof options.audioWeight !== 'undefined' ? options.audioWeight : 0.5,
        diversityFactor: typeof options.diversityFactor !== 'undefined' ? options.diversityFactor : 0.3,
        includeSeedTracks: typeof options.includeSeedTracks !== 'undefined' ? options.includeSeedTracks : true,
        allowTrackVariations: typeof options.allowTrackVariations !== 'undefined' ? options.allowTrackVariations : true
      };
      const res = await fetch(`${baseUrl}/playlists/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await handleResponse(res);
      // Expect { success: true, playlist: {...} }
      if (data.playlist) return data.playlist;
      return data;
    },

    async getTrackImage(trackId) {
      try {
        const res = await fetch(`${baseUrl}/track/${encodeURIComponent(trackId)}/image`);
        // If endpoint returns 404 or not ok, return null (frontend can use placeholder)
        if (!res.ok) return null;
        const data = await safeJson(res);
        if (data && data.success && data.imageUrl) return data.imageUrl;
        // Support responses like { imageUrl: '...' } without success
        if (data && data.imageUrl) return data.imageUrl;
        return null;
      } catch (err) {
        console.warn('getTrackImage error', err);
        return null;
      }
    }
  };
})();

// Expose globally
window.API = API;