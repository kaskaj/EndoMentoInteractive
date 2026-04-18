// Canvas
let canvX = 1920;
let canvY = 1080;
let pixDensity = 1;

// Tiles
let tilesX = 60;
let tileWidth = canvX / tilesX;
let tilesY = Math.ceil(canvY / tileWidth);

// Color Section limits
let secHigh = 0.5;
let secLow = 0.35;

// Colors
let colorBG = "#fff9daff"; 
let colorHigh = "#ff1b37";
let colorLow = "#ff33d2";

// Brush settings
let brushLengthBase = 6.0;
let brushLengthMultiplier = 2.0;
let brushWeight = 20.0;
let brushVibration = 0.8;
let brushSpacing = 5;
let brushQuality = 10;

// Brush angles
let angleLow = -20.0;
let angleHigh = 100.0;

// Noise scale settings
let noiseScaleColor = 0.001;
let noiseScaleAngle = 0.02; 
let noiseScaleColorMultiplier = 2.0;
let noiseScaleAngleMultiplier = 1.0;

// Position map
let startPos = [];
let noiseFieldTopSample = 0;

// Transition
let shrink = 1;
const shrinkMin = 0.02;
const shrinkMax = 1;
const transitionStep = 0.02;

// Font
let fontSemiBold;
let fontSemiBoldIt;

// Recognition handles
let faceDetected = false;
let fingerGestureDetected = false;

// Interaction stages
let stage;
const stageAnimation = 1;
const stageInvite = 2;
const stageTransitionIn = 3;
const stageInfo = 4;
const stageTransitionOut = 5;

// Interaction timing
const infoWaitTime = 1000;
const POLL_MS = 10;

// Load font
function preload() {
  const scriptUrl = document.currentScript
  ? new URL(document.currentScript.src, window.location.href)
  : new URL("interactive.js", window.location.href);
  const fontUrlSemiBold = new URL("STIXTwoText-SemiBold.ttf", scriptUrl).href;
  const fontUrlSemiBoldIt = new URL("STIXTwoText-SemiBoldItalic.ttf", scriptUrl).href;

  fontSemiBold = loadFont(fontUrlSemiBold);
  fontSemiBoldIt = loadFont(fontUrlSemiBoldIt);
}

function configureBrushes() {
  brush.add("EndoBrush", {
    type: "default",
    weight: brushWeight,
    vibration: brushVibration,
    definition: 1,
    quality: brushQuality,
    opacity: 100,
    spacing: brushSpacing,
    blend: false,
    pressure: {
      type: "standard",
      curve: [0.15, 0.2],
      min_max: [0.9, 1.2]
    }
  });
}

function noiseGen(x, y, t, noiseScale = 0.01) {
  return noise(noiseScale * x, noiseScale * y, noiseScale * t);
}

function brushAngleField(name, noiseScale, angleLow, angleHigh) {
  brush.addField(name, function (t, field) {
    for (let c = 0; c < field.length; c++) {
      for (let r = 0; r < field[0].length; r++) {
        // Generate noise
        let noise_raw = noiseGen(r, c, t, noiseScale)
        // Section noise
        field[c][r] = map(noise_raw, 0, 1, angleLow, angleHigh)
      }
    }
    return field;
  });
}

function getStartPositions() {
  startPos = Array.from({ length: tilesX }, (_, x) =>
    Array.from({ length: tilesY }, (_, y) => ({
      x: random(x * tileWidth, x * tileWidth + tileWidth),
      y: random(y * tileWidth, y * tileWidth + tileWidth)
    }))
  );
}

function initializeBrushFields() {
  brush.field("bottomFlowField");
  brush.field("topFlowField");
  brushAngleField("bottomFlowField", noiseScaleAngle, angleLow, angleHigh);
  brushAngleField("topFlowField", noiseScaleAngle * noiseScaleAngleMultiplier, angleLow, angleHigh);
}

function selectBrushColor(noiseField){
  if (noiseField >= secHigh) { return colorHigh; }
  else if (noiseField< secHigh && noiseField> secLow) { return colorLow; }
  else { return colorBG; }
}

