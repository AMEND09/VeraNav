// Global variables
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let currentRoute = null;
let currentStepIndex = 0;
let userLocation = null;
let objectDetectionInterval = null;
let detectionModel = null;
let audioClassifier = null;
let audioContext = null;
let soundDetectionActive = false;
let map = null;
let routeLayer = null;
let markers = {
    start: null,
    end: null,
    current: null
};
let cameraStream = null;
let isMapVisible = false;
let isCameraVisible = false;
let aiGuidanceInterval = null;
let lastDetections = [];
let lastAIGuidanceTime = 0;
let originalUserQuery = '';
let locationWatchId = null;
let isNavigating = false;
let voiceCommandRecognition = null;
let beepAudioContext = null;
let beepOscillator = null;
let beepGainNode = null;
let beepInterval = null;

// DOM elements
const startSpeechBtn = document.getElementById('start-speech-btn');
const recordingIndicator = document.getElementById('recording-indicator');
const transcriptDisplay = document.getElementById('transcript-display');
const transcriptText = document.getElementById('transcript-text');
const destinationInput = document.getElementById('destination-input');
const navigateBtn = document.getElementById('navigate-btn');
const voiceResponse = document.getElementById('voice-response');
const responseText = document.getElementById('response-text');

// Navigation screen elements
const homeScreen = document.getElementById('home-screen');
const navigationScreen = document.getElementById('navigation-screen');
const navDestination = document.getElementById('nav-destination');
const endNavigationBtn = document.getElementById('end-navigation-btn');
const navVoiceBtn = document.getElementById('nav-voice-btn');
const navRecordingIndicator = document.getElementById('nav-recording-indicator');
const navTranscriptDisplay = document.getElementById('nav-transcript-display');
const navTranscriptText = document.getElementById('nav-transcript-text');
const obstaclesAlert = document.getElementById('obstacles-alert');
const obstaclesList = document.getElementById('obstacles-list');
const soundsAlert = document.getElementById('sounds-alert');
const soundsList = document.getElementById('sounds-list');
const currentInstruction = document.getElementById('current-instruction');
const distanceDisplay = document.getElementById('distance-display');
const distanceValue = document.getElementById('distance-value');
const currentStepNum = document.getElementById('current-step-num');
const totalSteps = document.getElementById('total-steps');
const progressFill = document.getElementById('progress-fill');
const prevStepBtn = document.getElementById('prev-step-btn');
const nextStepBtn = document.getElementById('next-step-btn');
const safetyNotes = document.getElementById('safety-notes');
const safetyText = document.getElementById('safety-text');

// Map and camera elements
const mapDisplay = document.getElementById('map');
const cameraPreview = document.getElementById('camera-preview');
const toggleMapBtn = document.getElementById('toggle-map-btn');
const toggleCameraBtn = document.getElementById('toggle-camera-btn');
const detectionVideo = document.getElementById('detection-video');
const detectionCanvas = document.getElementById('detection-canvas');

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeAudioRecording();
    setupEventListeners();
    checkGeolocation();
    loadObjectDetectionModel();
    initializeYAMNet();
    initializeMap();
    document.addEventListener('pointerdown', ensureBeepAudioReady, { once: true });
});

// Initialize audio recording with MediaRecorder API
async function initializeAudioRecording() {
    try {
        // Check if MediaRecorder is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('MediaRecorder not supported');
        }
        
        console.log('Audio recording initialized - ready to record');
    } catch (error) {
        console.error('Audio recording initialization error:', error);
        startSpeechBtn.disabled = true;
        startSpeechBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i> <span>Mic not available</span>';
        startSpeechBtn.style.backgroundColor = '#95a5a6';
    }
}

// Initialize MediaPipe YAMNet for sound classification
async function initializeYAMNet() {
    const audioStatus = document.getElementById('audio-status');
    
    try {
        console.log('Loading MediaPipe YAMNet audio classifier...');
        
        // Check if MediaPipe Audio Tasks is loaded
        if (typeof window.AudioTasks === 'undefined') {
            console.warn('MediaPipe Audio Tasks library not loaded. Sound detection disabled.');
            if (audioStatus) {
                audioStatus.classList.add('status-warning');
            }
            return;
        }
        
        // Load MediaPipe Audio Tasks
        const audio = await window.AudioTasks.FilesetResolver.forAudioTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@0.10.0/wasm"
        );
        
        // Create audio classifier with YAMNet model
        audioClassifier = await window.AudioTasks.AudioClassifier.createFromOptions(audio, {
            baseOptions: {
                modelAssetPath: "/static/vendor/yamnet.tflite"
            }
        });
        
        console.log('✓ YAMNet audio classifier loaded successfully');
        if (audioStatus) {
            // Mark as warning since sound detection is disabled for now
            audioStatus.classList.add('status-warning');
            audioStatus.title = 'Audio classifier loaded but sound detection disabled';
        }
    } catch (error) {
        console.error('Failed to load YAMNet:', error);
        console.log('Sound detection will be disabled, but app will continue to work');
        audioClassifier = null;
        if (audioStatus) {
            audioStatus.classList.add('status-warning');
            audioStatus.title = 'Sound detection disabled';
        }
    }
}

// Load YOLOv8 object detection model
async function loadObjectDetectionModel() {
    const yoloStatus = document.getElementById('yolo-status');
    
    try {
        console.log('Connecting to YOLOv8 object detection service...');
        
        // Test connection to backend detection service
        const response = await fetch('/api/detection/health', { timeout: 3000 });
        if (response.ok) {
            console.log('✓ YOLOv8 object detection service connected');
            detectionModel = true; // Flag that service is available
            if (yoloStatus) {
                yoloStatus.classList.add('status-ok');
                yoloStatus.classList.remove('status-error');
            }
        } else {
            throw new Error('Detection service not available');
        }
    } catch (error) {
        console.error('Failed to connect to object detection service:', error);
        console.log('To enable object detection, run: python yolo_detection_service.py');
        detectionModel = null;
        if (yoloStatus) {
            yoloStatus.classList.add('status-error');
            yoloStatus.classList.remove('status-ok');
        }
    }
}

