const { getTrackById } = require('../data/dataLoader');
const similarityService = require('./similarityService');
const Fuse = require('fuse.js');

/**
 * Generate a playlist based on seed tracks
 * @param {Array<string>} seedTrackIds - Array of seed track IDs
 * @param {Object} options - Options for playlist generation
 * @returns {Object} Generated playlist
 */
function generatePlaylist(seedTrackIds, options = {}) {
  // Set default options
  const {
    minTracks = 10,
    maxTracks = 30,
    similarityType = 'combined',
    semanticWeight = 0.5,
    audioWeight = 0.5,
    diversityFactor = 0.3,
    includeSeedTracks = true,
    allowTrackVariations = true
  } = options;
  
  // Validate seed tracks
  const validSeedTracks = [];
  const seedTrackDetails = [];
  
  for (const trackId of seedTrackIds) {
    const track = getTrackById(trackId);
    if (track) {
      validSeedTracks.push({
        track_id: trackId,
        track_name: track.track_name || 'Unknown Track',
        artist_name: track.artist_name || 'Unknown Artist',
        isSeed: true,
        similarity: 1
      });
      
      // Store detailed track info for variation detection
      seedTrackDetails.push({
        id: trackId,
        name: track.track_name || '',
        artist: track.artist_name || '',
        baseName: getBaseTrackName(track.track_name || ''),
        lyrics: track.lyrics || ''
      });
    }
  }
  
  if (validSeedTracks.length === 0) {
    throw new Error('No valid seed tracks provided');
  }
  
  // Start with seed tracks if includeSeedTracks is true
  const playlistTracks = includeSeedTracks ? [...validSeedTracks] : [];
  
  // Get similar tracks for each seed track
  const allSimilarTracks = [];
  
  for (const seedTrack of validSeedTracks) {
    const similarTracks = similarityService.findSimilarTracks(seedTrack.track_id, {
      limit: maxTracks * 2, // Get more than we need to account for filtering
      similarityType,
      semanticWeight,
      audioWeight,
      minSimilarity: 0.1
    });
    
    // Add reference to which seed track this is similar to
    for (const track of similarTracks) {
      track.similarToSeed = seedTrack.track_id;
      allSimilarTracks.push(track);
    }
  }
  
  // Deduplicate similar tracks (same track might be similar to multiple seed tracks)
  const trackMap = new Map();
  
  for (const track of allSimilarTracks) {
    const trackId = track.track_id;
    
    // Skip if track is already a seed track and we're including seed tracks
    if (includeSeedTracks && validSeedTracks.some(seedTrack => seedTrack.track_id === trackId)) {
      continue;
    }
    
    // If track is already in map, keep the one with higher similarity
    if (trackMap.has(trackId)) {
      const existingTrack = trackMap.get(trackId);
      if (track.similarity > existingTrack.similarity) {
        trackMap.set(trackId, track);
      }
    } else {
      trackMap.set(trackId, track);
    }
  }
  
  // Get all unique similar tracks
  let uniqueSimilarTracks = Array.from(trackMap.values());
  
  // If we don't allow track variations, we need to identify and filter them
  if (!allowTrackVariations) {
    // First, identify variations
    const trackDetails = [];
    
    // Get full details for all candidate tracks
    for (const track of uniqueSimilarTracks) {
      const trackData = getTrackById(track.track_id);
      if (trackData) {
        trackDetails.push({
          id: track.track_id,
          name: trackData.track_name || '',
          artist: trackData.artist_name || '',
          baseName: getBaseTrackName(trackData.track_name || ''),
          lyrics: trackData.lyrics || '',
          similarity: track.similarity,
          similarToSeed: track.similarToSeed
        });
      }
    }
    
    // 1. First check: Filter out tracks that are variations of seed tracks
    uniqueSimilarTracks = uniqueSimilarTracks.filter(track => {
      const trackData = getTrackById(track.track_id);
      if (!trackData) return false;
      
      // Check if this track is a variation of any seed track
      for (const seedTrack of seedTrackDetails) {
        // Skip if it's not similar to this seed track
        if (track.similarToSeed !== seedTrack.id) continue;
        
        // Get the base name of this track
        const baseName = getBaseTrackName(trackData.track_name || '');
        
        // Compare with seed track base name using Fuse.js for fuzzy matching
        const titleFuse = new Fuse([seedTrack.baseName], {
          includeScore: true,
          threshold: 0.3
        });
        
        const titleResult = titleFuse.search(baseName);
        if (titleResult.length > 0 && titleResult[0].score < 0.3) {
          // This is likely a variation of the seed track
          track.isVariation = true;
          track.variationOf = seedTrack.id;
          return false; // Filter it out
        }
        
        // If both have lyrics, also check for high lyrics similarity
        if (trackData.lyrics && seedTrack.lyrics) {
          // Use Fuse.js to check lyrics similarity
          const lyricsFuse = new Fuse([seedTrack.lyrics], {
            includeScore: true,
            threshold: 0.6 // Higher threshold for lyrics (more permissive)
          });
          
          const lyricsResult = lyricsFuse.search(trackData.lyrics);
          if (lyricsResult.length > 0 && lyricsResult[0].score < 0.6) {
            // Lyrics are very similar, likely a variation
            track.isVariation = true;
            track.variationOf = seedTrack.id;
            return false; // Filter it out
          }
        }
      }
      
      return true;
    });
    
    // 2. Second check: Group remaining tracks by similar names and keep only the best version
    const groupedTracks = new Map();
    
    for (const track of uniqueSimilarTracks) {
      const trackData = getTrackById(track.track_id);
      if (!trackData) continue;
      
      const baseName = getBaseTrackName(trackData.track_name || '');
      
      // Try to find an existing group this track belongs to
      let foundGroup = false;
      
      for (const [groupKey, group] of groupedTracks.entries()) {
        const existingTrack = getTrackById(group[0].track_id);
        if (!existingTrack) continue;
        
        const existingBaseName = getBaseTrackName(existingTrack.track_name || '');
        
        // Use Fuse.js to check name similarity
        const fuse = new Fuse([existingBaseName], {
          includeScore: true,
          threshold: 0.3
        });
        
        const result = fuse.search(baseName);
        if (result.length > 0 && result[0].score < 0.3) {
          // This track belongs to an existing group
          group.push(track);
          foundGroup = true;
          break;
        }
        
        // If both have lyrics, also check for high lyrics similarity
        if (trackData.lyrics && existingTrack.lyrics) {
          // Use Fuse.js to check lyrics similarity
          const lyricsFuse = new Fuse([existingTrack.lyrics], {
            includeScore: true,
            threshold: 0.7 // More permissive for lyrics
          });
          
          const lyricsResult = lyricsFuse.search(trackData.lyrics);
          if (lyricsResult.length > 0 && lyricsResult[0].score < 0.7) {
            // Lyrics are very similar, likely variations of the same song
            group.push(track);
            foundGroup = true;
            break;
          }
        }
      }
      
      // If no group found, create a new one
      if (!foundGroup) {
        groupedTracks.set(track.track_id, [track]);
      }
    }
    
    // For each group, keep only the track with highest similarity
    uniqueSimilarTracks = [];
    for (const group of groupedTracks.values()) {
      // Sort by similarity (descending)
      group.sort((a, b) => b.similarity - a.similarity);
      
      // Mark if it's a variation (all but the best one)
      const bestMatch = group[0];
      if (group.length > 1) {
        bestMatch.isVariationGroup = true;
        bestMatch.groupSize = group.length;
      }
      
      uniqueSimilarTracks.push(bestMatch);
    }
  } else {
    // If variations are allowed, just mark them for display purposes
    for (const track of uniqueSimilarTracks) {
      const trackData = getTrackById(track.track_id);
      if (!trackData) continue;
      
      const baseName = getBaseTrackName(trackData.track_name || '');
      
      // Check if this track is a variation of any seed track
      for (const seedTrack of seedTrackDetails) {
        if (baseName === seedTrack.baseName) {
          track.isVariation = true;
          track.variationOf = seedTrack.id;
          break;
        }
      }
    }
  }
  
  // Apply diversity factor by reranking tracks
  let rankedTracks = applyDiversityReranking(uniqueSimilarTracks, diversityFactor);
  
  // Limit to maxTracks
  const recommendedTracks = rankedTracks.slice(0, maxTracks - playlistTracks.length);
  
  // Combine seed tracks and recommended tracks
  playlistTracks.push(...recommendedTracks);
  
  // Generate playlist name based on seed tracks
  const playlistName = generatePlaylistName(validSeedTracks);
  
  // Calculate average similarity
  const totalSimilarity = playlistTracks.reduce((sum, track) => sum + track.similarity, 0);
  const averageSimilarity = totalSimilarity / playlistTracks.length;
  
  return {
    name: playlistName,
    tracks: playlistTracks,
    stats: {
      trackCount: playlistTracks.length,
      seedTrackCount: validSeedTracks.length,
      averageSimilarity
    }
  };
}

