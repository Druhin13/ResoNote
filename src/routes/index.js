const express = require('express');
const router = express.Router();
const playlistRoutes = require('./playlist');

// API Info
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to the ResoNote API',
    version: '1.0.0',
    endpoints: {
      playlists: '/api/playlists'
    }
  });
});

// Playlist routes
router.use('/playlists', playlistRoutes);

module.exports = router;