// Helper function to load scripts dynamically
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Set up event listeners
function setupEventListeners() {
    // Speech button
    startSpeechBtn.addEventListener('click', toggleSpeechRecognition);
    
    // Navigate button
    navigateBtn.addEventListener('click', function() {
        const destination = destinationInput.value.trim();
        if (destination) {
            startNavigation(destination);
        } else {
            speakResponse('Please enter a destination first.');
        }
    });
    
    // End navigation
    endNavigationBtn.addEventListener('click', endNavigation);
    
    // Navigation controls
    prevStepBtn.addEventListener('click', showPreviousStep);
    nextStepBtn.addEventListener('click', showNextStep);
    
    // Toggle map
    toggleMapBtn.addEventListener('click', toggleMap);
    
    // Toggle camera
    toggleCameraBtn.addEventListener('click', toggleCamera);
    
    // Navigation voice button
    navVoiceBtn.addEventListener('click', toggleNavigationVoice);
    
    // Allow Enter key in destination input
    destinationInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            navigateBtn.click();
        }
    });
}

// Toggle audio recording
async function toggleSpeechRecognition() {
    if (isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
}

// Toggle navigation voice commands
async function toggleNavigationVoice() {
    if (isRecording) {
        stopNavigationRecording();
    } else {
        await startNavigationRecording();
    }
}

// Start navigation voice recording
async function startNavigationRecording() {
    try {
        navTranscriptDisplay.classList.add('hidden');
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100,
            } 
        });
        
        const options = { mimeType: 'audio/webm' };
        mediaRecorder = new MediaRecorder(stream, options);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await transcribeNavigationAudio(audioBlob);
            
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        isRecording = true;
        navVoiceBtn.classList.add('listening');
        navRecordingIndicator.classList.remove('hidden');
        
        console.log('Navigation voice recording started...');
    } catch (error) {
        console.error('Error starting navigation recording:', error);
        speakResponse('Sorry, I could not access your microphone. Please check permissions.');
    }
}

// Stop navigation voice recording
function stopNavigationRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        navVoiceBtn.classList.remove('listening');
        navRecordingIndicator.classList.add('hidden');
        
        console.log('Navigation recording stopped');
    }
}

// Transcribe navigation audio
async function transcribeNavigationAudio(audioBlob) {
    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'navigation.webm');
        
        const response = await fetch('/api/speech/transcribe', {
            method: 'POST',
            body: formData,
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('Navigation command:', data.transcription);
        navTranscriptText.textContent = data.transcription;
        navTranscriptDisplay.classList.remove('hidden');
        
        // Parse intent and handle navigation commands
        if (data.intent) {
            handleUserIntent(data.intent, data.transcription);
        }
        
        // Hide transcript after 3 seconds
        setTimeout(() => {
            navTranscriptDisplay.classList.add('hidden');
        }, 3000);
    } catch (error) {
        console.error('Error transcribing navigation audio:', error);
        speakResponse('Sorry, I could not understand that command. Please try again.');
    }
}

// Start audio recording
async function startRecording() {
    try {
        transcriptDisplay.classList.add('hidden');
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100,
            } 
        });
        
        // Use webm format for better compatibility
        const options = { mimeType: 'audio/webm' };
        mediaRecorder = new MediaRecorder(stream, options);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await transcribeAudio(audioBlob);
            
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        isRecording = true;
        startSpeechBtn.classList.add('listening');
        recordingIndicator.classList.remove('hidden');
        
        console.log('Recording started...');
    } catch (error) {
        console.error('Error starting recording:', error);
        speakResponse('Sorry, I could not access your microphone. Please check permissions.');
    }
}

// Stop audio recording
function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        startSpeechBtn.classList.remove('listening');
        recordingIndicator.classList.add('hidden');
        
        console.log('Recording stopped');
    }
}

// Transcribe audio using backend Whisper API and LLM intent parsing
async function transcribeAudio(audioBlob) {
    try {
        speakResponse('Processing your speech...');
        
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        
        const response = await fetch('/api/speech/transcribe', {
            method: 'POST',
            body: formData,
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('Transcription:', data.transcription);
        transcriptText.textContent = data.transcription;
        transcriptDisplay.classList.remove('hidden');
        
        // Parse intent from LLM response (JSON format)
        if (data.intent) {
            handleUserIntent(data.intent, data.transcription);
        } else {
            // Fallback: speak the AI response
            speakResponse(data.response);
        }
    } catch (error) {
        console.error('Error transcribing audio:', error);
        speakResponse('Sorry, I encountered an error processing your speech. Please try again.');
    }
}

// Handle user intent from LLM
function handleUserIntent(intent, originalText) {
    console.log('Intent:', intent);
    
    // Store original query for context
    originalUserQuery = originalText;
    
    // Check for navigation commands during active navigation
    if (isNavigating) {
        const lowerText = originalText.toLowerCase();
        if (lowerText.includes('next') || lowerText.includes('continue')) {
            showNextStep();
            return;
        } else if (lowerText.includes('previous') || lowerText.includes('back') || lowerText.includes('repeat')) {
            showPreviousStep();
            return;
        } else if (lowerText.includes('where am i') || lowerText.includes('current step')) {
            speakResponse(`Step ${currentStepIndex + 1} of ${currentRoute.steps.length}: ${currentRoute.steps[currentStepIndex].instruction}`);
            return;
        }
    }
    
    switch (intent.action) {
        case 'navigate':
            if (intent.destination) {
                startNavigation(intent.destination, originalText);
            } else {
                speakResponse('Where would you like to navigate to?');
            }
            break;
            
        case 'help':
            speakResponse(intent.response || 'How can I help you with navigation?');
            break;
            
        case 'locate':
            if (intent.place) {
                findNearbyPlace(intent.place);
            } else {
                speakResponse('What would you like me to find nearby?');
            }
            break;
            
        case 'info':
            speakResponse(intent.response || 'I can help you navigate to places, find nearby locations, and provide assistance.');
            break;
            
        case 'emergency':
            speakResponse(intent.response || 'Please stay calm. Would you like me to help you find emergency services?');
            break;
            
        case 'unknown':
        default:
            // For unknown intents or general questions, just speak the AI's response
            // The AI has already processed the query and provided a response
            if (intent.response) {
                speakResponse(intent.response);
            } else {
                // Fallback: ask AI for general advice
                getGeneralAIAdvice(originalText);
            }
    }
}

// Get general AI advice for queries that don't match specific tools
async function getGeneralAIAdvice(query) {
    try {
        speakResponse('Let me think about that...');
        
        const context = {
            query: query,
            isNavigating: isNavigating,
            hasLocation: !!userLocation,
            currentStep: isNavigating && currentRoute ? currentRoute.steps[currentStepIndex]?.instruction : null
        };
        
        const response = await fetch('/api/navigation/general-advice', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(context)
        });
        
        if (response.ok) {
            const data = await response.json();
            speakResponse(data.advice || 'I apologize, I am not sure how to help with that. Please try asking me to navigate somewhere or find a nearby place.');
        } else {
            speakResponse('I am not sure how to help with that. You can ask me to navigate somewhere, find nearby places, or get directions.');
        }
    } catch (error) {
        console.error('Error getting general AI advice:', error);
        speakResponse('How can I assist you? You can ask me to navigate somewhere, find nearby places, or ask for help.');
    }
}

// Find nearby place
async function findNearbyPlace(placeType) {
    if (!userLocation) {
        speakResponse('Please enable location services to find nearby places.');
        return;
    }
    
    try {
        const response = await fetch(`/api/navigation/search-nearby?lat=${userLocation.latitude}&lon=${userLocation.longitude}&type=${placeType}`);
        const data = await response.json();
        
        if (data.places && data.places.length > 0) {
            const nearest = data.places[0];
            speakResponse(`The nearest ${placeType} is ${nearest.name}, about ${Math.round(nearest.distance)} meters away. Would you like directions?`);
        } else {
            speakResponse(`I couldn't find any ${placeType} nearby.`);
        }
    } catch (error) {
        console.error('Error finding nearby place:', error);
        speakResponse('Sorry, I encountered an error searching for nearby places.');
    }
}

// Legacy function - now handled by transcribeAudio
// Kept for backward compatibility if needed
async function processSpeech(text) {
    try {
        const response = await fetch('/api/speech/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ speechText: text })
        });

        const data = await response.json();
        speakResponse(data.response);
    } catch (error) {
        console.error('Error processing speech:', error);
        speakResponse('Sorry, I encountered an error processing your request.');
    }
}

