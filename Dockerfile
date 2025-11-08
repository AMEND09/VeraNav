# Multi-stage build for Vera Navigator - AI-powered navigation assistant
# Combines Node.js backend, Whisper STT service, and YOLO object detection

# Build stage for Python dependencies
FROM python:3.11-slim AS python-builder

# Install system dependencies required for Python ML libraries
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    software-properties-common \
    git \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Python requirements and install dependencies
COPY requirements.txt .
RUN python -m venv /opt/venv --copies \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# Install Node.js runtime and copy Python deps into compatible environment
FROM node:20-bookworm

# Install Python and system dependencies needed for all services
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    libsm6 \
    libxext6 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --only=production

# Copy application code
COPY src/ ./src/
COPY public/ ./public/
COPY NAIN/ ./NAIN/

# Copy Python scripts
COPY whisper_server.py .
COPY yolo_detection_service.py .

# Copy Python virtual environment from builder stage
COPY --from=python-builder /opt/venv /opt/venv

# Use Python virtual environment by default
ENV PATH="/opt/venv/bin:${PATH}"

# Copy YOLO model file
COPY yolov8n.pt ./

# Create a startup script to run all services
RUN echo '#!/bin/sh\n\
echo "Starting Whisper server..."\n\
python3 whisper_server.py &\n\
WHISPER_PID=$!\n\
\n\
echo "Starting YOLO detection service..."\n\
python3 yolo_detection_service.py &\n\
YOLO_PID=$!\n\
\n\
# Give Python services time to start\n\
echo "Waiting for Python services to start..."\n\
sleep 15\n\
\n\
echo "Starting main Node.js server..."\n\
node src/backend/server.js\n\
\n\
# Wait for background processes\n\
wait $WHISPER_PID\n\
wait $YOLO_PID' > start.sh && chmod +x start.sh

# Set environment variables with defaults
ENV NODE_ENV=production
ENV PORT=5000
ENV WHISPER_PORT=5001
ENV YOLO_PORT=5002
ENV WHISPER_SERVER_URL=http://localhost:5001
ENV YOLO_SERVICE_URL=http://localhost:5002

# Expose ports
EXPOSE 5000 5001 5002

# Use the startup script as the entrypoint
CMD ["./start.sh"]