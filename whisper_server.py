"""
Local Whisper Speech-to-Text Server
Uses OpenAI's Whisper model running locally for transcription
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import tempfile
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load Whisper model (use 'base' for balance of speed and accuracy)
# Models: tiny, base, small, medium, large
logger.info("Loading Whisper model... This may take a minute on first run.")
model = whisper.load_model("base")
logger.info("✓ Whisper model loaded successfully")

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'OK',
        'model': 'whisper-base',
        'service': 'Local Whisper Server'
    })

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    """
    Transcribe audio file using local Whisper model
    Accepts: multipart/form-data with 'audio' file
    Returns: { transcription: string }
    """
    try:
        # Check if audio file is present
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        
        if audio_file.filename == '':
            return jsonify({'error': 'Empty filename'}), 400
        
        # Save audio to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_audio:
            audio_file.save(temp_audio.name)
            temp_path = temp_audio.name
        
        logger.info(f"Processing audio file: {audio_file.filename}")
        
        # Transcribe with Whisper
        result = model.transcribe(
            temp_path,
            language='en',
            fp16=False,  # Disable FP16 for CPU compatibility
            verbose=False
        )
        
        transcription = result['text'].strip()
        
        # Clean up temporary file
        os.unlink(temp_path)
        
        logger.info(f"Transcription: {transcription}")
        
        return jsonify({
            'transcription': transcription,
            'language': result.get('language', 'en'),
            'success': True
        })
    
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        
        # Clean up temp file if it exists
        if 'temp_path' in locals():
            try:
                os.unlink(temp_path)
            except:
                pass
        
        return jsonify({
            'error': 'Transcription failed',
            'details': str(e)
        }), 500

@app.route('/models', methods=['GET'])
def list_models():
    """List available Whisper models"""
    return jsonify({
        'current_model': 'base',
        'available_models': ['tiny', 'base', 'small', 'medium', 'large'],
        'model_info': {
            'tiny': 'Fastest, least accurate (~1GB RAM)',
            'base': 'Good balance (~1GB RAM)',
            'small': 'Better accuracy (~2GB RAM)',
            'medium': 'High accuracy (~5GB RAM)',
            'large': 'Best accuracy (~10GB RAM)'
        }
    })

if __name__ == '__main__':
    # Run on port 5001 (Node server uses 5000)
    port = int(os.environ.get('WHISPER_PORT', 5001))
    logger.info(f"Starting Whisper server on port {port}")
    logger.info("Note: First transcription may be slow as model initializes")
    app.run(host='0.0.0.0', port=port, debug=False)