// Start navigation to a destination
async function startNavigation(destination, userQuery = null) {
    if (!userLocation) {
        speakResponse('Please enable location services to start navigation.');
        return;
    }

    try {
        speakResponse('Searching for the best place...');
        
        const response = await fetch('/api/navigation/directions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                start: `${userLocation.latitude},${userLocation.longitude}`,
                destination: destination,
                userQuery: userQuery || destination
            })
        });

        const data = await response.json();

        if (data.route) {
            currentRoute = data.route;
            
            // Use coordinates from API response
            const startCoords = data.route.startCoords || { 
                lat: userLocation.latitude, 
                lon: userLocation.longitude 
            };
            
            const destCoords = data.route.destCoords || {
                lat: userLocation.latitude, 
                lon: userLocation.longitude
            };
            
            const destinationName = data.route.destinationName || destination;
            
            isNavigating = true;
            
            showNavigationScreen(destinationName);
            updateMapWithRoute(data.route, startCoords, destCoords);
            updateNavigationDisplay();
            
            // Start live location tracking
            startLocationTracking();
            
            // Start object detection with YOLO
            startObjectDetection();
            startSoundDetection();
            
            // Start AI guidance system (checks every 30 seconds)
            startAIGuidance();
            
            const distanceKm = (data.route.distance / 1000).toFixed(1);
            const durationMin = Math.round(data.route.duration / 60);
            
            // Use AI confirmation if available
            const confirmationMsg = data.route.aiConfirmation || 
                `Route found to ${destinationName}. ${data.route.steps.length} steps. Total distance: ${distanceKm} kilometers. Estimated time: ${durationMin} minutes.`;
            
            // Speak confirmation
            speakResponse(confirmationMsg);
            
            // Speak AI safety insights if available
            if (data.route.aiInsights) {
                setTimeout(() => {
                    speakResponse(data.route.aiInsights);
                }, 3000); // Wait 3 seconds after confirmation
            }
            
            // Speak first navigation instruction
            if (data.route.steps && data.route.steps.length > 0) {
                setTimeout(() => {
                    speakResponse(data.route.steps[0].instruction);
                }, data.route.aiInsights ? 10000 : 5000); // Wait for AI insights to finish
            }
        } else {
            speakResponse('Sorry, I could not find directions to that location.');
        }
    } catch (error) {
        console.error('Error getting directions:', error);
        speakResponse('Sorry, I encountered an error getting directions.');
    }
}

// Initialize Leaflet map
function initializeMap() {
    const mapStatus = document.getElementById('map-status');
    
    try {
        // Check if Leaflet is loaded
        if (typeof L === 'undefined') {
            console.error('Leaflet library not loaded. Map functionality disabled.');
            toggleMapBtn.disabled = true;
            toggleMapBtn.style.opacity = '0.5';
            toggleMapBtn.title = 'Map library failed to load';
            if (mapStatus) {
                mapStatus.classList.add('status-error');
            }
            return;
        }
        
        // Create map centered on default location
        map = L.map('map', {
            center: [37.7749, -122.4194], // San Francisco default
            zoom: 15,
            zoomControl: true,
        });
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(map);
        
        console.log('✓ Map initialized');
        if (mapStatus) {
            mapStatus.classList.add('status-ok');
        }
    } catch (error) {
        console.error('Failed to initialize map:', error);
        toggleMapBtn.disabled = true;
        toggleMapBtn.style.opacity = '0.5';
        if (mapStatus) {
            mapStatus.classList.add('status-error');
        }
    }
}

