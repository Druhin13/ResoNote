const { getTrackById, getAllTracks } = require('../data/dataLoader');
const helpers = require('../utils/helpers');

/**
 * Calculate similarity between two tracks
 * @param {string} trackId1 - First track ID
 * @param {string} trackId2 - Second track ID
 * @param {string} similarityType - Type of similarity to calculate (semantic, audio, combined)
 * @param {number} semanticWeight - Weight for semantic similarity when using combined type
 * @param {number} audioWeight - Weight for audio similarity when using combined type
 * @returns {number} Similarity score (0-1)
 */
function calculateTrackSimilarity(trackId1, trackId2, similarityType = 'combined', semanticWeight = 0.5, audioWeight = 0.5) {
  // Get track data
  const track1 = getTrackById(trackId1);
  const track2 = getTrackById(trackId2);
  
  if (!track1 || !track2) {
    return 0;
  }
  
  // For same track, return max similarity
  if (trackId1 === trackId2) {
    return 1;
  }
  
  // Calculate based on specified type
  switch (similarityType) {
    case 'semantic':
      return calculateSemanticSimilarity(track1, track2);
    case 'audio':
      return calculateAudioSimilarity(track1, track2);
    case 'combined':
      const semantic = calculateSemanticSimilarity(track1, track2);
      const audio = calculateAudioSimilarity(track1, track2);
      
      // Normalize weights to ensure they sum to 1
      const totalWeight = semanticWeight + audioWeight;
      const normalizedSemanticWeight = semanticWeight / totalWeight;
      const normalizedAudioWeight = audioWeight / totalWeight;
      
      return (semantic * normalizedSemanticWeight) + (audio * normalizedAudioWeight);
    default:
      throw new Error(`Invalid similarity type: ${similarityType}`);
  }
}

/**
 * Calculate semantic similarity between two tracks based on tags
 * @param {Object} track1 - First track data
 * @param {Object} track2 - Second track data
 * @returns {number} Similarity score (0-1)
 */
function calculateSemanticSimilarity(track1, track2) {
  if (!track1.tags || !track2.tags) {
    return 0;
  }
  
  let totalSimilarity = 0;
  let totalWeight = 0;
  
  // Define facet weights
  const facetWeights = {
    'Emotional_Tone': 0.4,
    'Thematic_Content': 0.3,
    'Narrative_Structure': 0.1,
    'Lyrical_Style': 0.2
  };
  
  // Calculate basic tag similarity for each facet
  const basicSimilarities = {};
  let basicTagSimilarity = 0;
  let facetsWithTags = 0;
  
  for (const [facet, weight] of Object.entries(facetWeights)) {
    const tags1 = track1.tags[facet] || [];
    const tags2 = track2.tags[facet] || [];
    
    // Skip if either track has no tags for this facet
    if (tags1.length === 0 || tags2.length === 0) {
      basicSimilarities[facet] = 0;
      continue;
    }
    
    facetsWithTags++;
    
    // Get confidence scores for tags
    const scores1 = track1.scores && track1.scores[facet] ? track1.scores[facet] : {};
    const scores2 = track2.scores && track2.scores[facet] ? track2.scores[facet] : {};
    
    // Calculate weighted Jaccard similarity for this facet using confidence scores
    let intersection = 0;
    let union = 0;
    
    // Create a set of all unique tags
    const allTags = new Set([...tags1, ...tags2]);
    
    for (const tag of allTags) {
      const score1 = scores1[tag] || 0;
      const score2 = scores2[tag] || 0;
      
      // Use the minimum score for intersection (common tags)
      intersection += Math.min(score1, score2);
      
      // Use the maximum score for union (all tags)
      union += Math.max(score1, score2);
    }
    
    // Calculate weighted Jaccard similarity
    let similarity = union > 0 ? intersection / union : 0;
    
    // If no confidence scores available, fall back to regular Jaccard similarity
    if (intersection === 0 && union === 0) {
      const set1 = new Set(tags1);
      const set2 = new Set(tags2);
      similarity = helpers.jaccardSimilarity(set1, set2);
    }
    
    basicSimilarities[facet] = similarity;
    basicTagSimilarity += similarity * weight;
  }
  
  if (facetsWithTags === 0) {
    return 0;
  }
  
  // Calculate tag co-occurrence similarity
  let coOccurrenceSimilarity = 0;
  
  // Only calculate co-occurrence if both tracks have at least two facets with tags
  if (facetsWithTags >= 2) {
    // Get all facets with tags in both tracks
    const facetsWithData = Object.keys(facetWeights).filter(facet => 
      (track1.tags[facet] && track1.tags[facet].length > 0) && 
      (track2.tags[facet] && track2.tags[facet].length > 0)
    );
    
    if (facetsWithData.length >= 2) {
      // Build tag vectors across facets
      const tagVector1 = buildTagVector(track1, facetsWithData);
      const tagVector2 = buildTagVector(track2, facetsWithData);
      
      // Calculate cosine similarity between tag vectors
      const cosineSim = calculateCosineSimilarity(tagVector1, tagVector2);
      coOccurrenceSimilarity = cosineSim;
    }
  }
  
  // Combine basic tag similarity with co-occurrence similarity
  // Give more weight to co-occurrence as it captures more complex relationships
  const combinedSimilarity = (basicTagSimilarity * 0.4) + (coOccurrenceSimilarity * 0.6);
  
  return combinedSimilarity;
}

