let HandLandmarker, FilesetResolver;

const video = document.getElementById("webcam");
const canvas = document.getElementById("particle-canvas");
const ctx = canvas.getContext("2d");
const statusBadge = document.getElementById("status-badge");
const btnStart = document.getElementById("btn-start");
const modeBtns = document.querySelectorAll(".mode-btn");

let handLandmarker = undefined;
let webcamRunning = false;
let particles = [];
let landmarks = [];
let currentMode = "1";
let welcomePoints = [];
let departmentPoints = [];

// --- 粒子系統設定 ---
const PARTICLE_COUNT = 2500; // 大幅增加粒子數以完整填滿文字
const INTERACTION_DISTANCE = 150;

class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.vx = (Math.random() - 0.5) * 1;
        this.vy = (Math.random() - 0.5) * 1;
        this.color = `hsla(${180 + Math.random() * 40}, 100%, 70%, ${0.5 + Math.random() * 0.5})`;
        
        this.targetX = this.x;
        this.targetY = this.y;
        this.isFixed = false;
        this.friction = 0.95;
        this.ease = 0.1;
    }

    update() {
        if (currentMode === "1") {
            this.updateMode1();
        } else if (currentMode === "2") {
            this.updateMode2();
        } else if (currentMode === "3") {
            this.updateMode3();
        }

        // 基本物理運動
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= this.friction;
        this.vy *= this.friction;

        // 邊界回彈
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    }

    updateMode1() {
        // 模式 1: 手靠近時聚集成 "WELCOME"
        if (landmarks.length > 0) {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            this.vx += dx * this.ease * 0.5;
            this.vy += dy * this.ease * 0.5;
            this.friction = 0.8;
        } else {
            // 沒偵測到手時，讓粒子在大範圍內隨機漂浮分散
            this.vx += (Math.random() - 0.5) * 0.5;
            this.vy += (Math.random() - 0.5) * 0.5;
            this.friction = 0.98; // 減少阻力讓它漂浮感更強
            
            // 輕微的隨機大範圍位移，防止粒子卡在原地
            if (Math.random() > 0.99) {
                this.vx += (Math.random() - 0.5) * 5;
                this.vy += (Math.random() - 0.5) * 5;
            }
        }
    }

    updateMode2() {
        // 模式 2: 偵測到手 -> 爆炸 -> 重組
        if (landmarks.length > 0) {
            // 取第一隻手的中心點作為爆炸源
            const palm = landmarks[0][0]; // 腕部
            const px = palm.x * canvas.width;
            const py = palm.y * canvas.height;
            
            const dx = this.x - px;
            const dy = this.y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 100) {
                const force = (100 - dist) / 100;
                this.vx += (dx / dist) * force * 10;
                this.vy += (dy / dist) * force * 10;
            }
            
            // 慢慢往目標移動（重組）
            const tdx = this.targetX - this.x;
            const tdy = this.targetY - this.y;
            this.vx += tdx * 0.01;
            this.vy += tdy * 0.01;
        } else {
            this.vx += (Math.random() - 0.5) * 0.1;
            this.vy += (Math.random() - 0.5) * 0.1;
        }
    }

    updateMode3() {
        // 模式 3: 手部骨架縮回特效
        if (landmarks.length > 0) {
            // 找出離這個粒子最近的手部關節點
            let minDict = Infinity;
            let closestPoint = null;

            for (let hand of landmarks) {
                for (let point of hand) {
                    const px = point.x * canvas.width;
                    const py = point.y * canvas.height;
                    const dx = px - this.x;
                    const dy = py - this.y;
                    const distSq = dx * dx + dy * dy;
                    
                    if (distSq < minDict) {
                        minDict = distSq;
                        closestPoint = { x: px, y: py };
                    }
                }
            }

            if (closestPoint && minDict < 40000) { // 約 200px 範圍
                const dist = Math.sqrt(minDict);
                const dx = closestPoint.x - this.x;
                const dy = closestPoint.y - this.y;
                
                // 向手部關節點縮回的力
                const force = (200 - dist) / 200;
                this.vx += (dx / dist) * force * 2;
                this.vy += (dy / dist) * force * 2;
                this.friction = 0.85;
            } else {
                // 如果離手太遠，則慢慢回歸目標位置
                const dx = this.targetX - this.x;
                const dy = this.targetY - this.y;
                this.vx += dx * 0.01;
                this.vy += dy * 0.01;
                this.friction = 0.95;
            }
        } else {
            // 沒有偵測到手時，回歸看板文字位置
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            this.vx += dx * 0.02;
            this.vy += dy * 0.02;
            this.friction = 0.9;
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- 文字取樣 ---
function sampleText(text, fontSize, targetArray) {
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    
    tempCtx.fillStyle = "white";
    tempCtx.font = `bold ${fontSize}px "Outfit", "Noto Sans TC"`;
    tempCtx.textAlign = "center";
    tempCtx.textBaseline = "middle";
    tempCtx.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height).data;
    const points = [];
    const step = 6; // 取樣密度
    
    for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
            const index = (y * canvas.width + x) * 4;
            if (imageData[index] > 128) {
                points.push({ x, y });
            }
        }
    }
    return points;
}

function updateParticleTargets() {
    let points = [];
    if (currentMode === "1") {
        points = welcomePoints;
    } else {
        points = departmentPoints;
    }
    
    particles.forEach((p, i) => {
        if (i < points.length) {
            p.targetX = points[i].x;
            p.targetY = points[i].y;
        } else {
            // 多餘的粒子分散在周圍
            p.targetX = Math.random() * canvas.width;
            p.targetY = Math.random() * canvas.height;
        }
    });
}

function initScene() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // 稍微縮小字體比例，確保在不同螢幕寬度下都不會被截斷
    welcomePoints = sampleText("WELCOME", Math.min(canvas.width / 6, 200), []);
    departmentPoints = sampleText("二林工商資處科", Math.min(canvas.width / 10, 120), []);
    
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle());
    }
    updateParticleTargets();
}

// --- MediaPipe ---
async function createHandLandmarker() {
    statusBadge.innerText = "正在載入 AI 模型...";
    const visionModule = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/vision_bundle.mjs");
    HandLandmarker = visionModule.HandLandmarker;
    FilesetResolver = visionModule.FilesetResolver;

    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
    });
    statusBadge.innerText = "系統就緒";
}

async function enableCam() {
    const constraints = { video: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
    webcamRunning = true;
}

async function predictWebcam() {
    if (handLandmarker && webcamRunning) {
        let startTimeMs = performance.now();
        const results = handLandmarker.detectForVideo(video, startTimeMs);
        landmarks = results.landmarks || [];
        statusBadge.innerText = landmarks.length > 0 ? "偵測到手部互動中" : "等待手部中...";
    }
    window.requestAnimationFrame(predictWebcam);
}

function render() {
    ctx.fillStyle = "rgba(10, 10, 18, 0.2)"; // 拖尾效果
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach(p => {
        p.update();
        p.draw();
    });
    
    window.requestAnimationFrame(render);
}

// --- 事件 ---
btnStart.addEventListener("click", async () => {
    btnStart.style.display = "none";
    initScene();
    try {
        await createHandLandmarker();
        await enableCam();
    } catch (err) {
        console.error(err);
        statusBadge.innerText = "啟動失敗";
        btnStart.style.display = "block";
    }
});

modeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        modeBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentMode = btn.dataset.mode;
        updateParticleTargets();
    });
});

window.addEventListener("resize", initScene);

// 預先繪製背景
ctx.fillStyle = "#0a0a12";
ctx.fillRect(0, 0, canvas.width, canvas.height);
render();
