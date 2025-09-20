/**
 * Helper utilities for the ResoNote API
 */

/**
 * Calculate the Jaccard similarity between two sets
 * @param {Set} set1 - First set
 * @param {Set} set2 - Second set
 * @returns {number} - Similarity score (0-1)
 */
function jaccardSimilarity(set1, set2) {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Normalize a value to a range between 0 and 1
 * @param {number} value - Value to normalize
 * @param {number} min - Minimum value in original range
 * @param {number} max - Maximum value in original range
 * @returns {number} - Normalized value (0-1)
 */
function normalize(value, min, max) {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

/**
 * Calculate the Euclidean distance between two vectors
 * @param {Array<number>} vector1 - First vector
 * @param {Array<number>} vector2 - Second vector
 * @returns {number} - Distance between vectors
 */
function euclideanDistance(vector1, vector2) {
  if (vector1.length !== vector2.length) {
    throw new Error('Vectors must have the same dimension');
  }
  
  return Math.sqrt(
    vector1.reduce((sum, val, i) => {
      const diff = val - vector2[i];
      return sum + diff * diff;
    }, 0)
  );
}

/**
 * Convert Euclidean distance to similarity (0-1 scale)
 * @param {number} distance - Euclidean distance
 * @param {number} maxDistance - Maximum possible distance
 * @returns {number} - Similarity score (0-1)
 */
function distanceToSimilarity(distance, maxDistance) {
  return 1 - Math.min(distance / maxDistance, 1);
}

/**
 * Generate a random string
 * @param {number} length - Length of the string
 * @returns {string} - Random string
 */
function generateRandomString(length = 10) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
}

module.exports = {
  jaccardSimilarity,
  normalize,
  euclideanDistance,
  distanceToSimilarity,
  generateRandomString
};