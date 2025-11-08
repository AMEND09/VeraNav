const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const FormData = require('form-data');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/detection');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'frame-' + uniqueSuffix + '.jpg');
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image file type'));
    }
  }
});

// YOLOv8 detection service URL (runs separately via Python)
const YOLO_SERVICE_URL = process.env.YOLO_SERVICE_URL || 'http://localhost:5002';

/**
 * Health check for detection service
 */
router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(`${YOLO_SERVICE_URL}/health`, { timeout: 3000 });
    res.json({ 
      status: 'OK', 
      service: 'YOLOv8',
      serviceStatus: response.data 
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'Service Unavailable', 
      message: 'YOLOv8 detection service is not running. Start it with: python yolo_detection_service.py',
      error: error.message 
    });
  }
});

/**
 * Detect objects in an image using YOLOv8
 */
router.post('/detect', upload.single('image'), async (req, res) => {
  let filePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }
    
    filePath = req.file.path;
    console.log(`Received image for detection: ${req.file.filename}`);
    
    // Send image to YOLOv8 service
    const formData = new FormData();
    formData.append('image', await fs.readFile(filePath), {
      filename: req.file.filename,
      contentType: req.file.mimetype
    });
    
    const response = await axios.post(`${YOLO_SERVICE_URL}/detect`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 10000, // 10 second timeout
    });
    
    // Clean up uploaded file
    await fs.unlink(filePath);
    
    res.json({
      detections: response.data.detections || [],
      count: response.data.count || 0,
      processing_time: response.data.processing_time
    });
  } catch (error) {
    console.error('Error in object detection:', error.message);
    
    // Clean up uploaded file on error
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
      }
    }
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        error: 'YOLOv8 detection service not available',
        message: 'Start the service with: python yolo_detection_service.py'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to detect objects',
      details: error.message 
    });
  }
});

module.exports = router;