/**
 * Build a tag vector representation that preserves co-occurrence relationships
 * @param {Object} track - Track data
 * @param {Array} facets - Array of facets to include
 * @returns {Object} - Tag vector
 */
function buildTagVector(track, facets) {
  const tagVector = {};
  
  // First, collect all individual tags
  facets.forEach(facet => {
    const tags = track.tags[facet] || [];
    const scores = track.scores && track.scores[facet] ? track.scores[facet] : {};
    
    tags.forEach(tag => {
      // Use the tag's confidence score if available, otherwise 1
      const confidence = scores[tag] || 1;
      tagVector[`${facet}:${tag}`] = confidence;
    });
  });
  
  // Then, add co-occurrence pairs across different facets
  for (let i = 0; i < facets.length; i++) {
    const facet1 = facets[i];
    const tags1 = track.tags[facet1] || [];
    
    for (let j = i + 1; j < facets.length; j++) {
      const facet2 = facets[j];
      const tags2 = track.tags[facet2] || [];
      
      // Create co-occurrence features for each pair of tags across different facets
      tags1.forEach(tag1 => {
        tags2.forEach(tag2 => {
          const key = `${facet1}:${tag1}|${facet2}:${tag2}`;
          
          // For co-occurrence, we can use the product of confidence scores
          const confidence1 = (track.scores && track.scores[facet1]) ? (track.scores[facet1][tag1] || 1) : 1;
          const confidence2 = (track.scores && track.scores[facet2]) ? (track.scores[facet2][tag2] || 1) : 1;
          
          tagVector[key] = confidence1 * confidence2;
        });
      });
    }
  }
  
  return tagVector;
}

/**
 * Calculate cosine similarity between two vectors
 * @param {Object} vector1 - First vector
 * @param {Object} vector2 - Second vector
 * @returns {number} - Cosine similarity (0-1)
 */
function calculateCosineSimilarity(vector1, vector2) {
  // Get all unique keys
  const allKeys = new Set([...Object.keys(vector1), ...Object.keys(vector2)]);
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  // Calculate dot product and magnitudes
  allKeys.forEach(key => {
    const value1 = vector1[key] || 0;
    const value2 = vector2[key] || 0;
    
    dotProduct += value1 * value2;
    magnitude1 += value1 * value1;
    magnitude2 += value2 * value2;
  });
  
  // Calculate cosine similarity
  const magnitudeProduct = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
  
  if (magnitudeProduct === 0) {
    return 0;
  }
  
  return dotProduct / magnitudeProduct;
}

/**
 * Calculate audio similarity between two tracks based on audio features
 * @param {Object} track1 - First track data
 * @param {Object} track2 - Second track data
 * @returns {number} Similarity score (0-1)
 */
