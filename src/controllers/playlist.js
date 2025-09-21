/**
 * @file Playlist-related controllers:
 * - Generation from seed tracks and tuning params
 * - Similar tracks lookup
 * - Track details and pairwise similarity breakdown
 * - Search, random selection, and taxonomy (facets/tags)
 */

const asyncHandler = require("express-async-handler");
const {
  getFacets,
  getTags,
  getTrackById,
  getRandomTrack,
  searchTracks,
} = require("../data/dataLoader");
const similarityService = require("../services/similarityService");
const playlistService = require("../services/playlistService");

/**
 * Generate a playlist from seed track IDs with similarity and diversity controls.
 *
 * Body parameters:
 * @param {string[]} req.body.trackIds Seed track IDs
 * @param {number} [req.body.minTracks=10] Minimum number of tracks in the result
 * @param {number} [req.body.maxTracks=30] Maximum number of tracks in the result (<=100)
 * @param {'semantic'|'audio'|'combined'} [req.body.similarityType='combined'] Similarity metric
 * @param {number} [req.body.semanticWeight=0.5] Weight for semantic similarity [0,1]
 * @param {number} [req.body.audioWeight=0.5] Weight for audio similarity [0,1]
 * @param {number} [req.body.diversityFactor=0.3] Cohesion vs. variety control [0,1]
 * @param {boolean} [req.body.includeSeedTracks=true] Include seeds in final playlist
 * @param {boolean} [req.body.allowTrackVariations=true] Allow near-duplicates/alternates
 *
 * Response: { success: boolean, playlist?: any, message?: string }
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const generatePlaylist = asyncHandler(async (req, res) => {
  const {
    trackIds,
    minTracks = 10,
    maxTracks = 30,
    similarityType = "combined",
    semanticWeight = 0.5,
    audioWeight = 0.5,
    diversityFactor = 0.3,
    includeSeedTracks = true,
    allowTrackVariations = true,
  } = req.body;

  if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Please provide at least one track ID.",
      });
  }
  if (minTracks < 1 || maxTracks < minTracks || maxTracks > 100) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          "Invalid track count limits: minTracks must be at least 1, maxTracks must be between minTracks and 100.",
      });
  }
  if (!["semantic", "audio", "combined"].includes(similarityType)) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          'Invalid similarityType: must be "semantic", "audio", or "combined".',
      });
  }

  let playlist;
  try {
    playlist = playlistService.generatePlaylist(trackIds, {
      minTracks: parseInt(minTracks),
      maxTracks: parseInt(maxTracks),
      similarityType,
      semanticWeight: parseFloat(semanticWeight),
      audioWeight: parseFloat(audioWeight),
      diversityFactor: parseFloat(diversityFactor),
      includeSeedTracks: !!includeSeedTracks,
      allowTrackVariations: !!allowTrackVariations,
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to generate playlist.",
      });
  }

  if (!playlist || !playlist.tracks || playlist.tracks.length < minTracks) {
    return res.status(400).json({
      success: false,
      message: `Could not generate a playlist with at least ${minTracks} tracks.`,
    });
  }

  res.json({
    success: true,
    playlist,
  });
});

/**
 * Return tracks similar to a given source track.
 *
 * Route params:
 * @param {string} req.params.trackId Source track ID
 *
 * Query params:
 * @param {number} [req.query.limit=20] Maximum results
 * @param {'semantic'|'audio'|'combined'} [req.query.similarityType='combined'] Metric
 * @param {number} [req.query.semanticWeight=0.5] Semantic weight [0,1]
 * @param {number} [req.query.audioWeight=0.5] Audio weight [0,1]
 * @param {number} [req.query.minSimilarity=0.1] Minimum similarity threshold
 * @param {boolean|string} [req.query.allowTrackVariations=true] Include variations
 *
 * Response: { success, sourceTrack, similarTracks }
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getSimilarTracks = asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const {
    limit = 20,
    similarityType = "combined",
    semanticWeight = 0.5,
    audioWeight = 0.5,
    minSimilarity = 0.1,
    allowTrackVariations = true,
  } = req.query;

  const track = getTrackById(trackId);
  if (!track) {
    return res
      .status(404)
      .json({ success: false, message: `Track with ID ${trackId} not found.` });
  }

  let similarTracks;
  try {
    similarTracks = similarityService.findSimilarTracks(trackId, {
      limit: parseInt(limit),
      similarityType,
      semanticWeight: parseFloat(semanticWeight),
      audioWeight: parseFloat(audioWeight),
      minSimilarity: parseFloat(minSimilarity),
      allowTrackVariations:
        allowTrackVariations === "true" || allowTrackVariations === true,
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to find similar tracks.",
      });
  }

  res.json({
    success: true,
    sourceTrack: {
      track_id: trackId,
      track_name: track.track_name || "Unknown Track",
      artist_name: track.artist_name || "Unknown Artist",
    },
    similarTracks,
  });
});

/**
 * Fetch a normalized track detail payload for the given ID.
 *
 * Route params:
 * @param {string} req.params.trackId Track ID
 *
 * Response: { success, track: { track_id, track_name, artist_name, features, tags, scores, lyrics } }
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getTrackDetails = asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const track = getTrackById(trackId);
  if (!track) {
    return res
      .status(404)
      .json({ success: false, message: `Track with ID ${trackId} not found.` });
  }

  const trackDetails = {
    track_id: trackId,
    track_name: track.track_name || "Unknown Track",
    artist_name: track.artist_name || "Unknown Artist",
    features: track.features || {},
    tags: track.tags || {},
    scores: track.scores || {},
    lyrics: track.lyrics || null,
  };

  res.json({
    success: true,
    track: trackDetails,
  });
});

/**
 * Provide an overall similarity score and breakdown for two tracks.
 *
 * Query params:
 * @param {string} req.query.track1 Source track ID
 * @param {string} req.query.track2 Target track ID
 * @param {'semantic'|'audio'|'combined'} [req.query.similarityType='combined'] Metric
 * @param {number} [req.query.semanticWeight=0.5] Semantic weight [0,1]
 * @param {number} [req.query.audioWeight=0.5] Audio weight [0,1]
 *
 * Response: { success, similarity: { overall, semantic, audio, breakdown }, sourceTrack, targetTrack }
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getSimilarityDetails = asyncHandler(async (req, res) => {
  const { track1, track2 } = req.query;
  const {
    similarityType = "combined",
    semanticWeight = 0.5,
    audioWeight = 0.5,
  } = req.query;

  if (!track1 || !track2) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Please provide both track1 and track2 parameters.",
      });
  }

  const sourceTrack = getTrackById(track1);
  const targetTrack = getTrackById(track2);

  if (!sourceTrack || !targetTrack) {
    return res
      .status(404)
      .json({ success: false, message: "One or both tracks not found." });
  }

  const overallSimilarity = similarityService.calculateTrackSimilarity(
    track1,
    track2,
    similarityType,
    parseFloat(semanticWeight),
    parseFloat(audioWeight)
  );

  const semanticSimilarity = similarityService.calculateSemanticSimilarity(
    sourceTrack,
    targetTrack
  );
  const audioSimilarity = similarityService.calculateAudioSimilarity(
    sourceTrack,
    targetTrack
  );
  const breakdown = similarityService.getSimilarityBreakdown(
    sourceTrack,
    targetTrack
  );

  res.json({
    success: true,
    similarity: {
      overall: overallSimilarity,
      semantic: semanticSimilarity,
      audio: audioSimilarity,
      breakdown,
    },
    sourceTrack: {
      track_id: track1,
      track_name: sourceTrack.track_name || "Unknown Track",
      artist_name: sourceTrack.artist_name || "Unknown Artist",
    },
    targetTrack: {
      track_id: track2,
      track_name: targetTrack.track_name || "Unknown Track",
      artist_name: targetTrack.artist_name || "Unknown Artist",
    },
  });
});

/**
 * Search tracks by free-text query with an optional limit.
 *
 * Query params:
 * @param {string} req.query.query Search string (required)
 * @param {number} [req.query.limit=10] Max results
 *
 * Response: { success, query, results }
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const searchTracksController = asyncHandler(async (req, res) => {
  const { query, limit = 10 } = req.query;

  if (!query || query.trim() === "") {
    return res
      .status(400)
      .json({ success: false, message: "Search query is required." });
  }

  let results;
  try {
    results = searchTracks(query, parseInt(limit));
  } catch (error) {
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to search tracks.",
      });
  }

  res.json({
    success: true,
    query,
    results,
  });
});

/**
 * Return a random track from the dataset.
 *
 * Response: { success, track }
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getRandomTrackController = asyncHandler(async (req, res) => {
  let track;
  try {
    track = getRandomTrack();
  } catch (error) {
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to get random track.",
      });
  }

  res.json({
    success: true,
    track,
  });
});

/**
 * Return all available tag facets for taxonomy navigation.
 *
 * Response: { success, facets }
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getFacetsController = asyncHandler(async (req, res) => {
  let facets;
  try {
    facets = getFacets();
  } catch (error) {
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch facets.",
      });
  }

  res.json({
    success: true,
    facets,
  });
});

/**
 * Return tags for a given facet passed via query string.
 *
 * Query params:
 * @param {string} [req.query.facet] Facet name to filter tags
 *
 * Response: { success, tags }
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getTagsController = asyncHandler(async (req, res) => {
  const { facet } = req.query;

  let tags;
  try {
    tags = getTags(facet);
  } catch (error) {
    return res
      .status(400)
      .json({
        success: false,
        message: error.message || "Failed to fetch tags.",
      });
  }

  res.json({
    success: true,
    tags,
  });
});

/**
 * Return tags for a facet identified by route parameter.
 *
 * Route params:
 * @param {string} req.params.facetName Facet identifier
 *
 * Response: { success, facet, tags }
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getTagsByFacet = asyncHandler(async (req, res) => {
  const { facetName } = req.params;

  let tags;
  try {
    tags = getTags(facetName);
  } catch (error) {
    return res
      .status(400)
      .json({
        success: false,
        message: error.message || "Failed to fetch tags for facet.",
      });
  }

  res.json({
    success: true,
    facet: facetName,
    tags,
  });
});

module.exports = {
  generatePlaylist,
  getSimilarTracks,
  getTrackDetails,
  getSimilarityDetails,
  searchTracks: searchTracksController,
  getRandomTrack: getRandomTrackController,
  getFacets: getFacetsController,
  getTags: getTagsController,
  getTagsByFacet,
};
