/**
 * ПУЛЬС - Album Presentation Player
 * Performance-optimized for budget mobile devices.
 * 
 * Key techniques:
 * - Canvas 2D background replaces CPU‑expensive CSS blur filters
 * - Web Audio API analyser with small fftSize (128) for low CPU cost
 * - Visualizer updates throttled to 30fps instead of 60fps
 * - DOM writes batched; CSS variables used minimally (2 vars instead of 6)
 * - Passive event listeners where applicable
 * - requestAnimationFrame only runs when music is playing
 */

const TRACKS = [
    { title: "Братан Какао",    file: "Братан Какао.mp3",    cover: "Братан Какао.jpg" },
    { title: "Газовый Гэнри",  file: "Газовый Гэнри.mp3",  cover: "Газовый Гэнри.jpg" },
    { title: "Залетел на фьючи",file: "Залетел на фьючи.mp3",cover: "Залетел на фьючи.jpg" },
    { title: "Серебро",         file: "Серебро.mp3",         cover: "Серебро.jpg" },
    { title: "Я Инвестор",      file: "Я Инвестор.mp3",      cover: "Я Иневстор.jpg" }
];

// ─────────────── DOM refs ───────────────
const audio            = document.getElementById("audio-element");
const playBtn          = document.getElementById("play-btn");
const prevBtn          = document.getElementById("prev-btn");
const nextBtn          = document.getElementById("next-btn");
const trackTitleEl     = document.getElementById("track-title");
const trackCoverEl     = document.getElementById("track-cover");
const progressBarEl    = document.getElementById("progress-bar");
const currentTimeEl    = document.getElementById("current-time");
const durationTimeEl   = document.getElementById("duration-time");
const trackListEl      = document.getElementById("track-list");
const coverContainer   = document.getElementById("cover-container");
const pulseRing        = document.getElementById("pulse-ring");
const bgCanvas         = document.getElementById("bg-canvas");
const bgCtx            = bgCanvas.getContext("2d", { alpha: false });

// ─────────────── State ────────────────
let currentIdx  = 0;
let isPlaying   = false;
let audioCtx, analyser, dataArray;
let animId      = null;
let lastFrame   = 0;
const TARGET_FPS = 30;
const FRAME_MS   = 1000 / TARGET_FPS;

// ─────────────── Canvas Background ───────────────
// Two slow‑moving orbs rendered as radial gradients on a canvas.
// Painting on canvas skips the browser's CSS layout & compositing passes
// that make CSS ::before/::after blur so expensive.
const orbs = [
    { x: 0.3, y: 0.4, r: 0.45, vx: 0.00015, vy: 0.0001,  hue: 270, base: 0 },
    { x: 0.7, y: 0.6, r: 0.35, vx: -0.0001, vy: 0.00015, hue: 35,  base: 0 }
];
let bgBeat = 0; // smooth interpolation target

function resizeCanvas() {
    bgCanvas.width  = window.innerWidth;
    bgCanvas.height = window.innerHeight;
}

function renderBg(beat) {
    const W = bgCanvas.width, H = bgCanvas.height;
    bgCtx.fillStyle = "#10002b";
    bgCtx.fillRect(0, 0, W, H);

    orbs.forEach(o => {
        // Drift orbs gently
        o.x += o.vx;
        o.y += o.vy;
        if (o.x < 0.1 || o.x > 0.9) o.vx *= -1;
        if (o.y < 0.1 || o.y > 0.9) o.vy *= -1;

        const cx = o.x * W;
        const cy = o.y * H;
        const radius = o.r * Math.max(W, H) * (1 + beat * 0.15);
        const alpha  = 0.35 + beat * 0.2;

        const grad = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, `hsla(${o.hue}, 80%, 40%, ${alpha})`);
        grad.addColorStop(1, "transparent");

        bgCtx.fillStyle = grad;
        bgCtx.fillRect(0, 0, W, H);
    });
}

// Initial draw
resizeCanvas();
renderBg(0);

window.addEventListener("resize", () => {
    resizeCanvas();
    if (!isPlaying) renderBg(bgBeat);
}, { passive: true });

// ─────────────── Tracklist UI ────────────────
function buildTracklist() {
    const frag = document.createDocumentFragment();
    TRACKS.forEach((t, i) => {
        const li = document.createElement("li");
        li.className = "track-item" + (i === 0 ? " active paused" : "");
        li.dataset.index = i;
        li.setAttribute("role", "listitem");
        li.innerHTML =
            `<div class="track-item-num">${i + 1}</div>` +
            `<img class="track-item-img" src="${t.cover}" alt="${t.title}" loading="lazy" width="40" height="40">` +
            `<div class="track-item-info">` +
                `<div class="track-item-title">${t.title}</div>` +
                `<div class="track-item-artist">Sanchoyze Production</div>` +
            `</div>` +
            `<div class="playing-icon" aria-hidden="true">` +
                `<div class="bar"></div><div class="bar"></div><div class="bar"></div>` +
            `</div>`;

        li.addEventListener("click", () => {
            if (currentIdx === i) { togglePlay(); }
            else { loadTrack(i); startPlay(); }
        }, { passive: true });

        frag.appendChild(li);
    });
    trackListEl.appendChild(frag);
}

// ─────────────── Track Management ────────────────
const trackItems = () => trackListEl.querySelectorAll(".track-item");

