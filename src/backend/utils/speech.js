// Speech processing utilities
const { processSpeechQuery: aiProcessSpeechQuery } = require('./ai');
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

// Local Whisper server configuration
const WHISPER_SERVER_URL = process.env.WHISPER_SERVER_URL || 'http://localhost:5001';

// Check if local Whisper server is available
let whisperAvailable = false;
axios.get(`${WHISPER_SERVER_URL}/health`)
  .then(() => {
    whisperAvailable = true;
    console.log('✓ Local Whisper server connected successfully');
  })
  .catch(() => {
    console.warn('⚠ Local Whisper server not available - start it with: python whisper_server.py');
  });

/**
 * Process speech query
 * Receives text and passes it to AI processing utility
 */
async function processSpeechQuery(query) {
  return await aiProcessSpeechQuery(query);
}

/**
 * Transcribe audio file using local Whisper server
 * @param {string} audioFilePath - Path to the audio file
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(audioFilePath) {
  try {
    // Create form data with audio file
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(audioFilePath));

    // Send to local Whisper server
    const response = await axios.post(`${WHISPER_SERVER_URL}/transcribe`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 30000, // 30 second timeout
    });

    if (response.data && response.data.transcription) {
      return response.data.transcription;
    }

    throw new Error('No transcription received from Whisper server');
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Local Whisper server not running. Start it with: python whisper_server.py');
    }
    
    console.error('Whisper transcription error:', error.message);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}

/**
 * Check if Whisper server is available
 */
async function checkWhisperHealth() {
  try {
    const response = await axios.get(`${WHISPER_SERVER_URL}/health`, { timeout: 5000 });
    return response.data;
  } catch (error) {
    return null;
  }
}

module.exports = {
  processSpeechQuery,
  transcribeAudio,
  checkWhisperHealth
};