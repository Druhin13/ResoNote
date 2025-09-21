/**
 * @file Express routes for evaluation-related operations.
 * Provides endpoints for evaluating playlists and performing cross-validation.
 */

const express = require("express");
const router = express.Router();
const evaluationController = require("../controllers/evaluation");

/**
 * POST /playlist
 * Evaluate a generated playlist based on diversity, similarity, and tag coverage.
 */
router.post("/playlist", evaluationController.playlistEvaluation);

/**
 * POST /cross-validate
 * Perform k-fold cross-validation using track similarities.
 */
router.post("/cross-validate", evaluationController.crossValidate);

module.exports = router;
