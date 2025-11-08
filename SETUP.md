# Vera Navigator - Setup Guide

## 🚀 Major Upgrades Implemented

This project has been upgraded with comprehensive AI and accessibility features:

### 1. **OpenAI Whisper Speech-to-Text**
- Real audio streaming from browser to backend
- Accurate speech transcription using Whisper API
- Supports multiple audio formats (webm, wav, mp3)

### 2. **Gemini 2.0 Flash AI Assistant**
- Upgraded from basic Gemini to `gemini-2.0-flash-exp`
- Provides contextual navigation assistance
- Safety and accessibility insights for routes

### 3. **Real-time Object Detection (COCO-SSD/YOLO)**
- TensorFlow.js-powered object detection
- Identifies obstacles, vehicles, people, and hazards
- Distance estimation for detected objects
- Real-time visual warnings

### 4. **OpenStreetMap Nominatim Navigation**
- Professional geocoding and routing
- Rate-limited API calls (1 req/sec)
- Reverse geocoding support
- Nearby POI discovery

## 📋 Prerequisites

- Node.js 14.0.0 or higher
- npm or yarn
- OpenAI API key (for Whisper)
- Google Gemini API key (for AI assistance)

## 🔧 Installation

### 1. Install Dependencies

```powershell
# Install backend dependencies
npm install

# The following packages were added:
# - multer (file upload handling)
# - openai (Whisper transcription)
# - form-data (multipart form handling)
# - cross-env (environment variable management)
```

### 2. Configure API Keys

Edit `.env` file in the root directory:

```env
# Google Generative AI API Key (Gemini 2.0 Flash)
GEMINI_API_KEY=your_gemini_api_key_here

# OpenAI API Key (for Whisper speech-to-text)
OPENAI_API_KEY=your_openai_api_key_here

# Port Configuration
PORT=5000

# Node Environment
NODE_ENV=development
```

**Important:** Replace the placeholder values with your actual API keys:

- **Get Gemini API Key**: https://makersuite.google.com/app/apikey
- **Get OpenAI API Key**: https://platform.openai.com/api-keys

### 3. Create Required Directories

The app will automatically create the `uploads/` directory for temporary audio files.

## 🎯 Running the Application

### Development Mode (Recommended)

```powershell
npm run dev
```

This starts both:
- Backend server on port 5000
- Frontend with increased memory allocation

### Backend Only

```powershell
npm run server
```

### Frontend Only

```powershell
npm run client
```

## 🧪 Testing the Features

### 1. Speech Recognition (Whisper)

1. Open http://localhost:5000
2. Click "Tap to Speak"
3. Grant microphone permissions
4. Speak clearly (e.g., "Navigate to Central Park")
5. Audio is recorded, uploaded, and transcribed via Whisper
6. Gemini AI processes the transcription and responds

### 2. Object Detection (TensorFlow.js)

1. Start navigation to any destination
2. Grant camera permissions when prompted
3. The app will detect objects in real-time:
   - People, vehicles, bicycles
   - Traffic signals, signs
   - Obstacles like benches, poles
4. Warnings are spoken for nearby objects

### 3. Navigation (Nominatim + OSRM)

1. Enter a destination or speak "Navigate to [place]"
2. The system will:
   - Geocode the destination via Nominatim
   - Calculate walking route via OSRM
   - Enhance with Gemini AI safety insights
   - Provide step-by-step instructions

## 🏗️ Architecture

```
vera-navigator/
├── src/
│   └── backend/
│       ├── server.js              # Express server (upgraded for audio)
│       ├── routes/
│       │   ├── speech.js          # NEW: Whisper transcription endpoint
│       │   └── navigation.js      # Enhanced with Nominatim
│       └── utils/
│           ├── ai.js              # Gemini 2.0 Flash integration
│           ├── speech.js          # Whisper API client
│           └── nominatim.js       # NEW: OSM geocoding utility
├── public/
│   ├── index.html                 # Updated with TF.js scripts
│   └── js/
│       └── main.js                # NEW: Audio recording + object detection
├── uploads/                       # Temporary audio file storage
├── .env                           # API keys configuration
└── package.json                   # Updated dependencies
```

