# Setup Script for Vera Navigator with Local Whisper

Write-Host "=== Vera Navigator Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
Write-Host "Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python313 --version 2>&1
    Write-Host "✓ $pythonVersion found" -ForegroundColor Green
} catch {
    Write-Host "✗ Python 3.13 not found. Please install Python 3.13 from https://www.python.org/" -ForegroundColor Red
    exit 1
}

# Check if pip is installed
Write-Host "Checking pip installation..." -ForegroundColor Yellow
try {
    $pipVersion = pip --version 2>&1
    Write-Host "✓ pip found" -ForegroundColor Green
} catch {
    Write-Host "✗ pip not found. Please install pip" -ForegroundColor Red
    exit 1
}

# Check if ffmpeg is installed (required for Whisper)
Write-Host "Checking ffmpeg installation..." -ForegroundColor Yellow
try {
    $ffmpegVersion = ffmpeg -version 2>&1 | Select-Object -First 1
    Write-Host "✓ ffmpeg found" -ForegroundColor Green
} catch {
    Write-Host "⚠ ffmpeg not found. Whisper requires ffmpeg for audio processing." -ForegroundColor Yellow
    Write-Host "  Install with: winget install ffmpeg" -ForegroundColor Yellow
    Write-Host "  Or download from: https://www.ffmpeg.org/download.html" -ForegroundColor Yellow
    Write-Host ""
}

# Install Node dependencies
Write-Host ""
Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Node.js dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install Node.js dependencies" -ForegroundColor Red
    exit 1
}

# Create Python virtual environment (optional but recommended)
Write-Host ""
Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
if (Test-Path "venv") {
    Write-Host "Virtual environment already exists, skipping..." -ForegroundColor Yellow
} else {
    python313 -m venv venv
    Write-Host "✓ Virtual environment created" -ForegroundColor Green
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& ".\venv\Scripts\Activate.ps1"

# Install Python dependencies
Write-Host ""
Write-Host "Installing Python dependencies (this may take several minutes)..." -ForegroundColor Yellow
Write-Host "Note: PyTorch will download ~2GB of data on first install" -ForegroundColor Cyan
pip install -r requirements.txt
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Python dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install Python dependencies" -ForegroundColor Red
    exit 1
}

# Summary
Write-Host ""
Write-Host "=== Setup Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "To run the application:" -ForegroundColor Cyan
Write-Host "  1. Activate Python virtual environment (if not already activated):" -ForegroundColor White
Write-Host "     .\venv\Scripts\Activate.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. Start both servers:" -ForegroundColor White
Write-Host "     npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Or run servers separately:" -ForegroundColor White
Write-Host "     Terminal 1: npm run server    (Node.js backend)" -ForegroundColor Yellow
Write-Host "     Terminal 2: npm run whisper   (Python Whisper)" -ForegroundColor Yellow
Write-Host ""
Write-Host "  3. Open browser: http://localhost:5000" -ForegroundColor White
Write-Host ""
Write-Host "Note: First Whisper transcription will be slow (~10-20 seconds)" -ForegroundColor Cyan
Write-Host "      as the model downloads and initializes." -ForegroundColor Cyan
