/**
 * Playlist model representing a generated playlist
 */
class Playlist {
  constructor(data = {}) {
    this.id = data.id || `pl_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    this.name = data.name || "ResoNote Playlist";
    this.tracks = data.tracks || [];
    this.seedTracks = data.seedTracks || [];
    this.options = data.options || {};
    this.createdAt = data.createdAt || new Date();
  }
  
  /**
   * Calculate statistics about the playlist
   * @returns {Object} Statistics object
   */
  getStats() {
    const trackCount = this.tracks.length;
    
    // Calculate average similarity excluding seed tracks
    const nonSeedTracks = this.tracks.filter(track => !track.isSeed);
    const averageSimilarity = nonSeedTracks.length > 0 ? 
      nonSeedTracks.reduce((sum, t) => sum + t.similarity, 0) / nonSeedTracks.length : 0;
    
    return {
      trackCount,
      averageSimilarity,
      seedTrackCount: this.seedTracks.length
    };
  }
  
  /**
   * Convert to an object for API responses
   * @returns {Object} Playlist object
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      tracks: this.tracks,
      seedTracks: this.seedTracks,
      options: this.options,
      stats: this.getStats(),
      createdAt: this.createdAt
    };
  }
}

module.exports = Playlist;