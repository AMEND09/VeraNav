from __future__ import annotations

import atexit
import math
import queue
import threading
import time
from pathlib import Path
from typing import Dict, Generator, List, Optional

import cv2
import numpy as np
import pyttsx3
from flask import Flask, Response, jsonify, render_template

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
CLASS_FILE = BASE_DIR / 'coco.names'
CONFIG_PATH = BASE_DIR / 'ssd_mobilenet_v3_large_coco_2020_01_14.pbtxt'
WEIGHTS_PATH = BASE_DIR / 'frozen_inference_graph.pb'

FRAME_WIDTH_PIXELS = 640
FRAME_HEIGHT_PIXELS = 360
HORIZONTAL_FOV_DEG = 62.0
KNOWN_WIDTH_CM = 20.0
SPEECH_COOLDOWN_SECONDS = 3.0
DANGER_DISTANCE_CM = 150.0

# Avoid reloading model for each request
CLASS_NAMES = CLASS_FILE.read_text(encoding='utf-8').strip().splitlines()
NET = cv2.dnn_DetectionModel(str(WEIGHTS_PATH), str(CONFIG_PATH))  # type: ignore[attr-defined]
NET.setInputSize(320, 320)
NET.setInputScale(1.0 / 127.5)
NET.setInputMean((127.5, 127.5, 127.5))
NET.setInputSwapRB(True)

FOCAL_LENGTH_PIXELS = (FRAME_WIDTH_PIXELS / 2.0) / math.tan(math.radians(HORIZONTAL_FOV_DEG / 2.0))

results_lock = threading.Lock()
camera_lock = threading.Lock()
latest_results: List[Dict[str, object]] = []

voice_queue: queue.Queue[str | None] = queue.Queue()
last_spoken_at: Dict[str, float] = {}
last_distance_announced: Dict[str, float] = {}


def voice_output() -> None:
    engine = pyttsx3.init()
    while True:
        phrase = voice_queue.get()
        if phrase is None:
            break
        engine.say(phrase)
        engine.runAndWait()


voice_thread = threading.Thread(target=voice_output, daemon=True)
voice_thread.start()


def estimate_distance_cm(box_width_pixels: float) -> Optional[float]:
    if box_width_pixels <= 0:
        return None
    distance = (KNOWN_WIDTH_CM * FOCAL_LENGTH_PIXELS) / box_width_pixels
    return float(distance)


def schedule_voice_prompt(label: str, distance_cm: float) -> None:
    now = time.time()
    last_time = last_spoken_at.get(label, 0.0)
    last_distance = last_distance_announced.get(label)
    distance_delta = abs(distance_cm - last_distance) if last_distance is not None else None

    if (now - last_time) < SPEECH_COOLDOWN_SECONDS and (distance_delta is None or distance_delta < 15.0):
        return

    voice_queue.put(f"{label} is approximately {distance_cm:.0f} centimeters away")
    last_spoken_at[label] = now
    last_distance_announced[label] = distance_cm


def generate_frames() -> Generator[bytes, None, None]:
    if not camera_lock.acquire(blocking=False):
        yield from camera_in_use_frame()
        return

    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH_PIXELS)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT_PIXELS)
    cap.set(cv2.CAP_PROP_BRIGHTNESS, 70)

    try:
        if not cap.isOpened():
            yield from camera_error_frame('Camera unavailable')
            return

        while True:
            success, frame = cap.read()
            if not success:
                yield from camera_error_frame('Unable to read from camera')
                break

            class_ids, confidences, boxes = NET.detect(frame, confThreshold=0.45, nmsThreshold=0.2)
            detections: List[Dict[str, object]] = []

            if class_ids is not None and len(class_ids) > 0:
                for class_id, confidence, box in zip(class_ids.flatten(), confidences.flatten(), boxes):
                    if class_id - 1 < 0 or class_id - 1 >= len(CLASS_NAMES):
                        continue

                    label = CLASS_NAMES[class_id - 1].capitalize()
                    x, y, w, h = box
                    cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

                    distance_cm = estimate_distance_cm(float(w))
                    confidence_pct = float(confidence)
                    is_close = distance_cm is not None and distance_cm <= DANGER_DISTANCE_CM

                    text_parts = [label]
                    if distance_cm is not None:
                        text_parts.append(f"{distance_cm:.0f} cm")
                    text = ' - '.join(text_parts)
                    cv2.putText(frame, text, (x, max(y - 10, 20)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

                    detections.append(
                        {
                            'label': label,
                            'distance_cm': round(distance_cm, 2) if distance_cm is not None else None,
                            'confidence': round(confidence_pct, 4),
                            'is_close': is_close,
                        }
                    )

                    if is_close and distance_cm is not None:
                        schedule_voice_prompt(label, distance_cm)

            with results_lock:
                # Copy detections so readers get a stable snapshot
                global latest_results
                latest_results = [dict(item) for item in detections]

            ret, buffer = cv2.imencode('.jpg', frame)
            if not ret:
                yield from camera_error_frame('Failed to encode frame')
                break

            frame_bytes = buffer.tobytes()
            yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'

    finally:
        cap.release()
        camera_lock.release()


def build_message_frame(message: str) -> bytes:
    frame = np.zeros((FRAME_HEIGHT_PIXELS, FRAME_WIDTH_PIXELS, 3), dtype=np.uint8)
    cv2.putText(frame, message, (20, FRAME_HEIGHT_PIXELS // 2), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    ret, buffer = cv2.imencode('.jpg', frame)
    if not ret:
        return b''
    frame_bytes = buffer.tobytes()
    return b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'


def camera_error_frame(message: str) -> Generator[bytes, None, None]:
    while True:
        yield build_message_frame(message)
        time.sleep(1.0)


def camera_in_use_frame() -> Generator[bytes, None, None]:
    while True:
        yield build_message_frame('Camera already in use')
        time.sleep(1.0)


@app.route('/')
def index() -> str:
    return render_template('index.html')


@app.route('/video_feed')
def video_feed() -> Response:
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/latest_detections')
def latest_detections() -> Response:
    with results_lock:
        data = [dict(item) for item in latest_results]
    return jsonify({'detections': data})


@atexit.register
def shutdown_voice_thread() -> None:
    voice_queue.put(None)


if __name__ == '__main__':
    app.run(debug=True)