function calculateAudioSimilarity(track1, track2) {
  if (!track1.features || !track2.features) {
    return 0;
  }
  
  // Define feature weights
  const featureWeights = {
    'danceability': 0.15,
    'energy': 0.15,
    'acousticness': 0.1,
    'instrumentalness': 0.1,
    'valence': 0.15,
    'tempo': 0.1,
    'loudness': 0.05,
    'speechiness': 0.1,
    'liveness': 0.05,
    'mode': 0.05
  };
  
  // Calculate weighted Euclidean distance
  let sumSquaredDiff = 0;
  let totalWeight = 0;
  
  for (const [feature, weight] of Object.entries(featureWeights)) {
    // Skip if either track doesn't have this feature
    if (
      !track1.features.hasOwnProperty(feature) || 
      !track2.features.hasOwnProperty(feature) || 
      track1.features[feature] === null ||
      track2.features[feature] === null
    ) {
      continue;
    }
    
    // Normalize tempo which has a larger range
    if (feature === 'tempo') {
      const value1 = helpers.normalize(track1.features[feature], 40, 200);
      const value2 = helpers.normalize(track2.features[feature], 40, 200);
      const diff = value1 - value2;
      sumSquaredDiff += (diff * diff) * weight;
    }
    // Normalize loudness which is usually negative
    else if (feature === 'loudness') {
      const value1 = helpers.normalize(track1.features[feature], -60, 0);
      const value2 = helpers.normalize(track2.features[feature], -60, 0);
      const diff = value1 - value2;
      sumSquaredDiff += (diff * diff) * weight;
    }
    // Handle binary features
    else if (feature === 'mode') {
      const diff = track1.features[feature] === track2.features[feature] ? 0 : 1;
      sumSquaredDiff += diff * weight;
    }
    // All other features assumed to be in 0-1 range
    else {
      const diff = track1.features[feature] - track2.features[feature];
      sumSquaredDiff += (diff * diff) * weight;
    }
    
    totalWeight += weight;
  }
  
  // If no features were compared, return 0
  if (totalWeight === 0) {
    return 0;
  }
  
  // Calculate weighted distance (0-1 range)
  const distance = Math.sqrt(sumSquaredDiff / totalWeight);
  
  // Convert distance to similarity (1 is most similar)
  return 1 - Math.min(distance, 1);
}

/**
 * Get detailed breakdown of similarity between two tracks
 * @param {Object} track1 - First track data
 * @param {Object} track2 - Second track data
 * @returns {Object} Detailed similarity breakdown
 */
