const _ = require('lodash');
const { getTrackById, getAllTracks } = require('../data/dataLoader');

/**
 * Calculate semantic similarity between two tracks based on their tags
 * @param {Object} sourceTrack - The source track
 * @param {Object} targetTrack - The target track to compare with
 * @returns {number} - Similarity score (0-1)
 */
function calculateSemanticSimilarity(sourceTrack, targetTrack) {
  // If either track doesn't have tags, return 0
  if (!sourceTrack.tags || !targetTrack.tags) {
    return 0;
  }
  
  // Get all facets
  const facets = [
    'Emotional_Tone',
    'Thematic_Content',
    'Narrative_Structure',
    'Lyrical_Style'
  ];
  
  let totalScore = 0;
  let availableFacets = 0;
  
  // Calculate similarity for each facet
  for (const facet of facets) {
    if (sourceTrack.tags[facet] && targetTrack.tags[facet]) {
      // Get the intersection of tags
      const sourceTags = new Set(sourceTrack.tags[facet]);
      const targetTags = new Set(targetTrack.tags[facet]);
      const intersection = new Set([...sourceTags].filter(x => targetTags.has(x)));
      
      // Calculate Jaccard similarity
      const union = new Set([...sourceTags, ...targetTags]);
      const similarity = intersection.size / union.size;
      
      // Weight by score if available
      let weightedSimilarity = similarity;
      if (sourceTrack.scores && targetTrack.scores && 
          sourceTrack.scores[facet] && targetTrack.scores[facet]) {
        
        // Calculate weighted similarity based on scores
        let scoreSum = 0;
        let scoreCount = 0;
        
        for (const tag of intersection) {
          if (sourceTrack.scores[facet][tag] && targetTrack.scores[facet][tag]) {
            const scoreProduct = sourceTrack.scores[facet][tag] * targetTrack.scores[facet][tag];
            scoreSum += scoreProduct;
            scoreCount++;
          }
        }
        
        if (scoreCount > 0) {
          weightedSimilarity = (similarity * 0.4) + ((scoreSum / scoreCount) * 0.6);
        }
      }
      
      totalScore += weightedSimilarity;
      availableFacets++;
    }
  }
  
  // Return average similarity across available facets
  return availableFacets > 0 ? totalScore / availableFacets : 0;
}

/**
 * Calculate audio feature similarity between two tracks
 * @param {Object} sourceTrack - The source track
 * @param {Object} targetTrack - The target track to compare with
 * @returns {number} - Similarity score (0-1)
 */
function calculateAudioSimilarity(sourceTrack, targetTrack) {
  // If either track doesn't have features, return 0
  if (!sourceTrack.features || !targetTrack.features) {
    return 0;
  }
  
  // Features to compare and their weights
  const featureWeights = {
    acousticness: 1,
    danceability: 1.5,
    energy: 1.5,
    instrumentalness: 1,
    liveness: 0.8,
    loudness: 0.8,
    speechiness: 1,
    tempo: 0.5,
    valence: 1.5,
    popularity: 0.3
  };
  
  let totalWeight = 0;
  let weightedDifference = 0;
  
  // Calculate normalized differences for each feature
  for (const [feature, weight] of Object.entries(featureWeights)) {
    if (sourceTrack.features[feature] !== undefined && 
        targetTrack.features[feature] !== undefined) {
      
      let normalizedDiff;
      
      // Special case for tempo which has a wider range
      if (feature === 'tempo') {
        const maxTempoDiff = 50; // max difference to consider
        const diff = Math.abs(sourceTrack.features[feature] - targetTrack.features[feature]);
        normalizedDiff = Math.min(diff / maxTempoDiff, 1);
      }
      // Special case for loudness which is typically negative
      else if (feature === 'loudness') {
        const maxLoudnessDiff = 20; // max difference to consider
        const diff = Math.abs(sourceTrack.features[feature] - targetTrack.features[feature]);
        normalizedDiff = Math.min(diff / maxLoudnessDiff, 1);
      }
      // Default case for features that range from 0 to 1
      else {
        normalizedDiff = Math.abs(sourceTrack.features[feature] - targetTrack.features[feature]);
      }
      
      weightedDifference += normalizedDiff * weight;
      totalWeight += weight;
    }
  }
  
  // Convert difference to similarity (0-1)
  return totalWeight > 0 ? 1 - (weightedDifference / totalWeight) : 0;
}

/**
 * Calculate combined similarity between two tracks
 * @param {Object} sourceTrack - The source track
 * @param {Object} targetTrack - The target track to compare with
 * @param {Object} options - Similarity calculation options
 * @returns {number} - Similarity score (0-1)
 */
function calculateCombinedSimilarity(sourceTrack, targetTrack, options = {}) {
  const {
    semanticWeight = 0.5,
    audioWeight = 0.5
  } = options;
  
  const semanticSimilarity = calculateSemanticSimilarity(sourceTrack, targetTrack);
  const audioSimilarity = calculateAudioSimilarity(sourceTrack, targetTrack);
  
  const totalWeight = semanticWeight + audioWeight;
  
  if (totalWeight === 0) {
    return 0;
  }
  
  return ((semanticSimilarity * semanticWeight) + 
          (audioSimilarity * audioWeight)) / totalWeight;
}

/**
 * Find similar tracks to a source track
 * @param {string} trackId - ID of the source track
 * @param {Object} options - Options for similarity calculation
 * @returns {Array} - Array of tracks with similarity scores
 */
function findSimilarTracks(trackId, options = {}) {
  const {
    similarityType = 'combined', // 'semantic', 'audio', or 'combined'
    limit = 10,
    minSimilarity = 0.1,
    semanticWeight = 0.5,
    audioWeight = 0.5
  } = options;
  
  const sourceTrack = getTrackById(trackId);
  
  if (!sourceTrack) {
    throw new Error(`Track with ID ${trackId} not found`);
  }
  
  const allTracks = getAllTracks();
  const similarities = [];
  
  // Calculate similarity for each track
  for (const [id, track] of allTracks.entries()) {
    // Skip the source track
    if (id === trackId) {
      continue;
    }
    
    let similarity;
    
    switch (similarityType) {
      case 'semantic':
        similarity = calculateSemanticSimilarity(sourceTrack, track);
        break;
      case 'audio':
        similarity = calculateAudioSimilarity(sourceTrack, track);
        break;
      case 'combined':
      default:
        similarity = calculateCombinedSimilarity(sourceTrack, track, {
          semanticWeight,
          audioWeight
        });
        break;
    }
    
    if (similarity >= minSimilarity) {
      similarities.push({
        track_id: id,
        similarity,
        track_name: track.track_name,
        artist_name: track.artist_name
      });
    }
  }
  
  // Sort by similarity (descending) and limit results
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

module.exports = {
  calculateSemanticSimilarity,
  calculateAudioSimilarity,
  calculateCombinedSimilarity,
  findSimilarTracks
};