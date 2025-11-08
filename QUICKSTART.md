# Quick Start Guide - Vera Navigator

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies
```powershell
# Install Node.js packages
npm install

# Install Python packages
pip install -r requirements.txt
```

### 2. Configure API Key
1. Copy `.env.example` to `.env`
2. Get a free Gemini API key: https://makersuite.google.com/app/apikey
3. Add your key to `.env`:
   ```
   GEMINI_API_KEY=your_actual_key_here
   ```

### 3. Run Everything
```powershell
npm run dev
```

This starts all three services:
- ✅ Whisper Server (Speech-to-Text) on port 5001
- ✅ YOLOv8 Detector (Object Detection) on port 5002  
- ✅ Main Server (Backend API) on port 5000

### 4. Open in Browser
Navigate to: http://localhost:5000

## 🎯 First Time Use

### Grant Permissions
The app will ask for:
- 🎤 **Microphone** - For voice commands and sound detection
- 📹 **Camera** - For object detection
- 📍 **Location** - For navigation

### Try These Commands:
1. **Navigation**: "Take me to the library"
2. **Find nearby**: "Where is the nearest coffee shop"
3. **Help**: "What can you do?"

## 🔧 Troubleshooting

### Services Won't Start?
Run them individually in separate terminals:

**Terminal 1:**
```powershell
python whisper_server.py
```

**Terminal 2:**
```powershell
python yolo_detection_service.py
```

**Terminal 3:**
```powershell
npm start
```

### YOLOv8 Downloading Model?
First run will download ~6MB model. Wait for:
```
✓ YOLOv8 model loaded successfully
```

### Camera/Mic Not Working?
- Make sure you granted browser permissions
- Try HTTPS (some browsers require it)
- Check browser console for errors

### Python Module Errors?
```powershell
# Reinstall with verbose output
pip install -r requirements.txt --upgrade --force-reinstall
```

## 📱 Features Now Working

### ✅ Real Sound Detection
- MediaPipe YAMNet detects 521 sound classes
- Alerts for: vehicles, sirens, horns, construction
- Real-time continuous monitoring

### ✅ Real Object Detection  
- YOLOv8 detects 80 object classes
- Warns about: people, vehicles, obstacles
- Processes every 2 seconds

### ✅ Real Navigation
- Uses Nominatim (OpenStreetMap)
- Gets actual walking routes via OSRM
- Turn-by-turn directions

### ✅ Smart Intent Parsing
- Gemini LLM understands natural language
- Returns structured JSON actions
- Handles navigation, search, help requests

## 🎓 Advanced

### Run Without Python Services
```powershell
npm run dev:node-only
```
Note: Object detection and transcription won't work.

### Use Better YOLOv8 Model
In `.env`:
```
YOLO_MODEL_PATH=yolov8s.pt
```
Options: `yolov8n.pt` (fast), `yolov8s.pt` (better), `yolov8m.pt` (best)

### Check Service Health
```powershell
# Whisper
curl http://localhost:5001/health

# YOLOv8
curl http://localhost:5002/health

# Main API
curl http://localhost:5000/health
```

## 📚 Full Documentation
See `FUNCTIONAL_IMPLEMENTATION.md` for detailed architecture and API docs.

## 🆘 Need Help?
1. Check the browser console for errors
2. Check terminal output for service errors
3. Verify all three services are running
4. Ensure `.env` has valid Gemini API key

## 🎉 You're Ready!
Open http://localhost:5000 and start navigating with voice commands!
