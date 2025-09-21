/**
 * @file Media routes for handling track-related assets such as images.
 */

const express = require("express");
const router = express.Router();
const mediaController = require("../controllers/media");

/**
 * GET /track/:id/image
 * Retrieve the album/track image for a given track ID.
 */
router.get("/track/:id/image", mediaController.getTrackImage);

module.exports = router;
