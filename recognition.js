import {
  GestureRecognizer,
  FaceDetector,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

let gestureRecognizer;
let faceDetector;
let lastVideoTime = -1;
let lastFingerPos = null;
let movementAccum = 0;
let lastMovementTs = 0;
let lastOneFingerTs = 0;
let cachedFaceDetected = 0;
let lastFaceInferenceTs = 0;

const movementThreshold = 0.1;
const oneFingerLostGraceMs = 220;
const movementDecayPerSecond = 0.06;
const faceDetectIntervalMs = 140;

const hiddenVideo = document.createElement("video");
hiddenVideo.autoplay = true;
hiddenVideo.playsInline = true;
hiddenVideo.muted = true;
hiddenVideo.style.display = "none";
document.body.appendChild(hiddenVideo);

function setHandles(faceDetected, pointingFingerMovementDetected) {
  if (typeof window.setRecognitionHandles === "function") {
    window.setRecognitionHandles({
      faceDetected,
      pointingFingerMovementDetected
    });
  }
}

function detectPointingFingerMovement(landmarksList, now) {
  if (lastMovementTs > 0) {
    const dtSec = Math.max(0, (now - lastMovementTs) / 1000);
    movementAccum = Math.max(0, movementAccum - movementDecayPerSecond * dtSec);
  }
  lastMovementTs = now;

  if (!landmarksList || landmarksList.length === 0) {
    if (now - lastOneFingerTs > oneFingerLostGraceMs) {
      lastFingerPos = null;
      movementAccum = 0;
    }
    return 0;
  }

  const lm = landmarksList[0];
  if (!lm || lm.length < 21) {
    if (now - lastOneFingerTs > oneFingerLostGraceMs) {
      lastFingerPos = null;
      movementAccum = 0;
    }
    return 0;
  }

  const indexUp = lm[8].y < lm[6].y;
  const middleDown = lm[12].y > lm[10].y;
  const ringDown = lm[16].y > lm[14].y;
  const pinkyDown = lm[20].y > lm[18].y;
  const oneFingerUp = indexUp && middleDown && ringDown && pinkyDown;

  const fx = lm[8].x;
  const fy = lm[8].y;

  if (oneFingerUp) {
    lastOneFingerTs = now;
    if (lastFingerPos) {
      const dx = fx - lastFingerPos.x;
      const dy = fy - lastFingerPos.y;
      movementAccum += Math.hypot(dx, dy);
    }
    lastFingerPos = { x: fx, y: fy };
  } else if (now - lastOneFingerTs > oneFingerLostGraceMs) {
    lastFingerPos = null;
    movementAccum = 0;
  }

  if (movementAccum >= movementThreshold) {
    movementAccum = 0;
    lastFingerPos = null;
    return 1;
  }

  return 0;
}

function predictWebcam() {
  if (!gestureRecognizer || !faceDetector) {
    return;
  }

  if (hiddenVideo.currentTime !== lastVideoTime) {
    lastVideoTime = hiddenVideo.currentTime;
    const now = performance.now();
    if (now - lastFaceInferenceTs >= faceDetectIntervalMs) {
      const faceResults = faceDetector.detectForVideo(hiddenVideo, now);
      const detections = faceResults.detections ?? [];
      cachedFaceDetected = detections.length > 0 ? 1 : 0;
      lastFaceInferenceTs = now;
    }

    const gestureResults = gestureRecognizer.recognizeForVideo(hiddenVideo, now);
    const pointingFingerMovementDetected = detectPointingFingerMovement(
      gestureResults.landmarks,
      now
    );

    setHandles(cachedFaceDetected, pointingFingerMovementDetected);
  }

  window.requestAnimationFrame(predictWebcam);
}

async function initRecognition() {
  setHandles(0, 0);

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );

  gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    cannedGesturesClassifierOptions: {
      scoreThreshold: 0,
      maxResults: 8
    }
  });

  faceDetector = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
      delegate: "GPU"
    },
    runningMode: "VIDEO"
  });

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 }
    }
  });
  hiddenVideo.srcObject = stream;
  await hiddenVideo.play();

  window.requestAnimationFrame(predictWebcam);
}

initRecognition().catch(() => {
  setHandles(0, 0);
});