// Toggle map visibility
function toggleMap() {
    if (!map) {
        console.error('Map not initialized');
        return;
    }
    
    isMapVisible = !isMapVisible;
    console.log('Toggle map. Now visible:', isMapVisible);
    
    if (isMapVisible) {
        mapDisplay.classList.add('active');
        toggleMapBtn.innerHTML = '<i class="fas fa-map"></i><span>Hide Map</span>';
        
        console.log('Map display classes:', mapDisplay.className);
        console.log('Map display style:', window.getComputedStyle(mapDisplay).display);
        
        // Invalidate size after showing to fix rendering
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                console.log('Map size invalidated');
            }
        }, 100);
        
        // Center on current location if available
        if (userLocation) {
            map.setView([userLocation.latitude, userLocation.longitude], 15);
            console.log('Map centered on user location');
        }
    } else {
        mapDisplay.classList.remove('active');
        toggleMapBtn.innerHTML = '<i class="fas fa-map"></i><span>Show Map</span>';
    }
}

// Toggle camera visibility
function toggleCamera() {
    isCameraVisible = !isCameraVisible;
    
    if (isCameraVisible) {
        cameraPreview.classList.remove('hidden');
        cameraPreview.classList.add('active');
        toggleCameraBtn.innerHTML = '<i class="fas fa-video"></i><span>Hide Camera</span>';
        console.log('Starting camera preview...');
        ensureBeepAudioReady();
        startCameraPreview();
    } else {
        cameraPreview.classList.remove('active');
        cameraPreview.classList.add('hidden');
        toggleCameraBtn.innerHTML = '<i class="fas fa-video"></i><span>Show Camera</span>';
        stopCameraPreview();
    }
}

// Start camera preview with YOLO detection overlay
async function startCameraPreview() {
    try {
        console.log('Requesting camera access...');
        
        // Get camera stream
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: 640, 
                height: 480,
                facingMode: 'environment'
            } 
        });
        
        console.log('✓ Camera access granted');
        
        detectionVideo.srcObject = cameraStream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            detectionVideo.onloadedmetadata = () => {
                detectionVideo.play();
                resolve();
            };
        });
        
        // Set up canvas for drawing detection boxes
        const ctx = detectionCanvas.getContext('2d');
        detectionCanvas.width = 640;
        detectionCanvas.height = 480;
        
        console.log('✓ Video stream ready, starting detection...');
        
        // Start detection loop
        startObjectDetectionPreview(ctx);
        
        console.log('✓ Camera preview started');
    } catch (error) {
        console.error('Camera access error:', error);
        alert('Camera access denied. Please allow camera access in your browser settings to use object detection.');
        isCameraVisible = false;
        cameraPreview.classList.remove('active');
    }
}

// Stop camera preview
function stopCameraPreview() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    
    if (objectDetectionInterval) {
        clearInterval(objectDetectionInterval);
        objectDetectionInterval = null;
    }
    
    // Stop beeping when camera is turned off
    stopBeeping();
    
    // Clear canvas
    const ctx = detectionCanvas.getContext('2d');
    ctx.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height);
}

// Object detection with visual overlay
function startObjectDetectionPreview(ctx) {
    if (!detectionModel) {
        console.warn('Detection model not available');
        return;
    }
    
    objectDetectionInterval = setInterval(async () => {
        try {
            // Draw current video frame to canvas
            ctx.drawImage(detectionVideo, 0, 0, detectionCanvas.width, detectionCanvas.height);
            
            // Capture frame from canvas
            detectionCanvas.toBlob(async (blob) => {
                if (!blob) {
                    console.warn('Failed to create blob from canvas');
                    return;
                }
                
                const formData = new FormData();
                formData.append('image', blob, 'frame.jpg');
                
                try {
                    const response = await fetch('/api/detection/detect', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        
                        // Redraw video frame
                        ctx.drawImage(detectionVideo, 0, 0, detectionCanvas.width, detectionCanvas.height);
                        
                        // Draw detection boxes on top
                        if (data.detections && data.detections.length > 0) {
                            data.detections.forEach(det => {
                                if (det.confidence > 0.5) {
                                    drawDetectionBox(ctx, det);
                                }
                            });
                            
                            // Update beeping based on detections
                            updateBeeping(data.detections);
                            
                            // Update obstacles list
                            const obstacles = data.detections.filter(d => 
                                d.confidence > 0.5 && isRelevantObstacle(d.class_name)
                            );
                            if (obstacles.length > 0) {
                                updateObstaclesList(obstacles);
                            } else {
                                obstaclesAlert.classList.add('hidden');
                            }
                        } else {
                            obstaclesAlert.classList.add('hidden');
                            stopBeeping();
                        }
                    } else if (response.status === 503) {
                        console.warn('YOLO detection service not running.');
                        // Show message on canvas
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                        ctx.fillRect(0, 0, detectionCanvas.width, 100);
                        ctx.fillStyle = '#fff';
                        ctx.font = '16px Arial';
                        ctx.fillText('YOLO Service Not Running', 10, 30);
                        ctx.fillText('Start with: python yolo_detection_service.py', 10, 55);
                    } else {
                        console.error('Detection API error:', response.status);
                    }
                } catch (fetchError) {
                    if (fetchError.message.includes('fetch')) {
                        // Show message on canvas
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                        ctx.fillRect(0, 0, detectionCanvas.width, 100);
                        ctx.fillStyle = '#fff';
                        ctx.font = '16px Arial';
                        ctx.fillText('Cannot connect to YOLO service', 10, 30);
                        ctx.fillText('Make sure yolo_detection_service.py is running', 10, 55);
                    }
                    console.error('Fetch error:', fetchError.message);
                }
            }, 'image/jpeg', 0.8);
        } catch (error) {
            console.error('Detection error:', error);
        }
    }, 1500); // Detection every 1.5 seconds
}

// Draw detection box on canvas
function drawDetectionBox(ctx, detection) {
    const [x, y, w, h] = detection.bbox;
    
    // Draw box
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    
    // Draw label background
    const label = `${detection.class_name} ${Math.round(detection.confidence * 100)}%`;
    ctx.font = '16px Arial';
    const textWidth = ctx.measureText(label).width;
    
    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
    ctx.fillRect(x, y - 25, textWidth + 10, 25);
    
    // Draw label text
    ctx.fillStyle = '#000';
    ctx.fillText(label, x + 5, y - 7);
}

