const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluation');

router.post('/playlist', evaluationController.playlistEvaluation);
router.post('/cross-validate', evaluationController.crossValidate);

module.exports = router;