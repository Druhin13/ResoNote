/**
 * @file Express routes for analysis-related operations.
 * Provides endpoints for track analysis and similarity matrix generation.
 */

const express = require("express");
const router = express.Router();
const analysisController = require("../controllers/analysis");

/**
 * GET /tracks/:trackId
 * Retrieve analysis details for a specific track by ID.
 */
router.get("/tracks/:trackId", analysisController.trackAnalysis);

/**
 * POST /similarity-matrix
 * Compute a similarity matrix for a list of track IDs.
 */
router.post("/similarity-matrix", analysisController.similarityMatrix);

module.exports = router;