/**
 * Extract the base track name without remix/version information
 * @param {string} trackName - Full track name
 * @returns {string} Base track name
 */
function getBaseTrackName(trackName) {
  if (!trackName) return '';
  
  // Common patterns for variations
  const variationPatterns = [
    /\s*[\(\[\{].*remix.*[\)\]\}]/i,
    /\s*[\(\[\{].*version.*[\)\]\}]/i,
    /\s*[\(\[\{].*edit.*[\)\]\}]/i,
    /\s*[\(\[\{].*mix.*[\)\]\}]/i,
    /\s*[\(\[\{].*feat\..*[\)\]\}]/i,
    /\s*[\(\[\{].*featuring.*[\)\]\}]/i,
    /\s*[\(\[\{].*cover.*[\)\]\}]/i,
    /\s*[\(\[\{].*live.*[\)\]\}]/i,
    /\s*[\(\[\{].*acoustic.*[\)\]\}]/i,
    /\s*[\(\[\{].*instrumental.*[\)\]\}]/i,
    /\s*-\s*remix.*/i,
    /\s*-\s*version.*/i,
    /\s*-\s*edit.*/i,
    /\s*-\s*mix.*/i,
    /\s*-\s*feat\..*/i,
    /\s*-\s*featuring.*/i,
    /\s*-\s*cover.*/i,
    /\s*-\s*live.*/i
  ];
  
  // Remove all variation patterns
  let baseName = trackName;
  variationPatterns.forEach(pattern => {
    baseName = baseName.replace(pattern, '');
  });
  
  // Trim whitespace
  baseName = baseName.trim();
  
  return baseName;
}

