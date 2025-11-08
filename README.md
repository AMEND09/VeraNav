# Vera Navigator - AI-Powered Navigation Assistant for the Visually Impaired

Vera Navigator is a fully functional web application that provides an AI-powered navigation assistant for visually impaired users. The application combines **real** speech recognition (Whisper), Google Generative AI (Gemini), OpenStreetMap routing (Nominatim/OSRM), and **genuine** real-time object detection (YOLOv8) and sound classification (MediaPipe YAMNet) to provide an accessible navigation experience.

## ✨ Features (All Functional - No Demo Data!)

- **Voice Interface**: OpenAI Whisper for speech-to-text + Web Speech API for audio feedback
- **AI-Powered Intent Parsing**: Gemini 2.0 Flash returns structured JSON to understand user intent
- **Real-time Routing**: Nominatim geocoding + OSRM routing with actual step-by-step instructions
- **Obstacle Detection**: YOLOv8 object detection via camera feed to identify real obstacles
- **Dangerous Sound Detection**: MediaPipe YAMNet audio classification detects 521 sound classes
- **GPS Navigation**: Live location tracking with turn-by-turn directions
- **Smart Context Awareness**: LLM interprets requests like "take me to the library" or "where's the nearest coffee shop"

## 🛠 Tech Stack

- **Frontend**: Vanilla JavaScript (HTML/CSS/JS)
- **Backend**: Node.js with Express
- **AI/LLM**: Google Generative AI (Gemini 2.0 Flash) - Intent parsing with JSON output
- **Speech-to-Text**: OpenAI Whisper (local Python service)
- **Routing**: Nominatim (geocoding) + OSRM (routing)
- **Object Detection**: Ultralytics YOLOv8 (Python service)
- **Sound Classification**: MediaPipe YAMNet (browser via CDN)
- **Text-to-Speech**: Web Speech Synthesis API

## 🚀 Quick Start

**See [QUICKSTART.md](QUICKSTART.md) for a 5-minute setup guide!**

### Basic Setup

1. **Install dependencies**:
   ```powershell
   npm install
   pip install -r requirements.txt
   ```

2. **Configure environment**:
   ```powershell
   # Copy example config
   cp .env.example .env
   
   # Add your Gemini API key to .env
   # Get it from: https://makersuite.google.com/app/apikey
   ```

3. **Run all services**:
   ```powershell
   npm run dev
   ```
   This starts:
   - Whisper Server (port 5001)
   - YOLOv8 Detection Service (port 5002)
   - Main Backend Server (port 5000)

4. **Access the application**:
   - Open http://localhost:5000
   - Grant camera, microphone, and location permissions
   - Start navigating with voice commands!

## 📡 API Endpoints

**See [FUNCTIONAL_IMPLEMENTATION.md](FUNCTIONAL_IMPLEMENTATION.md) for detailed API documentation.**

### Speech Processing
- `POST /api/speech/transcribe` - Upload audio, get transcription + intent JSON
- `POST /api/speech/process` - Process text query, get intent

### Navigation
- `POST /api/navigation/directions` - Get route with turn-by-turn directions
- `GET /api/navigation/search-nearby` - Find nearby places by type
- `GET /api/navigation/location-suggestions/:query` - Autocomplete suggestions

### Object Detection
- `GET /api/detection/health` - Check YOLOv8 service status
- `POST /api/detection/detect` - Detect objects in image frame

### System
- `GET /health` - Main server health check

## How to Use

1. Grant location and microphone permissions when prompted
2. Speak your destination (e.g. "Navigate to the nearest coffee shop")
3. The AI will process your request and provide route guidance
4. Follow the audio instructions and receive alerts about obstacles and dangers
5. Use the previous/next buttons to review instructions if needed

## Security Considerations

- API keys are stored in environment variables
- Input validation on all endpoints
- CORS configured for security
- No sensitive data is stored on the server

## Production Deployment

For production deployment, ensure:

1. Environment variables are properly configured
2. SSL/TLS is enabled
3. Proper error handling is in place
4. Performance optimizations are implemented
5. Server logs are monitored

## 📋 How It Works

### 1. Sound Detection (MediaPipe YAMNet)
- Real-time audio classification of 521 sound classes
- Detects dangerous sounds: vehicles, sirens, horns, construction
- Alerts user with spoken warnings

### 2. Object Detection (YOLOv8)
- Real-time object detection of 80 classes
- Warns about: people, vehicles, obstacles, furniture
- Estimates distance based on bounding box size

### 3. Navigation (Nominatim + OSRM)
- Geocodes addresses using OpenStreetMap
- Calculates walking routes via OSRM
- Provides turn-by-turn directions

### 4. Intent Parsing (Gemini LLM)
- Understands natural language commands
- Returns structured JSON with action type
- Handles: navigate, locate, help, info requests

## 🎯 Example Commands

- "Take me to the library"
- "Navigate to Main Street"
- "Where is the nearest coffee shop?"
- "Find a hospital nearby"
- "Help me cross the street"
- "What can you do?"

## ⚠️ Requirements

- **Browser**: Chrome, Edge, or Firefox (latest versions)
- **Permissions**: Camera, microphone, location access
- **Hardware**: Webcam for object detection, microphone for voice
- **Python**: 3.8+ for Whisper and YOLOv8 services
- **Internet**: For Nominatim API and model downloads

## 📚 Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - 5-minute setup guide
- **[FUNCTIONAL_IMPLEMENTATION.md](FUNCTIONAL_IMPLEMENTATION.md)** - Architecture and detailed docs
- **[WHISPER_SETUP.md](WHISPER_SETUP.md)** - Whisper server setup
- **[SETUP.md](SETUP.md)** - General setup instructions

## License

This project is licensed under the MIT License.