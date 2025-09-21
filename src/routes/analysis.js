const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysis');

router.get('/tracks/:trackId', analysisController.trackAnalysis);
router.post('/similarity-matrix', analysisController.similarityMatrix);

module.exports = router;