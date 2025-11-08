const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max (Whisper limit)
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/mp4'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file type'));
    }
  }
});

const { processSpeechQuery, transcribeAudio } = require('../utils/speech');

/**
 * Process speech input and return AI response with intent (text-based)
 * Legacy endpoint for backward compatibility
 */
router.post('/process', async (req, res) => {
  try {
    const { speechText } = req.body;
    
    if (!speechText) {
      return res.status(400).json({ error: 'Speech text is required' });
    }
    
    const result = await processSpeechQuery(speechText);
    
    res.json({ 
      response: result.response,
      intent: result.intent
    });
  } catch (error) {
    console.error('Error processing speech:', error);
    res.status(500).json({ error: 'Failed to process speech' });
  }
});

/**
 * Upload audio file, transcribe with Whisper, and process with AI
 * Returns transcription, intent JSON, and response
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  let filePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }
    
    filePath = req.file.path;
    console.log(`Received audio file: ${req.file.filename} (${req.file.size} bytes)`);
    
    // Transcribe audio using Whisper
    const transcription = await transcribeAudio(filePath);
    console.log(`Transcription: ${transcription}`);
    
    // Process transcription with AI to get intent
    const aiResult = await processSpeechQuery(transcription);
    
    // Clean up uploaded file
    await fs.unlink(filePath);
    
    res.json({ 
      transcription,
      intent: aiResult.intent,
      response: aiResult.response
    });
  } catch (error) {
    console.error('Error transcribing audio:', error);
    
    // Clean up uploaded file on error
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to transcribe audio',
      details: error.message 
    });
  }
});

module.exports = router;