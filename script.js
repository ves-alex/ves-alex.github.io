// ===== Intro : zipper circulaire qui s'ouvre =====
const intro = document.getElementById('ringIntro');
const pull = document.getElementById('ringPull');

let opening = false;
let autoOpenTimer = null;
let audioCtx = null;

let dragStartY = null;
let dragOffset = 0;
let lastClickPos = 0;
let lastVibratePos = 0;

const AUTO_OPEN_DELAY = 3000;
const ANIM_DURATION = 2400;
const BASE_R = 80;              // rayon initial du cercle (px)
const BASE_PULL_OFFSET = 130;   // distance initiale de la tirette au centre (px)
const DRAG_RATIO = 1.6;         // amplification : 1px de drag → 1.6px de rayon en plus
const FULL_OPEN_THRESHOLD = 0.7;// drag minimum pour valider l'ouverture (en fraction de maxDrag)
const CLICK_INTERVAL_PX = 28;
const VIBRATE_INTERVAL_PX = 36;
const SNAP_DURATION = 800;

const maxDrag = () => window.innerHeight * 0.55;

// ===== Web Audio : souffle d'ambiance pendant la dissipation =====
function ensureAudioCtx() {
    if (audioCtx) return audioCtx;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        audioCtx = null;
    }
    return audioCtx;
}

// Souffle de zipper circulaire : montée de fréquence + clics rapides en parallèle
function playRingZip() {
    const ctx = ensureAudioCtx();
    if (!ctx || ctx.state === 'closed') return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const duration = 2.4;

    // Couche 1 : bruit blanc filtré (zip global)
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(900, now);
    bandpass.frequency.exponentialRampToValueAtTime(3500, now + duration * 0.7);
    bandpass.frequency.linearRampToValueAtTime(1200, now + duration);
    bandpass.Q.value = 1.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.25);
    gain.gain.linearRampToValueAtTime(0.12, now + duration - 0.3);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
    source.stop(now + duration + 0.1);

    // Couche 2 : 16 micro-clics répartis sur la durée
    for (let i = 0; i < 16; i++) {
        const t = now + (i / 16) * duration * 0.92;
        const clickBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
        const cd = clickBuf.getChannelData(0);
        for (let j = 0; j < cd.length; j++) {
            cd[j] = (Math.random() * 2 - 1) * Math.exp(-j / (cd.length * 0.18));
        }
        const clickSrc = ctx.createBufferSource();
        clickSrc.buffer = clickBuf;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 2500 + Math.random() * 1500;
        const cg = ctx.createGain();
        cg.gain.value = 0.06;
        clickSrc.connect(hp);
        hp.connect(cg);
        cg.connect(ctx.destination);
        clickSrc.start(t);
    }
}

function tryVibrate(pattern) {
    if (navigator.vibrate) {
        try { navigator.vibrate(pattern); } catch (e) {}
    }
}

// Petit clic rapide pour le drag (un cran de zipper)
function playRingClick(intensity = 1) {
    const ctx = ensureAudioCtx();
    if (!ctx || ctx.state === 'closed') return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const duration = 0.04;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.18));
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2400 + Math.random() * 1500;
    const gain = ctx.createGain();
    gain.gain.value = Math.min(0.16, 0.06 + intensity * 0.04);
    source.connect(hp);
    hp.connect(gain);
    gain.connect(ctx.destination);
    source.start();
}

// Met à jour le rayon du cercle et la position de la tirette
function setRingState(r, pullOff) {
    intro.style.setProperty('--ring-r', `${r}px`);
    intro.style.setProperty('--pull-offset', `${pullOff}px`);
}