/**
 * Apply diversity reranking to a list of tracks
 * @param {Array} tracks - Tracks to rerank
 * @param {number} diversityFactor - How much to prioritize diversity (0-1)
 * @returns {Array} Reranked tracks
 */
function applyDiversityReranking(tracks, diversityFactor) {
  if (tracks.length <= 1 || diversityFactor <= 0) {
    // Sort by similarity if diversity is not a factor
    return [...tracks].sort((a, b) => b.similarity - a.similarity);
  }
  
  // Clone tracks to avoid modifying original
  const tracksToRank = [...tracks];
  
  // Sort initially by similarity
  tracksToRank.sort((a, b) => b.similarity - a.similarity);
  
  // Selected tracks will be the reranked result
  const selectedTracks = [tracksToRank.shift()];
  
  while (tracksToRank.length > 0) {
    // Calculate diversity score for each remaining track
    for (const track of tracksToRank) {
      let totalDiversity = 0;
      
      // Calculate average diversity from already selected tracks
      for (const selectedTrack of selectedTracks) {
        // Higher value means more diverse
        const diversity = 1 - similarityService.calculateTrackSimilarity(
          track.track_id,
          selectedTrack.track_id,
          'combined',
          0.5,
          0.5
        );
        
        totalDiversity += diversity;
      }
      
      const avgDiversity = totalDiversity / selectedTracks.length;
      
      // Combined score balances similarity and diversity
      track.combinedScore = (track.similarity * (1 - diversityFactor)) + 
                           (avgDiversity * diversityFactor);
    }
    
    // Sort by combined score
    tracksToRank.sort((a, b) => b.combinedScore - a.combinedScore);
    
    // Pick the track with highest combined score
    selectedTracks.push(tracksToRank.shift());
  }
  
  return selectedTracks;
}

/**
 * Generate a playlist name based on seed tracks
 * @param {Array} seedTracks - Seed tracks
 * @returns {string} Playlist name
 */
function generatePlaylistName(seedTracks) {
  if (seedTracks.length === 0) {
    return 'ResoNote Playlist';
  }
  
  if (seedTracks.length === 1) {
    const track = seedTracks[0];
    return `Songs like "${track.track_name}" by ${track.artist_name}`;
  }
  
  if (seedTracks.length === 2) {
    return `Mix of ${seedTracks[0].artist_name} and ${seedTracks[1].artist_name}`;
  }
  
  // For 3+ seed tracks, use the first two and indicate there are more
  return `Mix of ${seedTracks[0].artist_name}, ${seedTracks[1].artist_name}, and ${seedTracks.length - 2} more`;
}

/**
 * Find similar tracks for a specific track
 * @param {string} trackId - ID of the track to find similar tracks for
 * @param {Object} options - Options for similarity calculation
 * @returns {Array} Array of similar tracks
 */
function findSimilarTracks(trackId, options = {}) {
  return similarityService.findSimilarTracks(trackId, options);
}

module.exports = {
  generatePlaylist,
  findSimilarTracks,
  getBaseTrackName // Exported for testing
};