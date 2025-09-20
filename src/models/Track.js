/**
 * Track model representing the structure of a music track
 * This is a simple representation of the combined data from both data sources
 */
class Track {
  constructor(data = {}) {
    this.track_id = data.track_id || null;
    this.track_name = data.track_name || null;
    this.artist_name = data.artist_name || null;
    
    // Semantic tags
    this.tags = data.tags || {};
    this.scores = data.scores || {};
    
    // Audio features
    this.features = data.features || {};
    
    // Additional data
    this.lyrics = data.lyrics || null;
    this.popularity = data.popularity || 0;
  }
  
  /**
   * Check if this track has semantic tags
   * @returns {boolean}
   */
  hasSemanticData() {
    return this.tags && Object.keys(this.tags).length > 0;
  }
  
  /**
   * Check if this track has audio features
   * @returns {boolean}
   */
  hasAudioFeatures() {
    return this.features && Object.keys(this.features).length > 0;
  }
  
  /**
   * Get a simple representation of the track for API responses
   * @returns {Object} Simple track object
   */
  toSimpleObject() {
    return {
      track_id: this.track_id,
      track_name: this.track_name || 'Unknown Track',
      artist_name: this.artist_name || 'Unknown Artist'
    };
  }
}

module.exports = Track;