// Recognition Handles from "recognition.js"
window.setRecognitionHandles = function ({
  faceDetected: nextFaceDetected,
  pointingFingerMovementDetected: nextFingerGestureDetected
} = {}) {
  faceDetected = !!nextFaceDetected;
  fingerGestureDetected = !!nextFingerGestureDetected;
};
window.getRecognitionHandles = function () {
  return {
    faceDetected: faceDetected,
    pointingFingerMovementDetected: fingerGestureDetected
  };
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFace() {
  while (true) {
    if (faceDetected) { return true; }
    await sleep(POLL_MS);
  }
}

async function waitForGestureOrFaceLost() {
  while (true) {
    if (!faceDetected) { return "face_lost"; }
    if (fingerGestureDetected) { return true; }
    await sleep(POLL_MS);
  }
}

async function waitForFaceLost(ms) {
  let noFaceSince = null;
  while (true) {
    // Reset timer if a face is detected
    if (faceDetected) { noFaceSince = null; }
    // If the face is no longer detected, count the time
    else if (noFaceSince === null) { noFaceSince = Date.now(); }
    // If the face is no detected for a certain amount of time, end stage
    else if (Date.now() - noFaceSince >= ms) { return; }
    await sleep(POLL_MS);
  }
}

async function waitForShrinkReached() {
  while (true) {
    if (shrink <= shrinkMin) { return; }
    await sleep(POLL_MS);
  }
}

async function waitForShrinkRestored() {
  while (true) {
    if (shrink >= shrinkMax) { return; }
    await sleep(POLL_MS);
  }
}

// Main loop
async function runInteractiveFlow() {
  while (true) {
    // Play animation until the face is detected
    stage = stageAnimation;
    shrink = shrinkMax;
    await waitForFace();
    // If the face is detected, invite visitor for interaction by gestrue
    stage = stageInvite;
    const event = await waitForGestureOrFaceLost();
    if (event === "face_lost") { continue; }
    // If there is no gesture, continue with animation
    // If there is a gesture, end animation and show more information
    stage = stageTransitionIn;
    await waitForShrinkReached();
    // Show more info if the face is detected
    stage = stageInfo;
    await waitForFaceLost(infoWaitTime);
    // If there is no face anymore, wait few seconds then transition
    stage = stageTransitionOut;
    shrink = shrinkMin;
    await waitForShrinkRestored();
    // And go back to the animation
    stage = stageAnimation;
  }
}

// Main logic
function drawScene() {
  // Visitor is invited to interaction
  // (Text is shown over animation)
  if (stage == stageInvite) {
    playAnimation();
    brush.reDraw(); // Flushes the brush buffer
    showInvite();
  }
  // Visitor want to see more information
  // (Animation will transition into calm background)
  else if (stage == stageTransitionIn) {
    playAnimation();
    shrink -= transitionStep;
    if (shrink < shrinkMin) { shrink = shrinkMin; }
  }
  // Visitior is reading the information
  // (Informative text is shown)
  else if (stage == stageInfo) {
    playAnimation();
    brush.reDraw();
    showInfo();
  }
  // Interaction ended
  // (Transition from background back to animation)
  else if (stage == stageTransitionOut) {
    playAnimation();
    shrink += transitionStep;
    if (shrink > shrinkMax) { shrink = shrinkMax; }
  }
  // (Animation is playing again)
  else {
    playAnimation();
  }
}

// Stage functions
function playAnimation(){
  let phase = radians(100*frameCount);

  // Movement functions
  let sin_1 = map(sin(phase), -1, 1, 0.5, 1.5);
  let sin_2 = map(cos(1.2 * phase), -1, 1, 0.5, 1.5);
  let sin_3 = map(cos(0.8 * phase), -1, 1, 0.5, 1.5);

  let sin_1_b = map(sin(phase), -1, 1, 0.3, 1.3);
  let sin_2_b = map(cos(1.2 * phase), -1, 1, 0.3, 1.3);
  let sin_3_b = map(cos(0.8 * phase), -1, 1, 0.3, 1.3);

  for (let y = 0; y < tilesY; y++) {
    for (let x = 0; x < tilesX; x++) {

      // Adjust start positions
      let startX = startPos[x][y].x - tileWidth;
      let startY = startPos[x][y].y - tileWidth;

      // Pick brush
      brush.pick("EndoBrush");

      // Generate noise fields
      let noiseFieldBottom = noiseGen(x * tileWidth, y * tileWidth, frameCount, shrink * sin_3 * noiseScaleColor);
      let noiseFieldMiddle = noiseGen(x * tileWidth, y * tileWidth, frameCount, shrink * sin_2 * noiseScaleColor);
      let noiseFieldTop = noiseGen(x * tileWidth, y * tileWidth, frameCount, shrink * sin_1 * noiseScaleColor * noiseScaleColorMultiplier);

      // Detect the color for the info text
      if (x === 0 && y === 0) {noiseFieldTopSample = noiseFieldTop; }
      
      // Bottom layer
      brush.stroke(selectBrushColor(noiseFieldBottom));
      brush.field("bottomFlowField");
      brush.flowLine(startX, startY, brushLengthBase * tileWidth * sin_1_b, 0);

      // Mid layer
      brush.stroke(selectBrushColor(noiseFieldMiddle));
      brush.field("bottomFlowField");
      brush.flowLine(startX, startY, brushLengthBase * tileWidth * sin_3_b, 0);
  
      // Top layer
      brush.stroke(selectBrushColor(noiseFieldTop));
      brush.field("topFlowField");
      brush.flowLine(startX, startY, brushLengthBase * tileWidth * brushLengthMultiplier * sin_2_b, 0);

    }
  }
}

function showInvite() {
  fill(colorBG);
  rectMode(CENTER);
  textAlign(CENTER,CENTER);
  textLeading(45);
  textSize(50);
  textFont(fontSemiBold);
  text("Draw a ribbon in the air to learn more about this project. /", width/2, height/2 - 50, 800, 200);
  textFont(fontSemiBoldIt);
  text("Nakreslete stuhu ve vzduchu a zjistěte více o tomto projektu.", width/2, height/2 + 50, 900, 200);
}

function showInfo(){
  let infoTextColor = 0;
  if (noiseFieldTopSample >= secHigh) { infoTextColor = 255; }
  else if (noiseFieldTopSample < secHigh && noiseFieldTopSample > secLow) { infoTextColor = 0; }
  else { infoTextColor = 0; } 
  fill(infoTextColor);
  textFont(fontSemiBold);
  textAlign(CENTER,CENTER);
  textSize(50);
  text("EndoMento je skvělý projekt!", width/2, height/2);
}

//=============== p5 MAIN ===============

// Setup
function setup() {
  pixelDensity(pixDensity);
  angleMode(DEGREES);
  createCanvas(canvX, canvY, WEBGL);
  configureBrushes();
  initializeBrushFields();
  getStartPositions();
  runInteractiveFlow();
}
 
// Draw
function draw() {
  background(colorBG);
  translate(-width / 2, -height / 2);
  drawScene();
}
