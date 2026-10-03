/* ── CIVITAS ARTICLE — 3D figures ──
   No libraries: the pipeline is a small perspective projector on canvas 2D,
   the signal stack and performance bars are CSS 3D cuboids. */
(function () {
  'use strict';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ══════════ 1. PIPELINE SCENE ══════════ */
  const root = document.getElementById('pipe3d');
  if (root) pipeline(root);

  function pipeline(root) {
    const cv = root.querySelector('canvas');
    const ctx = cv.getContext('2d');
    const tip = root.querySelector('.p3-tip');
    const el = k => root.querySelector('[data-k="' + k + '"]');
    const ui = { acc: el('acc'), scored: el('scored'), backlog: el('backlog'), alerts: el('alerts'), note: el('note') };

    const NODES = {
      src:    { p: [-7.6, -2.2], s: [0.9, 0.9, 0.9], c: '#e5e7eb', label: 'Transactions',
                info: 'Synthetic, PaySim-derived transactions. No real bank, government or personal data at any point.' },
      ingest: { p: [-5.0, -2.2], s: [1.3, 1.1, 1.3], c: '#00e5ff', label: 'Ingest API',
                info: 'Persists the transaction and answers 202 PENDING before the model is consulted. Money movement never waits on ML.' },
      pg:     { p: [-5.0, 0.7], s: [1.1, 0.8, 1.1], c: '#38bdf8', label: 'Postgres',
                info: 'Source of truth. A UNIQUE constraint backs the Redis idempotency fast path, so a cache miss can never admit a duplicate transaction.' },
      stream: { p: [-1.9, -2.2], s: [2.4, 0.55, 1.0], c: '#ff2d55', label: 'Redis Stream',
                info: 'Consumer-group queue between ingestion and scoring. If scoring is slow or down, work waits here instead of failing payments.' },
      worker: { p: [1.2, -2.2], s: [1.1, 1.0, 1.1], c: '#a855f7', label: 'Worker',
                info: 'Consumes the stream and calls the engine through FraudModelClient, a typed Protocol with Stub, HTTP and in-process adapters.' },
      engine: { p: [4.1, -2.2], s: [1.5, 1.5, 1.5], c: '#F5C519', label: 'Risk engine',
                info: 'Built by my ML colleague: XGBoost 60%, rules 25%, Isolation Forest 10%, graph 5%. A HIGH-severity rule floors the score at 70.' },
      scores: { p: [7.1, -2.2], s: [1.2, 1.0, 1.2], c: '#22c55e', label: 'Scores',
                info: 'Append-only and version-stamped. Each signal is stored separately, so a supervisor can ask: did the model flag this, or a rule?' },
      alert:  { p: [7.1, 2.4], s: [1.0, 0.9, 1.0], c: '#f59e0b', label: 'Alert',
                info: 'Raised by backend policy when the score crosses a configurable threshold. The model\'s own "decision" field is stored, never obeyed.' },
      analyst:{ p: [4.1, 2.4], s: [1.0, 1.0, 1.0], c: '#cbd5e1', label: 'Analyst',
                info: 'Reviews the alert. Permissions are scopes, not roles, and object-level checks return 404, never 403.' },
      sup:    { p: [1.2, 2.4], s: [1.0, 1.0, 1.0], c: '#cbd5e1', label: 'Supervisor',
                info: 'Four-eyes: closing a case needs the separate alerts:close scope. No single actor confirms fraud alone.' },
      audit:  { p: [-1.9, 2.4], s: [1.6, 0.7, 1.0], c: '#94a3b8', label: 'Audit',
                info: 'End of the workflow. Because scores are append-only and version-stamped, any historical decision can be reconstructed.' },
    };
    const EDGES = [['src', 'ingest'], ['ingest', 'pg'], ['ingest', 'stream'], ['stream', 'worker'], ['worker', 'engine'],
                   ['engine', 'scores'], ['scores', 'alert'], ['alert', 'analyst'], ['analyst', 'sup'], ['sup', 'audit']];
    for (const k in NODES) { const n = NODES[k]; n.id = k; n.rgb = rgb(n.c); n.flash = 0; }

    /* ── camera ── */
    // wide screens: pipeline runs left→right; narrow (portrait) screens: turned 90° so it runs top→bottom
    const VIEWS = {
      wide:   { T: [0.2, 0.5, -0.2], yaw: -0.16, pitch: 0.74, dist: 17.5, fov: 36, sway: 0.22, cy: 0.47 },
      narrow: { T: [-0.2, 0.5, 0.1], yaw: -Math.PI / 2, pitch: 0.95, dist: 29, fov: 17, sway: 0.08, cy: 0.44 },
    };
    let V = VIEWS.wide, T = V.T, BASE_YAW = V.yaw;
    let yaw = BASE_YAW, pitch = V.pitch, dist = V.dist, F = 800, W = 0, H = 0, dpr = 1, narrow = null;
    let cy = 1, sy = 0, cp = 1, sp = 0;
    function setRot() { cy = Math.cos(yaw); sy = Math.sin(yaw); cp = Math.cos(pitch); sp = Math.sin(pitch); }
    function rot(x, y, z) {               // world direction → camera direction
      const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
      return [x1, y * cp + z1 * sp, -y * sp + z1 * cp];
    }
    function cam(x, y, z) { const r = rot(x - T[0], y - T[1], z - T[2]); r[2] += dist; return r; }
    function scr(c) { const s = F / c[2]; return [W / 2 + c[0] * s, H * V.cy - c[1] * s, s]; }

    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = cv.width = Math.round(cv.clientWidth * dpr);
      H = cv.height = Math.round(cv.clientHeight * dpr);
      const n = cv.clientWidth < 640;
      if (n !== narrow) {               // crossing the breakpoint resets the camera to that view
        narrow = n; V = n ? VIEWS.narrow : VIEWS.wide;
        T = V.T; BASE_YAW = yaw = V.yaw; pitch = V.pitch; dist = V.dist;
      }
      F = W / (2 * Math.tan(V.fov * Math.PI / 180));
    }
    new ResizeObserver(resize).observe(cv);
    resize();

    /* ── simulation state ── */
    const CAP = 61;                      // the real incident: 61 transactions, 0 scored
    let mode = 'bug', paused = false;
    let st, packets, floats, queue, spawnT, workT, spawned, pending, lastFail, lastScore;
    function reset() {
      st = { acc: 0, scored: 0, alerts: 0 };
      packets = []; floats = []; queue = [];
      spawnT = 0; workT = 0; spawned = 0; pending = 0; lastFail = -9; lastScore = -9;
    }
    reset();

    const Y = 0.35;
    function at(id) { const n = NODES[id]; return [n.p[0], Y, n.p[1]]; }
    function send(from, to, o) {
      const a = at(from), b = at(to);
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      packets.push({ a, b, t: 0, dur: len / (o.speed || 5.2), col: o.col || '#fff', size: o.size || 0.15, done: o.done || null });
    }
    function float(id, text, col) {
      const n = NODES[id];
      floats.push({ p: [n.p[0], n.s[1] + 0.55, n.p[1]], text, col, life: 1.6 });
    }

    function arriveStream(item) {
      if (!item.queued) { item.queued = true; pending++; }
      queue.push(item);
    }
    function arriveEngine(item) {
      if (mode === 'bug') {
        NODES.engine.flash = 1;
        if (sim - lastFail > 1.4) { float('engine', 'missing 4 fields', '#ff4d6a'); lastFail = sim; }
        // scoring failed silently: the message is never acked and stays pending
        send('engine', 'worker', { col: '#ff4d6a', size: 0.13, done: () =>
          send('worker', 'stream', { col: '#ff4d6a', size: 0.13, done: () => arriveStream(item) }) });
        return;
      }
      const high = Math.random() < 0.2;
      const score = high ? 72 + Math.floor(Math.random() * 26) : 4 + Math.floor(Math.random() * 50);
      st.scored++; pending--;
      if (high || sim - lastScore > 0.8) { float('engine', 'score ' + score, high ? '#f59e0b' : '#22c55e'); lastScore = sim; }
      send('engine', 'scores', { col: high ? '#f59e0b' : '#22c55e', done: () => {
        if (!high) return;
        send('scores', 'alert', { col: '#f59e0b', done: () => {
          st.alerts++; NODES.alert.flash = 1; float('alert', 'ALERT', '#f59e0b');
          send('alert', 'analyst', { col: '#f59e0b', speed: 3.6, done: () =>
            send('analyst', 'sup', { col: '#f59e0b', speed: 3.6, done: () =>
              send('sup', 'audit', { col: '#94a3b8', speed: 3.6 }) }) });
        } });
      } });
    }

    let sim = 0;
    function step(dt) {
      sim += dt;
      // ingest
      spawnT += dt;
      const spawnEvery = mode === 'bug' ? 0.3 : 0.5;
      if (spawnT >= spawnEvery && (mode !== 'bug' || spawned < CAP)) {
        spawnT = 0; spawned++;
        const item = {};
        send('src', 'ingest', { col: '#e5e7eb', done: () => {
          st.acc++; NODES.ingest.flash = 0.6;
          if (st.acc % 3 === 1) float('ingest', '202', '#00e5ff');
          send('ingest', 'src', { col: '#00e5ff', size: 0.08, speed: 7 });
          send('ingest', 'pg', { col: '#38bdf8', size: 0.08, speed: 6 });
          send('ingest', 'stream', { col: '#e5e7eb', done: () => arriveStream(item) });
        } });
      }
      // worker drains the stream
      workT += dt;
      if (workT >= (mode === 'bug' ? 0.45 : 0.22) && queue.length) {
        workT = 0;
        const item = queue.shift();
        send('stream', 'worker', { col: '#a855f7', done: () =>
          send('worker', 'engine', { col: '#a855f7', done: () => arriveEngine(item) }) });
      }
      // move packets
      for (let i = packets.length - 1; i >= 0; i--) {
        const k = packets[i];
        k.t += dt / k.dur;
        if (k.t >= 1) { packets.splice(i, 1); if (k.done) k.done(); }
      }
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i]; f.life -= dt; f.p[1] += dt * 0.55;
        if (f.life <= 0) floats.splice(i, 1);
      }
      for (const k in NODES) NODES[k].flash = Math.max(0, NODES[k].flash - dt * 2.2);
    }

    /* ── interaction ── */
    let drag = null, mouse = null, hover = null, pinned = null, lastInput = -10, now = 0;
    cv.addEventListener('pointerdown', e => {
      const r = cv.getBoundingClientRect();
      mouse = { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr, cx: e.clientX - r.left, cy: e.clientY - r.top };
      drag = { x: e.clientX, y: e.clientY, yaw, pitch, moved: false };
      cv.setPointerCapture(e.pointerId);
      lastInput = now;
    });
    cv.addEventListener('pointermove', e => {
      const r = cv.getBoundingClientRect();
      mouse = { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr, cx: e.clientX - r.left, cy: e.clientY - r.top };
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      yaw = drag.yaw + dx * 0.008;
      pitch = Math.min(1.25, Math.max(0.18, drag.pitch + dy * 0.005));
      lastInput = now;
    });
    const end = () => {
      if (drag && !drag.moved) pinned = hover && pinned !== hover ? hover : null;
      drag = null;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', () => { drag = null; });
    cv.addEventListener('pointerleave', () => { mouse = null; });

    root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      const m = b.dataset.mode;
      if (m === 'bug') { reset(); mode = 'bug'; }
      else mode = 'fixed';          // keep the backlog: watch the fix drain it
      root.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === b));
      paused = false; pauseBtn.textContent = 'Pause';
    }));
    const pauseBtn = root.querySelector('[data-act=pause]');
    pauseBtn.addEventListener('click', () => { paused = !paused; pauseBtn.textContent = paused ? 'Play' : 'Pause'; });

    /* ── drawing ── */
    const FACES = [[4, 5, 6, 7, 0, 1, 0], [0, 1, 5, 4, 0, 0, -1], [2, 3, 7, 6, 0, 0, 1], [1, 2, 6, 5, 1, 0, 0], [3, 0, 4, 7, -1, 0, 0]];
    const L = norm([-0.45, 1, -0.65]);

    function boxFaces(list, cx, cz, w, h, d, y0, col, opt) {
      const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, ya = y0, yb = y0 + h;
      const P = [[x0, ya, z0], [x1, ya, z0], [x1, ya, z1], [x0, ya, z1], [x0, yb, z0], [x1, yb, z0], [x1, yb, z1], [x0, yb, z1]];
      const C = P.map(p => cam(p[0], p[1], p[2]));
      for (const f of FACES) {
        const nc = rot(f[4], f[5], f[6]);
        const c = [0, 1, 2, 3].map(i => C[f[i]]);
        const mid = [(c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2, (c[0][2] + c[2][2]) / 2];
        if (nc[0] * mid[0] + nc[1] * mid[1] + nc[2] * mid[2] >= 0) continue;   // back face
        const shade = 0.35 + 0.65 * Math.max(0, f[4] * L[0] + f[5] * L[1] + f[6] * L[2]);
        list.push({ z: (c[0][2] + c[1][2] + c[2][2] + c[3][2]) / 4, pts: c.map(scr), col, shade, opt });
      }
      return C;
    }

    function drawFace(f) {
      const [r, g, b] = f.col, o = f.opt || {};
      const lit = o.solid ? 0.55 + 0.45 * f.shade : (o.hot ? 0.34 : 0.16) + (o.hot ? 0.3 : 0.2) * f.shade + (o.flash || 0) * 0.45;
      ctx.beginPath();
      f.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.closePath();
      ctx.fillStyle = `rgba(${r * lit | 0},${g * lit | 0},${b * lit | 0},${o.solid ? 1 : 0.94})`;
      ctx.fill();
      ctx.lineWidth = (o.hot ? 1.6 : 1) * dpr;
      ctx.strokeStyle = o.hot ? 'rgba(255,255,255,.95)' : `rgba(${r},${g},${b},${o.solid ? 0.35 : 0.5 + 0.4 * f.shade})`;
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

    function draw() {
      setRot();
      ctx.clearRect(0, 0, W, H);
      // floor grid
      for (let x = -9; x <= 9; x++) line3([x, 0, -4.6], [x, 0, 4.6], 'rgba(255,255,255,.045)', 1);
      for (let z = -4.5; z <= 4.5; z += 1) line3([-9, 0, z], [9, 0, z], 'rgba(255,255,255,.045)', 1);
      // edges, dashes flowing in the direction of travel
      for (const [a, b] of EDGES) {
        const A = NODES[a], B = NODES[b];
        line3([A.p[0], 0.02, A.p[1]], [B.p[0], 0.02, B.p[1]], 'rgba(255,255,255,.22)', 1.2, [5, 6], -sim * 22);
      }
      // solids + packets, painter-sorted
      const list = [];
      const hits = [];
      for (const k in NODES) {
        const n = NODES[k];
        const hot = n === hover || n === pinned;
        const C = boxFaces(list, n.p[0], n.p[1], n.s[0], n.s[1], n.s[2], 0, n.rgb, { hot, flash: n.flash });
        hits.push({ n, C });
      }
      // stream backlog: one cube per pending message
      const S = NODES.stream, shown = Math.min(pending, 72);
      for (let i = 0; i < shown; i++) {
        const layer = (i / 24) | 0, r = i % 24, col = r % 8, row = (r / 8) | 0;
        const x = S.p[0] - S.s[0] / 2 + 0.15 + col * 0.3, z = S.p[1] - S.s[2] / 2 + 0.2 + row * 0.3;
        boxFaces(list, x, z, 0.24, 0.24, 0.24, S.s[1] + 0.02 + layer * 0.27, mode === 'bug' ? [255, 77, 106] : [255, 160, 175], { solid: true });
      }
      for (const k of packets) {
        const t = k.t, p = [k.a[0] + (k.b[0] - k.a[0]) * t, Y + Math.sin(t * Math.PI) * 0.25, k.a[2] + (k.b[2] - k.a[2]) * t];
        const c = cam(p[0], p[1], p[2]);
        list.push({ z: c[2], pkt: true, s: scr(c), col: k.col, size: k.size });
      }
      list.sort((a, b) => b.z - a.z);
      for (const it of list) {
        if (!it.pkt) { drawFace(it); continue; }
        const r = it.size * it.s[2];
        ctx.beginPath(); ctx.arc(it.s[0], it.s[1], r * 2.4, 0, 6.283);
        ctx.fillStyle = hexA(it.col, 0.16); ctx.fill();
        ctx.beginPath(); ctx.arc(it.s[0], it.s[1], r, 0, 6.283);
        ctx.fillStyle = it.col; ctx.fill();
      }
      // labels
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const { n } of hits) {
        const s = scr(cam(n.p[0], n.s[1] + (n.id === 'stream' ? Math.min(pending, 72) / 24 * 0.27 + 0.5 : 0.32), n.p[1]));
        const fs = Math.max(9.5, Math.min(13, s[2] / dpr * 0.27)) * dpr;
        ctx.font = `700 ${fs}px "JetBrains Mono",monospace`;
        const hot = n === hover || n === pinned;
        const tw = ctx.measureText(n.label).width + 10 * dpr;
        ctx.fillStyle = 'rgba(6,6,8,.72)';
        ctx.fillRect(s[0] - tw / 2, s[1] - fs * 0.8, tw, fs * 1.6);
        ctx.fillStyle = hot ? '#fff' : `rgba(${n.rgb[0]},${n.rgb[1]},${n.rgb[2]},.95)`;
        ctx.fillText(n.label, s[0], s[1]);
      }
      for (const f of floats) {
        const s = scr(cam(f.p[0], f.p[1], f.p[2]));
        ctx.font = `700 ${11 * dpr}px "JetBrains Mono",monospace`;
        ctx.fillStyle = hexA(f.col, Math.min(1, f.life));
        ctx.fillText(f.text, s[0], s[1]);
      }
      // hover hit-test on projected bounding boxes, nearest wins
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
      if (!n) { if (tipFor) { tip.hidden = true; tipFor = null; } return; }
      if (tipFor !== n) {
        tipFor = n;
        tip.replaceChildren();
        const b = document.createElement('b');
        b.textContent = n.label; b.style.color = n.c;
        tip.append(b, document.createTextNode(n.info));
        tip.hidden = false;
      }
      let x, y;
      if (hover && mouse) { x = mouse.cx + 16; y = mouse.cy + 16; }
      else { const s = scr(cam(n.p[0], n.s[1], n.p[1])); x = s[0] / dpr + 16; y = s[1] / dpr + 10; }
      const rw = root.clientWidth, rh = root.clientHeight;
      x = Math.min(x, rw - tip.offsetWidth - 8); y = Math.min(y, rh - tip.offsetHeight - 8);
      tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
    }

    let shownState = '';
    function hud() {
      const key = [st.acc, st.scored, pending, st.alerts, mode, spawned >= CAP].join();
      if (key === shownState) return;
      shownState = key;
      ui.acc.textContent = st.acc;
      ui.scored.textContent = mode === 'bug' && st.acc ? st.scored + ' / ' + st.acc : st.scored;
      ui.scored.classList.toggle('bad', mode === 'bug' && st.acc > 0);
      ui.backlog.textContent = pending;
      ui.alerts.textContent = st.alerts;
      ui.note.classList.toggle('ok', mode !== 'bug');
      ui.note.replaceChildren();
      if (mode === 'bug') {
        ui.note.append('Every request got ', code('202'), '. The worker ran. Nothing threw. The adapter was missing ',
          code('transaction_id'), ', ', code('sender_id'), ', ', code('receiver_id'), ' and ', code('timestamp'),
          ' — so ' + (spawned >= CAP && st.acc === CAP ? '0 of 61 transactions were ever scored.' : 'nothing gets scored.'));
      } else {
        ui.note.append('Adapter fixed: the backlog drains, every transaction gets a score, and only scores over the threshold become alerts. Rates here are illustrative, not measured.');
      }
    }
    function code(t) { const c = document.createElement('code'); c.textContent = t; return c; }

    /* ── loop, only while on screen ── */
    let raf = 0, last = 0;
    function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t; now = t / 1000;
      if (!paused) step(dt);
      if (!drag && !RM && now - lastInput > 4) {
        const target = BASE_YAW + Math.sin(now * 0.18) * V.sway;
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
    if (RM) { paused = true; pauseBtn.textContent = 'Play'; }   // reduced motion: start still, user opts in
  }

  /* ══════════ 2. RISK SIGNAL STACK (CSS 3D) ══════════ */
  const stk = document.getElementById('stack3d');
  if (stk) {
    const iso = stk.querySelector('.stk-iso');
    const pair = k => [stk.querySelector('.cub[data-k="' + k + '"]'), stk.querySelector('li[data-k="' + k + '"]')];
    stk.querySelectorAll('li[data-k]').forEach(li => {
      const [c] = pair(li.dataset.k);
      li.addEventListener('mouseenter', () => { c && c.classList.add('hot'); li.classList.add('hot'); });
      li.addEventListener('mouseleave', () => { c && c.classList.remove('hot'); li.classList.remove('hot'); });
    });
    tilt(stk.querySelector('.stk-scene'), iso, 58, -40, 'translateZ(-60px)');
  }

  /* ══════════ 3. PERFORMANCE PAIRS (CSS 3D) ══════════ */
  const prf = document.querySelector('.prf');
  if (prf) {
    new IntersectionObserver((es, o) => {
      if (es[0].isIntersecting) { prf.classList.add('on'); o.disconnect(); }
    }, { threshold: 0.35 }).observe(prf);
    prf.querySelectorAll('.prf-card').forEach(c => tilt(c.querySelector('.prf-scene'), c.querySelector('.prf-iso'), 60, -35, 'translateY(85px)'));
  }

  // gentle pointer-follow tilt for the CSS 3D figures
  function tilt(area, iso, rx, rz, extra) {
    if (!area || !iso || RM) return;
    area.addEventListener('pointermove', e => {
      const r = area.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
      iso.style.transform = `rotateX(${rx - dy * 14}deg) rotateZ(${rz + dx * 22}deg) ${extra}`;
    });
    area.addEventListener('pointerleave', () => { iso.style.transform = ''; });
  }

  /* ── helpers ── */
  function rgb(h) { const v = parseInt(h.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; }
  function hexA(h, a) { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; }
  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / l); }
})();
