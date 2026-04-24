// ===== Intro fermeture éclair =====
const intro = document.getElementById('zipperIntro');
const pull = document.getElementById('zipperPull');

let opening = false;
let dragStartY = null;
let dragStartX = null;
let dragStartOffset = 0;
let pullPosition = 0;
let lastClickPos = 0;
let lastVibratePos = 0;
let autoOpenTimer = null;
let autoOpenInterval = null;
let audioCtx = null;

const CLICK_INTERVAL_PX = 22;
const VIBRATE_INTERVAL_PX = 30;
const OPEN_DURATION = 1600;
const SNAP_BACK_DURATION = 900;
const AUTO_OPEN_DELAY = 2500;
const FULL_OPEN_THRESHOLD = 0.96;
const TILT_SENSITIVITY = 8;

const maxPull = () => window.innerHeight - 110;

// ===== Web Audio : synthèse d'un clic métallique =====
function ensureAudioCtx() {
    if (audioCtx) return audioCtx;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        audioCtx = null;
    }
    return audioCtx;
}

function playZipperClick(intensity = 1) {
    const ctx = ensureAudioCtx();
    if (!ctx || ctx.state === 'closed') return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const duration = 0.05;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        const env = Math.exp(-i / (bufferSize * 0.18));
        data[i] = (Math.random() * 2 - 1) * env;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2200 + Math.random() * 1500;

    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 4500;
    peak.Q.value = 6;
    peak.gain.value = 8;

    const gain = ctx.createGain();
    gain.gain.value = Math.min(0.18, 0.07 + intensity * 0.04);

    source.connect(filter);
    filter.connect(peak);
    peak.connect(gain);
    gain.connect(ctx.destination);
    source.start();
}

// ===== Vibration mobile =====
function tryVibrate(ms = 6) {
    if (navigator.vibrate) {
        try { navigator.vibrate(ms); } catch (e) {}
    }
}

// ===== Mise à jour des variables CSS =====
function setPull(yPx, ratio) {
    const pct = (yPx / window.innerHeight) * 100;
    intro.style.setProperty('--pull-y', `${pct}%`);
    intro.style.setProperty('--pull-ratio', String(ratio));
    intro.style.setProperty('--halo-y', `${Math.max(8, pct + 2)}%`);
}

// ===== Tilt de la tirette (rotation pendant le drag) =====
function setPullTilt(deg) {
    pull.style.transform = `translateX(-50%) rotate(${deg}deg)`;
}
function clearPullTilt() {
    pull.style.transform = '';
}

// ===== Ouverture =====
function openZipper(fromPosition = pullPosition) {
    if (opening) return;
    opening = true;
    cancelAutoOpen();
    pull.classList.remove('idle');
    intro.classList.remove('dragging');
    intro.classList.add('opening');
    clearPullTilt();

    const remainingRatio = 1 - (fromPosition / maxPull());
    const duration = Math.max(800, Math.round(OPEN_DURATION * remainingRatio));

    intro.querySelectorAll('.panel, .zipper-pull, .zipper-teeth').forEach((el) => {
        el.style.transition = `clip-path ${duration}ms cubic-bezier(0.65, 0, 0.35, 1),
                               top ${duration}ms cubic-bezier(0.65, 0, 0.35, 1),
                               transform ${duration}ms cubic-bezier(0.65, 0, 0.35, 1)`;
    });

    requestAnimationFrame(() => {
        setPull(maxPull(), 1);
    });

    const clickInterval = Math.max(40, Math.round(duration / 28));
    autoOpenInterval = setInterval(() => {
        playZipperClick(1.2);
        tryVibrate(5);
    }, clickInterval);

    document.body.style.overflow = '';
    setTimeout(() => {
        clearInterval(autoOpenInterval);
        autoOpenInterval = null;
        playZipperClick(2);
        tryVibrate(40);
        intro.classList.add('gone');
    }, duration + 80);
}

