import {
    HandLandmarker,
    FilesetResolver,
    DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/bundle_mjs.js";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const gestureOverlay = document.getElementById("gesture-overlay");
const statusMsg = document.getElementById("status-msg");
const countdownDisplay = document.getElementById("countdown");
const btnStart = document.getElementById("btn-start");
const aiIcon = document.getElementById("ai-icon");
const aiChoiceText = document.getElementById("ai-choice-text");
const playerScoreEl = document.getElementById("player-score");
const aiScoreEl = document.getElementById("ai-score");
const btnCam = document.getElementById("btn-cam");

let handLandmarker = undefined;
let runningMode = "IMAGE";
let webcamRunning = false;
let lastVideoTime = -1;

let playerScore = 0;
let aiScore = 0;
let currentGesture = "NONE";
let isGameActive = false;

const GESTURES = {
    ROCK: "✊ 石頭",
    PAPER: "🖐️ 布",
    SCISSORS: "✌️ 剪刀",
    NONE: "❓ 未偵測"
};

const AI_OPTIONS = ["ROCK", "PAPER", "SCISSORS"];
const AI_ICONS = {
    ROCK: "✊",
    PAPER: "🖐️",
    SCISSORS: "✌️",
    WAITING: "🤖"
};

// --- Initialization ---

async function createHandLandmarker() {
    statusMsg.innerText = "正在載入 AI 模型...";
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
    });
    statusMsg.innerText = "模型載入完成！";
}

// 移除自動啟動，改由按鈕觸發
// createHandLandmarker(); 

btnCam.addEventListener("click", async () => {
    btnCam.disabled = true;
    btnCam.innerText = "正在啟動鏡頭...";
    
    try {
        if (!handLandmarker) {
            await createHandLandmarker();
        }
        await enableCam();
        btnCam.style.display = "none";
        btnStart.style.display = "inline-block";
    } catch (err) {
        console.error(err);
        statusMsg.innerText = "無法開啟鏡頭：" + (err.message || "未知錯誤");
        btnCam.disabled = false;
        btnCam.innerText = "重試開啟鏡頭";
    }
});

// --- Camera Setup ---

function enableCam() {
    return new Promise((resolve, reject) => {
        const constraints = {
            video: true
        };

        navigator.mediaDevices.getUserMedia(constraints)
            .then((stream) => {
                video.srcObject = stream;
                video.addEventListener("loadeddata", () => {
                    predictWebcam();
                    resolve();
                });
                webcamRunning = true;
                statusMsg.innerText = "準備就緒，點擊開始遊戲";
            })
            .catch((err) => {
                reject(err);
            });
    });
}

// --- Recognition Logic ---

async function predictWebcam() {
    canvasElement.style.width = video.videoWidth + "px";
    canvasElement.style.height = video.videoHeight + "px";
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await handLandmarker.setOptions({ runningMode: "VIDEO" });
    }

    let startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        const results = handLandmarker.detectForVideo(video, startTimeMs);

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        if (results.landmarks) {
            const drawingUtils = new DrawingUtils(canvasCtx);
            for (const landmarks of results.landmarks) {
                drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
                    color: "#00f2ff",
                    lineWidth: 5
                });
                drawingUtils.drawLandmarks(landmarks, { color: "#ff00e5", lineWidth: 2 });
                
                // Identify gesture
                updateCurrentGesture(landmarks);
            }
        } else {
            currentGesture = "NONE";
        }
        
        gestureOverlay.innerText = GESTURES[currentGesture];
        canvasCtx.restore();
    }

    if (webcamRunning) {
        window.requestAnimationFrame(predictWebcam);
    }
}

function updateCurrentGesture(landmarks) {
    // Landmarks info:
    // 0: Wrist
    // 4: Thumb Tip, 8: Index Tip, 12: Middle Tip, 16: Ring Tip, 20: Pinky Tip
    // 2, 6, 10, 14, 18: Second joints (PIP/IP)
    
    const isExtended = (tipIdx, jointIdx) => {
        // Simple heuristic: tip is higher (smaller Y) than the joint
        return landmarks[tipIdx].y < landmarks[jointIdx].y;
    };

    const indexExtended = isExtended(8, 6);
    const middleExtended = isExtended(12, 10);
    const ringExtended = isExtended(16, 14);
    const pinkyExtended = isExtended(20, 18);

    // Thumb is a bit tricky, compare X or distance from wrist?
    // For simplicity, let's use 4 fingers for RPS
    
    if (indexExtended && middleExtended && ringExtended && pinkyExtended) {
        currentGesture = "PAPER";
    } else if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
        currentGesture = "SCISSORS";
    } else if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        currentGesture = "ROCK";
    } else {
        currentGesture = "NONE";
    }
}

// --- Game Logic ---

btnStart.addEventListener("click", startGame);

async function startGame() {
    if (isGameActive) return;
    isGameActive = true;
    btnStart.disabled = true;
    
    // Reset AI view
    aiIcon.innerText = AI_ICONS.WAITING;
    aiChoiceText.innerText = "思考中...";
    aiIcon.classList.add("shaking");

    // Countdown sequence
    const sequence = ["3", "2", "1", "GO!"];
    for (const val of sequence) {
        countdownDisplay.innerText = val;
        statusMsg.innerText = val === "GO!" ? "快出拳！" : "準備好...";
        await new Promise(r => setTimeout(r, 1000));
    }

    // Capture Result
    calculateResult();
    
    countdownDisplay.innerText = "";
    aiIcon.classList.remove("shaking");
    btnStart.disabled = false;
    isGameActive = false;
}

function calculateResult() {
    const aiChoice = AI_OPTIONS[Math.floor(Math.random() * AI_OPTIONS.length)];
    aiIcon.innerText = AI_ICONS[aiChoice];
    aiChoiceText.innerText = GESTURES[aiChoice];

    if (currentGesture === "NONE") {
        statusMsg.innerText = "沒偵測到你的手勢！重新再來吧。";
        return;
    }

    if (currentGesture === aiChoice) {
        statusMsg.innerText = "平手！再來一局？";
    } else if (
        (currentGesture === "ROCK" && aiChoice === "SCISSORS") ||
        (currentGesture === "PAPER" && aiChoice === "ROCK") ||
        (currentGesture === "SCISSORS" && aiChoice === "PAPER")
    ) {
        statusMsg.innerText = "你贏了！🎉";
        playerScore++;
        updateScore();
        triggerWinEffect("player");
    } else {
        statusMsg.innerText = "AI 贏了！🤖";
        aiScore++;
        updateScore();
        triggerWinEffect("ai");
    }
}

function updateScore() {
    playerScoreEl.innerText = playerScore;
    aiScoreEl.innerText = aiScore;
}

function triggerWinEffect(winner) {
    const card = winner === "player" ? document.querySelector(".player-view .video-wrapper") : document.getElementById("ai-card");
    card.classList.add("winner-card");
    setTimeout(() => card.classList.remove("winner-card"), 1500);
}
