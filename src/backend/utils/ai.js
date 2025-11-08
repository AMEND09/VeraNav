const { GoogleGenAI } = require('@google/genai');

// Initialize Google Gen AI v2 with Gemini 2.5 Pro
let ai;
const modelName = 'gemini-2.5-flash';

if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  console.log('✓ Google Gen AI v2 (Gemini 2.5 Pro) initialized successfully');
} else {
  console.warn('⚠ GEMINI_API_KEY not found in environment variables');
}

// Default config for all requests
const defaultConfig = {
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 1024,
};

/**
 * Get route with AI-enhanced safety insights using Gemini 2.0 Flash
 */
async function getRouteWithAI(start, destination, route, startCoords, destCoords) {
  if (!ai) {
    // Return basic route if AI is not configured
    console.warn('AI not configured, returning basic route');
    return route;
  }
  
  try {
    const distanceKm = (route.distance / 1000).toFixed(2);
    const durationMin = Math.round(route.duration / 60);
    
    const prompt = `You are an expert navigation assistant for visually impaired users.
Analyze this walking route and provide accessibility and safety guidance.

Route Details:
- From: ${start}
- To: ${destination}
- Distance: ${distanceKm} km
- Estimated time: ${durationMin} minutes
- Number of steps: ${route.steps.length}

First 3 steps:
${route.steps.slice(0, 3).map((s, i) => `${i + 1}. ${s.instruction}`).join('\n')}

Provide a concise safety briefing (2-3 sentences) covering:
1. Key safety considerations for this route
2. Potential hazards (crossings, construction, busy areas)
3. Accessibility tips for visually impaired navigation

Keep response under 150 words and focus on actionable safety information.`;
    
    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];
    
    const response = await ai.models.generateContent({
      model: modelName,
      config: defaultConfig,
      contents,
    });
    
    const text = response.text || '';
    
    return {
      ...route,
      aiInsights: text,
      safetyNotes: text,
      enhanced: true,
    };
  } catch (error) {
    console.error('Error with AI route enhancement:', error.message);
    // Return basic route if AI fails
    return {
      ...route,
      aiInsights: null,
      safetyNotes: 'Please proceed carefully and be aware of your surroundings.',
      enhanced: false,
    };
  }
}

/**
 * Process speech query with AI and return structured intent JSON
 */
async function processSpeechQuery(query) {
  if (!ai) {
    return {
      intent: null,
      response: `I received your request: ${query}. Please configure the GEMINI_API_KEY for full functionality.`
    };
  }
  
  try {
    const prompt = `You are a navigation assistant for visually impaired users. Parse the user's intent and respond with ONLY a valid JSON object.

User query: "${query}"

Determine the user's intent and respond with this exact JSON structure:
{
  "action": "navigate" | "help" | "locate" | "info" | "emergency" | "unknown",
  "destination": "destination name if action is navigate, otherwise null",
  "place": "place type if action is locate (e.g., 'restaurant', 'hospital'), otherwise null",
  "response": "friendly spoken response to the user"
}

Examples:
- "Take me to the library" → {"action":"navigate","destination":"library","place":null,"response":"Navigating to the library. Please wait while I calculate the route."}
- "Where is the nearest coffee shop" → {"action":"locate","destination":null,"place":"coffee shop","response":"I'll search for nearby coffee shops."}
- "Help me cross the street" → {"action":"help","destination":null,"place":null,"response":"I can help guide you. Listen for traffic sounds and wait for a safe moment to cross."}
- "What can you do" → {"action":"info","destination":null,"place":null,"response":"I can help you navigate to places, find nearby locations, detect obstacles, and provide assistance. Just tell me where you'd like to go or what you need."}

Respond with ONLY the JSON object, no other text.`;
    
    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];
    
    const response = await ai.models.generateContent({
      model: modelName,
      config: defaultConfig,
      contents,
    });
    
    const text = (response.text || '').trim();
    
    // Parse JSON from response
    let intent;
    try {
      // Remove markdown code blocks if present
      const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      intent = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse intent JSON:', text);
      intent = {
        action: 'unknown',
        destination: null,
        place: null,
        response: `I heard: "${query}". How can I assist you with navigation?`
      };
    }
    
    return {
      intent: intent,
      response: intent.response
    };
  } catch (error) {
    console.error('Error processing speech query:', error);
    return {
      intent: null,
      response: `I received your request: ${query}. There was an issue processing your request with AI, but I'm working on it.`
    };
  }
}

/**
 * Use AI to select the best place from Nominatim search results
 */
