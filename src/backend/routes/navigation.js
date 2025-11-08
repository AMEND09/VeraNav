const express = require('express');
const router = express.Router();
const axios = require('axios');

// Import utilities
const { getRouteWithAI } = require('../utils/ai');
const { 
  geocodeAddress, 
  reverseGeocode, 
  searchPlaces, 
  getNearbyPOIs,
  calculateDistance 
} = require('../utils/nominatim');

/**
 * Get directions from current location to destination
 * Uses Nominatim for place search and AI for place selection
 */
router.post('/directions', async (req, res) => {
  try {
    const { start, destination, userQuery } = req.body;
    
    if (!start || !destination) {
      return res.status(400).json({ error: 'Start and destination are required' });
    }

    // Parse start coordinates (can be "lat,lon" string or address)
    let startCoords;
    if (start.includes(',')) {
      const [lat, lon] = start.split(',').map(s => parseFloat(s.trim()));
      startCoords = { lat, lon };
    } else {
      startCoords = await geocodeAddress(start);
    }
    
    // Search for destination places using Nominatim
    console.log(`Searching for places matching: "${destination}"`);
    
    const searchOptions = {
      limit: 10,
      viewbox: [
        startCoords.lon - 0.1,
        startCoords.lat + 0.1,
        startCoords.lon + 0.1,
        startCoords.lat - 0.1,
      ].join(','),
      bounded: false // Allow results outside viewbox but prioritize nearby
    };
    
    const places = await searchPlaces(destination, searchOptions);
    
    if (!places || places.length === 0) {
      return res.status(404).json({ 
        error: 'No places found',
        message: `Could not find any places matching "${destination}"` 
      });
    }
    
    // Calculate distances for all places
    const placesWithDistance = places.map(place => ({
      ...place,
      distance: calculateDistance(
        startCoords.lat,
        startCoords.lon,
        place.lat,
        place.lon
      )
    })).sort((a, b) => a.distance - b.distance);
    
    console.log(`Found ${placesWithDistance.length} places, using AI to select best match...`);
    
    // Use AI to select the best place
    const { selectBestPlace } = require('../utils/ai');
    const selectedPlace = await selectBestPlace(
      userQuery || destination,
      placesWithDistance.slice(0, 5), // Top 5 closest
      startCoords
    );
    
    console.log(`AI selected: ${selectedPlace.display_name}`);
    
    const destCoords = { lat: selectedPlace.lat, lon: selectedPlace.lon };
    
    console.log(`Route: ${startCoords.lat},${startCoords.lon} → ${destCoords.lat},${destCoords.lon}`);
    
    // Get route from OSRM (Open Source Routing Machine)
    const route = await getOSRMRoute(startCoords, destCoords);
    
    // Enhance with AI insights for accessibility
    const aiEnhancedRoute = await getRouteWithAI(
      `${startCoords.lat},${startCoords.lon}`, 
      selectedPlace.display_name, 
      route,
      startCoords,
      destCoords
    );
    
    // Add coordinates and place info to response for map display
    aiEnhancedRoute.startCoords = startCoords;
    aiEnhancedRoute.destCoords = destCoords;
    aiEnhancedRoute.destinationName = selectedPlace.display_name;
    aiEnhancedRoute.destinationType = selectedPlace.type;
    aiEnhancedRoute.aiConfirmation = selectedPlace.confirmationMessage;
    
    res.json({ 
      route: aiEnhancedRoute,
      selectedPlace: {
        name: selectedPlace.display_name,
        type: selectedPlace.type,
        distance: Math.round(selectedPlace.distance)
      }
    });
  } catch (error) {
    console.error('Error getting directions:', error);
    res.status(500).json({ 
      error: 'Failed to get directions',
      details: error.message 
    });
  }
});

/**
 * Get location suggestions for autocomplete
 */
router.get('/location-suggestions/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { lat, lon } = req.query; // Optional: prioritize results near user location
    
    if (!query || query.length < 3) {
      return res.json([]);
    }
    
    const options = { limit: 5 };
    
    // If user location provided, prioritize nearby results
    if (lat && lon) {
      const radius = 0.1; // ~11km
      options.viewbox = [
        parseFloat(lon) - radius,
        parseFloat(lat) + radius,
        parseFloat(lon) + radius,
        parseFloat(lat) - radius,
      ].join(',');
    }
    
    const places = await searchPlaces(query, options);
    
    res.json(places);
  } catch (error) {
    console.error('Error getting location suggestions:', error);
    res.status(500).json({ 
      error: 'Failed to get location suggestions',
      details: error.message 
    });
  }
});

/**
 * Get nearby points of interest
 */
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lon, radius } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    const pois = await getNearbyPOIs(
      parseFloat(lat), 
      parseFloat(lon), 
      radius ? parseInt(radius) : 500
    );
    
    res.json(pois);
  } catch (error) {
    console.error('Error getting nearby POIs:', error);
    res.status(500).json({ 
      error: 'Failed to get nearby POIs',
      details: error.message 
    });
  }
});

/**
 * Search for nearby places by type
 */