// ===== Ouverture =====
function openIntro() {
    if (opening) return;
    opening = true;
    cancelAutoOpen();
    intro.classList.remove('dragging');
    intro.classList.add('opening');

    // Force la cible inline pour écraser ce que le drag a posé.
    // Les transitions CSS (r 2.2s, transform 2.2s) prennent le relais à partir
    // de la valeur courante, donc la continuité visuelle est garantie.
    intro.style.setProperty('--ring-r', '1800px');
    intro.style.setProperty('--pull-offset', '120vh');

    document.body.style.overflow = '';
    playRingZip();
    tryVibrate([8, 40, 6, 60, 8, 80, 20]);

    // Le voile entier fond pendant la dernière phase pour que la disparition
    // ne soit jamais brutale, même si le cercle n'a pas atteint sa cible.
    intro.style.transition = 'opacity 700ms cubic-bezier(0.4, 0, 0.15, 1) ' + (ANIM_DURATION - 700) + 'ms';
    requestAnimationFrame(() => {
        intro.style.opacity = '0';
    });

    setTimeout(() => {
        intro.classList.add('gone');
    }, ANIM_DURATION + 50);
}

function scheduleAutoOpen() {
    cancelAutoOpen();
    autoOpenTimer = setTimeout(() => {
        if (!opening) openIntro();
    }, AUTO_OPEN_DELAY);
}
function cancelAutoOpen() {
    if (autoOpenTimer) {
        clearTimeout(autoOpenTimer);
        autoOpenTimer = null;
    }
}

// ===== Drag de la tirette =====
function onPullDown(e) {
    if (opening) return;
    cancelAutoOpen();
    ensureAudioCtx();
    e.preventDefault();
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartY = y;
    dragOffset = 0;
    lastClickPos = 0;
    lastVibratePos = 0;
    intro.classList.add('dragging');
    playRingClick(0.6);
    tryVibrate(8);

    document.addEventListener('pointermove', onPullMove);
    document.addEventListener('pointerup', onPullUp, { once: true });
    document.addEventListener('touchmove', onPullMove, { passive: false });
    document.addEventListener('touchend', onPullUp, { once: true });
}

function onPullMove(e) {
    if (dragStartY === null || opening) return;
    if (e.cancelable) e.preventDefault();
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = Math.max(0, dragStartY - y);  // uniquement vers le haut
    dragOffset = Math.min(maxDrag(), dy);

    const newR = BASE_R + dragOffset * DRAG_RATIO;
    const newPullOff = BASE_PULL_OFFSET + dragOffset;
    setRingState(newR, newPullOff);

    if (Math.abs(dragOffset - lastClickPos) >= CLICK_INTERVAL_PX) {
        playRingClick();
        lastClickPos = dragOffset;
    }
    if (Math.abs(dragOffset - lastVibratePos) >= VIBRATE_INTERVAL_PX) {
        tryVibrate(5);
        lastVibratePos = dragOffset;
    }
}

function onPullUp() {
    document.removeEventListener('pointermove', onPullMove);
    document.removeEventListener('touchmove', onPullMove);
    if (opening) return;

    const ratio = dragOffset / maxDrag();
    if (ratio >= FULL_OPEN_THRESHOLD) {
        // Continue l'ouverture jusqu'au bout
        intro.classList.remove('dragging');
        openIntro();
    } else {
        // Snap back vers l'état initial
        intro.classList.remove('dragging');
        // Force une transition douce pour le retour
        const els = [
            document.querySelector('.ring-mask-circle'),
            document.querySelector('.ring-teeth-outer'),
            document.querySelector('.ring-teeth-inner'),
            pull
        ];
        els.forEach((el) => {
            if (el) el.style.transition = `r ${SNAP_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${SNAP_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        });
        setRingState(BASE_R, BASE_PULL_OFFSET);
        setTimeout(() => {
            els.forEach((el) => { if (el) el.style.transition = ''; });
        }, SNAP_DURATION + 50);
        scheduleAutoOpen();
    }
    dragStartY = null;
    dragOffset = 0;
}

pull.addEventListener('pointerdown', onPullDown);
pull.addEventListener('touchstart', onPullDown, { passive: false });

// Clic ailleurs sur l'intro = ouverture animée
intro.addEventListener('click', (e) => {
    if (opening) return;
    if (e.target === pull || pull.contains(e.target)) return;
    ensureAudioCtx();
    openIntro();
});

intro.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        ensureAudioCtx();
        openIntro();
    }
});

// État initial
document.body.style.overflow = 'hidden';
setRingState(BASE_R, BASE_PULL_OFFSET);
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