// Update map with route
function updateMapWithRoute(routeData, startCoords, destCoords) {
    if (!map) return;
    
    // Clear existing route and markers
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    if (markers.start) map.removeLayer(markers.start);
    if (markers.end) map.removeLayer(markers.end);
    if (markers.current) map.removeLayer(markers.current);
    
    // Draw route line
    if (routeData.geometry && routeData.geometry.coordinates) {
        const coordinates = routeData.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        
        routeLayer = L.polyline(coordinates, {
            color: '#3498db',
            weight: 5,
            opacity: 0.7,
        }).addTo(map);
        
        // Fit map to route bounds
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
    }
    
    // Add markers
    markers.start = L.marker([startCoords.lat, startCoords.lon], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(map).bindPopup('Start');
    
    markers.end = L.marker([destCoords.lat, destCoords.lon], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(map).bindPopup('Destination');
    
    // Add current position marker if available
    if (userLocation) {
        updateCurrentPositionMarker(userLocation.latitude, userLocation.longitude);
    }
}

// Update current position marker on map
function updateCurrentPositionMarker(lat, lon) {
    if (!map) return;
    
    if (markers.current) {
        markers.current.setLatLng([lat, lon]);
    } else {
        markers.current = L.marker([lat, lon], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(map).bindPopup('You are here');
    }
}

// Show navigation screen
function showNavigationScreen(destination) {
    console.log('Showing navigation screen...');
    
    homeScreen.classList.remove('active');
    homeScreen.classList.add('hidden');
    
    navigationScreen.classList.remove('hidden');
    navigationScreen.classList.add('active');
    
    navDestination.textContent = destination;
    
    console.log('Navigation screen classes:', navigationScreen.className);
    
    // Automatically show map
    if (!isMapVisible) {
        console.log('Toggling map visibility...');
        toggleMap();
    }
    
    // Update button text for last step
    updateNavigationButtons();
}

// Update navigation display
function updateNavigationDisplay(shouldSpeak = false) {
    if (!currentRoute || !currentRoute.steps || currentRoute.steps.length === 0) {
        currentInstruction.textContent = 'No instructions available';
        return;
    }

    const step = currentRoute.steps[currentStepIndex];
    currentInstruction.textContent = step.instruction || 'Getting instructions...';
    
    // Update step counter
    currentStepNum.textContent = currentStepIndex + 1;
    totalSteps.textContent = currentRoute.steps.length;
    
    // Update progress bar
    const progressPercent = ((currentStepIndex + 1) / currentRoute.steps.length) * 100;
    progressFill.style.width = `${progressPercent}%`;
    
    // Calculate actual distance to next maneuver if we have location
    if (userLocation && step.maneuver && step.maneuver.location) {
        const maneuverPoint = step.maneuver.location;
        const distanceToManeuver = calculateDistanceInMeters(
            userLocation.latitude,
            userLocation.longitude,
            maneuverPoint[1], // lat
            maneuverPoint[0]  // lon
        );
        distanceValue.textContent = Math.round(distanceToManeuver);
        distanceDisplay.classList.remove('hidden');
    } else {
        // Fallback to step distance
        distanceValue.textContent = step.distance || '?';
        distanceDisplay.classList.remove('hidden');
    }
    
    // Update navigation buttons
    updateNavigationButtons();
    
    // Speak the instruction if requested (manual step change)
    if (shouldSpeak) {
        speakResponse(`Step ${currentStepIndex + 1}: ${step.instruction}`);
    }
    
    // Show safety notes if available on first step
    if (currentStepIndex === 0 && currentRoute.safetyNotes) {
        safetyText.textContent = currentRoute.safetyNotes;
        safetyNotes.classList.remove('hidden');
    }
}

// Update navigation buttons state
function updateNavigationButtons() {
    prevStepBtn.disabled = currentStepIndex === 0;
    
    if (currentStepIndex === currentRoute.steps.length - 1) {
        nextStepBtn.innerHTML = '<i class="fas fa-flag-checkered"></i> Arrived';
    } else {
        nextStepBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Next Step';
    }
}

// Show next step
function showNextStep() {
    if (currentStepIndex < currentRoute.steps.length - 1) {
        currentStepIndex++;
        updateNavigationDisplay(true); // Speak the new step
    } else {
        // Navigation complete
        speakResponse(`You have arrived at your destination: ${navDestination.textContent}`);
        endNavigation();
    }
}

// Show previous step
function showPreviousStep() {
    if (currentStepIndex > 0) {
        currentStepIndex--;
        updateNavigationDisplay(true); // Speak the previous step
    }
}

// Start AI guidance system (runs every 30 seconds)
function startAIGuidance() {
    console.log('Starting AI guidance system...');
    
    // Clear any existing interval
    if (aiGuidanceInterval) {
        clearInterval(aiGuidanceInterval);
    }
    
    // Run immediately first time
    checkAIGuidance();
    
    // Then every 30 seconds
    aiGuidanceInterval = setInterval(() => {
        checkAIGuidance();
    }, 30000);
}

// Check if AI should provide guidance based on current situation
async function checkAIGuidance() {
    if (!currentRoute || !currentRoute.steps) {
        console.log('No route available for AI guidance');
        return;
    }
    
    const now = Date.now();
    if (now - lastAIGuidanceTime < 25000) {
        // Don't run too frequently even if triggered manually
        return;
    }
    
    try {
        const currentStep = currentRoute.steps[currentStepIndex];
        if (!currentStep) return;
        
        const routeContext = `Step ${currentStepIndex + 1} of ${currentRoute.steps.length}. ${Math.round(currentRoute.distance)}m total distance remaining.`;
        
        console.log('Requesting AI guidance analysis...');
        
        const response = await fetch('/api/navigation/analyze-situation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                currentStep: currentStep.instruction,
                detections: lastDetections,
                routeContext: routeContext
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            const analysis = data.analysis;
            
            console.log('AI Analysis:', analysis);
            
            if (analysis && analysis.shouldAlert && analysis.guidance) {
                // Provide guidance if AI thinks it's needed
                console.log(`AI Guidance (${analysis.urgency}): ${analysis.guidance}`);
                
                // Always speak AI guidance (it's important)
                speakResponse(analysis.guidance);
                lastAIGuidanceTime = now;
            }
        }
    } catch (error) {
        console.error('Error getting AI guidance:', error);
    }
}

// Stop AI guidance system
function stopAIGuidance() {
    if (aiGuidanceInterval) {
        clearInterval(aiGuidanceInterval);
        aiGuidanceInterval = null;
        console.log('AI guidance system stopped');
    }
}

// End navigation
function endNavigation() {
    navigationScreen.classList.remove('active');
    navigationScreen.classList.add('hidden');
    
    homeScreen.classList.remove('hidden');
    homeScreen.classList.add('active');
    
    // Stop all tracking and detection
    stopLocationTracking();
    stopObjectDetection();
    stopSoundDetection();
    stopAIGuidance();
    
    // Stop camera if running
    if (isCameraVisible) {
        toggleCamera();
    }
    
    // Clear map route
    if (routeLayer && map) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }
    
    // Reset navigation state
    currentRoute = null;
    currentStepIndex = 0;
    isNavigating = false;
    isMapVisible = false;
    mapDisplay.classList.remove('active');
    toggleMapBtn.innerHTML = '<i class="fas fa-map"></i><span>Show Map</span>';
    lastDetections = [];
    originalUserQuery = '';
    
    speakResponse('Navigation ended.');
}

// Check and get user's geolocation
function checkGeolocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                userLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                console.log('Location acquired:', userLocation);
            },
            function(error) {
                console.error('Error getting location:', error);
                // We can proceed without location, but navigation will be limited
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            }
        );
    } else {
        console.log('Geolocation is not supported by this browser.');
    }
}