router.get('/search-nearby', async (req, res) => {
  try {
    const { lat, lon, type } = req.query;
    
    if (!lat || !lon || !type) {
      return res.status(400).json({ error: 'Latitude, longitude, and type are required' });
    }
    
    // Search for places matching the type
    const places = await searchPlaces(type, {
      limit: 5,
      viewbox: [
        parseFloat(lon) - 0.05,
        parseFloat(lat) + 0.05,
        parseFloat(lon) + 0.05,
        parseFloat(lat) - 0.05,
      ].join(','),
      bounded: true
    });
    
    // Calculate distances and sort by proximity
    const placesWithDistance = places.map(place => ({
      ...place,
      distance: calculateDistance(
        parseFloat(lat),
        parseFloat(lon),
        place.lat,
        place.lon
      )
    })).sort((a, b) => a.distance - b.distance);
    
    res.json({ places: placesWithDistance });
  } catch (error) {
    console.error('Error searching nearby places:', error);
    res.status(500).json({ 
      error: 'Failed to search nearby places',
      details: error.message 
    });
  }
});

/**
 * Reverse geocode coordinates to address
 */
router.get('/reverse-geocode', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    const address = await reverseGeocode(parseFloat(lat), parseFloat(lon));
    
    res.json(address);
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    res.status(500).json({ 
      error: 'Failed to reverse geocode',
      details: error.message 
    });
  }
});

/**
 * Analyze navigation situation with AI
 * Takes current step, detections, and optionally an image
 */
router.post('/analyze-situation', async (req, res) => {
  try {
    const { currentStep, detections, routeContext } = req.body;
    
    if (!currentStep) {
      return res.status(400).json({ error: 'Current step is required' });
    }
    
    const { analyzeNavigationFrame } = require('../utils/ai');
    
    const analysis = await analyzeNavigationFrame(
      detections || [],
      currentStep,
      routeContext || 'User is following walking directions',
      null // Could add image base64 in future
    );
    
    res.json({ analysis });
  } catch (error) {
    console.error('Error analyzing navigation situation:', error);
    res.status(500).json({ 
      error: 'Failed to analyze situation',
      details: error.message 
    });
  }
});

/**
 * Get general AI advice for queries that don't match specific tools
 */
router.post('/general-advice', async (req, res) => {
  try {
    const { query, isNavigating, hasLocation, currentStep } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const { getGeneralAdvice } = require('../utils/ai');
    
    const advice = await getGeneralAdvice(query, {
      isNavigating,
      hasLocation,
      currentStep
    });
    
    res.json({ advice });
  } catch (error) {
    console.error('Error getting general AI advice:', error);
    res.status(500).json({ 
      error: 'Failed to get advice',
      details: error.message 
    });
  }
});

/**
 * Get route from OSRM (walking directions)
 */
async function getOSRMRoute(start, destination) {
  const url = `https://router.project-osrm.org/route/v1/walking/${start.lon},${start.lat};${destination.lon},${destination.lat}`;
  
  try {
    const response = await axios.get(url, {
      params: {
        overview: 'full',
        steps: true,
        geometries: 'geojson',
        annotations: true,
      },
    });
    
    const data = response.data;
    
    if (data.code !== 'Ok') {
      throw new Error('No route found');
    }
    
    const route = data.routes[0];
    const leg = route.legs[0];
    
    // Convert to detailed step-by-step instructions
    const steps = leg.steps.map((step, index) => {
      const instruction = generateInstruction(step, index === leg.steps.length - 1);
      
      return {
        instruction,
        distance: Math.round(step.distance),
        duration: Math.round(step.duration),
        maneuver: {
          type: step.maneuver.type,
          modifier: step.maneuver.modifier,
          location: step.maneuver.location, // [lon, lat] for step completion detection
        },
        name: step.name || 'Unnamed road',
      };
    });
    
    return {
      geometry: route.geometry,
      distance: Math.round(route.distance),
      duration: Math.round(route.duration),
      steps,
    };
  } catch (error) {
    console.error('OSRM routing error:', error.message);
    throw new Error(`Failed to get route: ${error.message}`);
  }
}

/**
 * Generate human-readable instruction from OSRM maneuver
 */
function generateInstruction(step, isLast) {
  if (isLast) {
    return `Arrive at your destination`;
  }
  
  const maneuver = step.maneuver;
  const roadName = step.name || 'the road';
  const distance = Math.round(step.distance);
  
  let direction = '';
  
  switch (maneuver.type) {
    case 'depart':
      direction = `Head ${maneuver.modifier || 'straight'} on ${roadName}`;
      break;
    case 'turn':
      direction = `Turn ${maneuver.modifier} onto ${roadName}`;
      break;
    case 'merge':
      direction = `Merge ${maneuver.modifier || ''} onto ${roadName}`;
      break;
    case 'fork':
      direction = `Take the ${maneuver.modifier} fork onto ${roadName}`;
      break;
    case 'continue':
      direction = `Continue on ${roadName}`;
      break;
    case 'roundabout':
      direction = `At the roundabout, take exit onto ${roadName}`;
      break;
    case 'arrive':
      direction = `Arrive at your destination`;
      break;
    default:
      direction = `Continue on ${roadName}`;
  }
  
  return `${direction} for ${distance} meters`;
}

module.exports = router;