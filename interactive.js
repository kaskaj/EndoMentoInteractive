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
const transitionStep = 0.04;

// Font
let fontSemiBold;
let fontSemiBoldIt;
let inviteString = "Nakreslete stuhu ve vzduchu a zjistěte\nvíce o tomto projektu.";
let inviteStringEng = "Draw a ribbon in the air to learn\nmore about this project.";

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
let pickQuote;

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
    pickQuote = int(random(0, QuotesCzech.length));
    stage = stageInfo;
    await waitForFaceLost(infoWaitTime);
    // If there is no face anymore, wait few seconds then transition
    stage = stageTransitionOut;
    shrink = shrinkMin;
    await waitForShrinkRestored();
    // And go back to the animation
    //stage = stageAnimation;
  }
}

// Main logic
function drawScene() {
  playAnimation();
  // Visitor is invited to interaction
  // (Text is shown over animation)
  if (stage == stageInvite) {
    brush.reDraw(); // Flushes the brush buffer
    showInvite();
  }
  // Visitor want to see more information
  // (Animation will transition into calm background)
  else if (stage == stageTransitionIn) {
    shrink -= transitionStep;
    if (shrink < shrinkMin) { shrink = shrinkMin; }
  }
  // Visitior is reading the information
  // (Informative text is shown)
  else if (stage == stageInfo) {
    brush.reDraw();
    showInfo();
  }
  // Interaction ended
  // (Transition from background back to animation)
  else if (stage == stageTransitionOut) {
    shrink += transitionStep;
    if (shrink > shrinkMax) { shrink = shrinkMax; }
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
  push();
  fill(0);
    translate(width / 2, height / 2);
    //rotate(90);
    //rectMode(CENTER);
    fill(colorBG);
    textLeading(36);
    textSize(36);
    textFont(fontSemiBold);
    textAlign(CENTER, BOTTOM);
    text(inviteString, 0,  0);
    textFont(fontSemiBoldIt);
    textAlign(CENTER, TOP);
    text(inviteStringEng, 0, 2);
  pop();
}

function showInfo(){
  let infoTextColor = 0;
  if (noiseFieldTopSample >= secHigh) { infoTextColor = 255; }
  else if (noiseFieldTopSample < secHigh && noiseFieldTopSample > secLow) { infoTextColor = 0; }
  else { infoTextColor = 0; }
  push();
    fill(0);
    translate(width / 2, height / 2);
    //rotate(90);
    //rectMode(CENTER);
    fill(infoTextColor);
    textLeading(60);
    textSize(60);
    textFont(fontSemiBold);
    textAlign(CENTER, BOTTOM);
    text(QuotesCzech[pickQuote], 0, 0);
    textFont(fontSemiBoldIt);
    textAlign(CENTER, TOP);
    text(QuotesEnglish[pickQuote], 0, 1);
  pop();
}

function setup() {
  pixelDensity(pixDensity);
  angleMode(DEGREES);
  createCanvas(canvX, canvY, WEBGL);
  configureBrushes();
  initializeBrushFields();
  getStartPositions();
  runInteractiveFlow();
}
 
function draw() {
  background(colorBG);
  translate(-width / 2, -height / 2);
  drawScene();
}

const QuotesCzech = [
"Endometrióza se týká přibližně\n1 z 10 žen v reprodukčním věku.",
"Na světě žije 176 milionů\nžen s endometriózou.",
"Než uslyšíte diagnózu, uplyne\nv průměru 7–10 let.",
"Endometrióza znamená, že tkáně podobné\nděložní sliznici rostou mimo dělohu.",
"Endometrióza může způsobovat\nsrůsty – orgány se lepí k sobě.",
"Endometrióza může deformovat\nvaječníky a vejcovody.",
"Endometrióza může měnit\nstrukturu i funkci orgánů.",
"Endometrióza ovlivňuje\nfungování celého těla.",
"Endometrióza může dráždit\nnervová zakončení.",
"Endometrióza může zvyšovat\ncitlivost na bolest.",
"Bolest kvůli endometrióze může časem\nzesilovat, i když nález zůstává stejný.",
"Bolest u endometriózy bývá\nchronická i cyklická.",
"Bolest kvůli endometrióze\nmůžeme zažívat každý den.",
"Během menstruace ženy s endometriózou\nčasto zvrací a omdlévají.",
"Těhotenství se někdy prezentuje jako\nřešení, ale endometriózu nevyléčí.",
"Odebrání dělohy nezaručí\nvyléčení endometriózy, přesto\ntento mýtus přetrvává.",
"Endometrióza může zásadně\nomezit každodenní fungování.",
"Fyzioterapie a psychoterapie mohou\npomoci, ne každá žena si je může dovolit.",
"Endometrióza může\nvést k neplodnosti.",
"Endometrióza může ovlivnit\nschopnost otěhotnět.",
"Až polovina žen s neplodností\nmá endometriózu.",
"Nevíme přesně, proč endometrióza\nvzniká, a neumíme ji vyléčit.",
"Léčba existuje, vyléčení ne.",
"Endometriózu popsali už v 19. století.\nDodnes ji neumíme vyléčit.",
"Na endometriózu se často předepisuje\nhormonální antikoncepce.",
"Když hormonální léčba nezabere, může\nse navodit stav podobný přechodu.",
"Endometrióza se může vrátit\ni krátce po operaci.",
"Endometrióza znamená\nchronický zánět v těle.",
"Endometrióza není jen silná\nnebo bolestivá menstruace.",
"Bolest při endometrióze se může\nobjevovat i mimo menstruaci.",
"Endometrióza znamená,\nže sex může bolet.",
"Endometrióza může zasáhnout\ni střeva a močový měchýř.",
"Endometrióza byla popsána i mimo\npánev, například v plicích.",
"Léčba endometriózy často znamená\nvolbu mezi příznaky nemoci\na vedlejšími účinky léčby.",
"Endometrióza často znamená\ni chronickou únavu.",
"Endometrióza může ovlivnit\nsoustředění a paměť.",
"Příznaky endometriózy jsou\nněkdy zaměňovány za stres\nnebo psychické potíže.",
"Endometrióza se často řeší\npotlačením hormonálního cyklu.",
"Léčba neodstraňuje nemoc,\njen ji ztiší.",
"Diagnóza endometriózy se\nčasto potvrzuje až operací.",
"Ultrazvuk nemusí endometriózu odhalit.",
"Magnetická rezonance nemusí\nendometriózu vždy zachytit.",
"Endometrióza má různé formy a projevy;\nne všechny vidíme na ultrazvuku.",
"Síla bolesti u endometriózy neodpovídá\nvždy rozsahu onemocnění.",
"I malé ložisko endometriózy může\nzpůsobovat silnou bolest.",
"Ženy s endometriózou mají až\ndvakrát vyšší riziko deprese.",
"Endometrióza může ovlivnit pracovní\nschopnost i partnerské vztahy.",
"Některé ženy kvůli endometrióze\nmění práci nebo tempo života.",
"Endometrióza není vidět,\nale její dopady jsou reálné.",
"Endometrióza může znemožnit\nběžné fungování během dne.",
"Jsou dny, kdy ženy s endometriózou\nnezvládnou vstát z postele.",
"Hormonální léčba může ovlivnit\nnáladu, energii i libido.",
"Chronická bolest mění fungování\nnervového systému, nedělá nás silnější.",
"Bolest u endometriózy není jen\nlokální, ovlivňuje celé tělo.",
"Výzkum endometriózy je\ndlouhodobě podfinancovaný.",
"Silná bolest při menstruaci\nnení normální.",
"Zvracení a mdloby při menstruaci\nnejsou normální."
];

const QuotesEnglish = [
  "Endometriosis affects approximately\n1 in 10 women of reproductive age.",
"176 million women worldwide\nlive with endometriosis.",
"It takes an average of 7–10 years\nbefore receiving a diagnosis.",
"Endometriosis means tissue similar to the\nuterine lining grows outside the uterus.",
"Endometriosis can cause adhesions –\norgans stick together.",
"Endometriosis can deform\nthe ovaries and fallopian tubes.",
"Endometriosis can change the structure\nand function of organs.",
"Endometriosis affects the functioning\nof the whole body.",
"Endometriosis can irritate\nnerve endings.",
"Endometriosis can increase\nsensitivity to pain.",
"Pain caused by endometriosis\ncan worsen over time, even when\nfindings remain the same.",
"Pain in endometriosis is often\nboth chronic and cyclical.",
"Pain caused by endometriosis can\nbe experienced every day.",
"During menstruation, women with\nendometriosis often vomit and faint.",
"Pregnancy is sometimes presented\nas a solution, but it does not\ncure endometriosis.",
"Removal of the uterus does not\nguarantee a cure for endometriosis,\nyet this myth per-sists.",
"Endometriosis can significantly\nlimit daily functioning.",
"Physiotherapy and psychotherapy can help,\nbut not every woman can afford them.",
"Endometriosis can\nlead to infertility.",
"Endometriosis can affect\nthe ability to conceive.",
"Up to half of women with infertility\nhave endometriosis.",
"We do not know exactly why endometriosis\ndevelops, and we cannot cure it.",
"Treatment exists, but not a cure.",
"Endometriosis was already described in\nthe 19th century. We still cannot cure it.",
"Hormonal contraception is often\nprescribed for endometriosis.",
"When hormonal treatment does not work,\na menopause-like state may be induced.",
"Endometriosis can return even\nshortly after surgery.",
"Endometriosis means chronic\ninflammation in the body.",
"Endometriosis is not just\na heavy or painful period.",
"Pain from endometriosis can occur\neven outside menstruation.",
"Endometriosis means\nsex can be painful.",
"Endometriosis can also affect\nthe bowels and bladder.",
"Endometriosis has also been found outside\nthe pelvis, for example in the lungs.",
"Treatment of endometriosis often means\nchoosing between symptoms of the disease\nand side effects of treatment.",
"Endometriosis often also\nmeans chronic fatigue.",
"Endometriosis can affect\nconcentration and memory.",
"Symptoms of endometriosis are\nsometimes mistaken for stress\nor psychological problems.",
"Endometriosis is often managed by\nsuppressing the hormonal cycle.",
"Treatment does not remove\nthe disease, it only quiets it.",
"A diagnosis of endometriosis is often\nconfirmed only through surgery.",
"Ultrasound may not detect endometriosis.",
"MRI may not always\ndetect endometriosis.",
"Endometriosis has different\nforms and manifestations; not all\nare visible on ultrasound.",
"The severity of pain in endometriosis\ndoes not always correspond to\nthe extent of the dis-ease.",
"Even a small endometriosis\nlesion can cause severe pain.",
"Women with endometriosis have up\nto twice higher risk of depression.",
"Endometriosis can affect work\nability and relationships.",
"Some women change jobs or their pace\nof life because of endometriosis.",
"Endometriosis is invisible,\nbut its impacts are real.",
"Endometriosis can make normal\ndaytime functioning impossible.",
"There are days when women with\nendometriosis cannot get out of bed.",
"Hormonal treatment can affect\nmood, energy, and libido.",
"Chronic pain changes how\nthe nervous system functions;\nit does not make us stronger.",
"Pain in endometriosis is not only\nlocal, it affects the whole body.",
"Research on endometriosis has\nlong been underfunded.",
"Severe pain during menstruation\nis not normal.",
"Vomiting and fainting during\nmenstruation are not normal."
];