// Start watching user's location for live navigation
function startLocationTracking() {
    if (!navigator.geolocation) {
        console.error('Geolocation not supported');
        return;
    }
    
    console.log('Starting live location tracking...');
    
    locationWatchId = navigator.geolocation.watchPosition(
        function(position) {
            const newLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                heading: position.coords.heading
            };
            
            console.log('Location update:', newLocation);
            
            // Update user location
            userLocation = newLocation;
            
            // Update map marker
            updateCurrentPositionMarker(newLocation.latitude, newLocation.longitude);
            
            // Update distance to next maneuver
            updateDistanceDisplay(newLocation);
            
            // Check if user has moved to next step
            if (currentRoute && currentRoute.steps && isNavigating) {
                checkStepCompletion(newLocation);
            }
        },
        function(error) {
            console.error('Location tracking error:', error);
        },
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0 // Always get fresh location
        }
    );
}

// Update distance display with current location
function updateDistanceDisplay(location) {
    if (!currentRoute || !currentRoute.steps || !location) {
        return;
    }
    
    const step = currentRoute.steps[currentStepIndex];
    if (step && step.maneuver && step.maneuver.location) {
        const maneuverPoint = step.maneuver.location;
        const distance = calculateDistanceInMeters(
            location.latitude,
            location.longitude,
            maneuverPoint[1],
            maneuverPoint[0]
        );
        
        distanceValue.textContent = Math.round(distance);
    }
}

// Stop watching user's location
function stopLocationTracking() {
    if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
        console.log('Location tracking stopped');
    }
}

// Check if user has completed current step and should move to next
function checkStepCompletion(location) {
    if (!currentRoute || !currentRoute.steps || currentStepIndex >= currentRoute.steps.length - 1) {
        return;
    }
    
    const currentStep = currentRoute.steps[currentStepIndex];
    const nextStep = currentRoute.steps[currentStepIndex + 1];
    
    // Get the end point of current step (start of next step)
    if (nextStep && nextStep.maneuver && nextStep.maneuver.location) {
        const stepEndPoint = nextStep.maneuver.location;
        const distance = calculateDistanceInMeters(
            location.latitude,
            location.longitude,
            stepEndPoint[1],
            stepEndPoint[0]
        );
        
        // If within 15 meters of the next maneuver point, advance to next step
        if (distance < 15) {
            console.log(`User reached step completion point (${Math.round(distance)}m away)`);
            advanceToNextStep();
        }
    }
}

// Automatically advance to next step
function advanceToNextStep() {
    if (currentStepIndex < currentRoute.steps.length - 1) {
        currentStepIndex++;
        updateNavigationDisplay(true); // Speak when auto-advancing
        console.log('Auto-advanced to next step');
    }
}

// Calculate distance between two coordinates in meters
function calculateDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
}

// Start real-time object detection with YOLOv8 (background mode)
async function startObjectDetection() {
    if (!detectionModel) {
        console.warn('Object detection service not available - skipping detection');
        return;
    }
    
    // If camera is already visible, detection is handled by preview mode
    if (isCameraVisible) {
        console.log('Detection already running in camera preview mode');
        return;
    }
    
    try {
        console.log('Starting background object detection...');
        ensureBeepAudioReady();
        
        // Get camera stream in background
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: 640, 
                height: 480,
                facingMode: 'environment'
            } 
        });
        
        detectionVideo.srcObject = cameraStream;
        
        // Wait for video to load
        await new Promise((resolve) => {
            detectionVideo.onloadedmetadata = () => {
                detectionVideo.play();
                resolve();
            };
        });
        
        const ctx = detectionCanvas.getContext('2d');
        detectionCanvas.width = 640;
        detectionCanvas.height = 480;
        
        console.log('✓ Background camera started');
        
        // Run YOLOv8 detection every 2 seconds
        objectDetectionInterval = setInterval(async () => {
            // Skip if camera preview is active (it handles its own detection)
            if (isCameraVisible) return;
            
            try {
                // Capture frame from video
                ctx.drawImage(detectionVideo, 0, 0, 640, 480);
                
                // Convert canvas to blob
                detectionCanvas.toBlob(async (blob) => {
                    if (!blob) return;
                    
                    const formData = new FormData();
                    formData.append('image', blob, 'frame.jpg');
                    
                    try {
                        // Send to YOLOv8 detection service
                        const response = await fetch('/api/detection/detect', {
                            method: 'POST',
                            body: formData
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            
                            if (data.detections && data.detections.length > 0) {
                                // Filter for relevant obstacles
                                const obstacles = data.detections.filter(det => 
                                    det.confidence > 0.5 && isRelevantObstacle(det.class_name)
                                );
                                
                                if (obstacles.length > 0) {
                                    updateObstaclesList(obstacles);
                                } else {
                                    obstaclesAlert.classList.add('hidden');
                                }

                                // Update beeping pattern for any detections (even non-obstacles)
                                updateBeeping(data.detections);
                            } else {
                                // Clear alerts if no obstacles
                                obstaclesAlert.classList.add('hidden');
                                stopBeeping();
                            }
                        } else if (response.status === 503) {
                            console.warn('YOLO detection service not running. Start with: python yolo_detection_service.py');
                            // Stop trying after first failure
                            stopObjectDetection();
                            stopBeeping();
                            detectionModel = null;
                        }
                    } catch (fetchError) {
                        // Network error - service not running
                        if (fetchError.message.includes('fetch')) {
                            console.warn('Cannot connect to YOLO service. Make sure it\'s running: python yolo_detection_service.py');
                            stopObjectDetection();
                            stopBeeping();
                            detectionModel = null;
                        } else {
                            console.error('Detection fetch error:', fetchError);
                        }
                    }
                }, 'image/jpeg', 0.8);
            } catch (error) {
                console.error('Detection error:', error);
                stopBeeping();
            }
        }, 2000);
        
        console.log('✓ Background object detection started');
    } catch (error) {
        console.error('Camera access error:', error);
        console.log('Object detection will be disabled. User can still toggle camera manually.');
        stopBeeping();
    }
}

