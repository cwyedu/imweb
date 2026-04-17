const video = document.getElementById('video');
const canvas = document.getElementById('capture-canvas');
const gallery = document.getElementById('gallery');
const countdownOverlay = document.getElementById('countdown');
const flashEffect = document.getElementById('flash');

const btnDetect = document.getElementById('btn-detect');
const btnStart = document.getElementById('btn-start');
const btnDownload = document.getElementById('btn-download');

let stream = null;
let capturedPhotos = [];
let activeFilter = 'none';

// Filter Selection
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelector('.filter-btn.active').classList.remove('active');
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        video.style.filter = activeFilter;
    });
});

// 1. Detect Camera
btnDetect.addEventListener('click', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
            audio: false
        });
        video.srcObject = stream;
        btnDetect.textContent = '鏡頭已啟動';
        btnDetect.disabled = true;
        btnStart.disabled = false;
    } catch (err) {
        console.error('Error accessing camera:', err);
        alert('無法存取鏡頭，請確認權限設定。');
    }
});

// 2. Start 3-Burst Capture
btnStart.addEventListener('click', async () => {
    capturedPhotos = [];
    gallery.innerHTML = ''; // Clear gallery
    btnStart.disabled = true;
    btnDownload.disabled = true;

    for (let i = 0; i < 3; i++) {
        await runCountdown(3);
        capturePhoto();
        triggerFlash();
        // Small delay between shots
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    btnStart.disabled = false;
    btnDownload.disabled = false;
});

async function runCountdown(seconds) {
    return new Promise(resolve => {
        let count = seconds;
        countdownOverlay.classList.add('active');
        
        const timer = setInterval(() => {
            countdownOverlay.textContent = count;
            if (count === 0) {
                clearInterval(timer);
                countdownOverlay.classList.remove('active');
                countdownOverlay.textContent = '';
                resolve();
            }
            count--;
        }, 1000);
        
        // Initial display
        countdownOverlay.textContent = count;
        count--;
    });
}

function capturePhoto() {
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Apply filter to canvas
    ctx.filter = activeFilter;
    
    // Draw mirrored image to canvas
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    capturedPhotos.push(dataUrl);
    
    // Add to gallery
    const item = document.createElement('div');
    item.className = 'gallery-item';
    const img = document.createElement('img');
    img.src = dataUrl;
    // We already mirrored it on canvas, but let's reset CSS mirror for the img element if needed
    // In our CSS, .gallery-item img has transform: scaleX(-1), so we should check.
    // Actually, if we draw mirrored on canvas, we don't need CSS mirror on the result.
    img.style.transform = 'none'; 
    item.appendChild(img);
    gallery.appendChild(item);
}

function triggerFlash() {
    flashEffect.classList.add('active');
    setTimeout(() => {
        flashEffect.classList.remove('active');
    }, 300);
}

// 3. Download Collage
btnDownload.addEventListener('click', () => {
    if (capturedPhotos.length < 3) return;

    const layout = document.querySelector('input[name="layout"]:checked').value;
    const collageCanvas = document.createElement('canvas');
    const ctx = collageCanvas.getContext('2d');
    
    const imgWidth = 800;
    const imgHeight = (imgWidth / 4) * 3; // 4:3 ratio
    const padding = 40;
    const footerHeight = 120;
    
    if (layout === 'vertical') {
        collageCanvas.width = imgWidth + (padding * 2);
        collageCanvas.height = (imgHeight * 3) + (padding * 4) + footerHeight;
    } else {
        collageCanvas.width = (imgWidth * 3) + (padding * 4);
        collageCanvas.height = imgHeight + (padding * 2) + footerHeight;
    }
    
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, collageCanvas.width, collageCanvas.height);
    
    let loadedCount = 0;
    const images = [];
    
    capturedPhotos.forEach((src, index) => {
        const img = new Image();
        img.onload = () => {
            images[index] = img;
            loadedCount++;
            if (loadedCount === 3) {
                drawFinalCollage(collageCanvas, ctx, images, imgWidth, imgHeight, padding, footerHeight, layout);
            }
        };
        img.src = src;
    });
});

function drawFinalCollage(canvas, ctx, images, w, h, p, fh, layout) {
    // Draw 3 images
    images.forEach((img, i) => {
        if (layout === 'vertical') {
            ctx.drawImage(img, p, p + (i * (h + p)), w, h);
        } else {
            ctx.drawImage(img, p + (i * (w + p)), p, w, h);
        }
    });
    
    // Footer Text
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 32px "Outfit", "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    
    const textX = canvas.width / 2;
    const textY = canvas.height - fh + 40;
    
    ctx.fillText('Premium Photo Booth Memories', textX, textY);
    
    const dateStr = new Date().toLocaleDateString('zh-TW', { 
        year: 'numeric', month: 'long', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    });
    ctx.font = '24px "Outfit", "Noto Sans TC", sans-serif';
    ctx.fillStyle = '#666666';
    ctx.fillText(dateStr, textX, textY + 40);
    
    // Download
    const link = document.createElement('a');
    link.download = `photobooth-${Date.now()}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.click();
}
