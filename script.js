const trackList = [
    { title: "Братан Какао", file: "Братан Какао.mp3", cover: "Братан Какао.jpg" },
    { title: "Газовый Гэнри", file: "Газовый Гэнри.mp3", cover: "Газовый Гэнри.jpg" },
    { title: "Залетел на фьючи", file: "Залетел на фьючи.mp3", cover: "Залетел на фьючи.jpg" },
    { title: "Серебро", file: "Серебро.mp3", cover: "Серебро.jpg" },
    { title: "Я Инвестор", file: "Я Инвестор.mp3", cover: "Я Иневстор.jpg" }
];

const audio = document.getElementById("audio-element");
const playBtn = document.getElementById("play-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const trackTitle = document.getElementById("track-title");
const trackCover = document.getElementById("track-cover");
const progressBar = document.getElementById("progress-bar");
const currentTimeEl = document.getElementById("current-time");
const durationTimeEl = document.getElementById("duration-time");
const trackListContainer = document.getElementById("track-list");

let currentTrackIndex = 0;
let isPlaying = false;

// Audio Visualizer Variables
let audioCtx;
let analyser;
let source;
let dataArray;
let animationId;

// Initialize Tracklist UI
function initTracklist() {
    trackListContainer.innerHTML = '';
    trackList.forEach((track, index) => {
        const li = document.createElement("li");
        li.className = `track-item ${index === currentTrackIndex ? 'active paused' : ''}`;
        li.setAttribute("data-index", index);
        
        li.innerHTML = `
            <div class="track-item-num">${index + 1}</div>
            <img class="track-item-img" src="${track.cover}" alt="${track.title}">
            <div class="track-item-info">
                <div class="track-item-title">${track.title}</div>
                <div class="track-item-artist">Sanchoyze Production</div>
            </div>
            <div class="playing-icon">
                <div class="bar"></div>
                <div class="bar"></div>
                <div class="bar"></div>
            </div>
        `;
        
        li.addEventListener("click", () => {
            if (currentTrackIndex === index) {
                togglePlay();
            } else {
                loadTrack(index);
                playAudio();
            }
        });
        
        trackListContainer.appendChild(li);
    });
}

// Visualizer Initialization
function initVisualizer() {
    if (audioCtx) return;
    
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        
        source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
    } catch (e) {
        console.error("Web Audio API Error:", e);
    }
}

// Visualizer Update Loop
function updateVisualizer() {
    if (!isPlaying) {
        // Smoothly return to base state when paused
        document.documentElement.style.setProperty('--beat-scale', '1');
        document.documentElement.style.setProperty('--beat-opacity-bg', '0.8');
        document.documentElement.style.setProperty('--beat-glow', '0 10px 30px rgba(0, 0, 0, 0.5)');
        document.documentElement.style.setProperty('--beat-ring-scale', '1');
        document.documentElement.style.setProperty('--beat-ring-opacity', '0');
        document.documentElement.style.setProperty('--beat-title-glow', '0 0 30px rgba(157, 78, 221, 0.5)');
        return;
    }

    animationId = requestAnimationFrame(updateVisualizer);

    if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);

        // Calculate average of lower frequencies (bass/kick) - bins 0 to 10
        let bassSum = 0;
        const bassCount = 10; 
        for (let i = 0; i < bassCount; i++) {
            bassSum += dataArray[i];
        }
        const bassAvg = bassSum / bassCount; 
        
        // Normalize intensity against maximum byte value (0.0 to 1.0)
        const beatIntensity = bassAvg / 255; 
        
        // Calculate CSS variable values based on beat intensity
        const scale = 1 + (beatIntensity * 0.08); // Max 1.08 scale
        const opacityBg = 0.6 + (beatIntensity * 0.4); // 0.6 to 1.0
        
        const glowSize = 30 + (beatIntensity * 80); 
        const r = Math.floor(157 + beatIntensity * 50);
        const g = 78;
        const b = Math.floor(221 - beatIntensity * 50);
        const a = 0.5 + beatIntensity * 0.5;
        const glowColor = `rgba(${r}, ${g}, ${b}, ${a})`;
        
        const ringScale = 1 + (beatIntensity * 0.5);
        const ringOpacity = beatIntensity > 0.4 ? (beatIntensity - 0.2) : 0;
        
        // Apply to CSS variables
        document.documentElement.style.setProperty('--beat-scale', scale.toString());
        document.documentElement.style.setProperty('--beat-opacity-bg', opacityBg.toString());
        document.documentElement.style.setProperty('--beat-glow', `0 0 ${glowSize}px ${glowColor}`);
        document.documentElement.style.setProperty('--beat-ring-scale', ringScale.toString());
        document.documentElement.style.setProperty('--beat-ring-opacity', ringOpacity.toString());
        document.documentElement.style.setProperty('--beat-title-glow', `0 0 ${glowSize}px ${glowColor}`);
    }
}

