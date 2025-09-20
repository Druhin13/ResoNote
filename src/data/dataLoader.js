const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);

// In-memory cache for our data
let tracksWithTags = new Map();
let tracksWithFeatures = new Map();
let allTracks = new Map();
let dataLoaded = false;

/**
 * Load data from JSONL file
 * @param {string} filePath - Path to the JSONL file
 * @returns {Promise<Map>} - Map of parsed objects
 */
async function loadJsonlFile(filePath) {
  const result = new Map();
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    try {
      const data = JSON.parse(line);
      if (data.track_id) {
        result.set(data.track_id, data);
      }
    } catch (err) {
      console.error(`Error parsing line: ${line}`);
    }
  }
  
  return result;
}

/**
 * Load data from JSON file
 * @param {string} filePath - Path to the JSON file
 * @returns {Promise<Map>} - Map of parsed objects
 */
async function loadJsonFile(filePath) {
  const result = new Map();
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const data = JSON.parse(await readFileAsync(filePath, 'utf8'));
  
  if (Array.isArray(data)) {
    data.forEach(item => {
      if (item.track_id) {
        result.set(item.track_id, item);
      }
    });
  }
  
  return result;
}

/**
 * Merge track data from both sources
 * @param {Map} tagsMap - Map of tracks with tags
 * @param {Map} featuresMap - Map of tracks with features
 * @returns {Map} - Merged tracks map
 */
function mergeTracks(tagsMap, featuresMap) {
  const result = new Map();
  
  // Process tracks with tags
  for (const [trackId, trackData] of tagsMap.entries()) {
    result.set(trackId, { 
      track_id: trackId,
      tags: trackData.tags || {},
      scores: trackData.scores || {},
      features: null,
      lyrics: null
    });
  }
  
  // Add features and lyrics where available
  for (const [trackId, trackData] of featuresMap.entries()) {
    const track = result.get(trackId) || { 
      track_id: trackId,
      tags: {},
      scores: {},
    };
    
    // Extract audio features
    const features = {};
    const audioFeatureKeys = [
      'acousticness', 'danceability', 'duration_ms', 'energy', 
      'instrumentalness', 'key', 'liveness', 'loudness', 
      'mode', 'speechiness', 'tempo', 'time_signature', 'valence', 'popularity'
    ];
    
    audioFeatureKeys.forEach(key => {
      if (key in trackData) {
        features[key] = trackData[key];
      }
    });
    
    // Update track with features and other data
    track.features = features;
    track.lyrics = trackData.lyrics || null;
    track.artist_name = trackData.artist_name || null;
    track.track_name = trackData.track_name || null;
    
    result.set(trackId, track);
  }
  
  return result;
}

/**
 * Main function to load all data
 */
async function loadData() {
  try {
    console.log('Loading track data...');
    
    // Load tracks with tags
    tracksWithTags = await loadJsonlFile(path.join(__dirname, '../../database/all_tracks.jsonl'));
    console.log(`Loaded ${tracksWithTags.size} tracks with tags`);
    
    // Load tracks with features
    tracksWithFeatures = await loadJsonFile(path.join(__dirname, '../../database/audio_features_and_lyrics_cleaned.json'));
    console.log(`Loaded ${tracksWithFeatures.size} tracks with features`);
    
    // Merge tracks
    allTracks = mergeTracks(tracksWithTags, tracksWithFeatures);
    console.log(`Total unique tracks: ${allTracks.size}`);
    
    dataLoaded = true;
    console.log('Data loading complete');
  } catch (error) {
    console.error('Error loading data:', error);
    throw error;
  }
}

/**
 * Get all loaded tracks
 */
function getAllTracks() {
  if (!dataLoaded) {
    throw new Error('Data not loaded yet');
  }
  return allTracks;
}

/**
 * Get track by ID
 * @param {string} trackId 
 * @returns {Object|null} track data or null if not found
 */
function getTrackById(trackId) {
  if (!dataLoaded) {
    throw new Error('Data not loaded yet');
  }
  return allTracks.get(trackId) || null;
}

/**
 * Get all available facets
 * @returns {Array} array of facet names
 */
function getFacets() {
  if (!dataLoaded) {
    throw new Error('Data not loaded yet');
  }
  
  // Return just the facet names
  return [
    'Emotional_Tone',
    'Thematic_Content',
    'Narrative_Structure',
    'Lyrical_Style'
  ];
}

/**
 * Get all tags across all facets or for a specific facet
 * @param {string} [facetName] - Optional facet name to filter tags
 * @returns {Object|Array} - Tags organized by facet or as a simple array for a specific facet
 */
function getTags(facetName = null) {
  if (!dataLoaded) {
    throw new Error('Data not loaded yet');
  }
  
  // Initialize collection of unique tags by facet
  const tagsByFacet = {
    Emotional_Tone: new Set(),
    Thematic_Content: new Set(),
    Narrative_Structure: new Set(),
    Lyrical_Style: new Set()
  };
  
  // If a specific facet is requested, check if it's valid
  if (facetName && !tagsByFacet.hasOwnProperty(facetName)) {
    throw new Error(`Invalid facet name: ${facetName}. Valid facets are: ${Object.keys(tagsByFacet).join(', ')}`);
  }
  
  // Collect tags from all tracks
  for (const track of allTracks.values()) {
    if (track.tags) {
      Object.entries(track.tags).forEach(([facet, tags]) => {
        if (facet in tagsByFacet && Array.isArray(tags)) {
          tags.forEach(tag => tagsByFacet[facet].add(tag));
        }
      });
    }
  }
  
  // If a specific facet was requested, return just those tags as an array
  if (facetName) {
    return Array.from(tagsByFacet[facetName]).sort();
  }
  
  // Otherwise, convert Sets to sorted Arrays for all facets
  return Object.fromEntries(
    Object.entries(tagsByFacet).map(([key, value]) => [key, Array.from(value).sort()])
  );
}

module.exports = {
  loadData,
  getAllTracks,
  getTrackById,
  getFacets,
  getTags
};