function snapBack() {
    intro.classList.remove('dragging');
    clearPullTilt();
    intro.querySelectorAll('.panel, .zipper-pull, .zipper-teeth').forEach((el) => {
        el.style.transition = `clip-path ${SNAP_BACK_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1),
                               top ${SNAP_BACK_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1),
                               transform ${SNAP_BACK_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    });
    setPull(0, 0);
    setTimeout(() => {
        if (!opening) pull.classList.add('idle');
    }, SNAP_BACK_DURATION + 40);
}

// ===== Auto-ouverture =====
function scheduleAutoOpen() {
    cancelAutoOpen();
    autoOpenTimer = setTimeout(() => {
        if (!opening) openZipper(0);
    }, AUTO_OPEN_DELAY);
}
function cancelAutoOpen() {
    if (autoOpenTimer) {
        clearTimeout(autoOpenTimer);
        autoOpenTimer = null;
    }
}

// ===== Drag =====
function onPointerDown(e) {
    if (opening) return;
    cancelAutoOpen();
    ensureAudioCtx();
    const y = (e.touches ? e.touches[0].clientY : e.clientY);
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    dragStartY = y;
    dragStartX = x;
    dragStartOffset = pullPosition;
    lastClickPos = pullPosition;
    lastVibratePos = pullPosition;
    intro.classList.add('dragging');
    pull.classList.remove('idle');
    playZipperClick(0.5);
    tryVibrate(8);

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp, { once: true });
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchend', onPointerUp, { once: true });
}

function onPointerMove(e) {
    if (dragStartY === null || opening) return;
    if (e.cancelable) e.preventDefault();
    const y = (e.touches ? e.touches[0].clientY : e.clientY);
    const x = (e.touches ? e.touches[0].clientX : e.clientX);

    pullPosition = Math.max(0, Math.min(maxPull(), dragStartOffset + (y - dragStartY)));
    const ratio = pullPosition / maxPull();

    setPull(pullPosition, ratio);

    const dx = x - dragStartX;
    const tilt = Math.max(-6, Math.min(6, dx / TILT_SENSITIVITY));
    setPullTilt(tilt);

    if (Math.abs(pullPosition - lastClickPos) >= CLICK_INTERVAL_PX) {
        playZipperClick();
        lastClickPos = pullPosition;
    }
    if (Math.abs(pullPosition - lastVibratePos) >= VIBRATE_INTERVAL_PX) {
        tryVibrate(5);
        lastVibratePos = pullPosition;
    }
}

function onPointerUp() {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('touchmove', onPointerMove);
    if (opening) return;

    const ratio = pullPosition / maxPull();
    if (ratio >= FULL_OPEN_THRESHOLD) {
        openZipper(pullPosition);
    } else {
        snapBack();
        pullPosition = 0;
        scheduleAutoOpen();
    }
    dragStartY = null;
    dragStartX = null;
    dragStartOffset = 0;
}

pull.addEventListener('pointerdown', onPointerDown);
pull.addEventListener('touchstart', onPointerDown, { passive: true });

// Clic n'importe où sur l'intro (hors tirette) : ouverture animée
intro.addEventListener('click', (e) => {
    if (opening) return;
    if (e.target === pull || pull.contains(e.target)) return;
    ensureAudioCtx();
    openZipper(0);
});

// Clavier : Entrée ou Espace ouvrent l'intro
intro.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        ensureAudioCtx();
        openZipper(0);
    }
});

// Annule l'auto-open dès que l'utilisateur survole la tirette
pull.addEventListener('pointerenter', cancelAutoOpen);

// État initial
pull.classList.add('idle');
document.body.style.overflow = 'hidden';
setPull(0, 0);
scheduleAutoOpen();

// ===== Reveal au scroll =====
const reveals = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.15 });

reveals.forEach((el) => observer.observe(el));

// ===== Formulaire de contact (mailto) =====
const form = document.getElementById('contactForm');
const note = document.getElementById('formNote');
const TARGET_EMAIL = 'alexves.tech@pm.me';

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = (data.get('name') || '').toString().trim();
    const email = (data.get('email') || '').toString().trim();
    const message = (data.get('message') || '').toString().trim();

    if (!name || !email || !message) {
        note.textContent = 'Oups — merci de remplir les trois champs.';
        return;
    }

    const subject = encodeURIComponent(`Message de ${name} via ton site`);
    const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
    window.location.href = `mailto:${TARGET_EMAIL}?subject=${subject}&body=${body}`;
    note.textContent = 'Ton client mail devrait s’ouvrir… Merci !';
});

// ===== Année dynamique =====
document.getElementById('year').textContent = new Date().getFullYear();
