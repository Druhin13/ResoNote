/**
 * @file Utility functions for similarity and scoring calculations in ResoNote.
 * Includes set similarity, normalization, vector distance, distance→similarity mapping,
 * and random string generation. Pure functions without external side effects.
 */

/**
 * Calculate the Jaccard similarity between two sets.
 * Defined as |A ∩ B| / |A ∪ B| with graceful handling of empty unions.
 *
 * @template T
 * @param {Set<T>} set1 First set
 * @param {Set<T>} set2 Second set
 * @returns {number} Similarity in [0,1]
 * @example
 * jaccardSimilarity(new Set([1,2]), new Set([2,3])) // 0.333...
 */
function jaccardSimilarity(set1, set2) {
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Normalize a numeric value linearly to the range [0,1].
 * Returns 0.5 when min === max to avoid division by zero.
 *
 * @param {number} value Value to normalize
 * @param {number} min Domain minimum
 * @param {number} max Domain maximum
 * @returns {number} Normalized value in [0,1]
 * @example
 * normalize(120, 40, 200) // 0.5
 */
function normalize(value, min, max) {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

/**
 * Compute the Euclidean distance between two equal-length numeric vectors.
 *
 * @param {Array<number>} vector1 First vector
 * @param {Array<number>} vector2 Second vector
 * @returns {number} Non-negative distance
 * @throws {Error} If vectors have different dimensions
 * @example
 * euclideanDistance([0,0],[3,4]) // 5
 */
function euclideanDistance(vector1, vector2) {
  if (vector1.length !== vector2.length) {
    throw new Error("Vectors must have the same dimension");
  }

  return Math.sqrt(
    vector1.reduce((sum, val, i) => {
      const diff = val - vector2[i];
      return sum + diff * diff;
    }, 0)
  );
}

/**
 * Convert a Euclidean distance to a bounded similarity score in [0,1].
 * Similarity decreases linearly with distance and is floored at 0 when distance ≥ maxDistance.
 *
 * @param {number} distance Euclidean distance (≥ 0)
 * @param {number} maxDistance Maximum distance used for scaling (> 0)
 * @returns {number} Similarity in [0,1]
 * @example
 * distanceToSimilarity(0, 10) // 1
 * distanceToSimilarity(5, 10) // 0.5
 */
function distanceToSimilarity(distance, maxDistance) {
  return 1 - Math.min(distance / maxDistance, 1);
}

/**
 * Generate an alphanumeric random string.
 *
 * @param {number} [length=10] Desired output length
 * @returns {string} Random string of the requested length
 * @example
 * generateRandomString(8) // e.g., "aZ3kP0qR"
 */
function generateRandomString(length = 10) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

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
  generateRandomString,
};
