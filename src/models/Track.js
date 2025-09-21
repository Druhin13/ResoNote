/**
 * @file Track model representing the structure of a music track.
 * Combines semantic tags, scores, audio features, and metadata into a single object.
 */

/**
 * Class representing a music track.
 */
class Track {
  /**
   * Create a Track instance.
   * @param {Object} [data={}] - Initialization data
   * @param {string} [data.track_id] - Unique track identifier
   * @param {string} [data.track_name] - Track name
   * @param {string} [data.artist_name] - Artist name
   * @param {Object<string,string[]>} [data.tags] - Semantic tags grouped by facet
   * @param {Object<string,Object>} [data.scores] - Confidence scores for tags
   * @param {Object<string,number>} [data.features] - Audio features (e.g., energy, valence)
   * @param {string|null} [data.lyrics] - Track lyrics
   * @param {number} [data.popularity] - Popularity score
   */
  constructor(data = {}) {
    this.track_id = data.track_id || null;
    this.track_name = data.track_name || null;
    this.artist_name = data.artist_name || null;

    this.tags = data.tags || {};
    this.scores = data.scores || {};
    this.features = data.features || {};

    this.lyrics = data.lyrics || null;
    this.popularity = data.popularity || 0;
  }

  /**
   * Check if the track contains semantic tags.
   * @returns {boolean} True if semantic tags exist
   */
  hasSemanticData() {
    return this.tags && Object.keys(this.tags).length > 0;
  }

  /**
   * Check if the track contains audio features.
   * @returns {boolean} True if audio features exist
   */
  hasAudioFeatures() {
    return this.features && Object.keys(this.features).length > 0;
  }

  /**
   * Get a simplified representation of the track.
   * Used for lightweight API responses.
   * @returns {{track_id:string, track_name:string, artist_name:string}} Simple track object
   */
  toSimpleObject() {
    return {
      track_id: this.track_id,
      track_name: this.track_name || "Unknown Track",
      artist_name: this.artist_name || "Unknown Artist",
    };
  }
}

module.exports = Track;