function loadTrack(idx) {
    currentIdx = idx;
    const t = TRACKS[idx];

    audio.src = t.file;
    audio.load();
    trackTitleEl.textContent = t.title;

    // Crossfade cover
    trackCoverEl.style.opacity = "0";
    setTimeout(() => {
        trackCoverEl.src = t.cover;
        trackCoverEl.style.opacity = "1";
    }, 180);

    // Update tracklist highlights (avoid querySelectorAll in tight loops)
    trackItems().forEach((el, i) => {
        el.classList.toggle("active", i === idx);
        el.classList.toggle("paused", i === idx && !isPlaying);
    });

    progressBarEl.value = 0;
    updateProgressStyle(0);
}

function startPlay() {
    isPlaying = true;
    initAudioCtx();

    audio.play().catch(console.error);
    playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    trackCoverEl.classList.add("playing");

    const active = trackListEl.querySelector(".track-item.active");
    if (active) active.classList.remove("paused");

    if (!animId) scheduleFrame();
}

function stopPlay() {
    isPlaying = false;
    audio.pause();
    playBtn.innerHTML = '<i class="fas fa-play"></i>';
    trackCoverEl.classList.remove("playing");

    cancelAnimationFrame(animId);
    animId = null;

    const active = trackListEl.querySelector(".track-item.active");
    if (active) active.classList.add("paused");

    // Reset beat visuals
    applyBeat(0);
}

function togglePlay() { isPlaying ? stopPlay() : startPlay(); }

function nextTrack() {
    currentIdx = (currentIdx + 1) % TRACKS.length;
    loadTrack(currentIdx);
    if (isPlaying) startPlay();
}

function prevTrack() {
    currentIdx = (currentIdx - 1 + TRACKS.length) % TRACKS.length;
    loadTrack(currentIdx);
    if (isPlaying) startPlay();
}

// ─────────────── Web Audio API ────────────────
function initAudioCtx() {
    if (audioCtx) {
        if (audioCtx.state === "suspended") audioCtx.resume();
        return;
    }
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AC();
        analyser  = audioCtx.createAnalyser();
        // Small fftSize → fewer bins → faster getByteFrequencyData
        analyser.fftSize       = 128;
        analyser.smoothingTimeConstant = 0.75; // temporal smoothing built into API

        const src = audioCtx.createMediaElementSource(audio);
        src.connect(analyser);
        analyser.connect(audioCtx.destination);

        dataArray = new Uint8Array(analyser.frequencyBinCount); // 64 values
    } catch (e) {
        console.warn("Web Audio API unavailable:", e);
    }
}

// ─────────────── Visualizer ────────────────
// Runs at max TARGET_FPS to avoid overloading budget CPUs
function scheduleFrame() {
    animId = requestAnimationFrame(onFrame);
}

function onFrame(ts) {
    if (!isPlaying) return;

    if (ts - lastFrame >= FRAME_MS) {
        lastFrame = ts;
        const beat = readBeat();
        applyBeat(beat);
        renderBg(beat);
    }
    scheduleFrame();
}

function readBeat() {
    if (!analyser || !dataArray) return 0;
    analyser.getByteFrequencyData(dataArray);
    // Average first 8 bins (subbass/bass) — cheapest operation
    let sum = 0;
    for (let i = 0; i < 8; i++) sum += dataArray[i];
    return sum / (8 * 255); // 0.0 – 1.0
}

/**
 * Apply beat intensity to DOM.
 * Only 2 element style mutations per frame (cover-container + pulse-ring).
 * CSS transitions handle easing; no CSS variable writes needed.
 */
function applyBeat(beat) {
    const scale       = 1 + beat * 0.07;
    const ringScale   = 1 + beat * 0.55;
    const ringOpacity = beat > 0.35 ? (beat - 0.2) * 0.9 : 0;

    // transform is GPU-composited (no layout reflow)
    coverContainer.style.transform = `scale(${scale.toFixed(3)})`;
    pulseRing.style.transform      = `scale(${ringScale.toFixed(3)})`;
    pulseRing.style.opacity        = ringOpacity.toFixed(3);
}

// ─────────────── Progress Bar ────────────────
function updateProgressStyle(pct) {
    progressBarEl.style.background =
        `linear-gradient(to right, #9d4edd ${pct}%, rgba(255,255,255,0.2) ${pct}%)`;
}

const fmtTime = s => {
    if (isNaN(s)) return "0:00";
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return `${m}:${ss < 10 ? "0" : ""}${ss}`;
};

audio.addEventListener("timeupdate", () => {
    const d = audio.duration;
    if (!d) return;
    const pct = (audio.currentTime / d) * 100;
    progressBarEl.value = pct;
    updateProgressStyle(pct);
    currentTimeEl.textContent = fmtTime(audio.currentTime);
}, { passive: true });

audio.addEventListener("loadedmetadata", () => {
    durationTimeEl.textContent = fmtTime(audio.duration);
}, { passive: true });

audio.addEventListener("ended", nextTrack, { passive: true });

progressBarEl.addEventListener("input", e => {
    const pct = +e.target.value;
    audio.currentTime = (audio.duration / 100) * pct;
    updateProgressStyle(pct);
});

// ─────────────── Controls ────────────────
playBtn.addEventListener("click", togglePlay);
nextBtn.addEventListener("click", nextTrack);
prevBtn.addEventListener("click", prevTrack);

// ─────────────── Init ────────────────
buildTracklist();
loadTrack(0);