// Stop object detection
function stopObjectDetection() {
    if (objectDetectionInterval) {
        clearInterval(objectDetectionInterval);
        objectDetectionInterval = null;
    }
    
    // Don't stop camera stream if preview is visible
    if (!isCameraVisible && cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    stopBeeping();
}

// Check if detected class is a relevant obstacle
function isRelevantObstacle(className) {
    const relevantClasses = [
        'person', 'bicycle', 'car', 'motorcycle', 'bus', 'truck',
        'traffic light', 'fire hydrant', 'stop sign', 'parking meter',
        'bench', 'chair', 'potted plant', 'dog', 'cat',
    ];
    return relevantClasses.includes(className);
}

// Update obstacles list with YOLOv8 detections
function updateObstaclesList(obstacles) {
    // Store detections for AI analysis
    lastDetections = obstacles;
    
    // Clear old list
    obstaclesList.innerHTML = '';
    
    // Group by class and count
    const grouped = {};
    obstacles.forEach(obs => {
        const className = obs.class_name || obs.class;
        if (!grouped[className]) {
            grouped[className] = {
                count: 0,
                maxConfidence: 0,
                minDistance: Infinity,
            };
        }
        grouped[className].count++;
        grouped[className].maxConfidence = Math.max(grouped[className].maxConfidence, obs.confidence || obs.score);
        
        // Calculate distance from bounding box (YOLOv8 format: [x, y, w, h])
        const bbox = obs.bbox || obs.box;
        const boxArea = (bbox[2] * bbox[3]) / (640 * 480);
        const estimatedDistance = estimateDistance(boxArea);
        grouped[className].minDistance = Math.min(grouped[className].minDistance, estimatedDistance);
    });
    
    // Add to list (visual only, no TTS - beeping provides audio feedback)
    Object.entries(grouped).forEach(([className, info]) => {
        const li = document.createElement('li');
        const countText = info.count > 1 ? `${info.count} ${className}s` : className;
        const distanceText = info.minDistance < 5 ? ' (very close)' : info.minDistance < 10 ? ' (nearby)' : '';
        li.textContent = `${countText}${distanceText}`;
        obstaclesList.appendChild(li);
    });
    
    obstaclesAlert.classList.remove('hidden');
    
    // No TTS - beeping provides audio feedback for obstacles
}

// Estimate distance based on object size in frame (rough approximation)
function estimateDistance(areaRatio) {
    // This is a very rough approximation
    // In reality, you'd need object size and focal length
    if (areaRatio > 0.3) return 2; // Very close
    if (areaRatio > 0.15) return 5; // Close
    if (areaRatio > 0.05) return 10; // Medium
    return 20; // Far
}

// Check if speech synthesis is currently speaking
function isCurrentlySpeaking() {
    return 'speechSynthesis' in window && window.speechSynthesis.speaking;
}

// Start sound detection with MediaPipe YAMNet
async function startSoundDetection() {
    // TODO: Implement sound detection via whisper server to avoid audio context conflicts
    // For now, sound detection is disabled to prevent AudioContext sample rate conflicts
    console.log('Sound detection disabled (will be implemented via whisper server)');
    return;
    
    /* DISABLED - Audio context conflicts with MediaPipe
    if (!audioClassifier) {
        console.warn('YAMNet audio classifier not loaded - skipping sound detection');
        return;
    }
    
    try {
        // Get microphone stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
            } 
        });
        
        // Create a NEW audio context specifically for sound detection
        // This avoids conflicts with MediaPipe's internal audio context
        const detectionAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        console.log(`Detection audio context sample rate: ${detectionAudioContext.sampleRate} Hz`);
        
        // Create media stream source
        const source = detectionAudioContext.createMediaStreamSource(stream);
        const scriptNode = detectionAudioContext.createScriptProcessor(16384, 1, 1);
        
        soundDetectionActive = true;
        
        // Store reference for cleanup
        audioContext = detectionAudioContext;
        
        console.log('✓ Sound detection audio processing started');
        
        // Dangerous sound categories to alert on
        const dangerousSounds = [
            'Vehicle', 'Car', 'Motor vehicle', 'Car horn', 'Truck', 'Bus',
            'Siren', 'Emergency vehicle', 'Ambulance siren', 'Fire engine',
            'Train', 'Train horn', 'Railway',
            'Motorcycle', 'Traffic noise',
            'Construction', 'Jackhammer', 'Power tool'
        ];
        
        let lastAlertTime = 0;
        const ALERT_COOLDOWN = 5000; // 5 seconds between alerts
        
        scriptNode.onaudioprocess = function (audioProcessingEvent) {
            if (!soundDetectionActive) return;
            
            const inputBuffer = audioProcessingEvent.inputBuffer;
            const inputData = inputBuffer.getChannelData(0);
            
            try {
                // Classify the audio with YAMNet
                const results = audioClassifier.classify(inputData);
                
                if (results && results.length > 0) {
                    const classifications = results[0].classifications[0].categories;
                    
                    // Check top 3 classifications for dangerous sounds
                    for (let i = 0; i < Math.min(3, classifications.length); i++) {
                        const category = classifications[i];
                        
                        // Check if it's a dangerous sound with sufficient confidence
                        if (category.score > 0.3 && isDangerousSound(category.categoryName, dangerousSounds)) {
                            const now = Date.now();
                            
                            // Alert only if cooldown period has passed
                            if (now - lastAlertTime > ALERT_COOLDOWN) {
                                soundsList.textContent = `Sound: ${category.categoryName} (${(category.score * 100).toFixed(0)}% confidence)`;
                                soundsAlert.classList.remove('hidden');
                                
                                if (!isCurrentlySpeaking()) {
                                    speakResponse(`Caution: Detected ${category.categoryName} nearby`);
                                }
                                
                                lastAlertTime = now;
                            }
                            break;
                        }
                    }
                }
            } catch (error) {
                console.error('Audio classification error:', error);
            }
        };
        
        source.connect(scriptNode);
        scriptNode.connect(detectionAudioContext.destination);
        
        console.log('✓ YAMNet sound detection started');
    } catch (error) {
        console.error('Error starting sound detection:', error);
        speakResponse('Microphone access denied for sound detection.');
    }
    */
}

// Check if a sound is dangerous
function isDangerousSound(soundName, dangerousList) {
    const lowerSound = soundName.toLowerCase();
    return dangerousList.some(danger => 
        lowerSound.includes(danger.toLowerCase()) || 
        danger.toLowerCase().includes(lowerSound)
    );
}

// Stop sound detection
function stopSoundDetection() {
    soundDetectionActive = false;
    if (audioContext && audioContext.state === 'running') {
        audioContext.suspend();
    }
}

// Text-to-speech function
function speakResponse(text) {
    if (!text) return;
    
    responseText.textContent = text;
    voiceResponse.classList.remove('hidden');
    
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9; // Slightly slower for better comprehension
        utterance.pitch = 1;
        utterance.volume = 1;
        
        speechSynthesis.speak(utterance);
    }
}

