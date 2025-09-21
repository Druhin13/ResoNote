const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlist');

/**
 * @route   POST /api/playlists/generate
 * @desc    Generate a playlist based on seed tracks
 * @access  Public
 */
router.post('/generate', playlistController.generatePlaylist);

/**
 * @route   GET /api/playlists/tracks/:trackId
 * @desc    Get similar tracks to a specific track
 * @access  Public
 */
router.get('/tracks/:trackId', playlistController.getSimilarTracks);

/**
 * @route   GET /api/playlists/tracks/:trackId/details
 * @desc    Get detailed information about a track
 * @access  Public
 */
router.get('/tracks/:trackId/details', playlistController.getTrackDetails);

/**
 * @route   GET /api/playlists/similarity
 * @desc    Get similarity details between two tracks
 * @access  Public
 */
router.get('/similarity', playlistController.getSimilarityDetails);

/**
 * @route   GET /api/playlists/search
 * @desc    Search for tracks by name, artist, or lyrics
 * @access  Public
 */
router.get('/search', playlistController.searchTracks);

/**
 * @route   GET /api/playlists/random-track
 * @desc    Get a random track from the database
 * @access  Public
 */
router.get('/random-track', playlistController.getRandomTrack);

/**
 * @route   GET /api/playlists/facets
 * @desc    Get all available facets
 * @access  Public
 */
router.get('/facets', playlistController.getFacets);

/**
 * @route   GET /api/playlists/tags
 * @desc    Get all tags across all facets or for a specific facet
 * @access  Public
 */
router.get('/tags', playlistController.getTags);

/**
 * @route   GET /api/playlists/facets/:facetName/tags
 * @desc    Get all tags for a specific facet
 * @access  Public
 */
router.get('/facets/:facetName/tags', playlistController.getTagsByFacet);

module.exports = router;