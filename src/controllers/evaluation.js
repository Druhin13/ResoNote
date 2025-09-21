const { getTrackById } = require('../data/dataLoader');
const similarityService = require('../services/similarityService');

const playlistEvaluation = (req, res) => {
  const { seedTrackIds = [], playlistTrackIds = [], similarityType = 'combined', semanticWeight = 0.5, audioWeight = 0.5 } = req.body;
  if (!Array.isArray(seedTrackIds) || !Array.isArray(playlistTrackIds) || seedTrackIds.length === 0 || playlistTrackIds.length === 0) {
    return res.status(400).json({ success: false, message: 'Both seedTrackIds and playlistTrackIds are required and must not be empty' });
  }
  
  // Intra-list diversity (ILD): average pairwise dissimilarity
  let totalDiversity = 0, pairs = 0;
  for (let i = 0; i < playlistTrackIds.length; i++) {
    for (let j = i + 1; j < playlistTrackIds.length; j++) {
      const sim = similarityService.calculateTrackSimilarity(
        playlistTrackIds[i], playlistTrackIds[j], similarityType, semanticWeight, audioWeight
      );
      totalDiversity += (1 - sim);
      pairs += 1;
    }
  }
  const ild = pairs > 0 ? totalDiversity / pairs : null;

  // Average similarity to seed tracks
  let avgSim = 0, totalSim = 0, simCount = 0;
  for (const pt of playlistTrackIds) {
    for (const st of seedTrackIds) {
      const sim = similarityService.calculateTrackSimilarity(
        pt, st, similarityType, semanticWeight, audioWeight
      );
      totalSim += sim;
      simCount += 1;
    }
  }
  avgSim = simCount > 0 ? totalSim / simCount : null;

  // Coverage of feature space (dummy: number of unique tags)
  let uniqueTags = new Set();
  playlistTrackIds.forEach(ptId => {
    const track = getTrackById(ptId);
    if (track && track.tags) {
      Object.values(track.tags).forEach(tagsArr => tagsArr.forEach(t => uniqueTags.add(t)));
    }
  });
  const tagCoverage = uniqueTags.size;

  res.json({
    success: true,
    evaluation: {
      intraListDiversity: ild,
      avgSimilarityToSeeds: avgSim,
      tagCoverage
    }
  });
};

const crossValidate = (req, res) => {
  const { trackIds = [], k = 5, similarityType = 'combined', semanticWeight = 0.5, audioWeight = 0.5 } = req.body;
  if (!Array.isArray(trackIds) || trackIds.length < k) {
    return res.status(400).json({ success: false, message: 'Not enough tracks for cross-validation' });
  }
  // Simple k-fold cross-validation: each fold is a seed, others are candidates
  const folds = [];
  for (let i = 0; i < k; i++) {
    const foldSeeds = [trackIds[i]];
    const foldCandidates = trackIds.filter((_, idx) => idx !== i);
    // For each candidate, compute similarity to seed
    const similarities = foldCandidates.map(cid => similarityService.calculateTrackSimilarity(
      foldSeeds[0], cid, similarityType, semanticWeight, audioWeight
    ));
    folds.push({
      seed: foldSeeds[0],
      candidates: foldCandidates,
      similarities
    });
  }
  // Example metrics: mean similarity per fold
  const meanSimilarities = folds.map(f => f.similarities.reduce((a, b) => a + b, 0) / f.similarities.length);

  res.json({
    success: true,
    crossValidation: {
      folds,
      meanSimilarities
    }
  });
};

module.exports = {
  playlistEvaluation,
  crossValidate
};