/**
 * @file Controllers for analytical endpoints:
 * - Per-track analysis (tags, normalized features, embeddings)
 * - Pairwise similarity matrix for a set of tracks
 */

const { getTrackById, getAllTracks } = require('../data/dataLoader');
const similarityService = require('../services/similarityService');

/**
 * Generate analysis for a single track:
 * - Tag distribution with per-tag confidence (if available)
 * - Normalized audio features (tempo, loudness, etc.)
 * - 2D semantic embedding proxy (valence, energy)
 * - Optional sentiment when present
 *
 * @param {import('express').Request} req Express request (expects req.params.trackId)
 * @param {import('express').Response} res JSON response with { success, analysis }
 * @returns {void}
 */
const trackAnalysis = (req, res) => {
  const { trackId } = req.params;
  const track = getTrackById(trackId);
  if (!track) {
    return res.status(404).json({ success: false, message: 'Track not found' });
  }

  const tagFacets = Object.keys(track.tags || {});
  const tagDistribution = tagFacets.map(facet => ({
    facet,
    tags: (track.tags[facet] || []).map(tag => ({
      tag,
      confidence: (track.scores && track.scores[facet] && track.scores[facet][tag]) || null
    }))
  }));

  const features = track.features || {};
  const normalizedFeatures = {};
  Object.keys(features).forEach(key => {
    let value = features[key];
    if (typeof value === 'number') {
      if (key === 'tempo') normalizedFeatures[key] = (value - 40) / (200 - 40);
      else if (key === 'loudness') normalizedFeatures[key] = (value + 60) / 60;
      else if (key === 'mode') normalizedFeatures[key] = value;
      else normalizedFeatures[key] = value;
    }
  });

  // Sentiment: ONLY report if present in dataset, else omit
  let sentiment = undefined;
  if ('sentiment' in track && track.sentiment) {
    sentiment = track.sentiment;
  }

  const semanticEmbedding = {
    x: features.valence || 0,
    y: features.energy || 0
  };

  const analysis = {
    trackId,
    tagDistribution,
    normalizedFeatures,
    semanticEmbedding
  };
  if (sentiment !== undefined) analysis.sentiment = sentiment;

  res.json({
    success: true,
    analysis
  });
};

/**
 * Compute an N×N similarity matrix for provided track IDs.
 * Diagonal entries are 1; off-diagonals are calculated via similarityService.
 *
 * @param {import('express').Request} req Express request with body:
 * {
 *   trackIds: string[],
 *   similarityType?: 'semantic'|'audio'|'combined',
 *   semanticWeight?: number,
 *   audioWeight?: number
 * }
 * @param {import('express').Response} res JSON response with { success, trackIds, similarityMatrix }
 * @returns {void}
 */
const similarityMatrix = (req, res) => {
  const { trackIds = [], similarityType = 'combined', semanticWeight = 0.5, audioWeight = 0.5 } = req.body;
  if (!Array.isArray(trackIds) || trackIds.length < 2) {
    return res.status(400).json({ success: false, message: 'trackIds must be an array of at least 2 track IDs' });
  }
  const matrix = [];
  for (let i = 0; i < trackIds.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < trackIds.length; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else {
        matrix[i][j] = similarityService.calculateTrackSimilarity(
          trackIds[i], trackIds[j], similarityType, semanticWeight, audioWeight
        );
      }
    }
  }
  res.json({
    success: true,
    trackIds,
    similarityMatrix: matrix
  });
};

module.exports = {
  trackAnalysis,
  similarityMatrix
};