function getSimilarityBreakdown(track1, track2) {
  const result = {
    semantic: {
      overall: 0,
      facets: {},
      coOccurrence: {
        score: 0,
        matchingPatterns: []
      }
    },
    audio: {
      overall: 0,
      features: {}
    }
  };
  
  // Calculate semantic similarity breakdown
  if (track1.tags && track2.tags) {
    const facetWeights = {
      'Emotional_Tone': 0.4,
      'Thematic_Content': 0.3,
      'Narrative_Structure': 0.1,
      'Lyrical_Style': 0.2
    };
    
    let totalSemanticSimilarity = 0;
    let totalSemanticWeight = 0;
    
    // Get facets with tags in both tracks
    const facetsWithData = Object.keys(facetWeights).filter(facet => 
      (track1.tags[facet] && track1.tags[facet].length > 0) && 
      (track2.tags[facet] && track2.tags[facet].length > 0)
    );
    
    // Calculate basic tag similarity for each facet
    for (const [facet, weight] of Object.entries(facetWeights)) {
      const tags1 = track1.tags[facet] || [];
      const tags2 = track2.tags[facet] || [];
      
      if (tags1.length === 0 || tags2.length === 0) {
        result.semantic.facets[facet] = {
          similarity: 0,
          weight,
          matching_tags: []
        };
        continue;
      }
      
      // Get confidence scores for tags
      const scores1 = track1.scores && track1.scores[facet] ? track1.scores[facet] : {};
      const scores2 = track2.scores && track2.scores[facet] ? track2.scores[facet] : {};
      
      // Find matching tags with their confidence scores
      const matchingTags = [];
      const matchingScores = {};
      
      for (const tag of tags1) {
        if (tags2.includes(tag)) {
          matchingTags.push(tag);
          const score1 = scores1[tag] || 1;
          const score2 = scores2[tag] || 1;
          matchingScores[tag] = (score1 + score2) / 2; // Average confidence
        }
      }
      
      // Calculate similarity using confidence-weighted Jaccard if scores are available
      let similarity;
      if (Object.keys(scores1).length > 0 && Object.keys(scores2).length > 0) {
        let intersection = 0;
        let union = 0;
        
        // Create a set of all unique tags
        const allTags = new Set([...tags1, ...tags2]);
        
        for (const tag of allTags) {
          const score1 = scores1[tag] || 0;
          const score2 = scores2[tag] || 0;
          
          // Use the minimum score for intersection (common tags)
          intersection += Math.min(score1, score2);
          
          // Use the maximum score for union (all tags)
          union += Math.max(score1, score2);
        }
        
        similarity = union > 0 ? intersection / union : 0;
      } else {
        // Fall back to regular Jaccard similarity
        const set1 = new Set(tags1);
        const set2 = new Set(tags2);
        similarity = helpers.jaccardSimilarity(set1, set2);
      }
      
      result.semantic.facets[facet] = {
        similarity,
        weight,
        matching_tags: matchingTags,
        matching_scores: matchingScores,
        tags1: Array.from(new Set(tags1)),
        tags2: Array.from(new Set(tags2))
      };
      
      totalSemanticSimilarity += similarity * weight;
      totalSemanticWeight += weight;
    }
    
    // Calculate tag co-occurrence similarity if we have enough facets
    if (facetsWithData.length >= 2) {
      // Build tag vectors
      const tagVector1 = buildTagVector(track1, facetsWithData);
      const tagVector2 = buildTagVector(track2, facetsWithData);
      
      // Find matching co-occurrence patterns
      const matchingPatterns = [];
      
      Object.keys(tagVector1).forEach(key => {
        if (key.includes('|') && tagVector2[key]) {
          // This is a co-occurrence pattern that exists in both tracks
          const [part1, part2] = key.split('|');
          const [facet1, tag1] = part1.split(':');
          const [facet2, tag2] = part2.split(':');
          
          matchingPatterns.push({
            pattern: `${tag1} (${facet1}) with ${tag2} (${facet2})`,
            confidence1: tagVector1[key],
            confidence2: tagVector2[key],
            combined: (tagVector1[key] + tagVector2[key]) / 2
          });
        }
      });
      
      // Sort patterns by combined confidence
      matchingPatterns.sort((a, b) => b.combined - a.combined);
      
      // Calculate cosine similarity
      const cosineSim = calculateCosineSimilarity(tagVector1, tagVector2);
      
      result.semantic.coOccurrence = {
        score: cosineSim,
        matchingPatterns: matchingPatterns.slice(0, 5) // Top 5 patterns
      };
      
      // Combine basic similarity with co-occurrence
      const basicSimilarity = totalSemanticWeight > 0 ? totalSemanticSimilarity / totalSemanticWeight : 0;
      result.semantic.overall = (basicSimilarity * 0.4) + (cosineSim * 0.6);
    } else {
      // If we don't have enough facets, just use the basic similarity
      result.semantic.overall = totalSemanticWeight > 0 ? totalSemanticSimilarity / totalSemanticWeight : 0;
    }
  }
  
  // Calculate audio similarity breakdown
  if (track1.features && track2.features) {
    const featureWeights = {
      'danceability': 0.15,
      'energy': 0.15,
      'acousticness': 0.1,
      'instrumentalness': 0.1,
      'valence': 0.15,
      'tempo': 0.1,
      'loudness': 0.05,
      'speechiness': 0.1,
      'liveness': 0.05,
      'mode': 0.05
    };
    
    let sumSquaredDiff = 0;
    let totalAudioWeight = 0;
    
    for (const [feature, weight] of Object.entries(featureWeights)) {
      if (
        !track1.features.hasOwnProperty(feature) || 
        !track2.features.hasOwnProperty(feature) || 
        track1.features[feature] === null ||
        track2.features[feature] === null
      ) {
        result.audio.features[feature] = {
          similarity: 0,
          weight,
          value1: null,
          value2: null
        };
        continue;
      }
      
      let value1 = track1.features[feature];
      let value2 = track2.features[feature];
      let normalizedValue1 = value1;
      let normalizedValue2 = value2;
      let featureSimilarity = 0;
      
      // Calculate specific feature similarity
      if (feature === 'tempo') {
        normalizedValue1 = helpers.normalize(value1, 40, 200);
        normalizedValue2 = helpers.normalize(value2, 40, 200);
        const diff = normalizedValue1 - normalizedValue2;
        featureSimilarity = 1 - Math.min(Math.abs(diff), 1);
        sumSquaredDiff += (diff * diff) * weight;
      } else if (feature === 'loudness') {
        normalizedValue1 = helpers.normalize(value1, -60, 0);
        normalizedValue2 = helpers.normalize(value2, -60, 0);
        const diff = normalizedValue1 - normalizedValue2;
        featureSimilarity = 1 - Math.min(Math.abs(diff), 1);
        sumSquaredDiff += (diff * diff) * weight;
      } else if (feature === 'mode') {
        const diff = value1 === value2 ? 0 : 1;
        featureSimilarity = value1 === value2 ? 1 : 0;
        sumSquaredDiff += diff * weight;
      } else {
        const diff = value1 - value2;
        featureSimilarity = 1 - Math.min(Math.abs(diff), 1);
        sumSquaredDiff += (diff * diff) * weight;
      }
      
      result.audio.features[feature] = {
        similarity: featureSimilarity,
        weight,
        value1,
        value2,
        normalized1: normalizedValue1,
        normalized2: normalizedValue2
      };
      
      totalAudioWeight += weight;
    }
    
    if (totalAudioWeight > 0) {
      const distance = Math.sqrt(sumSquaredDiff / totalAudioWeight);
      result.audio.overall = 1 - Math.min(distance, 1);
    }
  }
  
  return result;
}

