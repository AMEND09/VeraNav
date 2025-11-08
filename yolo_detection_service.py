"""
YOLOv8 Object Detection Service
Provides a REST API for real-time object detection using YOLOv8
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
from ultralytics import YOLO
import time
import os
from pathlib import Path

app = Flask(__name__)
CORS(app)

# Load YOLOv8 model
MODEL_PATH = os.environ.get('YOLO_MODEL_PATH', 'yolov8n.pt')  # nano model for speed
print(f"Loading YOLOv8 model from {MODEL_PATH}...")

try:
    model = YOLO(MODEL_PATH)
    print("✓ YOLOv8 model loaded successfully")
except Exception as e:
    print(f"⚠ Error loading YOLOv8 model: {e}")
    print("Downloading YOLOv8n model...")
    model = YOLO('yolov8n.pt')  # This will auto-download if not present
    print("✓ YOLOv8 model downloaded and loaded")

# Relevant obstacle classes for navigation assistance
RELEVANT_CLASSES = [
    'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
    'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
    'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
    'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
    'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
    'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
    'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
    'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
    'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
    'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
    'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
    'toothbrush'
]

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'OK',
        'service': 'YOLOv8 Object Detection',
        'model': MODEL_PATH,
        'version': '1.0.0'
    })

@app.route('/detect', methods=['POST'])
def detect_objects():
    """
    Detect objects in an uploaded image
    Returns: JSON with detections, bounding boxes, and confidence scores
    """
    start_time = time.time()
    
    try:
        # Check if image file is present
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        
        # Read image file
        img_bytes = file.read()
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({'error': 'Invalid image file'}), 400
        
        # Run YOLOv8 detection
        results = model(img, verbose=False)
        
        # Extract detections
        detections = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                # Get box coordinates, confidence, and class
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])
                class_name = model.names[class_id]
                
                # Only include if confidence is high enough
                if confidence > 0.4:
                    detections.append({
                        'class_name': class_name,
                        'class_id': class_id,
                        'confidence': round(confidence, 3),
                        'bbox': [
                            round(x1, 2),
                            round(y1, 2),
                            round(x2 - x1, 2),  # width
                            round(y2 - y1, 2)   # height
                        ],
                        'box': [
                            round(x1, 2),
                            round(y1, 2),
                            round(x2, 2),
                            round(y2, 2)
                        ]
                    })
        
        processing_time = time.time() - start_time
        
        return jsonify({
            'detections': detections,
            'count': len(detections),
            'processing_time': round(processing_time, 3),
            'image_size': {
                'width': img.shape[1],
                'height': img.shape[0]
            }
        })
    
    except Exception as e:
        print(f"Error during detection: {e}")
        return jsonify({
            'error': 'Detection failed',
            'details': str(e)
        }), 500

@app.route('/detect-video-frame', methods=['POST'])
def detect_video_frame():
    """
    Optimized endpoint for video frame detection
    Uses lower confidence threshold and faster processing
    """
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        img_bytes = file.read()
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({'error': 'Invalid image file'}), 400
        
        # Resize for faster processing
        img_resized = cv2.resize(img, (416, 416))
        
        # Run detection with lower confidence threshold
        results = model(img_resized, conf=0.35, iou=0.45, verbose=False)
        
        detections = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])
                class_name = model.names[class_id]
                
                # Scale coordinates back to original size
                scale_x = img.shape[1] / 416
                scale_y = img.shape[0] / 416
                
                detections.append({
                    'class_name': class_name,
                    'confidence': round(confidence, 2),
                    'bbox': [
                        round(x1 * scale_x, 1),
                        round(y1 * scale_y, 1),
                        round((x2 - x1) * scale_x, 1),
                        round((y2 - y1) * scale_y, 1)
                    ]
                })
        
        return jsonify({
            'detections': detections,
            'count': len(detections)
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('YOLO_PORT', 5002))
    print(f"\n{'='*60}")
    print(f"  YOLOv8 Object Detection Service")
    print(f"  Running on http://localhost:{port}")
    print(f"  Model: {MODEL_PATH}")
    print(f"{'='*60}\n")
    
    app.run(host='0.0.0.0', port=port, debug=False)