function loadTrack(index) {
    currentTrackIndex = index;
    const track = trackList[currentTrackIndex];
    
    audio.src = track.file;
    audio.load();
    
    trackTitle.textContent = track.title;
    
    trackCover.style.opacity = 0;
    setTimeout(() => {
        trackCover.src = track.cover;
        trackCover.style.opacity = 1;
    }, 200);

    // Update active class in list
    document.querySelectorAll(".track-item").forEach((item, i) => {
        item.classList.remove("active");
        if (i === currentTrackIndex) {
            item.classList.add("active");
            if (isPlaying) {
                item.classList.remove("paused");
            } else {
                item.classList.add("paused");
            }
        }
    });

    progressBar.style.background = `linear-gradient(to right, var(--primary) 0%, rgba(255, 255, 255, 0.2) 0%)`;
    progressBar.value = 0;
}

function playAudio() {
    isPlaying = true;
    
    // Initialize analyzer on first play to comply with browser autoplay policies
    initVisualizer();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    audio.play().catch(e => console.error("Audio playback error:", e));
    playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    trackCover.classList.add("playing");
    
    const activeItem = document.querySelector(".track-item.active");
    if (activeItem) activeItem.classList.remove("paused");
    
    updateVisualizer(); // Start visualizer loop
}

function pauseAudio() {
    isPlaying = false;
    audio.pause();
    playBtn.innerHTML = '<i class="fas fa-play"></i>';
    trackCover.classList.remove("playing");
    
    cancelAnimationFrame(animationId);
    // Reset visualizer to base state
    updateVisualizer(); 
    
    const activeItem = document.querySelector(".track-item.active");
    if (activeItem) activeItem.classList.add("paused");
}

function togglePlay() {
    if (isPlaying) {
        pauseAudio();
    } else {
        playAudio();
    }
}

function nextTrack() {
    currentTrackIndex = (currentTrackIndex + 1) % trackList.length;
    loadTrack(currentTrackIndex);
    if (isPlaying) playAudio();
}

function prevTrack() {
    currentTrackIndex = (currentTrackIndex - 1 + trackList.length) % trackList.length;
    loadTrack(currentTrackIndex);
    if (isPlaying) playAudio();
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// Event Listeners
playBtn.addEventListener("click", togglePlay);
nextBtn.addEventListener("click", nextTrack);
prevBtn.addEventListener("click", prevTrack);

audio.addEventListener("timeupdate", () => {
    const currentTime = audio.currentTime;
    const duration = audio.duration;
    
    if (duration > 0) {
        const progressPercent = (currentTime / duration) * 100;
        progressBar.value = progressPercent;
        progressBar.style.background = `linear-gradient(to right, var(--primary) ${progressPercent}%, rgba(255, 255, 255, 0.2) ${progressPercent}%)`;
    }
    
    currentTimeEl.textContent = formatTime(currentTime);
});

audio.addEventListener("loadedmetadata", () => {
    durationTimeEl.textContent = formatTime(audio.duration);
});

audio.addEventListener("ended", nextTrack);

progressBar.addEventListener("input", (e) => {
    const seekTime = (audio.duration / 100) * e.target.value;
    audio.currentTime = seekTime;
    
    const progressPercent = e.target.value;
    progressBar.style.background = `linear-gradient(to right, var(--primary) ${progressPercent}%, rgba(255, 255, 255, 0.2) ${progressPercent}%)`;
});

// Initialize
initTracklist();
loadTrack(currentTrackIndex);
