const TRACKS = [
    { title: "Братан Какао", file: "Братан Какао.mp3", cover: "Братан Какао.jpg" },
    { title: "Газовый Гэнри", file: "Газовый Гэнри.mp3", cover: "Газовый Гэнри.jpg" },
    { title: "Залетел на фьючи", file: "Залетел на фьючи.mp3", cover: "Залетел на фьючи.jpg" },
    { title: "Серебро", file: "Серебро.mp3", cover: "Серебро.jpg" },
    { title: "Я Инвестор", file: "Я Инвестор.mp3", cover: "Я Иневстор.jpg" }
];

const audio = document.getElementById("audio-element");
const playBtn = document.getElementById("play-btn");
const trackTitleEl = document.getElementById("track-title");
const trackCoverEl = document.getElementById("track-cover");
const progressBarEl = document.getElementById("progress-bar");
const currentTimeEl = document.getElementById("current-time");
const durationTimeEl = document.getElementById("duration-time");
const trackListEl = document.getElementById("track-list");

let currentIdx = 0;
let isPlaying = false;
let audioCtx, analyser, dataArray;

function initTracklist() {
    trackListEl.innerHTML = TRACKS.map((t, i) => `
        <li class="track-item ${i === 0 ? 'active' : ''}" onclick="selectTrack(${i})">
            <img class="track-item-img" src="${t.cover}" width="36" height="36">
            <div class="track-item-info">
                <div class="track-item-title">${t.title}</div>
                <div class="track-item-artist">Sanchoyze Production</div>
            </div>
            <div class="playing-icon"><div class="bar"></div><div class="bar"></div></div>
        </li>
    `).join('');
}

function selectTrack(i) {
    if (currentIdx === i) {
        togglePlay();
    } else {
        currentIdx = i;
        loadTrack();
        playAudio();
    }
}

function loadTrack() {
    const t = TRACKS[currentIdx];
    audio.src = t.file;
    trackTitleEl.textContent = t.title;
    trackCoverEl.src = t.cover;
    
    document.querySelectorAll('.track-item').forEach((el, idx) => {
        el.classList.toggle('active', idx === currentIdx);
    });
}

function initAudio() {
    if (audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 32; // Smallest possible for speed
    const source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
}

function playAudio() {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    audio.play();
    isPlaying = true;
    playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    trackCoverEl.classList.add('playing');
    requestAnimationFrame(updateBeat);
}

function pauseAudio() {
    audio.pause();
    isPlaying = false;
    playBtn.innerHTML = '<i class="fas fa-play"></i>';
    trackCoverEl.classList.remove('playing');
    document.body.style.setProperty('--b', '1');
}

function togglePlay() {
    isPlaying ? pauseAudio() : playAudio();
}

function updateBeat() {
    if (!isPlaying) return;
    if (analyser) {
        analyser.getByteFrequencyData(dataArray);
        const beat = dataArray[0] / 255; // Just check the first bass bin
        document.body.style.setProperty('--b', (1 + beat * 0.1).toFixed(2));
    }
    requestAnimationFrame(updateBeat);
}

audio.ontimeupdate = () => {
    const pct = (audio.currentTime / audio.duration) * 100 || 0;
    progressBarEl.value = pct;
    progressBarEl.style.background = `linear-gradient(to right, var(--primary) ${pct}%, rgba(255,255,255,0.1) ${pct}%)`;
    currentTimeEl.textContent = fmt(audio.currentTime);
};

audio.onloadedmetadata = () => {
    durationTimeEl.textContent = fmt(audio.duration);
};

audio.onended = () => {
    currentIdx = (currentIdx + 1) % TRACKS.length;
    loadTrack();
    playAudio();
};

progressBarEl.oninput = () => {
    audio.currentTime = (progressBarEl.value / 100) * audio.duration;
};

const fmt = s => {
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return `${m}:${ss < 10 ? '0' : ''}${ss}`;
};

document.getElementById('prev-btn').onclick = () => {
    currentIdx = (currentIdx - 1 + TRACKS.length) % TRACKS.length;
    loadTrack();
    if (isPlaying) playAudio();
};

document.getElementById('next-btn').onclick = () => {
    currentIdx = (currentIdx + 1) % TRACKS.length;
    loadTrack();
    if (isPlaying) playAudio();
};

playBtn.onclick = togglePlay;

initTracklist();
loadTrack();
