const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { promisify } = require('util');
const Fuse = require('fuse.js');

const readFileAsync = promisify(fs.readFile);

// In-memory cache for our data
let tracksWithTags = new Map();
let tracksWithFeatures = new Map();
let allTracks = new Map();
let dataLoaded = false;
let searchIndex = null;

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
 * Initialize search index for tracks
 */
function initSearchIndex() {
  if (!dataLoaded || searchIndex) return;
  
  // Prepare search documents
  const searchDocuments = [];
  
  for (const [trackId, track] of allTracks.entries()) {
    if (!track.track_name) continue;
    
    searchDocuments.push({
      track_id: trackId,
      track_name: track.track_name || '',
      artist_name: track.artist_name || '',
      lyrics: track.lyrics || ''
    });
  }
  
  // Configure Fuse.js options
  const options = {
    includeScore: true,
    shouldSort: true,
    threshold: 0.4,
    location: 0,
    distance: 100,
    maxPatternLength: 32,
    minMatchCharLength: 2,
    keys: [
      { name: 'track_name', weight: 0.7 },
      { name: 'artist_name', weight: 0.2 },
      { name: 'lyrics', weight: 0.1 }
    ]
  };
  
  searchIndex = new Fuse(searchDocuments, options);
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
    
    // Initialize search index
    initSearchIndex();
    
    console.log('Data loading complete');
  } catch (error) {
    console.error('Error loading data:', error);
    throw error;
  }
}

/**
 * Get all loaded tracks
 * @returns {Map} - Map of all tracks
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
 * Get a random track from the dataset
 * @returns {Object} A random track
 */
function getRandomTrack() {
  if (!dataLoaded) {
    throw new Error('Data not loaded yet');
  }
  
  const trackIds = Array.from(allTracks.keys());
  if (trackIds.length === 0) {
    throw new Error('No tracks available');
  }
  
  const randomIndex = Math.floor(Math.random() * trackIds.length);
  const randomTrackId = trackIds[randomIndex];
  const track = allTracks.get(randomTrackId);
  
  return {
    track_id: randomTrackId,
    track_name: track.track_name || 'Unknown Track',
    artist_name: track.artist_name || 'Unknown Artist'
  };
}

/**
 * Safely convert a value to lowercase string
 * @param {*} value - The value to convert
 * @returns {string} The lowercase string
 */
function safeToLowerCase(value) {
  // Check if value is a string
  if (typeof value === 'string') {
    return value.toLowerCase();
  } 
  // If value is null or undefined, return empty string
  if (value == null) {
    return '';
  }
  // Otherwise try to convert to string
  try {
    return String(value).toLowerCase();
  } catch (e) {
    return '';
  }
}

/**
 * Check for exact matches in track data
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results to return
 * @returns {Array} - Array of exact matching tracks
 */
function findExactMatches(query, limit = 10) {
  const exactMatches = [];
  const queryLower = query.toLowerCase();
  
  for (const [trackId, track] of allTracks.entries()) {
    const trackName = safeToLowerCase(track.track_name);
    const artistName = safeToLowerCase(track.artist_name);
    
    // Check for exact matches in track name
    if (trackName === queryLower || trackName.includes(queryLower)) {
      exactMatches.push({
        track_id: trackId,
        track_name: track.track_name || 'Unknown Track',
        artist_name: track.artist_name || 'Unknown Artist',
        exactMatch: true
      });
      
      if (exactMatches.length >= limit) {
        return exactMatches;
      }
    }
    
    // Check for exact matches in artist name
    if (artistName === queryLower || artistName.includes(queryLower)) {
      if (!exactMatches.some(m => m.track_id === trackId)) {
        exactMatches.push({
          track_id: trackId,
          track_name: track.track_name || 'Unknown Track',
          artist_name: track.artist_name || 'Unknown Artist',
          exactMatch: true
        });
        
        if (exactMatches.length >= limit) {
          return exactMatches;
        }
      }
    }
  }
  
  return exactMatches;
}

/**
 * Search for tracks based on track name, artist name, and lyrics
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results to return
 * @returns {Array} - Array of matching tracks
 */
function searchTracks(query, limit = 10) {
  if (!dataLoaded) {
    throw new Error('Data not loaded yet');
  }
  
  if (!query || query.trim() === '') {
    return [];
  }
  
  query = query.trim();
  
  // First, check for exact matches
  const exactMatches = findExactMatches(query, limit);
  if (exactMatches.length >= limit) {
    return exactMatches;
  }
  
  // If we still need more results, use fuzzy search
  if (!searchIndex) {
    initSearchIndex();
  }
  
  const fuzzyResults = searchIndex.search(query);
  
  // Combine exact matches with fuzzy search results
  const exactMatchIds = new Set(exactMatches.map(match => match.track_id));
  const remainingLimit = limit - exactMatches.length;
  
  const fuzzyMatches = fuzzyResults
    .filter(result => !exactMatchIds.has(result.item.track_id))
    .slice(0, remainingLimit)
    .map(result => ({
      track_id: result.item.track_id,
      track_name: result.item.track_name,
      artist_name: result.item.artist_name,
      exactMatch: false
    }));
  
  return [...exactMatches, ...fuzzyMatches];
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
  getRandomTrack,
  searchTracks,
  getFacets,
  getTags
};