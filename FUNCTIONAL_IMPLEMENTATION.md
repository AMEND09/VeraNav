# Vera Navigator - Functional Implementation Guide

## Overview
This application now uses genuine functional components instead of demo data:

1. **MediaPipe YAMNet** - Real-time sound classification for dangerous sounds
2. **YOLOv8** - Real-time object detection for obstacle warnings
3. **Nominatim** - Real navigation with OpenStreetMap routing (OSRM)
4. **Gemini LLM** - Intent parsing with structured JSON output

## Installation

### 1. Install Node.js Dependencies
```bash
npm install
```

### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

This installs:
- Flask for the services
- OpenAI Whisper for speech-to-text
- Ultralytics YOLOv8 for object detection
- OpenCV for image processing

### 3. Download YAMNet Model
The YAMNet model should already be in `NAIN/static/vendor/yamnet.tflite`. If not:
```bash
# Download from MediaPipe
curl -o NAIN/static/vendor/yamnet.tflite https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite
```

### 4. Configure Environment Variables
Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Gemini API Key (for LLM intent parsing)
GEMINI_API_KEY=your_gemini_api_key_here

# Service URLs (defaults shown)
WHISPER_SERVER_URL=http://localhost:5001
YOLO_SERVICE_URL=http://localhost:5002

# Optional: YOLOv8 Model Path
YOLO_MODEL_PATH=yolov8n.pt
```

## Running the Application

### Option 1: Run All Services Together
```bash
npm run dev
```

This starts:
- Whisper server (port 5001)
- YOLOv8 detection service (port 5002)
- Node.js backend (port 5000)

### Option 2: Run Services Individually

**Terminal 1 - Whisper Server:**
```bash
npm run whisper
# or
python whisper_server.py
```

**Terminal 2 - YOLOv8 Detection Service:**
```bash
npm run yolo
# or
python yolo_detection_service.py
```

**Terminal 3 - Node.js Backend:**
```bash
npm start
# or for development with auto-reload
npm run server
```

### Option 3: Run Only Backend (Without Python Services)
```bash
npm run dev:node-only
```

Note: Object detection and speech transcription will not work without Python services.

## How It Works

### 1. Sound Detection (MediaPipe YAMNet)
- **Frontend**: `public/js/main.js` - `startSoundDetection()`
- **Model**: MediaPipe YAMNet via CDN
- **Process**:
  1. Captures audio from microphone
  2. Processes with Web Audio API
  3. Classifies sounds using YAMNet
  4. Alerts user about dangerous sounds (vehicles, sirens, etc.)

### 2. Object Detection (YOLOv8)
- **Frontend**: `public/js/main.js` - `startObjectDetection()`
- **Backend Service**: `yolo_detection_service.py`
- **Process**:
  1. Captures video frames from camera
  2. Sends frames to YOLOv8 service every 2 seconds
  3. Service returns detected objects with bounding boxes
  4. Frontend displays warnings for nearby obstacles

### 3. Navigation (Nominatim + OSRM)
- **Backend**: `src/backend/routes/navigation.js`
- **Utilities**: `src/backend/utils/nominatim.js`
- **Process**:
  1. Geocodes destination using Nominatim
  2. Gets walking route from OSRM
  3. Enhances route with AI safety insights
  4. Returns step-by-step directions

### 4. Intent Parsing (Gemini LLM)
- **Backend**: `src/backend/utils/ai.js` - `processSpeechQuery()`
- **Process**:
  1. Receives transcribed speech
  2. Sends to Gemini with JSON schema prompt
  3. Parses intent (navigate, locate, help, etc.)
  4. Returns structured JSON response
  5. Frontend handles intent appropriately

## API Endpoints

### Speech Processing
- `POST /api/speech/transcribe` - Upload audio, get transcription + intent
- `POST /api/speech/process` - Process text query, get intent

### Navigation
- `POST /api/navigation/directions` - Get route directions
- `GET /api/navigation/search-nearby` - Search nearby places by type
- `GET /api/navigation/nearby` - Get nearby POIs
- `GET /api/navigation/location-suggestions/:query` - Autocomplete

### Object Detection
- `GET /api/detection/health` - Check if YOLOv8 service is running
- `POST /api/detection/detect` - Detect objects in image

## Intent JSON Schema

The LLM returns structured JSON for user intents:

```json
{
  "action": "navigate|help|locate|info|emergency|unknown",
  "destination": "string or null",
  "place": "string or null",
  "response": "friendly spoken response"
}
```

### Examples:

**Navigation:**
```json
{
  "action": "navigate",
  "destination": "library",
  "place": null,
  "response": "Navigating to the library. Please wait while I calculate the route."
}
```

**Locate Nearby:**
```json
{
  "action": "locate",
  "destination": null,
  "place": "coffee shop",
  "response": "I'll search for nearby coffee shops."
}
```

**Help Request:**
```json
{
  "action": "help",
  "destination": null,
  "place": null,
  "response": "I can help guide you. What do you need assistance with?"
}
```

## Testing

### Test Sound Detection
1. Open the app in browser
2. Allow microphone access
3. Start navigation to any destination
4. Make sounds or play audio (car horns, sirens)
5. App should detect and announce dangerous sounds

### Test Object Detection
1. Open the app in browser
2. Allow camera access
3. Start navigation
4. Point camera at objects (people, cars, furniture)
5. App should detect and warn about obstacles

### Test Navigation
1. Open the app
2. Say or type: "Navigate to [destination]"
3. App should:
   - Parse intent
   - Geocode destination
   - Calculate route
   - Provide step-by-step directions

### Test Intent Parsing
Try various queries:
- "Take me to the hospital"
- "Where is the nearest coffee shop"
- "Help me cross the street"
- "What can you do?"

## Troubleshooting

### YOLOv8 Model Download
If the model doesn't auto-download:
```bash
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
```

### MediaPipe YAMNet Issues
- Ensure `yamnet.tflite` is in `NAIN/static/vendor/`
- Check browser console for loading errors
- Try copying from: https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite

### Nominatim Rate Limiting
- The app respects Nominatim's 1 req/sec limit
- If you get errors, wait a few seconds and retry
- For production, consider self-hosting Nominatim

### Gemini API Issues
- Ensure `GEMINI_API_KEY` is set in `.env`
- Get a key from: https://makersuite.google.com/app/apikey
- App works without LLM but won't parse intents

## Performance Notes

### YOLOv8 Models
- `yolov8n.pt` (nano) - Fastest, good for real-time
- `yolov8s.pt` (small) - Better accuracy, slower
- `yolov8m.pt` (medium) - High accuracy, much slower

Change model by setting `YOLO_MODEL_PATH` in `.env`

### Detection Intervals
- Object detection: 2 seconds (configurable in `main.js`)
- Sound detection: Continuous real-time
- Both can be adjusted based on device performance

## Browser Requirements

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: May have MediaPipe limitations
- Mobile: Best on Android Chrome

All browsers need:
- Camera access for object detection
- Microphone access for sound detection and speech
- Geolocation for navigation

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Use process manager (PM2) for Node.js
3. Use systemd or supervisor for Python services
4. Consider containerization (Docker)
5. Use HTTPS for camera/microphone access
6. Consider self-hosting Nominatim for higher rate limits

## Credits

- **YOLOv8**: Ultralytics
- **MediaPipe YAMNet**: Google MediaPipe
- **Whisper**: OpenAI
- **Nominatim**: OpenStreetMap
- **OSRM**: Open Source Routing Machine
- **Gemini**: Google AI
