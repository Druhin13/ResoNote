/**
 * @file Main API router.
 * Provides the base API information and mounts sub-routes.
 */

const express = require("express");
const router = express.Router();
const playlistRoutes = require("./playlist");

/**
 * GET /
 * Return basic API information and available endpoints.
 */
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to the ResoNote API",
    version: "1.0.0",
    endpoints: {
      playlists: "/api/playlists",
    },
  });
});

/**
 * Mount playlist-related routes.
 */
router.use("/playlists", playlistRoutes);

module.exports = router;
