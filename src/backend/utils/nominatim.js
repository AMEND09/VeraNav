const axios = require('axios');

// Nominatim API configuration
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'VeraNavigator/1.0 (Accessibility Navigation App)';

// Rate limiting: Nominatim requires max 1 request per second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second

/**
 * Delay to respect Nominatim rate limits
 */
async function respectRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  lastRequestTime = Date.now();
}

/**
 * Geocode an address to coordinates
 * @param {string} address - Address to geocode
 * @returns {Promise<Object>} - { lat, lon, display_name, type }
 */
async function geocodeAddress(address) {
  await respectRateLimit();
  
  try {
    const response = await axios.get(`${NOMINATIM_BASE_URL}/search`, {
      params: {
        q: address,
        format: 'json',
        addressdetails: 1,
        limit: 1,
      },
      headers: {
        'User-Agent': USER_AGENT,
      },
    });
    
    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        display_name: result.display_name,
        type: result.type,
        importance: result.importance,
      };
    }
    
    throw new Error('Address not found');
  } catch (error) {
    console.error('Geocoding error:', error.message);
    throw new Error(`Failed to geocode address: ${error.message}`);
  }
}

/**
 * Reverse geocode coordinates to an address
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} - Address details
 */
async function reverseGeocode(lat, lon) {
  await respectRateLimit();
  
  try {
    const response = await axios.get(`${NOMINATIM_BASE_URL}/reverse`, {
      params: {
        lat,
        lon,
        format: 'json',
        addressdetails: 1,
      },
      headers: {
        'User-Agent': USER_AGENT,
      },
    });
    
    if (response.data) {
      return {
        display_name: response.data.display_name,
        address: response.data.address,
      };
    }
    
    throw new Error('Location not found');
  } catch (error) {
    console.error('Reverse geocoding error:', error.message);
    throw new Error(`Failed to reverse geocode: ${error.message}`);
  }
}

/**
 * Search for places matching a query
 * @param {string} query - Search query
 * @param {Object} options - Search options (limit, viewbox, bounded)
 * @returns {Promise<Array>} - Array of matching places
 */
async function searchPlaces(query, options = {}) {
  await respectRateLimit();
  
  try {
    const params = {
      q: query,
      format: 'json',
      addressdetails: 1,
      limit: options.limit || 5,
    };
    
    // Add viewbox if provided (limit search to specific area)
    if (options.viewbox) {
      params.viewbox = options.viewbox;
      params.bounded = options.bounded ? 1 : 0;
    }
    
    const response = await axios.get(`${NOMINATIM_BASE_URL}/search`, {
      params,
      headers: {
        'User-Agent': USER_AGENT,
      },
    });
    
    return response.data.map(result => ({
      display_name: result.display_name,
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      type: result.type,
      importance: result.importance,
      address: result.address,
    }));
  } catch (error) {
    console.error('Place search error:', error.message);
    throw new Error(`Failed to search places: ${error.message}`);
  }
}

/**
 * Get nearby points of interest
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} radius - Search radius in meters
 * @returns {Promise<Array>} - Array of nearby POIs
 */
async function getNearbyPOIs(lat, lon, radius = 500) {
  await respectRateLimit();
  
  try {
    // Calculate bounding box (approximate)
    const latOffset = radius / 111000; // ~111km per degree latitude
    const lonOffset = radius / (111000 * Math.cos(lat * Math.PI / 180));
    
    const viewbox = [
      lon - lonOffset,
      lat + latOffset,
      lon + lonOffset,
      lat - latOffset,
    ].join(',');
    
    const response = await axios.get(`${NOMINATIM_BASE_URL}/search`, {
      params: {
        format: 'json',
        addressdetails: 1,
        limit: 20,
        viewbox,
        bounded: 1,
      },
      headers: {
        'User-Agent': USER_AGENT,
      },
    });
    
    return response.data.map(result => ({
      display_name: result.display_name,
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      type: result.type,
      category: result.category,
      distance: calculateDistance(lat, lon, parseFloat(result.lat), parseFloat(result.lon)),
    }));
  } catch (error) {
    console.error('Nearby POI search error:', error.message);
    throw new Error(`Failed to find nearby POIs: ${error.message}`);
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * @param {number} lat1 - Latitude 1
 * @param {number} lon1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lon2 - Longitude 2
 * @returns {number} - Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

module.exports = {
  geocodeAddress,
  reverseGeocode,
  searchPlaces,
  getNearbyPOIs,
  calculateDistance,
};
