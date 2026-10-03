/* ── SCENE3D — dependency-free 3D figures for the blog ──
   Canvas 2D plus a small perspective projector. A scene file supplies nodes,
   edges, modes and a tick(); this engine owns the camera (auto-fitted to the
   canvas), input, HUD, tooltips and the packet/label animation. */
(function () {
  'use strict';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // box faces: 4 corner indices + outward normal (bottom face is never visible)
  const FACES = [[4, 5, 6, 7, 0, 1, 0], [0, 1, 5, 4, 0, 0, -1], [2, 3, 7, 6, 0, 0, 1], [1, 2, 6, 5, 1, 0, 0], [3, 0, 4, 7, -1, 0, 0]];
  const FRAME_EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const LIGHT = norm([-0.45, 1, -0.65]);

  window.Scene3D = {
    mount(sel, cfg) {
      const root = typeof sel === 'string' ? document.querySelector(sel) : sel;
      return root ? build(root, cfg) : null;
    },
  };

  function build(root, cfg) {
    /* ── DOM: status + stats + note above, canvas in the middle, controls below ── */
    const top = h('div', 'p3-top'), hudEl = h('div', 'p3-hud'), note = h('p', 'p3-note');
    note.setAttribute('aria-live', 'polite');
    let statusEl = null;
    if (cfg.status) {
      const d = h('div', 'p3-dash');
      d.append(h('span', 'p3-dot'), document.createTextNode(cfg.status.label + ': '));
      statusEl = h('b'); d.append(statusEl); hudEl.append(d);
    }
    const dl = h('dl', 'p3-stats'), statEls = {};
    for (const s of cfg.stats || []) {
      const w = h('div'), dt = h('dt'), dd = h('dd');
      dt.textContent = s.label; dd.textContent = '0'; statEls[s.k] = dd;
      w.append(dt, dd); dl.append(w);
    }
    hudEl.append(dl); top.append(hudEl, note);
    const stage = h('div', 'p3-stage'), cv = h('canvas'), tip = h('div', 'p3-tip'), hint = h('div', 'p3-hint');
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', cfg.aria || '');
    tip.hidden = true; hint.textContent = 'Drag to orbit · hover a block';
    stage.append(cv, tip, hint);
    const ctrl = h('div', 'p3-ctrl');
    root.replaceChildren(top, stage, ctrl);
    const ctx = cv.getContext('2d');

    /* ── scene graph ── */
    const N = {}, nodes = [];
    for (const id in cfg.nodes) {
      const n = Object.assign({ id, y: 0, kind: 'box', state: null, badge: '', flash: 0, lift: 0 }, cfg.nodes[id]);
      n.rgb = rgb(n.c); N[id] = n; nodes.push(n);
    }
    const edges = (cfg.edges || []).map(([a, b, o]) => Object.assign({ a, b, col: null, solid: false, w: 1.2, hidden: false }, o));

    /* ── camera ── */
    const VIEWS = {
      wide: Object.assign({ yaw: -0.16, pitch: 0.64, dist: 32, sway: 0.16 }, cfg.camera && cfg.camera.wide),
      narrow: Object.assign({ yaw: -Math.PI / 2, pitch: 0.95, dist: 26, sway: 0.08 }, cfg.camera && cfg.camera.narrow),
    };
    let V = VIEWS.wide, narrow = null, yaw = V.yaw, pitch = V.pitch, dist = V.dist;
    let F = 800, OX = 0, OY = 0, W = 0, H = 0, dpr = 1, cy = 1, sy = 0, cp = 1, sp = 0;
    const T = centre();
    function setRot() { cy = Math.cos(yaw); sy = Math.sin(yaw); cp = Math.cos(pitch); sp = Math.sin(pitch); }
    function rot(x, y, z) { const x1 = x * cy - z * sy, z1 = x * sy + z * cy; return [x1, y * cp + z1 * sp, -y * sp + z1 * cp]; }
    function cam(x, y, z) { const r = rot(x - T[0], y - T[1], z - T[2]); r[2] += dist; return r; }
    function scr(c) { const s = F / c[2]; return [W / 2 + OX + c[0] * s, H / 2 + OY - c[1] * s, s]; }
    function corners(n, head = 0) {
      const x0 = n.p[0] - n.s[0] / 2, x1 = n.p[0] + n.s[0] / 2, z0 = n.p[1] - n.s[2] / 2, z1 = n.p[1] + n.s[2] / 2;
      const ya = n.y, yb = n.y + n.s[1] + head;
      return [[x0, ya, z0], [x1, ya, z0], [x1, ya, z1], [x0, ya, z1], [x0, yb, z0], [x1, yb, z0], [x1, yb, z1], [x0, yb, z1]];
    }
    function centre() {
      let a = [Infinity, Infinity, Infinity], b = [-Infinity, -Infinity, -Infinity];
      for (const n of nodes) for (const c of corners(n)) for (let i = 0; i < 3; i++) { a[i] = Math.min(a[i], c[i]); b[i] = Math.max(b[i], c[i]); }
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    }
    // scale + offset so the whole scene (incl. labels, across the idle sway) fills the canvas
    function fit() {
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      const keep = yaw;
      for (const k of RM ? [0] : [-1, 0, 1]) {
        yaw = V.yaw + k * V.sway; setRot();
        for (const n of nodes) for (const c of corners(n, n.kind === 'frame' ? 0.4 : 0.8)) {
          const q = cam(c[0], c[1], c[2]), u = q[0] / q[2], v = q[1] / q[2];
          u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
        }
      }
      yaw = keep; setRot();
      const px = W * (narrow ? 0.05 : 0.04), py = H * 0.06;
      F = Math.min((W - 2 * px) / (u1 - u0), (H - 2 * py) / (v1 - v0));
      OX = -F * (u0 + u1) / 2; OY = F * (v0 + v1) / 2;
    }
    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = cv.width = Math.round(cv.clientWidth * dpr);
      H = cv.height = Math.round(cv.clientHeight * dpr);
      if (!W || !H) return;
      const n = cv.clientWidth < 640;
      if (n !== narrow) { narrow = n; V = n ? VIEWS.narrow : VIEWS.wide; yaw = V.yaw; pitch = V.pitch; dist = V.dist; }
      fit();
    }
    new ResizeObserver(resize).observe(cv);
    resize();

    /* ── simulation ── */
    let mode = null, paused = false, sim = 0, packets = [], floats = [], timers = {}, stats = {};
    const api = {
      get mode() { return mode && mode.id; },
      get t() { return sim; },
      state: {},
      node: id => N[id],
      edge: (a, b) => edges.find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a)),
      stat(k, d = 1) { stats[k] = (stats[k] || 0) + d; },
      set(k, v) { stats[k] = v; },
      get: k => stats[k] || 0,
      status(text, tone) { if (statusEl) { statusEl.textContent = text; statusEl.dataset.tone = tone || ''; } },
      every(name, sec) {
        if (!(name in timers)) timers[name] = sec;          // fire on first call
        if (timers[name] < sec) return false;
        timers[name] = 0; return true;
      },
      send(from, to, o = {}) {
        const a = at(from), b = at(to);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 0.01;
        packets.push({ a, b, t: 0, dur: len / (o.speed || 5.2), col: o.col || '#e5e7eb', size: o.size || 0.15, arc: o.arc == null ? 0.25 : o.arc, done: o.done || null });
      },
      path(ids, o = {}, done) {
        const hop = i => i >= ids.length - 1 ? done && done() :
          api.send(ids[i], ids[i + 1], Object.assign({}, o, { done: () => { if (o.each) o.each(ids[i + 1]); hop(i + 1); } }));
        hop(0);
      },
      float(id, text, col) { const n = N[id]; floats.push({ p: [n.p[0], n.y + n.s[1] + 0.6 + n.lift, n.p[1]], text, col: col || '#fff', life: 1.6 }); },
      flash(id, v = 1) { N[id].flash = v; },
      reset,
    };
    function at(id) { const n = N[id]; return [n.p[0], n.y + Math.min(n.s[1] / 2, 0.55), n.p[1]]; }
    function reset() {
      packets = []; floats = []; timers = {}; stats = {}; sim = 0; api.state = {};
      for (const n of nodes) { n.state = null; n.badge = ''; n.badgeShort = null; n.flash = 0; n.lift = 0; }
      for (const e of edges) { const o = (cfg.edges.find(x => x[0] === e.a && x[1] === e.b) || [])[2] || {}; e.col = o.col || null; e.solid = !!o.solid; e.w = o.w || 1.2; e.hidden = !!o.hidden; }
    }
    function step(dt) {
      sim += dt;
      for (const k in timers) timers[k] += dt;
      if (cfg.tick) cfg.tick(dt, api);
      for (let i = packets.length - 1; i >= 0; i--) {
        const k = packets[i]; k.t += dt / k.dur;
        if (k.t >= 1) { packets.splice(i, 1); if (k.done) k.done(); }
      }
      for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.life -= dt; f.p[1] += dt * 0.55; if (f.life <= 0) floats.splice(i, 1); }
      for (const n of nodes) n.flash = Math.max(0, n.flash - dt * 2.2);
    }

    /* ── controls ── */
    const modeBtns = [];
    function setMode(m) {
      if (!mode || m.reset !== false) reset();
      mode = m;
      if (m.enter) m.enter(api);
      modeBtns.forEach(b => b.classList.toggle('on', b._m === m));
      if (stepLabel) stepLabel.textContent = (cfg.modes.indexOf(m) + 1) + ' / ' + cfg.modes.length + ' · ' + m.label;
      if (prevBtn) { prevBtn.disabled = cfg.modes.indexOf(m) === 0; nextBtn.disabled = cfg.modes.indexOf(m) === cfg.modes.length - 1; }
      shown = '';
    }
    let stepLabel = null, prevBtn = null, nextBtn = null;
    if (cfg.controls === 'steps') {
      prevBtn = btn('◀ Back', () => setMode(cfg.modes[Math.max(0, cfg.modes.indexOf(mode) - 1)]));
      nextBtn = btn('Next step ▶', () => setMode(cfg.modes[Math.min(cfg.modes.length - 1, cfg.modes.indexOf(mode) + 1)]));
      nextBtn.classList.add('on');
      stepLabel = h('span', 'p3-step');
      ctrl.append(prevBtn, nextBtn, stepLabel);
    } else {
      for (const m of cfg.modes) { const b = btn(m.label, () => setMode(m)); b._m = m; if (m.tone) b.dataset.tone = m.tone; modeBtns.push(b); ctrl.append(b); }
    }
    const pauseBtn = btn('Pause', () => { paused = !paused; pauseBtn.textContent = paused ? 'Play' : 'Pause'; });
    pauseBtn.classList.add('p3-pause');
    ctrl.append(pauseBtn);
    function btn(label, fn) { const b = h('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', fn); return b; }

    /* ── input ── */
    let drag = null, mouse = null, hover = null, pinned = null, lastInput = -10, now = 0;
    const pointer = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr, cx: e.clientX - r.left, cy: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', e => {
      mouse = pointer(e);
      drag = { x: e.clientX, y: e.clientY, yaw, pitch, moved: false };
      cv.setPointerCapture(e.pointerId); lastInput = now;
    });
    cv.addEventListener('pointermove', e => {
      mouse = pointer(e);
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      yaw = drag.yaw + dx * 0.008;
      pitch = Math.min(1.3, Math.max(0.2, drag.pitch + dy * 0.005));
      lastInput = now;
    });
    cv.addEventListener('pointerup', () => { if (drag && !drag.moved) pinned = hover && pinned !== hover ? hover : null; drag = null; });
    cv.addEventListener('pointercancel', () => { drag = null; });
    cv.addEventListener('pointerleave', () => { mouse = null; });
    cv.addEventListener('dblclick', () => { yaw = V.yaw; pitch = V.pitch; });

    /* ── drawing ── */
    function boxFaces(list, cx, cz, w, hh, d, y0, col, opt) {
      const n = { p: [cx, cz], s: [w, hh, d], y: y0 };
      const C = corners(n).map(p => cam(p[0], p[1], p[2]));
      for (const f of FACES) {
        const nc = rot(f[4], f[5], f[6]);
        const c = [C[f[0]], C[f[1]], C[f[2]], C[f[3]]];
        const mid = [(c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2, (c[0][2] + c[2][2]) / 2];
        if (nc[0] * mid[0] + nc[1] * mid[1] + nc[2] * mid[2] >= 0) continue;
        const shade = 0.35 + 0.65 * Math.max(0, f[4] * LIGHT[0] + f[5] * LIGHT[1] + f[6] * LIGHT[2]);
        list.push({ z: (c[0][2] + c[1][2] + c[2][2] + c[3][2]) / 4, pts: c.map(scr), col, shade, opt });
      }
      return C;
    }
    const addBox = (x, z, w, hh, d, y0, hex, opt) => boxes.push([x, z, w, hh, d, y0, rgb(hex), opt || { solid: true }]);
    let boxes = [];

    function drawFace(f) {
      const [r, g, b] = f.col, o = f.opt || {};
      let lit = o.solid ? 0.55 + 0.45 * f.shade : (o.hot ? 0.34 : 0.16) + (o.hot ? 0.3 : 0.2) * f.shade + (o.flash || 0) * 0.45;
      let alpha = o.solid ? 1 : 0.94;
      let fill = [r * lit, g * lit, b * lit];
      if (o.state === 'down') { const p = 0.5 + 0.5 * Math.sin(sim * 6); fill = [180 + 60 * p, 30, 50]; fill = fill.map(v => v * (0.35 + 0.35 * f.shade)); }
      if (o.state === 'off') { alpha = 0.28; fill = [60, 60, 66]; }
      ctx.beginPath();
      f.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.closePath();
      ctx.fillStyle = `rgba(${fill[0] | 0},${fill[1] | 0},${fill[2] | 0},${alpha})`;
      ctx.fill();
      ctx.lineWidth = (o.hot ? 1.6 : 1) * dpr;
      ctx.strokeStyle = o.hot ? 'rgba(255,255,255,.95)'
        : o.state === 'down' ? 'rgba(255,77,106,.95)'
        : o.state === 'off' ? 'rgba(160,160,170,.35)'
        : `rgba(${r},${g},${b},${o.solid ? 0.35 : 0.5 + 0.4 * f.shade})`;
      ctx.stroke();
    }
    function line3(a, b, style, width, dash, off) {
      const A = cam(a[0], a[1], a[2]), B = cam(b[0], b[1], b[2]);
      if (A[2] < 0.5 || B[2] < 0.5) return;
      const p = scr(A), q = scr(B);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
      ctx.strokeStyle = style; ctx.lineWidth = width * dpr;
      ctx.setLineDash(dash ? dash.map(v => v * dpr) : []); ctx.lineDashOffset = (off || 0) * dpr;
      ctx.stroke(); ctx.setLineDash([]);
    }
    function grid() {
      let a = [Infinity, Infinity], b = [-Infinity, -Infinity];
      for (const n of nodes) { a[0] = Math.min(a[0], n.p[0] - n.s[0]); b[0] = Math.max(b[0], n.p[0] + n.s[0]); a[1] = Math.min(a[1], n.p[1] - n.s[2]); b[1] = Math.max(b[1], n.p[1] + n.s[2]); }
      const x0 = Math.floor(a[0]) - 1, x1 = Math.ceil(b[0]) + 1, z0 = Math.floor(a[1]) - 1, z1 = Math.ceil(b[1]) + 1;
      for (let x = x0; x <= x1; x++) line3([x, 0, z0], [x, 0, z1], 'rgba(255,255,255,.045)', 1);
      for (let z = z0; z <= z1; z++) line3([x0, 0, z], [x1, 0, z], 'rgba(255,255,255,.045)', 1);
    }

    function draw() {
      setRot();
      ctx.clearRect(0, 0, W, H);
      grid();
      // frames (containers such as a host or a K8s node) sit behind everything
      for (const n of nodes) if (n.kind === 'frame') {
        const C = corners(n);
        for (const [i, j] of FRAME_EDGES) line3(C[i], C[j], hexA(n.c, n.state === 'off' ? 0.18 : 0.45), 1, [4, 4]);
      }
      for (const e of edges) {
        if (e.hidden) continue;
        const A = N[e.a], B = N[e.b];
        const col = e.col || 'rgba(255,255,255,.22)';
        if (e.solid) line3([A.p[0], 0.03, A.p[1]], [B.p[0], 0.03, B.p[1]], col, e.w * 1.6);
        else line3([A.p[0], 0.02, A.p[1]], [B.p[0], 0.02, B.p[1]], col, e.w, [5, 6], -sim * 22);
      }
      const list = [], hits = [];
      for (const n of nodes) {
        if (n.kind === 'frame') continue;
        const hot = n === hover || n === pinned;
        hits.push({ n, C: boxFaces(list, n.p[0], n.p[1], n.s[0], n.s[1], n.s[2], n.y, n.rgb, { hot, flash: n.flash, state: n.state }) });
      }
      boxes = [];
      if (cfg.decorate) cfg.decorate(api, addBox);
      for (const b of boxes) boxFaces(list, ...b);
      for (const k of packets) {
        const t = k.t, p = [k.a[0] + (k.b[0] - k.a[0]) * t, k.a[1] + (k.b[1] - k.a[1]) * t + Math.sin(t * Math.PI) * k.arc, k.a[2] + (k.b[2] - k.a[2]) * t];
        const c = cam(p[0], p[1], p[2]);
        list.push({ z: c[2], pkt: true, s: scr(c), col: k.col, size: k.size });
      }
      list.sort((a, b) => b.z - a.z);
      for (const it of list) {
        if (!it.pkt) { drawFace(it); continue; }
        const r = it.size * it.s[2];
        ctx.beginPath(); ctx.arc(it.s[0], it.s[1], r * 2.4, 0, 6.283); ctx.fillStyle = hexA(it.col, 0.16); ctx.fill();
        ctx.beginPath(); ctx.arc(it.s[0], it.s[1], r, 0, 6.283); ctx.fillStyle = it.col; ctx.fill();
      }
      // labels; frame captions sit on the back-left corner, clear of the blocks
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const n of nodes) {
        const frame = n.kind === 'frame';
        const anchor = frame ? [n.p[0] - n.s[0] / 2 + 0.2, n.y + n.s[1] + 0.25, n.p[1] + n.s[2] / 2] : [n.p[0], n.y + n.s[1] + 0.34 + n.lift, n.p[1]];
        const s = scr(cam(anchor[0], anchor[1], anchor[2]));
        const fs = Math.max(9.5, Math.min(13, s[2] / dpr * 0.24)) * dpr;
        const hot = n === hover || n === pinned;
        ctx.font = `700 ${fs}px "JetBrains Mono",monospace`;
        ctx.textAlign = frame ? 'left' : 'center';
        const text = narrow && n.short ? n.short : n.label;
        const tw = ctx.measureText(text).width + 10 * dpr;
        if (frame) s[0] = Math.min(s[0], W - tw - 4 * dpr);
        else s[0] = Math.max(tw / 2 + 4 * dpr, Math.min(W - tw / 2 - 4 * dpr, s[0]));
        const bx = frame ? s[0] - 5 * dpr : s[0] - tw / 2;
        ctx.fillStyle = 'rgba(6,6,8,.75)'; ctx.fillRect(bx, s[1] - fs * 0.8, tw, fs * 1.6);
        ctx.fillStyle = n.state === 'off' ? 'rgba(160,160,170,.6)' : hot ? '#fff' : hexA(n.c, 0.95);
        ctx.fillText(text, s[0], s[1]);
        const badge = narrow && n.badgeShort != null ? n.badgeShort : n.badge;
        if (badge) {
          ctx.font = `600 ${fs * 0.85}px "JetBrains Mono",monospace`;
          const bw = ctx.measureText(badge).width + 8 * dpr;
          ctx.fillStyle = 'rgba(6,6,8,.7)'; ctx.fillRect(s[0] - bw / 2, s[1] + fs * 0.75, bw, fs * 1.2);
          ctx.fillStyle = n.state === 'down' ? '#ff6b81' : 'rgba(255,255,255,.7)';
          ctx.fillText(badge, s[0], s[1] + fs * 1.35);
        }
      }
      ctx.textAlign = 'center';
      for (const f of floats) {
        const s = scr(cam(f.p[0], f.p[1], f.p[2]));
        ctx.font = `700 ${11 * dpr}px "JetBrains Mono",monospace`;
        ctx.fillStyle = hexA(f.col, Math.min(1, f.life)); ctx.fillText(f.text, s[0], s[1]);
      }
      hover = null;
      if (mouse && !drag) {
        let best = Infinity;
        for (const { n, C } of hits) {
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z = 0;
          for (const c of C) { const s = scr(c); x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]); z += c[2]; }
          if (mouse.x >= x0 && mouse.x <= x1 && mouse.y >= y0 && mouse.y <= y1 && z < best) { best = z; hover = n; }
        }
      }
      tooltip();
    }

    let tipFor = null;
    function tooltip() {
      const n = hover || pinned;
      if (!n || !n.info) { if (tipFor) { tip.hidden = true; tipFor = null; } return; }
      if (tipFor !== n) {
        tipFor = n; tip.replaceChildren();
        const b = h('b'); b.textContent = n.label; b.style.color = n.c;
        tip.append(b, document.createTextNode(n.info)); tip.hidden = false;
      }
      let x, y;
      if (hover && mouse) { x = mouse.cx + 16; y = mouse.cy + 16; }
      else { const s = scr(cam(n.p[0], n.y + n.s[1], n.p[1])); x = s[0] / dpr + 16; y = s[1] / dpr + 10; }
      x = Math.min(x, stage.clientWidth - tip.offsetWidth - 8); y = Math.min(y, stage.clientHeight - tip.offsetHeight - 8);
      tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
    }

    let shown = '';
    function hud() {
      const key = JSON.stringify(stats) + (mode && mode.id) + (cfg.noteKey ? cfg.noteKey(api) : '');
      if (key === shown) return;
      shown = key;
      for (const s of cfg.stats || []) {
        const v = stats[s.k] || 0, el = statEls[s.k];
        el.textContent = s.fmt ? s.fmt(v, api) : v.toLocaleString('en-US');
        el.dataset.tone = s.tone ? s.tone(v, api) || '' : '';
      }
      const parts = cfg.note ? cfg.note(api) : [];
      note.replaceChildren(...parts.map(p => {
        if (typeof p === 'string') return document.createTextNode(p);
        const e = h(p[0]); e.textContent = p[1]; return e;
      }));
      note.dataset.tone = (cfg.noteTone && cfg.noteTone(api)) || '';
    }

    /* ── loop: runs only while the figure is on screen ── */
    let raf = 0, last = 0;
    function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t; now = t / 1000;
      if (!paused) step(dt);
      if (!drag && !RM && now - lastInput > 4) {
        const target = V.yaw + Math.sin(now * 0.18) * V.sway;
        yaw += (target - yaw) * Math.min(1, dt * 0.6);
      }
      draw(); hud();
    }
    new IntersectionObserver(es => {
      for (const e of es) {
        if (e.isIntersecting && !raf) { last = 0; raf = requestAnimationFrame(frame); }
        else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
      }
    }).observe(root);

    if (cfg.status) api.status(cfg.status.value, cfg.status.tone);
    setMode(cfg.modes[0]);
    if (RM) { paused = true; pauseBtn.textContent = 'Play'; }   // reduced motion: start still, user opts in
    return api;
  }

  /* ── helpers ── */
  function h(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function rgb(hx) { const v = parseInt(hx.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; }
  function hexA(hx, a) { const [r, g, b] = rgb(hx); return `rgba(${r},${g},${b},${a})`; }
  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / l); }
})();
