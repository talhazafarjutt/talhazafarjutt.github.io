/* ── SUPREMATIST PORTFOLIO — vertical scroll ── */

/* ── SCROLL PROGRESS ── */
const prog = document.getElementById('prog');
window.addEventListener('scroll', () => {
  const pct = scrollY / (document.documentElement.scrollHeight - innerHeight) * 100;
  if (prog) prog.style.width = pct + '%';
}, { passive: true });

/* ── LENS CURSOR ── */
const lens = document.getElementById('lens');
let lx = 0, ly = 0, lrx = -200, lry = -200;
document.addEventListener('mousemove', e => { lx = e.clientX; ly = e.clientY; }, { passive: true });
(function ll() {
  lrx += (lx - lrx) * 0.13;
  lry += (ly - lry) * 0.13;
  if (lens) { lens.style.left = lrx + 'px'; lens.style.top = lry + 'px'; }
  requestAnimationFrame(ll);
})();

/* hover states for lens size */
document.querySelectorAll('a,button,.proj-card,.blog-card,.c-link,.al,.btn').forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('on-shape'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('on-shape'));
});
document.querySelectorAll('.face').forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('on-cube'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('on-cube'));
});
document.querySelectorAll('.shape').forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('on-shape'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('on-shape'));
});

/* ── PHYSICS SHAPES (hero only) ── */
const shapeEls = [
  document.getElementById('s0'),
  document.getElementById('s1'),
  document.getElementById('s2')
];
const phys = shapeEls.map(el => ({ el, rx: 0, ry: 0, vx: 0, vy: 0 }));
let mX = 0, mY = 0;
document.addEventListener('mousemove', e => { mX = e.clientX; mY = e.clientY; }, { passive: true });

(function physLoop() {
  requestAnimationFrame(physLoop);
  if (scrollY > innerHeight) return; // only in hero
  phys.forEach(s => {
    if (!s.el) return;
    const r = s.el.getBoundingClientRect();
    const cx = r.left + r.width * 0.5, cy = r.top + r.height * 0.5;
    const dx = mX - cx, dy = mY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const RAD = 220;
    s.vx += (0 - s.rx) * 0.05;
    s.vy += (0 - s.ry) * 0.05;
    if (dist < RAD) {
      const f = ((RAD - dist) / RAD) * 2.4;
      s.vx -= (dx / dist) * f;
      s.vy -= (dy / dist) * f;
    }
    s.vx *= 0.80; s.vy *= 0.80;
    s.rx += s.vx; s.ry += s.vy;
    s.el.style.translate = s.rx + 'px ' + s.ry + 'px';
  });
})();

/* ── 3D CUBE NAV ── */
const cubeEl   = document.getElementById('cube');
const cubeWrap = document.getElementById('cube-wrap');
const ROTS     = { f:[0,0], r:[0,-90], b:[0,-180], l:[0,90], t:[-90,0], bt:[90,0] };
const FACE_SEQ = ['f','r','b','l','t','bt'];
let cubeRX = 0, cubeRY = 0, cubeIdx = 0;
let dragging = false, dragX0 = 0, dragY0 = 0, dragRX0 = 0, dragRY0 = 0, dragMoved = false;

function setCubeRot(rx, ry) {
  cubeRX = rx; cubeRY = ry;
  if (cubeEl) cubeEl.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
}

if (cubeWrap) {
  cubeWrap.addEventListener('mousedown', e => {
    dragging = true; dragMoved = false;
    dragX0 = e.clientX; dragY0 = e.clientY;
    dragRX0 = cubeRX; dragRY0 = cubeRY;
    e.preventDefault();
  });
}
document.addEventListener('mousemove', e => {
  if (!dragging) return;
  const dx = e.clientX - dragX0, dy = e.clientY - dragY0;
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved = true;
  if (cubeEl) cubeEl.style.transform =
    'rotateX(' + (dragRX0 - dy * 0.65) + 'deg) rotateY(' + (dragRY0 + dx * 0.65) + 'deg)';
}, { passive: true });

document.addEventListener('mouseup', e => {
  if (!dragging) return;
  dragging = false;
  if (dragMoved) return;
  const target = e.target.closest ? e.target.closest('.face') : null;
  const goto = target && target.dataset.goto;
  if (goto) {
    const sec = document.getElementById(goto);
    if (sec) sec.scrollIntoView({ behavior: 'smooth' });
    // spin cube to matching face
    const faceKey = { projects:'f', about:'r', blog:'b', contact:'l', skills:'t', experience:'bt' }[goto];
    if (faceKey) { const [rx,ry] = ROTS[faceKey]; setCubeRot(rx, ry); }
    return;
  }
  // no face → cycle
  cubeIdx = (cubeIdx + 1) % FACE_SEQ.length;
  const [rx, ry] = ROTS[FACE_SEQ[cubeIdx]];
  setCubeRot(rx, ry);
});