/**
 * Find similar tracks to a specific track
 * @param {string} trackId - ID of the track to find similar tracks for
 * @param {Object} options - Options for similarity calculation
 * @returns {Array} Array of similar tracks
 */
function findSimilarTracks(trackId, options = {}) {
  // Set default options
  const {
    limit = 20,
    similarityType = 'combined',
    semanticWeight = 0.5,
    audioWeight = 0.5,
    minSimilarity = 0.1
  } = options;
  
  // Get source track
  const sourceTrack = getTrackById(trackId);
  if (!sourceTrack) {
    throw new Error(`Track with ID ${trackId} not found`);
  }
  
  // Get all tracks
  const allTracks = getAllTracks();
  
  // Calculate similarity scores
  const similarTracks = [];
  for (const [candidateId, candidateTrack] of allTracks.entries()) {
    // Skip the source track
    if (candidateId === trackId) {
      continue;
    }
    
    // Calculate similarity
    const similarity = calculateTrackSimilarity(
      trackId,
      candidateId,
      similarityType,
      semanticWeight,
      audioWeight
    );
    
    // Skip tracks below minimum similarity
    if (similarity < minSimilarity) {
      continue;
    }
    
    // Add to results
    similarTracks.push({
      track_id: candidateId,
      track_name: candidateTrack.track_name || 'Unknown Track',
      artist_name: candidateTrack.artist_name || 'Unknown Artist',
      similarity
    });
  }
  
  // Sort by similarity (highest first)
  similarTracks.sort((a, b) => b.similarity - a.similarity);
  
  // Return limited number of results
  return similarTracks.slice(0, limit);
}

module.exports = {
  findSimilarTracks,
  calculateTrackSimilarity,
  calculateSemanticSimilarity,
  calculateAudioSimilarity,
  getSimilarityBreakdown
};