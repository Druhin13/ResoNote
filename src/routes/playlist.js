/**
 * @file Playlist routes defining endpoints for generating, searching, and analyzing playlists.
 */

const express = require("express");
const router = express.Router();
const playlistController = require("../controllers/playlist");

/**
 * POST /api/playlists/generate
 * Generate a playlist based on provided seed tracks and options.
 */
router.post("/generate", playlistController.generatePlaylist);

/**
 * GET /api/playlists/tracks/:trackId
 * Retrieve tracks similar to the given track.
 */
router.get("/tracks/:trackId", playlistController.getSimilarTracks);

/**
 * GET /api/playlists/tracks/:trackId/details
 * Retrieve detailed information about a specific track.
 */
router.get("/tracks/:trackId/details", playlistController.getTrackDetails);

/**
 * GET /api/playlists/similarity
 * Retrieve similarity details between two tracks.
 */
router.get("/similarity", playlistController.getSimilarityDetails);

/**
 * GET /api/playlists/search
 * Search for tracks by name, artist, or lyrics.
 */
router.get("/search", playlistController.searchTracks);

/**
 * GET /api/playlists/random-track
 * Retrieve a random track from the dataset.
 */
router.get("/random-track", playlistController.getRandomTrack);

/**
 * GET /api/playlists/facets
 * Retrieve all available semantic facets.
 */
router.get("/facets", playlistController.getFacets);

/**
 * GET /api/playlists/tags
 * Retrieve tags across all facets or for a specific facet.
 */
router.get("/tags", playlistController.getTags);

/**
 * GET /api/playlists/facets/:facetName/tags
 * Retrieve tags for a specific facet.
 */
router.get("/facets/:facetName/tags", playlistController.getTagsByFacet);

module.exports = router;