/* touch support for cube */
if (cubeWrap) {
  let tx0 = 0, ty0 = 0;
  cubeWrap.addEventListener('touchstart', e => {
    tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY;
    dragRX0 = cubeRX; dragRY0 = cubeRY; dragMoved = false;
  }, { passive: true });
  cubeWrap.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - tx0, dy = e.touches[0].clientY - ty0;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved = true;
    if (cubeEl) cubeEl.style.transform =
      'rotateX(' + (dragRX0 - dy * 0.65) + 'deg) rotateY(' + (dragRY0 + dx * 0.65) + 'deg)';
  }, { passive: true });
}

/* ── TYPEWRITER ── */
(function () {
  const roles = [
    'Senior Backend Engineer',
    'DevOps & Infrastructure Engineer',
    'AI/MLOps Platform Builder',
    'Microservices Architect'
  ];
  const el = document.getElementById('tw');
  if (!el) return;
  let ri = 0, ci = 0, del = false;
  function tick() {
    const cur = roles[ri];
    if (del) {
      el.textContent = cur.slice(0, --ci);
      if (ci === 0) { del = false; ri = (ri + 1) % roles.length; setTimeout(tick, 350); return; }
      setTimeout(tick, 38);
    } else {
      el.textContent = cur.slice(0, ++ci);
      if (ci === cur.length) { del = true; setTimeout(tick, 2200); return; }
      setTimeout(tick, 72);
    }
  }
  setTimeout(tick, 1400);
})();

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

/* ── CUBE ACTIVE SECTION HIGHLIGHT ── */
const secObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const id = e.target.id;
    const faceMap = { projects:'f', about:'r', blog:'b', contact:'l', skills:'t', experience:'bt' };
    document.querySelectorAll('.face').forEach(f => f.classList.remove('face-active'));
    const key = faceMap[id];
    if (key) {
      const face = document.querySelector('.face-' + key);
      if (face) face.classList.add('face-active');
    }
  });
}, { threshold: 0.4 });
document.querySelectorAll('section[id]').forEach(s => secObs.observe(s));

/* ── WEB AUDIO — generative ambient ── */
let ac, osc1, osc2, gainNode, filterNode, audioReady = false;

function startAudio() {
  if (audioReady) return;
  audioReady = true;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();

    gainNode   = ac.createGain();
    filterNode = ac.createBiquadFilter();
    filterNode.type = 'bandpass';
    filterNode.frequency.value = 280;
    filterNode.Q.value = 5;

    osc1 = ac.createOscillator(); osc1.type = 'sine';     osc1.frequency.value = 55;
    osc2 = ac.createOscillator(); osc2.type = 'triangle'; osc2.frequency.value = 82.4;

    const lfo = ac.createOscillator();
    const lfoG = ac.createGain();
    lfo.frequency.value = 0.18; lfoG.gain.value = 0.005;
    lfo.connect(lfoG); lfoG.connect(gainNode.gain);

    osc1.connect(filterNode); osc2.connect(filterNode);
    filterNode.connect(gainNode); gainNode.connect(ac.destination);

    gainNode.gain.setValueAtTime(0, ac.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.012, ac.currentTime + 2.5);
    osc1.start(); osc2.start(); lfo.start();
  } catch (_) { audioReady = false; }
}

document.addEventListener('mousemove', startAudio, { once: true });
document.addEventListener('click',     startAudio, { once: true });
document.addEventListener('scroll',    startAudio, { once: true, passive: true });

document.addEventListener('mousemove', e => {
  if (!filterNode || !ac) return;
  filterNode.frequency.setTargetAtTime(150 + (e.clientX / innerWidth) * 650, ac.currentTime, 0.15);
  gainNode.gain.setTargetAtTime(0.006 + (e.clientY / innerHeight) * 0.014, ac.currentTime, 0.2);
}, { passive: true });

shapeEls.forEach((el, i) => {
  if (!el) return;
  el.addEventListener('mouseenter', () => {
    if (!ac) return;
    const b = ac.createOscillator(), bg = ac.createGain();
    bg.gain.setValueAtTime(0.045, ac.currentTime);
    bg.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.2);
    b.frequency.value = [330, 440, 554][i];
    b.connect(bg); bg.connect(ac.destination);
    b.start(); b.stop(ac.currentTime + 0.2);
  });
});

function uiClick() {
  if (!ac) return;
  const b = ac.createOscillator(), bg = ac.createGain();
  bg.gain.setValueAtTime(0.025, ac.currentTime);
  bg.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.07);
  b.frequency.value = 880; b.type = 'sine';
  b.connect(bg); bg.connect(ac.destination);
  b.start(); b.stop(ac.currentTime + 0.07);
}
document.querySelectorAll('.face,.btn,.bc-link,.al,.c-link').forEach(el => {
  el.addEventListener('click', uiClick);
});

/* ── CALENDLY ── */
const calBtn = document.getElementById('calBtn');
if (calBtn) {
  calBtn.addEventListener('click', () => {
    if (typeof Calendly !== 'undefined') {
      Calendly.initPopupWidget({ url: 'https://calendly.com/talha-zafar-j/30min' });
    }
  });
}

/* ── FACE-ACTIVE CSS INJECT (no extra class needed in HTML) ── */
const faceActiveStyle = document.createElement('style');
faceActiveStyle.textContent = '.face-active{background:var(--red)!important;color:#fff!important;border-color:var(--red)!important}';
document.head.appendChild(faceActiveStyle);