// Initialize beeping audio context
function ensureBeepAudioReady() {
    try {
        initBeepAudio();
    } catch (error) {
        console.error('Unable to initialize beep audio:', error);
    }
}

function initBeepAudio() {
    if (!beepAudioContext) {
        beepAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('✓ Beep audio context created');
    }
    // Resume context if suspended (browser security requirement)
    if (beepAudioContext.state === 'suspended') {
        beepAudioContext.resume().then(() => {
            console.log('✓ Beep audio context resumed');
        });
    }
}

// Calculate beep frequency based on closest object distance
function calculateBeepInterval(detections) {
    if (!detections || detections.length === 0) {
        return null; // No objects, no beeping
    }
    
    // Canvas dimensions (640x480 as set in startCameraPreview)
    const canvasWidth = 640;
    const canvasHeight = 480;
    const totalArea = canvasWidth * canvasHeight;
    
    // Find closest object based on bounding box size (larger = closer)
    let largestAreaRatio = 0;
    detections.forEach(det => {
        if (det.confidence > 0.5 && det.bbox) {
            let width = det.bbox[2];
            let height = det.bbox[3];
            
            // Fallback to box coordinates if width/height are zero after rounding
            if (!width || !height) {
                if (det.box && det.box.length === 4) {
                    width = det.box[2] - det.box[0];
                    height = det.box[3] - det.box[1];
                }
            }
            
            if (width > 0 && height > 0) {
                const area = width * height;
                const areaRatio = area / totalArea; // Normalize to 0-1
                if (areaRatio > largestAreaRatio) {
                    largestAreaRatio = areaRatio;
                }
            }
        }
    });
    
    if (largestAreaRatio <= 0) {
        return null;
    }
    
    console.log('Largest object area ratio:', largestAreaRatio.toFixed(4)); // Debug
    
    // Map area ratio to beep interval (larger area = faster beeping)
    if (largestAreaRatio < 0.01) return 2000; // Very far - 2 seconds
    if (largestAreaRatio < 0.02) return 1200; // Far - 1.2 seconds
    if (largestAreaRatio < 0.04) return 700;  // Medium - 0.7 seconds
    if (largestAreaRatio < 0.08) return 350;  // Close - 0.35 seconds
    return 150; // Very close - rapid beeping
}

// Start or update beeping based on detections
function updateBeeping(detections) {
    const interval = calculateBeepInterval(detections);
    
    if (!interval) {
        // Stop beeping if no objects
        stopBeeping();
        return;
    }
    
    // If beeping is already running with same interval, do nothing
    if (beepInterval && beepInterval.interval === interval) {
        return;
    }
    
    // Stop existing beeping
    stopBeeping();
    
    console.log(`Starting beeping with ${interval}ms interval`);
    
    // Start new beeping pattern
    initBeepAudio();
    beepInterval = {
        interval: interval,
        timer: setInterval(() => {
            playBeep();
        }, interval)
    };
    
    // Play immediate beep
    playBeep();
}

// Play a single beep
function playBeep() {
    if (!beepAudioContext) {
        console.warn('Beep audio context not initialized');
        return;
    }
    
    try {
        if (beepAudioContext.state === 'suspended') {
            beepAudioContext.resume().catch(err => console.error('Failed to resume beep audio context:', err));
        }

        const oscillator = beepAudioContext.createOscillator();
        const gainNode = beepAudioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(beepAudioContext.destination);
        
        oscillator.frequency.value = 800; // 800 Hz beep
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, beepAudioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, beepAudioContext.currentTime + 0.1);
        
        oscillator.start(beepAudioContext.currentTime);
        oscillator.stop(beepAudioContext.currentTime + 0.1);
    } catch (error) {
        console.error('Error playing beep:', error);
    }
}

// Stop beeping
function stopBeeping() {
    if (beepInterval) {
        clearInterval(beepInterval.timer);
        beepInterval = null;
    }
}

