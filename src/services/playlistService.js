const _ = require('lodash');
const { getTrackById, getAllTracks } = require('../data/dataLoader');
const similarityService = require('./similarityService');

/**
 * Generate a playlist based on seed tracks
 * @param {Array<string>} seedTrackIds - Array of seed track IDs
 * @param {Object} options - Playlist generation options
 * @returns {Object} - Generated playlist
 */
function generatePlaylist(seedTrackIds, options = {}) {
  const {
    minTracks = 10,
    maxTracks = 30,
    similarityType = 'combined', // 'semantic', 'audio', or 'combined'
    semanticWeight = 0.5,
    audioWeight = 0.5,
    diversityFactor = 0.3, // 0-1, higher = more diverse
    includeSeedTracks = true // whether to include seed tracks in the result
  } = options;
  
  // Validate seed track IDs
  if (!Array.isArray(seedTrackIds) || seedTrackIds.length === 0) {
    throw new Error('At least one seed track ID is required');
  }
  
  const validSeedTracks = [];
  
  // Verify all seed tracks exist
  for (const trackId of seedTrackIds) {
    const track = getTrackById(trackId);
    if (track) {
      validSeedTracks.push(track);
    } else {
      console.warn(`Warning: Seed track with ID ${trackId} not found`);
    }
  }
  
  if (validSeedTracks.length === 0) {
    throw new Error('None of the provided seed track IDs were found');
  }
  
  // Set of track IDs already in the playlist (to avoid duplicates)
  const playlistTrackIds = new Set(includeSeedTracks ? seedTrackIds : []);
  
  // Get all potential tracks (excluding seeds if they shouldn't be included)
  const allTracks = getAllTracks();
  const candidateTracks = [];
  
  for (const [id, track] of allTracks.entries()) {
    // Skip if already in playlist
    if (playlistTrackIds.has(id)) {
      continue;
    }
    
    candidateTracks.push(track);
  }
  
  // Calculate average similarity to all seed tracks for each candidate
  const tracksWithScores = candidateTracks.map(track => {
    let totalSimilarity = 0;
    
    for (const seedTrack of validSeedTracks) {
      let similarity;
      
      switch (similarityType) {
        case 'semantic':
          similarity = similarityService.calculateSemanticSimilarity(seedTrack, track);
          break;
        case 'audio':
          similarity = similarityService.calculateAudioSimilarity(seedTrack, track);
          break;
        case 'combined':
        default:
          similarity = similarityService.calculateCombinedSimilarity(seedTrack, track, {
            semanticWeight,
            audioWeight
          });
          break;
      }
      
      totalSimilarity += similarity;
    }
    
    const averageSimilarity = totalSimilarity / validSeedTracks.length;
    
    return {
      track,
      similarity: averageSimilarity
    };
  });
  
  // Sort by similarity (descending)
  tracksWithScores.sort((a, b) => b.similarity - a.similarity);
  
  // Start with seed tracks if requested
  const playlist = [];
  
  if (includeSeedTracks) {
    for (const trackId of seedTrackIds) {
      const track = getTrackById(trackId);
      if (track) {
        playlist.push({
          track_id: trackId,
          track_name: track.track_name || 'Unknown Track',
          artist_name: track.artist_name || 'Unknown Artist',
          similarity: 1.0, // Seed tracks have perfect similarity by definition
          isSeed: true
        });
      }
    }
  }
  
  // Add more tracks using a diversity-aware selection algorithm
  while (playlist.length < maxTracks && tracksWithScores.length > 0) {
    // Top candidate by similarity
    const nextTrackIndex = 0;
    
    // Apply diversity factor: sometimes pick from top N rather than just the top 1
    if (diversityFactor > 0 && playlist.length > 0) {
      const topN = Math.max(1, Math.ceil(tracksWithScores.length * diversityFactor));
      nextTrackIndex = Math.floor(Math.random() * Math.min(topN, tracksWithScores.length));
    }
    
    const selectedTrack = tracksWithScores[nextTrackIndex];
    tracksWithScores.splice(nextTrackIndex, 1);
    
    playlist.push({
      track_id: selectedTrack.track.track_id,
      track_name: selectedTrack.track.track_name || 'Unknown Track',
      artist_name: selectedTrack.track.artist_name || 'Unknown Artist',
      similarity: selectedTrack.similarity,
      isSeed: false
    });
  }
  
  // Ensure minimum tracks requirement if possible
  if (playlist.length < minTracks && tracksWithScores.length > 0) {
    const remaining = minTracks - playlist.length;
    const additionalTracks = tracksWithScores.slice(0, remaining);
    
    for (const { track, similarity } of additionalTracks) {
      playlist.push({
        track_id: track.track_id,
        track_name: track.track_name || 'Unknown Track',
        artist_name: track.artist_name || 'Unknown Artist',
        similarity,
        isSeed: false
      });
    }
  }
  
  return {
    id: generatePlaylistId(),
    name: generatePlaylistName(validSeedTracks),
    tracks: playlist,
    seedTracks: seedTrackIds,
    options: {
      similarityType,
      semanticWeight,
      audioWeight,
      diversityFactor
    },
    stats: {
      trackCount: playlist.length,
      averageSimilarity: playlist.length > 0 ? 
        playlist.reduce((sum, t) => sum + t.similarity, 0) / playlist.length : 0
    }
  };
}

/**
 * Generate a unique ID for a playlist
 * @returns {string} - Unique playlist ID
 */
function generatePlaylistId() {
  return `pl_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

/**
 * Generate a name for a playlist based on seed tracks
 * @param {Array<Object>} seedTracks - Array of seed track objects
 * @returns {string} - Generated playlist name
 */
function generatePlaylistName(seedTracks) {
  if (seedTracks.length === 0) {
    return "ResoNote Playlist";
  }
  
  if (seedTracks.length === 1) {
    const track = seedTracks[0];
    return track.track_name ? 
      `Similar to "${track.track_name}"` : 
      "ResoNote Playlist";
  }
  
  // If we have multiple seed tracks, use the first two in the name
  const track1 = seedTracks[0];
  const track2 = seedTracks[1];
  
  if (track1.track_name && track2.track_name) {
    return `Mix of "${track1.track_name}" and "${track2.track_name}"${seedTracks.length > 2 ? ' + more' : ''}`;
  }
  
  return `Mix of ${seedTracks.length} tracks`;
}

module.exports = {
  generatePlaylist
};