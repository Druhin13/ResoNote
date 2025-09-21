/**
 * @file Centralized application configuration for server, database, defaults, and rate limiting.
 * Values prefer environment variables with sensible fallbacks for local development.
 */

/**
 * @typedef {Object} ServerConfig
 * @property {number|string} port TCP port number or string from process.env.PORT
 * @property {"development"|"production"|"test"|string} env Execution environment
 */

/**
 * @typedef {Object} DatabaseConfig
 * @property {string} tracksPath Filesystem path to newline-delimited JSON tracks dataset (.jsonl)
 * @property {string} featuresPath Filesystem path to audio features + cleaned lyrics JSON
 */

/**
 * @typedef {Object} DefaultsConfig
 * @property {number} minTracks Minimum tracks to generate per playlist
 * @property {number} maxTracks Maximum tracks to generate per playlist
 * @property {number} semanticWeight Weight of semantic similarity in [0,1]
 * @property {number} audioWeight Weight of audio similarity in [0,1]
 * @property {number} diversityFactor Variety vs. cohesion control in [0,1]
 * @property {number} minSimilarity Lower bound for track inclusion based on similarity
 */

/**
 * @typedef {Object} RateLimitConfig
 * @property {number} windowMs Rolling window duration in milliseconds
 * @property {number} max Maximum requests allowed per IP within window
 */

/**
 * @typedef {Object} AppConfig
 * @property {ServerConfig} server Server configuration
 * @property {DatabaseConfig} database Dataset file locations
 * @property {DefaultsConfig} defaults Default playlist generation parameters
 * @property {RateLimitConfig} rateLimit Basic IP-based throttling configuration
 */

/** @type {AppConfig} */
const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || "development",
  },

  // Database configuration
  database: {
    tracksPath: process.env.TRACKS_PATH || "./database/all_tracks.jsonl",
    featuresPath:
      process.env.FEATURES_PATH ||
      "./database/audio_features_and_lyrics_cleaned.json",
  },

  // Default settings for playlist generation
  defaults: {
    minTracks: 5,
    maxTracks: 10,
    semanticWeight: 0.5,
    audioWeight: 0.5,
    diversityFactor: 0.3,
    minSimilarity: 0.1,
  },

  // API rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
};

module.exports = config;
