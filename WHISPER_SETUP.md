# Local Whisper Setup - Quick Start Guide

## 🎯 Overview

This project now uses **local Whisper** for speech-to-text transcription, eliminating the need for OpenAI API keys. The Whisper model runs on your machine via a Python Flask server.

## 📋 Prerequisites

1. **Python 3.8+** - [Download](https://www.python.org/downloads/)
2. **Node.js 14+** - Already installed ✓
3. **ffmpeg** - Required for audio processing

### Install ffmpeg (Windows)

```powershell
# Option 1: Using winget (Windows 10/11)
winget install ffmpeg

# Option 2: Using Chocolatey
choco install ffmpeg

# Option 3: Manual download
# Download from https://www.ffmpeg.org/download.html
# Add to PATH environment variable
```

To verify ffmpeg installation:
```powershell
ffmpeg -version
```

## 🚀 Quick Setup

### Automated Setup (Recommended)

```powershell
# Run the setup script
.\setup.ps1
```

This will:
- ✓ Check Python, pip, and ffmpeg
- ✓ Install Node.js dependencies
- ✓ Create Python virtual environment
- ✓ Install Python dependencies (Whisper, Flask, PyTorch)

### Manual Setup

1. **Install Node dependencies:**
```powershell
npm install
```

2. **Create Python virtual environment (optional but recommended):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

3. **Install Python dependencies:**
```powershell
pip install -r requirements.txt
```

**Note:** This will download ~2GB of PyTorch libraries on first install.

## 🎮 Running the Application

### Option 1: Run Both Servers Together (Recommended)

```powershell
# Make sure Python venv is activated
.\venv\Scripts\Activate.ps1

# Start both Node and Whisper servers
npm run dev
```

This starts:
- **Port 5000** - Node.js backend + web interface
- **Port 5001** - Python Whisper transcription server

### Option 2: Run Servers Separately

**Terminal 1 - Python Whisper Server:**
```powershell
.\venv\Scripts\Activate.ps1
npm run whisper
# Or: python whisper_server.py
```

**Terminal 2 - Node.js Backend:**
```powershell
npm run server
```

### Option 3: Node Only (No Speech Recognition)

```powershell
npm run dev:node-only
```

## 🧪 Testing Whisper

### Check Server Status

```powershell
# Whisper health check
curl http://localhost:5001/health
```

Expected response:
```json
{
  "status": "OK",
  "model": "whisper-base",
  "service": "Local Whisper Server"
}
```

### Test Transcription

1. Open http://localhost:5000
2. Click "Tap to Speak"
3. Allow microphone access
4. Speak clearly (e.g., "Navigate to Central Park")
5. Watch console logs for transcription

**First transcription will be slow** (~10-20 seconds) as the Whisper model loads into memory. Subsequent transcriptions are much faster (~2-5 seconds).

## 📊 Whisper Model Options

The project uses the **base** model by default (good balance of speed/accuracy).

Available models in `whisper_server.py`:

| Model    | Size   | Speed    | Accuracy | RAM Usage |
|----------|--------|----------|----------|-----------|
| `tiny`   | 39M    | Fastest  | Good     | ~1 GB     |
| `base`   | 74M    | Fast     | Better   | ~1 GB     |
| `small`  | 244M   | Medium   | Great    | ~2 GB     |
| `medium` | 769M   | Slow     | Excellent| ~5 GB     |
| `large`  | 1550M  | Slowest  | Best     | ~10 GB    |

To change the model, edit `whisper_server.py`:
```python
model = whisper.load_model("base")  # Change to "small", "medium", etc.
```

## 🔧 Troubleshooting

### Whisper Server Won't Start

**Error:** `ModuleNotFoundError: No module named 'flask'`

**Solution:**
```powershell
# Make sure virtual environment is activated
.\venv\Scripts\Activate.ps1

# Reinstall dependencies
pip install -r requirements.txt
```

### ffmpeg Not Found

**Error:** `RuntimeError: ffmpeg not found`

**Solution:** Install ffmpeg (see Prerequisites section above)

### Out of Memory

**Error:** Model loading fails or system freezes

**Solution:** Use a smaller model:
```python
model = whisper.load_model("tiny")  # Smallest, fastest model
```

### Node Server Can't Connect to Whisper

**Error in console:** `Local Whisper server not available`

**Solution:**
1. Check if Python server is running: `curl http://localhost:5001/health`
2. Start Whisper server: `npm run whisper`
3. Check firewall isn't blocking port 5001

### Slow First Transcription

**Expected behavior:** First transcription takes 10-20 seconds as Whisper downloads the model files (~100-500MB depending on model size). Subsequent transcriptions are fast.

**Model files are cached in:** `~/.cache/whisper/`

## 🎯 Architecture

```
User speaks → Browser MediaRecorder → Audio Blob → 
Node.js multer → Temp file → 
Python Flask Server → Whisper Model → Transcription → 
Node.js → Gemini AI → Response
```

## 📝 Configuration

Edit `.env` to configure:

```env
# Whisper server URL (default: http://localhost:5001)
WHISPER_SERVER_URL=http://localhost:5001
WHISPER_PORT=5001

# Node.js server port
PORT=5000
```

## 🚀 Performance Tips

1. **Use GPU acceleration** (if available):
   - Install CUDA-enabled PyTorch
   - Whisper will automatically use GPU
   - 5-10x faster transcription

2. **Keep Whisper server running:**
   - Model stays in memory
   - Subsequent transcriptions are much faster

3. **Adjust model size:**
   - Start with `tiny` for testing
   - Use `base` for production (good balance)
   - Use `small`+ for better accuracy

## 📦 What's Installed

### Node.js Dependencies
- `multer` - File upload handling
- `axios` - HTTP requests
- `form-data` - Multipart form data
- `express` - Web server
- Plus existing dependencies

### Python Dependencies
- `openai-whisper` - Speech recognition model
- `flask` - Web server
- `flask-cors` - CORS support
- `torch` - PyTorch (ML framework)
- `ffmpeg-python` - Audio processing

## 🔄 Updating

To update Whisper to the latest version:

```powershell
.\venv\Scripts\Activate.ps1
pip install --upgrade openai-whisper
```

## 💡 Next Steps

1. ✓ Run setup script: `.\setup.ps1`
2. ✓ Start servers: `npm run dev`
3. ✓ Test speech recognition in browser
4. ✓ Try navigation with voice commands
5. ✓ Experiment with different Whisper models

## 🆘 Need Help?

Check logs:
- **Whisper logs:** Python terminal output
- **Node logs:** Node terminal output
- **Browser logs:** Browser developer console (F12)

Common issues are usually:
- ffmpeg not installed
- Python venv not activated
- Port 5001 already in use
- Firewall blocking connections

---

**Ready to go!** Run `npm run dev` and start speaking! 🎤
