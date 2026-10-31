/* ── PORTFOLIO — vertical scroll ── */

/* ── SCROLL PROGRESS ── */
const prog = document.getElementById('prog');
window.addEventListener('scroll', () => {
  const pct = scrollY / (document.documentElement.scrollHeight - innerHeight) * 100;
  if (prog) prog.style.width = pct + '%';
}, { passive: true });

/* ── TOP BAR: shadow once scrolled, mobile menu ── */
const nav = document.getElementById('site-nav');
const navMenu = document.getElementById('nvMenu');
const navLinks = document.getElementById('nvLinks');
function setMenu(open) {
  if (!navMenu || !navLinks) return;
  navMenu.setAttribute('aria-expanded', String(open));
  navMenu.textContent = open ? 'Close' : 'Menu';
  navLinks.classList.toggle('open', open);
}
if (navMenu) navMenu.addEventListener('click', () => setMenu(navMenu.getAttribute('aria-expanded') !== 'true'));
if (navLinks) navLinks.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

/* ── INTERSECTION OBSERVER — reveal + counters ── */
function counter(el) {
  const to = parseInt(el.dataset.count);
  const suf = el.dataset.suf || '';
  const dur = 1300, s = performance.now();
  function step(n) {
    const p = Math.min((n - s) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(e * to) + (p >= 1 ? suf : '');
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const revObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('on');
    if (e.target.dataset.count) counter(e.target);
    revObs.unobserve(e.target);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -24px 0px' });

document.querySelectorAll('.ri,.rl,.rr,[data-count]').forEach(el => revObs.observe(el));

/* ── TOP BAR FOLLOWS THE SECTION IN VIEW ── */
// highlight the link of whichever section crosses the upper third of the viewport
const navSections = [...document.querySelectorAll('section[id]')];
const navAnchors = navLinks ? [...navLinks.querySelectorAll('a[href^="#"]')] : [];
let shownId = null;
function syncNav() {
  if (nav) nav.classList.toggle('scrolled', scrollY > 8);
  const probe = innerHeight * 0.35;
  let active = navSections[0];
  for (const sec of navSections) if (sec.getBoundingClientRect().top <= probe) active = sec;
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) active = navSections[navSections.length - 1];
  if (!active || active.id === shownId) return;
  shownId = active.id;
  navAnchors.forEach(a => {
    const on = a.getAttribute('href') === '#' + active.id;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
  });
}
let navTick = false;
window.addEventListener('scroll', () => {
  if (navTick) return;
  navTick = true;
  requestAnimationFrame(() => { navTick = false; syncNav(); });
}, { passive: true });
window.addEventListener('resize', syncNav);
syncNav();

/* ── CALENDLY — loaded on demand (≈ a third-party script per page view saved) ── */
// the contact card's button, plus any element marked data-calendly (packages page, top bar)
const calButtons = [...document.querySelectorAll('#calBtn, [data-calendly]')];
let calendlyReady = null;
function loadCalendly() {
  calendlyReady ??= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://assets.calendly.com/assets/external/widget.css';
    const js = document.createElement('script');
    js.src = 'https://assets.calendly.com/assets/external/widget.js'; js.async = true;
    js.onload = resolve; js.onerror = () => { calendlyReady = null; reject(); };
    document.head.append(css, js);
  });
  return calendlyReady;
}
if (calButtons.length) {
  // warm it up once a booking button is close, so the click opens instantly
  const warm = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { loadCalendly().catch(() => {}); warm.disconnect(); }
  }, { rootMargin: '600px 0px' });
  calButtons.forEach(b => warm.observe(b));
  // themed to the site palette (vanilla background, indigo ink + buttons)
  const CAL_URL = 'https://calendly.com/talha-zafar-j/30min?background_color=fff4d6&text_color=161e4d&primary_color=263baa';
  calButtons.forEach(b => b.addEventListener('click', e => {
    e.preventDefault();          // links marked data-calendly fall back to their href without JS
    loadCalendly()
      .then(() => Calendly.initPopupWidget({ url: CAL_URL }))
      .catch(() => window.open(CAL_URL, '_blank', 'noopener'));
  }));
}
