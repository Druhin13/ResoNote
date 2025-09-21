const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/media');

router.get('/track/:id/image', mediaController.getTrackImage);

module.exports = router;