const asyncHandler = require('express-async-handler');
const { getFacets, getTags, getTrackById, getRandomTrack, searchTracks } = require('../data/dataLoader');
const similarityService = require('../services/similarityService');
const playlistService = require('../services/playlistService');

const generatePlaylist = asyncHandler(async (req, res) => {
  const {
    trackIds,
    minTracks = 10,
    maxTracks = 30,
    similarityType = 'combined',
    semanticWeight = 0.5,
    audioWeight = 0.5,
    diversityFactor = 0.3,
    includeSeedTracks = true,
    allowTrackVariations = true
  } = req.body;

  if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
    return res.status(400).json({ success: false, message: 'Please provide at least one track ID.' });
  }
  if (minTracks < 1 || maxTracks < minTracks || maxTracks > 100) {
    return res.status(400).json({ success: false, message: 'Invalid track count limits: minTracks must be at least 1, maxTracks must be between minTracks and 100.' });
  }
  if (!['semantic', 'audio', 'combined'].includes(similarityType)) {
    return res.status(400).json({ success: false, message: 'Invalid similarityType: must be "semantic", "audio", or "combined".' });
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
      allowTrackVariations: !!allowTrackVariations
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to generate playlist.' });
  }

  if (!playlist || !playlist.tracks || playlist.tracks.length < minTracks) {
    return res.status(400).json({
      success: false,
      message: `Could not generate a playlist with at least ${minTracks} tracks.`
    });
  }

  res.json({
    success: true,
    playlist
  });
});

const getSimilarTracks = asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const {
    limit = 20,
    similarityType = 'combined',
    semanticWeight = 0.5,
    audioWeight = 0.5,
    minSimilarity = 0.1,
    allowTrackVariations = true
  } = req.query;

  const track = getTrackById(trackId);
  if (!track) {
    return res.status(404).json({ success: false, message: `Track with ID ${trackId} not found.` });
  }

  let similarTracks;
  try {
    similarTracks = similarityService.findSimilarTracks(trackId, {
      limit: parseInt(limit),
      similarityType,
      semanticWeight: parseFloat(semanticWeight),
      audioWeight: parseFloat(audioWeight),
      minSimilarity: parseFloat(minSimilarity),
      allowTrackVariations: allowTrackVariations === 'true' || allowTrackVariations === true
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to find similar tracks.' });
  }

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

const getTrackDetails = asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const track = getTrackById(trackId);
  if (!track) {
    return res.status(404).json({ success: false, message: `Track with ID ${trackId} not found.` });
  }

  const trackDetails = {
    track_id: trackId,
    track_name: track.track_name || 'Unknown Track',
    artist_name: track.artist_name || 'Unknown Artist',
    features: track.features || {},
    tags: track.tags || {},
    scores: track.scores || {},
    lyrics: track.lyrics || null
  };

  res.json({
    success: true,
    track: trackDetails
  });
});

const getSimilarityDetails = asyncHandler(async (req, res) => {
  const { track1, track2 } = req.query;
  const {
    similarityType = 'combined',
    semanticWeight = 0.5,
    audioWeight = 0.5
  } = req.query;

  if (!track1 || !track2) {
    return res.status(400).json({ success: false, message: 'Please provide both track1 and track2 parameters.' });
  }

  const sourceTrack = getTrackById(track1);
  const targetTrack = getTrackById(track2);

  if (!sourceTrack || !targetTrack) {
    return res.status(404).json({ success: false, message: 'One or both tracks not found.' });
  }

  const overallSimilarity = similarityService.calculateTrackSimilarity(
    track1,
    track2,
    similarityType,
    parseFloat(semanticWeight),
    parseFloat(audioWeight)
  );

  const semanticSimilarity = similarityService.calculateSemanticSimilarity(sourceTrack, targetTrack);
  const audioSimilarity = similarityService.calculateAudioSimilarity(sourceTrack, targetTrack);
  const breakdown = similarityService.getSimilarityBreakdown(sourceTrack, targetTrack);

  res.json({
    success: true,
    similarity: {
      overall: overallSimilarity,
      semantic: semanticSimilarity,
      audio: audioSimilarity,
      breakdown
    },
    sourceTrack: {
      track_id: track1,
      track_name: sourceTrack.track_name || 'Unknown Track',
      artist_name: sourceTrack.artist_name || 'Unknown Artist'
    },
    targetTrack: {
      track_id: track2,
      track_name: targetTrack.track_name || 'Unknown Track',
      artist_name: targetTrack.artist_name || 'Unknown Artist'
    }
  });
});

const searchTracksController = asyncHandler(async (req, res) => {
  const { query, limit = 10 } = req.query;

  if (!query || query.trim() === '') {
    return res.status(400).json({ success: false, message: 'Search query is required.' });
  }

  let results;
  try {
    results = searchTracks(query, parseInt(limit));
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to search tracks.' });
  }

  res.json({
    success: true,
    query,
    results
  });
});

const getRandomTrackController = asyncHandler(async (req, res) => {
  let track;
  try {
    track = getRandomTrack();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to get random track.' });
  }

  res.json({
    success: true,
    track
  });
});

const getFacetsController = asyncHandler(async (req, res) => {
  let facets;
  try {
    facets = getFacets();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch facets.' });
  }

  res.json({
    success: true,
    facets
  });
});

const getTagsController = asyncHandler(async (req, res) => {
  const { facet } = req.query;

  let tags;
  try {
    tags = getTags(facet);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to fetch tags.' });
  }

  res.json({
    success: true,
    tags
  });
});

const getTagsByFacet = asyncHandler(async (req, res) => {
  const { facetName } = req.params;

  let tags;
  try {
    tags = getTags(facetName);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to fetch tags for facet.' });
  }

  res.json({
    success: true,
    facet: facetName,
    tags
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
  getTagsByFacet
};