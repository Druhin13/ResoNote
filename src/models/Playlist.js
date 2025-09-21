/**
 * @file Playlist model representing a generated playlist with metadata,
 * seed tracks, configurable options, and derived statistics.
 */

/**
 * Class representing a generated playlist.
 */
class Playlist {
  /**
   * Create a Playlist instance.
   * @param {Object} [data={}] - Initialization data
   * @param {string} [data.id] - Unique playlist identifier
   * @param {string} [data.name] - Playlist name
   * @param {Array<Object>} [data.tracks] - Tracks included in the playlist
   * @param {Array<Object>} [data.seedTracks] - Seed tracks used to generate the playlist
   * @param {Object} [data.options] - Options used during generation
   * @param {Date|string} [data.createdAt] - Creation timestamp
   */
  constructor(data = {}) {
    this.id =
      data.id || `pl_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    this.name = data.name || "ResoNote Playlist";
    this.tracks = data.tracks || [];
    this.seedTracks = data.seedTracks || [];
    this.options = data.options || {};
    this.createdAt = data.createdAt || new Date();
  }

  /**
   * Calculate basic statistics about the playlist.
   * - Track count
   * - Average similarity of non-seed tracks
   * - Seed track count
   * @returns {{trackCount:number, averageSimilarity:number, seedTrackCount:number}} Statistics object
   */
  getStats() {
    const trackCount = this.tracks.length;

    const nonSeedTracks = this.tracks.filter((track) => !track.isSeed);
    const averageSimilarity =
      nonSeedTracks.length > 0
        ? nonSeedTracks.reduce((sum, t) => sum + t.similarity, 0) /
          nonSeedTracks.length
        : 0;

    return {
      trackCount,
      averageSimilarity,
      seedTrackCount: this.seedTracks.length,
    };
  }

  /**
   * Convert playlist instance to a plain object suitable for API responses.
   * @returns {Object} Serialized playlist object
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      tracks: this.tracks,
      seedTracks: this.seedTracks,
      options: this.options,
      stats: this.getStats(),
      createdAt: this.createdAt,
    };
  }
}

module.exports = Playlist;
