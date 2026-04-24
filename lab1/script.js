const songs = [
    'golden.mp3',
    '好好先生.mp3',
    '等你下課.mp3',
    '缺口.mp3',
    '蝸牛.mp3'
];

const audioVisualizer = document.querySelector('.player-card');
const timerDisplay = document.getElementById('timer-display');
const answerDisplay = document.getElementById('answer-display');
const answerText = answerDisplay.querySelector('span');
const guessInput = document.getElementById('guess-input');

const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnResume = document.getElementById('btn-resume');
const btnMore = document.getElementById('btn-more');
const btnShow = document.getElementById('btn-show');
const btnCheck = document.getElementById('btn-check');
const btnRestart = document.getElementById('btn-restart');

let currentAudio = null;
let currentSongName = '';
let timerInterval = null;
let timeLeft = 15;

// Utility to strip extension
function getSongTitle(filename) {
    return filename.replace(/\.[^/.]+$/, "");
}

function stopAudio() {
    if (currentAudio) {
        currentAudio.pause();
    }
    clearInterval(timerInterval);
    audioVisualizer.classList.remove('playing');
}

function updateTimerDisplay(seconds) {
    const s = Math.ceil(seconds);
    timerDisplay.textContent = `00:${s.toString().padStart(2, '0')}`;
}

async function startPlayback(isNew = true, isResume = false) {
    if (!isResume) {
        stopAudio();
    }
    
    if (isNew) {
        const randomIndex = Math.floor(Math.random() * songs.length);
        const songFile = songs[randomIndex];
        currentSongName = getSongTitle(songFile);
        currentAudio = new Audio(`songs/${songFile}`);
        
        // Reset UI
        answerDisplay.classList.add('hidden');
        answerText.textContent = '---';
        guessInput.value = '';
        timeLeft = 15;
    } else if (!isResume) {
        timeLeft = 15;
    }

    updateTimerDisplay(timeLeft);
    audioVisualizer.classList.add('playing');
    btnPause.disabled = false;
    btnResume.disabled = true;
    
    try {
        await currentAudio.play();
        
        timerInterval = setInterval(() => {
            timeLeft -= 1;
            updateTimerDisplay(timeLeft);
            
            if (timeLeft <= 0) {
                stopAudio();
                btnPause.disabled = true;
                btnResume.disabled = true;
                btnMore.disabled = false;
                btnShow.disabled = false;
            }
        }, 1000);
    } catch (err) {
        console.error('Audio playback failed:', err);
        alert('音訊播放失敗，請檢查瀏覽器設定或點擊頁面後再試。');
        stopAudio();
    }
}

btnStart.addEventListener('click', () => {
    startPlayback(true);
    btnMore.disabled = true;
    btnShow.disabled = true;
});

btnRestart.addEventListener('click', () => {
    startPlayback(true);
    btnMore.disabled = true;
    btnShow.disabled = true;
    document.getElementById('status-icon').textContent = '🎵';
});

btnPause.addEventListener('click', () => {
    stopAudio();
    btnPause.disabled = true;
    btnResume.disabled = false;
    btnMore.disabled = false;
    btnShow.disabled = false;
});

btnResume.addEventListener('click', () => {
    startPlayback(false, true);
    btnMore.disabled = true;
    btnShow.disabled = true;
});

btnMore.addEventListener('click', () => {
    startPlayback(false);
    btnMore.disabled = true;
    btnShow.disabled = true;
});

btnShow.addEventListener('click', () => {
    answerText.textContent = currentSongName;
    answerDisplay.classList.remove('hidden');
});

function checkAnswer() {
    const userGuess = guessInput.value.trim().toLowerCase();
    if (userGuess === currentSongName.toLowerCase() && currentSongName !== '') {
        answerText.textContent = currentSongName + ' (答對了！)';
        answerDisplay.classList.remove('hidden');
        document.getElementById('status-icon').textContent = '✅';
        setTimeout(() => {
            document.getElementById('status-icon').textContent = '🎵';
        }, 3000);
    } else {
        alert('不對喔，再猜猜看！');
    }
}

// Auto-pause when typing
guessInput.addEventListener('input', () => {
    if (currentAudio && !currentAudio.paused) {
        stopAudio();
        btnPause.disabled = true;
        btnResume.disabled = false;
        btnMore.disabled = false;
        btnShow.disabled = false;
    }
});

btnCheck.addEventListener('click', checkAnswer);

// Keep auto-check but maybe make it subtle, or just use the button as requested
guessInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        checkAnswer();
    }
});
