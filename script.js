// ===== Au refresh : toujours repartir en haut, même si une ancre traîne =====
// Sur arrivée fresh avec un lien partagé (#projets, #contact…), on respecte
// l'ancre. Sur un refresh manuel (Cmd+R), on force le retour en haut et on
// nettoie l'URL pour pouvoir profiter à nouveau de la cascade hero.
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}
window.addEventListener('load', () => {
    const navEntry = performance.getEntriesByType('navigation')[0];
    const isReload = navEntry && navEntry.type === 'reload';

    if (isReload) {
        if (window.location.hash) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        window.scrollTo(0, 0);
    } else if (!window.location.hash) {
        window.scrollTo(0, 0);
    }
});

// ===== Type-on sur le titre du hero =====
(function typeHeroTitle() {
    const target = document.querySelector('.hero h1 .highlight');
    if (!target) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const fullText = target.textContent;
    target.textContent = '';

    // Synchronisé avec animation-delay du h1 (0.7s) + 100ms de respiration
    setTimeout(() => {
        target.classList.add('typing');
        let i = 0;
        const typeNext = () => {
            if (i >= fullText.length) {
                target.classList.remove('typing');
                return;
            }
            i += 1;
            target.textContent = fullText.slice(0, i);
            const ch = fullText[i - 1];
            const delay = ch === ' ' ? 90 : 55 + Math.random() * 55;
            setTimeout(typeNext, delay);
        };
        typeNext();
    }, 800);
})();

// ===== Burger menu (mobile) =====
const navToggle = document.querySelector('.nav-toggle');
const primaryNav = document.getElementById('primary-nav');

function setNavOpen(open) {
    if (!navToggle || !primaryNav) return;
    navToggle.classList.toggle('open', open);
    primaryNav.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    document.body.style.overflow = open ? 'hidden' : '';
}

if (navToggle && primaryNav) {
    navToggle.addEventListener('click', () => {
        setNavOpen(!navToggle.classList.contains('open'));
    });
    // Fermer le menu après clic sur un lien (navigation interne)
    primaryNav.querySelectorAll('a').forEach((a) => {
        a.addEventListener('click', () => setNavOpen(false));
    });
    // Fermer avec Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navToggle.classList.contains('open')) {
            setNavOpen(false);
        }
    });
    // Sécurité : si on agrandit la fenêtre au-delà du breakpoint, on ferme
    window.addEventListener('resize', () => {
        if (window.innerWidth > 720 && navToggle.classList.contains('open')) {
            setNavOpen(false);
        }
    });
}

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

// ===== Highlight de la section active dans la nav =====
const navLinks = document.querySelectorAll('.nav nav a[href^="#"]');
const linkBySection = {};
navLinks.forEach((a) => {
    const id = a.getAttribute('href').slice(1);
    if (id) linkBySection[id] = a;
});
const sectionsToTrack = Object.keys(linkBySection)
    .map((id) => document.getElementById(id))
    .filter(Boolean);

const navObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            const link = linkBySection[entry.target.id];
            if (!link) return;
            navLinks.forEach((a) => a.classList.remove('active'));
            link.classList.add('active');
        }
    });
}, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });

sectionsToTrack.forEach((s) => navObserver.observe(s));

// ===== Scroll : parallax blobs + hero fade-out + progress bar =====
const heroInner = document.querySelector('.hero-inner');
const progressBar = document.querySelector('.scroll-progress');
let scrollTicking = false;

// On désactive les effets coûteux/visuellement bruyants sur petit écran
// (parallax blobs + hero qui s'envole). La progress bar reste utile partout.
const isSmallViewport = () => window.innerWidth <= 720;

function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
        const sy = window.scrollY;
        const small = isSmallViewport();

        if (!small) {
            // Parallax blobs (composé via CSS avec la propriété `translate`)
            document.documentElement.style.setProperty('--scroll-y', sy + 'px');
            // Hero qui s'envole : translate -0.4× scroll + fade sur 600px
            if (heroInner) {
                const fadeRatio = Math.max(0, Math.min(1, sy / 600));
                heroInner.style.translate = `0 ${(-sy * 0.4).toFixed(1)}px`;
                heroInner.style.opacity = (1 - fadeRatio).toFixed(3);
            }
        } else if (heroInner) {
            // Reset au cas où on basculerait de desktop vers mobile (rotate device, resize)
            heroInner.style.translate = '0 0';
            heroInner.style.opacity = '1';
            document.documentElement.style.setProperty('--scroll-y', '0px');
        }

        // Scroll progress bar — actif partout
        if (progressBar) {
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const ratio = docHeight > 0 ? sy / docHeight : 0;
            progressBar.style.transform = `scaleX(${ratio.toFixed(3)})`;
        }

        scrollTicking = false;
    });
}
window.addEventListener('scroll', onScroll, { passive: true });

// ===== Tilt 3D au survol — uniquement sur la powell-card (signature) =====
(function setupTilt() {
    const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!supportsHover) return;

    const MAX_TILT = 4; // tilt très subtil sur la powell-card
    const cards = document.querySelectorAll('.powell-card');

    cards.forEach((card) => {
        let raf = null;
        const onMove = (e) => {
            const rect = card.getBoundingClientRect();
            const dx = (e.clientX - rect.left) / rect.width - 0.5;   // [-0.5, 0.5]
            const dy = (e.clientY - rect.top) / rect.height - 0.5;
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                card.style.setProperty('--tilt-x', (-dy * MAX_TILT * 2).toFixed(2) + 'deg');
                card.style.setProperty('--tilt-y', (dx * MAX_TILT * 2).toFixed(2) + 'deg');
            });
        };
        const onLeave = () => {
            if (raf) cancelAnimationFrame(raf);
            card.style.setProperty('--tilt-x', '0deg');
            card.style.setProperty('--tilt-y', '0deg');
        };
        card.addEventListener('pointermove', onMove);
        card.addEventListener('pointerleave', onLeave);
    });
})();

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