async function selectBestPlace(userQuery, places, userLocation) {
  if (!ai || !places || places.length === 0) {
    return places[0]; // Return first result if AI not available
  }
  
  try {
    const placesDescription = places.map((place, idx) => 
      `${idx + 1}. ${place.display_name} (${place.type}, ${Math.round(place.distance || 0)}m away)`
    ).join('\n');
    
    const prompt = `You are helping a visually impaired user navigate. They said: "${userQuery}"

Here are the nearby places found:
${placesDescription}

User's current location: ${userLocation ? `${userLocation.lat}, ${userLocation.lon}` : 'Unknown'}

Select the BEST matching place that the user most likely wants to go to. Consider:
1. Relevance to what they asked for
2. Distance (closer is usually better)
3. Place type and importance
4. Common sense (e.g., if they said "hospital", prioritize hospitals over clinics)

Respond with ONLY a JSON object:
{
  "selectedIndex": <number 1-${places.length}>,
  "reasoning": "<brief explanation why this is the best match>",
  "confirmation": "<friendly confirmation message to tell the user>"
}`;
    
    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];
    
    const response = await ai.models.generateContent({
      model: modelName,
      config: defaultConfig,
      contents,
    });
    
    const text = (response.text || '').trim();
    
    const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const selection = JSON.parse(jsonText);
    
    const selectedPlace = places[selection.selectedIndex - 1];
    return {
      ...selectedPlace,
      aiReasoning: selection.reasoning,
      confirmationMessage: selection.confirmation
    };
  } catch (error) {
    console.error('Error with AI place selection:', error.message);
    return places[0]; // Fallback to first result
  }
}

/**
 * Analyze camera frame and current navigation state to provide guidance
 */
async function analyzeNavigationFrame(detections, currentStep, routeContext, imageBase64) {
  if (!ai) {
    return null;
  }
  
  try {
    const detectionsText = detections && detections.length > 0
      ? detections.map(d => `- ${d.class_name} (${Math.round(d.confidence * 100)}% confidence)`).join('\n')
      : 'No objects detected';
    
    const prompt = `You are an AI navigation assistant for a visually impaired person. Analyze the current situation and provide guidance.

CURRENT NAVIGATION INSTRUCTION:
${currentStep}

DETECTED OBJECTS IN VIEW:
${detectionsText}

ROUTE CONTEXT:
${routeContext}

Based on the detected objects and current instruction, should you provide additional guidance?

Respond with ONLY a JSON object:
{
  "shouldAlert": true/false,
  "guidance": "specific guidance message if shouldAlert is true, otherwise empty string",
  "urgency": "low" | "medium" | "high",
  "reason": "brief reason for the guidance"
}

Only set shouldAlert to true if there is something important the user should know about (obstacles in path, hazards, confirmation they're on right track, etc.). Don't alert for routine situations.`;

    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];
    
    const response = await ai.models.generateContent({
      model: modelName,
      config: defaultConfig,
      contents,
    });
    
    const text = (response.text || '').trim();
    
    const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(jsonText);
    
    return analysis;
  } catch (error) {
    console.error('Error analyzing navigation frame:', error.message);
    return null;
  }
}

/**
 * Get general advice for queries that don't match specific tools
 */
async function getGeneralAdvice(query, context) {
  if (!ai) {
    return "I'm having trouble connecting to my AI service. Please try asking me to navigate somewhere or find nearby places.";
  }
  
  try {
    const contextInfo = context.isNavigating 
      ? `The user is currently navigating. Current step: ${context.currentStep || 'Unknown'}`
      : 'The user is on the home screen and not currently navigating.';
    
    const locationInfo = context.hasLocation
      ? 'The user has location services enabled.'
      : 'The user does not have location services enabled.';
    
    const prompt = `You are Vera Navigator, an AI assistant for visually impaired users that helps with navigation and accessibility.

USER QUERY: "${query}"

CONTEXT:
${contextInfo}
${locationInfo}

The user asked something that doesn't match our specific tools (navigate, locate, help, info, emergency).

Provide a helpful, conversational response that:
1. Acknowledges what they asked about
2. Provides relevant information or advice if you can
3. Gently guides them toward how you can help them with navigation if appropriate
4. Keeps response under 100 words

Be friendly, supportive, and helpful. Remember the user is visually impaired, so speak clearly and avoid visual references.

Respond with ONLY your spoken advice, no JSON or formatting.`;
    
    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];
    
    const response = await ai.models.generateContent({
      model: modelName,
      config: defaultConfig,
      contents,
    });
    
    return (response.text || '').trim();
  } catch (error) {
    console.error('Error getting general advice:', error.message);
    return "I'm here to help you navigate. You can ask me to take you somewhere, find nearby places, or get directions. How can I assist you?";
  }
}

module.exports = {
  getRouteWithAI,
  processSpeechQuery,
  selectBestPlace,
  analyzeNavigationFrame,
  getGeneralAdvice
};