const asyncHandler = require('express-async-handler');
const { getFacets, getTags, getTrackById } = require('../data/dataLoader');
const similarityService = require('../services/similarityService');
const playlistService = require('../services/playlistService');

/**
 * @desc    Generate a playlist based on seed tracks
 * @route   POST /api/playlists/generate
 * @access  Public
 */
const generatePlaylist = asyncHandler(async (req, res) => {
  const {
    trackIds,
    minTracks = 10,
    maxTracks = 30,
    similarityType = 'combined',
    semanticWeight = 0.5,
    audioWeight = 0.5,
    diversityFactor = 0.3,
    includeSeedTracks = true
  } = req.body;
  
  // Validate request
  if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
    res.status(400);
    throw new Error('Please provide at least one track ID');
  }
  
  if (minTracks < 1 || maxTracks < minTracks || maxTracks > 100) {
    res.status(400);
    throw new Error('Invalid track count limits: minTracks must be at least 1, maxTracks must be between minTracks and 100');
  }
  
  if (!['semantic', 'audio', 'combined'].includes(similarityType)) {
    res.status(400);
    throw new Error('Invalid similarityType: must be "semantic", "audio", or "combined"');
  }
  
  // Generate playlist
  const playlist = playlistService.generatePlaylist(trackIds, {
    minTracks: parseInt(minTracks),
    maxTracks: parseInt(maxTracks),
    similarityType,
    semanticWeight: parseFloat(semanticWeight),
    audioWeight: parseFloat(audioWeight),
    diversityFactor: parseFloat(diversityFactor),
    includeSeedTracks: !!includeSeedTracks
  });
  
  res.json({
    success: true,
    playlist
  });
});

/**
 * @desc    Get similar tracks to a specific track
 * @route   GET /api/playlists/tracks/:trackId
 * @access  Public
 */
const getSimilarTracks = asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const {
    limit = 20,
    similarityType = 'combined',
    semanticWeight = 0.5,
    audioWeight = 0.5,
    minSimilarity = 0.1
  } = req.query;
  
  // Validate trackId
  const track = getTrackById(trackId);
  if (!track) {
    res.status(404);
    throw new Error(`Track with ID ${trackId} not found`);
  }
  
  // Get similar tracks
  const similarTracks = similarityService.findSimilarTracks(trackId, {
    limit: parseInt(limit),
    similarityType,
    semanticWeight: parseFloat(semanticWeight),
    audioWeight: parseFloat(audioWeight),
    minSimilarity: parseFloat(minSimilarity)
  });
  
  res.json({
    success: true,
    sourceTrack: {
      track_id: trackId,
      track_name: track.track_name || 'Unknown Track',
      artist_name: track.artist_name || 'Unknown Artist'
    },
    similarTracks
  });
});

/**
 * @desc    Get all available facets
 * @route   GET /api/playlists/facets
 * @access  Public
 */
const getFacetsController = asyncHandler(async (req, res) => {
  const facets = getFacets();
  
  res.json({
    success: true,
    facets
  });
});

/**
 * @desc    Get all tags across all facets
 * @route   GET /api/playlists/tags
 * @access  Public
 */
const getTagsController = asyncHandler(async (req, res) => {
  const { facet } = req.query;
  
  try {
    const tags = getTags(facet);
    
    res.json({
      success: true,
      tags
    });
  } catch (error) {
    res.status(400);
    throw error;
  }
});

/**
 * @desc    Get all tags for a specific facet
 * @route   GET /api/playlists/facets/:facetName/tags
 * @access  Public
 */
const getTagsByFacet = asyncHandler(async (req, res) => {
  const { facetName } = req.params;
  
  try {
    const tags = getTags(facetName);
    
    res.json({
      success: true,
      facet: facetName,
      tags
    });
  } catch (error) {
    res.status(400);
    throw error;
  }
});

module.exports = {
  generatePlaylist,
  getSimilarTracks,
  getFacets: getFacetsController,
  getTags: getTagsController,
  getTagsByFacet
};