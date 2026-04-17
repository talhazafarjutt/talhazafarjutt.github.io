/* ── SUPREMATIST PORTFOLIO — main.js ── */

/* ── PROJECT DATA ── */
const PROJECTS = [
  {
    id: 0, name: 'LLM Inference Platform', sub: 'Codsy',
    cmd: 'docker run codsy/llm', status: '● running',
    color: '#C8102E',
    desc: 'Production-grade multi-GPU LLM cluster: 4× Tesla V100, FastAPI load-balancing router, nginx API gateway with key auth, vLLM engine management. Serving active developer teams at scale.',
    tech: ['vLLM', 'FastAPI', 'nginx', 'K3s', 'V100', 'Python SDK']
  },
  {
    id: 1, name: 'Zero-Trust Secrets Pipeline', sub: 'Vault',
    cmd: 'vault status --policy', status: '● sealed',
    color: '#e2e8f0',
    desc: 'HashiCorp Vault in isolated LXD container: AppRole auth, dynamic credential rotation for SSH & CI/CD. Policy-based access, GDPR data residency compliant on bare metal.',
    tech: ['HashiCorp Vault', 'LXD', 'AppRole', 'GitHub Actions', 'GDPR']
  },
  {
    id: 2, name: 'AI Agent Microservices', sub: 'Platform',
    cmd: 'kubectl get pods -n ai', status: '6/6 running',
    color: '#F5C519',
    desc: '6 gRPC-connected services with Redis job queuing, ECDH + ABE multi-tenant isolation. Sub-100ms P95 latency serving 10k+ daily API requests.',
    tech: ['FastAPI', 'gRPC', 'Redis', 'ECDH', 'ABE', 'PostgreSQL']
  }
];

/* ── LENS CURSOR ── */
const lens = document.getElementById('lens');
let lx = 0, ly = 0, lrx = -200, lry = -200;

document.addEventListener('mousemove', e => { lx = e.clientX; ly = e.clientY; }, { passive: true });

(function lloop() {
  lrx += (lx - lrx) * 0.13;
  lry += (ly - lry) * 0.13;
  if (lens) { lens.style.left = lrx + 'px'; lens.style.top = lry + 'px'; }
  requestAnimationFrame(lloop);
})();

/* ── PHYSICS SHAPES ── */
const shapeEls = [
  document.getElementById('s0'),
  document.getElementById('s1'),
  document.getElementById('s2')
];

const phys = shapeEls.map(el => ({ el, rx: 0, ry: 0, vx: 0, vy: 0 }));
let mouseX = 0, mouseY = 0;

document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; }, { passive: true });

(function physLoop() {
  phys.forEach(s => {
    if (!s.el) return;
    const r = s.el.getBoundingClientRect();
    const cx = r.left + r.width * 0.5;
    const cy = r.top + r.height * 0.5;
    const dx = mouseX - cx, dy = mouseY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const RAD = 220;

    // spring toward rest
    s.vx += (0 - s.rx) * 0.05;
    s.vy += (0 - s.ry) * 0.05;

    // cursor repulsion
    if (dist < RAD) {
      const f = ((RAD - dist) / RAD) * 2.6;
      s.vx -= (dx / dist) * f;
      s.vy -= (dy / dist) * f;
    }

    s.vx *= 0.80;
    s.vy *= 0.80;
    s.rx += s.vx;
    s.ry += s.vy;
    s.el.style.translate = s.rx + 'px ' + s.ry + 'px';
  });
  requestAnimationFrame(physLoop);
})();

/* shape hover — lens grow */
shapeEls.forEach((el, i) => {
  if (!el) return;
  el.addEventListener('mouseenter', () => document.body.classList.add('on-shape'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('on-shape'));
  el.addEventListener('click', () => openDetail(i));
});

/* ── 3D MENU CUBE ── */
const cubeEl = document.getElementById('cube');
const FACE_SEQ = ['f', 'r', 'b', 'l', 't'];
const ROTS = { f: [0, 0], r: [0, -90], b: [0, -180], l: [0, 90], t: [-90, 0] };
let cubeRX = 0, cubeRY = 0, cubeIdx = 0;
let dragging = false, dragX0 = 0, dragY0 = 0, dragRX0 = 0, dragRY0 = 0;
let dragMoved = false;

function applyRot(rx, ry) {
  if (cubeEl) cubeEl.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
}

const cubeWrap = document.getElementById('cube-wrap');
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
  applyRot(dragRX0 - dy * 0.65, dragRY0 + dx * 0.65);
});

document.addEventListener('mouseup', e => {
  if (!dragging) return;
  dragging = false;
  if (dragMoved) return; // drag = rotate, not click
  // click on face → open panel
  const face = e.target.dataset && e.target.dataset.nav;
  if (face) { openPanel(face); return; }
  // click on wrap → cycle face
  cubeIdx = (cubeIdx + 1) % FACE_SEQ.length;
  const [rx, ry] = ROTS[FACE_SEQ[cubeIdx]];
  cubeRX = rx; cubeRY = ry;
  applyRot(rx, ry);
});