## 🔑 Key Features Explained

### Audio Streaming Pipeline

```
User speaks → MediaRecorder API → Audio Blob → 
Multer Upload → Whisper Transcription → 
Gemini AI Processing → Text-to-Speech Response
```

### Object Detection Pipeline

```
Camera Feed → TensorFlow.js COCO-SSD → 
Object Classification → Distance Estimation → 
Voice Warnings for Nearby Objects
```

### Navigation Pipeline

```
User Input → Nominatim Geocoding → 
OSRM Walking Route → Gemini Safety Analysis → 
Step-by-Step Voice Instructions
```

## 🛡️ Security Considerations

1. **Rate Limiting**: Built-in rate limiter (100 req/15min)
2. **File Size Limits**: Audio uploads capped at 25MB
3. **Content Security Policy**: Helmet.js configured
4. **API Key Protection**: Environment variables only
5. **CORS**: Restricted to localhost in development

## 🐛 Troubleshooting

### "GEMINI_API_KEY not found"

**Solution**: Add your Gemini API key to `.env` file

### "OPENAI_API_KEY not configured"

**Solution**: Add your OpenAI API key to `.env` file

### "Out of Memory" Error (Frontend)

**Solution**: Already fixed! Using `cross-env` to allocate 4GB memory:
```json
"client": "cross-env NODE_OPTIONS=--max_old_space_size=4096 cd frontend && npm start"
```

### Camera/Microphone Access Denied

**Solution**: 
- Check browser permissions
- Use HTTPS in production (required for device access)
- On localhost, permissions should work

### Object Detection Not Working

**Solution**:
- Check console for TensorFlow.js loading errors
- Ensure camera permissions granted
- Model loads automatically from CDN

### Nominatim Rate Limit Errors

**Solution**: Built-in rate limiting (1 req/sec). If issues persist:
- Consider caching geocoding results
- Use a dedicated Nominatim instance

## 📊 Performance Tips

1. **Object Detection**: Runs every 2 seconds (configurable in `main.js`)
2. **Audio Transcription**: Typically takes 2-5 seconds
3. **AI Responses**: Gemini 2.0 Flash is optimized for speed
4. **Navigation**: OSRM routing is very fast (<1 second)

## 🔄 API Endpoints

### Speech API

```http
POST /api/speech/transcribe
Content-Type: multipart/form-data
Body: { audio: File }
Response: { transcription: string, response: string }
```

```http
POST /api/speech/process
Content-Type: application/json
Body: { speechText: string }
Response: { response: string }
```

### Navigation API

```http
POST /api/navigation/directions
Content-Type: application/json
Body: { start: string, destination: string }
Response: { route: Object }
```

```http
GET /api/navigation/location-suggestions/:query?lat=&lon=
Response: Array<Place>
```

```http
GET /api/navigation/nearby?lat=&lon=&radius=
Response: Array<POI>
```

```http
GET /api/navigation/reverse-geocode?lat=&lon=
Response: { display_name: string, address: Object }
```

## 📦 Dependencies

### Backend
- `express` - Web server
- `multer` - File upload handling
- `openai` - Whisper API client
- `@google/generative-ai` - Gemini AI
- `axios` - HTTP requests
- `cors` - CORS middleware
- `dotenv` - Environment variables
- `helmet` - Security headers
- `express-rate-limit` - Rate limiting

### Frontend
- `@tensorflow/tfjs` - TensorFlow.js runtime
- `@tensorflow-models/coco-ssd` - Object detection model
- Native Web APIs:
  - MediaRecorder (audio recording)
  - MediaDevices (camera/mic access)
  - SpeechSynthesis (text-to-speech)

## 🎓 Next Steps

1. **Add your API keys** to `.env`
2. **Run `npm run dev`** to start the server
3. **Open http://localhost:5000** in your browser
4. **Grant permissions** for microphone and camera
5. **Test voice commands** like "Navigate to Times Square"

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions welcome! This is an accessibility-focused project for visually impaired users.

---

**Need Help?** Check the console logs for detailed debugging information.
