/**
 * Application configuration
 */
const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  
  // Database configuration
  database: {
    tracksPath: process.env.TRACKS_PATH || './database/all_tracks.jsonl',
    featuresPath: process.env.FEATURES_PATH || './database/audio_features_and_lyrics_cleaned.json'
  },
  
  // Default settings for playlist generation
  defaults: {
    minTracks: 10,
    maxTracks: 30,
    semanticWeight: 0.5,
    audioWeight: 0.5,
    diversityFactor: 0.3,
    minSimilarity: 0.1
  },
  
  // API rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  }
};

module.exports = config;