/* face hover — lens shrink */
document.querySelectorAll('.face').forEach(f => {
  f.addEventListener('mouseenter', () => document.body.classList.add('on-face'));
  f.addEventListener('mouseleave', () => document.body.classList.remove('on-face'));
});

/* ── PANELS ── */
const PANELS = {
  work:    document.getElementById('p-work'),
  about:   document.getElementById('p-about'),
  skills:  document.getElementById('p-skills'),
  blog:    document.getElementById('p-blog'),
  contact: document.getElementById('p-contact')
};
let activePanel = null;

function openPanel(id) {
  if (!PANELS[id]) return;
  closeAll();
  PANELS[id].classList.add('open');
  activePanel = id;
}
function closePanel() {
  if (activePanel && PANELS[activePanel]) PANELS[activePanel].classList.remove('open');
  activePanel = null;
}
function closeAll() { closePanel(); closeDetail(); }

document.querySelectorAll('.p-close').forEach(btn => {
  btn.addEventListener('click', closePanel);
});

/* work panel → project list → detail */
document.querySelectorAll('.p-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const pid = parseInt(btn.dataset.pid);
    closePanel();
    openDetail(pid);
  });
});

/* ── DETAIL OVERLAY (z-zoom) ── */
const detail = document.getElementById('detail');
const dBody  = document.getElementById('d-body');

function openDetail(pid) {
  const p = PROJECTS[pid];
  if (!dBody || !detail) return;
  dBody.innerHTML =
    '<div class="d-accent" style="background:' + p.color + '"></div>' +
    '<div class="d-cmd">' + p.cmd + '&nbsp;&nbsp;—&nbsp;&nbsp;' + p.status + '</div>' +
    '<div class="d-title">' + p.name + '</div>' +
    '<p class="d-desc">' + p.desc + '</p>' +
    '<div class="d-tech">' +
      p.tech.map(t => '<span class="d-badge">' + t + '</span>').join('') +
    '</div>';
  detail.classList.add('open');
}
function closeDetail() {
  if (detail) detail.classList.remove('open');
}

const dClose = document.getElementById('d-close');
if (dClose) dClose.addEventListener('click', closeDetail);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAll();
});

/* click outside panel → close */
document.addEventListener('click', e => {
  if (!activePanel) return;
  const panelEl = PANELS[activePanel];
  if (panelEl && !panelEl.contains(e.target) && !cubeWrap.contains(e.target)) closePanel();
});

/* ── WEB AUDIO — generative ambient ── */
let ac, osc1, osc2, lfoNode, gainNode, filterNode, audioReady = false;

function startAudio() {
  if (audioReady) return;
  audioReady = true;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();

    gainNode   = ac.createGain();
    filterNode = ac.createBiquadFilter();
    filterNode.type      = 'bandpass';
    filterNode.frequency.value = 280;
    filterNode.Q.value   = 6;

    osc1 = ac.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 55; // A1 drone

    osc2 = ac.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 82.4; // E2 fifth

    // LFO for gentle tremolo
    lfoNode = ac.createOscillator();
    const lfoGain = ac.createGain();
    lfoNode.frequency.value = 0.18;
    lfoGain.gain.value = 0.006;
    lfoNode.connect(lfoGain);
    lfoGain.connect(gainNode.gain);

    osc1.connect(filterNode);
    osc2.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(ac.destination);

    gainNode.gain.setValueAtTime(0, ac.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.014, ac.currentTime + 2.5);

    osc1.start(); osc2.start(); lfoNode.start();
  } catch (e) {
    audioReady = false;
  }
}

document.addEventListener('mousemove', startAudio, { once: true });
document.addEventListener('click',     startAudio, { once: true });

/* mouse → filter sweep */
document.addEventListener('mousemove', e => {
  if (!filterNode || !ac) return;
  const nx = e.clientX / innerWidth;
  const ny = e.clientY / innerHeight;
  filterNode.frequency.setTargetAtTime(160 + nx * 700, ac.currentTime, 0.14);
  gainNode.gain.setTargetAtTime(0.008 + ny * 0.014, ac.currentTime, 0.18);
}, { passive: true });

/* shape hover → brief tonal blip */
shapeEls.forEach((el, i) => {
  if (!el) return;
  el.addEventListener('mouseenter', () => {
    if (!ac) return;
    const b = ac.createOscillator();
    const bg = ac.createGain();
    bg.gain.setValueAtTime(0.05, ac.currentTime);
    bg.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.22);
    b.frequency.value = [330, 440, 554][i];
    b.type = 'sine';
    b.connect(bg); bg.connect(ac.destination);
    b.start(); b.stop(ac.currentTime + 0.22);
  });
});

/* panel open → subtle click */
function audioClick() {
  if (!ac) return;
  const b = ac.createOscillator();
  const bg = ac.createGain();
  bg.gain.setValueAtTime(0.03, ac.currentTime);
  bg.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.08);
  b.frequency.value = 880;
  b.connect(bg); bg.connect(ac.destination);
  b.start(); b.stop(ac.currentTime + 0.08);
}
document.querySelectorAll('.face, .p-item').forEach(el => {
  el.addEventListener('click', audioClick);
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
