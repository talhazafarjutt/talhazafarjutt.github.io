/* GPU inference — nginx → FastAPI router → 4 vLLM workers on 4× V100, and the readiness bug */
(function () {
  const W = ['w0', 'w1', 'w2', 'w3'];
  const worker = i => ({ p: [2.0, -2.7 + i * 1.8], s: [1.2, 0.8, 1.1], c: '#a855f7', label: 'llm-worker-' + i, short: 'w' + i,
    info: 'vLLM process serving an OpenAI-compatible API on its own port. After a pod restart it needs 3–4 minutes to load the model back into VRAM.' });
  const gpu = i => ({ p: [4.8, -2.7 + i * 1.8], s: [1.4, 0.4, 1.1], c: '#22c55e', label: 'V100 · 32 GB', short: 'V100',
    info: 'Tesla V100 PCIe, no NVLink: GPU-to-GPU traffic goes over the CPU\'s PCIe bus. Four 32 GB cards, 128 GB in total.' });

  Scene3D.mount('#scene3d', {
    aria: 'Interactive 3D model of the inference cluster: engineers call nginx, which checks the API key and per-key rate limit, then a FastAPI router that spreads requests across four vLLM workers, one per Tesla V100. Modes show plain round-robin failing on a worker that is still loading, the readiness-check fix, and nginx rate limiting a runaway client.',
    stats: [
      { k: 'ok', label: 'Served', tone: v => v ? 'ok' : null },
      { k: 'err', label: 'Errors', tone: v => v ? 'bad' : null },
      { k: 'lim', label: 'Rate-limited' },
    ],
    nodes: {
      server: { kind: 'frame', p: [-0.1, 0], s: [11.6, 1.4, 7.6], c: '#94a3b8', label: 'Bare-metal server · Germany · K3s', short: 'Server · K3s' },
      devs:   { p: [-8.8, -1.0], s: [1.1, 0.9, 1.1], c: '#e5e7eb', label: 'Engineers (5)', short: 'Engineers',
                info: 'The internal team: 10,000+ completions a day across five engineers.' },
      bot:    { p: [-8.8, 1.8], s: [1.1, 0.9, 1.1], c: '#ff4d6a', label: 'Runaway client', short: 'Runaway',
                info: 'One API key sending far more than its share. Only active in the rate-limit mode.' },
      nginx:  { p: [-4.8, 0], s: [1.3, 1.0, 1.3], c: '#00e5ff', label: 'nginx',
                info: 'API-key auth via auth_request and a per-key limit of 30 requests/minute with burst 10. proxy_buffering off, or streaming completions stop streaming.' },
      router: { p: [-1.5, 0], s: [1.4, 1.0, 1.4], c: '#f59e0b', label: 'FastAPI router', short: 'Router',
                info: 'Spreads requests across the four workers with a 120 s timeout, because long-context requests on V100s take a while. The fix was a readiness check before routing.' },
      w0: worker(0), w1: worker(1), w2: worker(2), w3: worker(3),
      g0: gpu(0), g1: gpu(1), g2: gpu(2), g3: gpu(3),
    },
    edges: [['devs', 'nginx'], ['bot', 'nginx'], ['nginx', 'router'],
            ...W.map(w => ['router', w]), ...W.map((w, i) => [w, 'g' + i, { solid: true, col: 'rgba(34,197,94,.35)', w: 1 }])],
    modes: [
      { id: 'rr', label: 'Plain round-robin',
        enter(a) { a.node('w2').state = 'down'; a.node('w2').badge = 'loading model · 3–4 min'; a.node('w2').badgeShort = 'loading'; a.node('bot').state = 'off'; } },
      { id: 'ready', label: '✓ Readiness check', tone: 'ok',
        enter(a) { a.node('w2').state = 'down'; a.node('w2').badge = 'loading · skipped'; a.node('w2').badgeShort = 'skipped'; a.node('bot').state = 'off'; a.state.readyAt = 7; } },
      { id: 'limit', label: 'Per-key rate limit', tone: 'info',
        enter(a) { a.state.tokens = 10; } },
    ],
    noteTone: a => a.mode === 'rr' ? 'bad' : a.mode === 'ready' ? 'ok' : '',
    noteKey: a => a.node('w2').state,
    note(a) {
      if (a.mode === 'rr') return ['After a pod restart, vLLM needs ', ['b', '3–4 minutes'], ' to load the model back into VRAM. Plain round-robin kept sending every fourth request to the worker that wasn\'t ready — and those requests failed ', ['b', 'silently'], '.'];
      if (a.mode === 'ready') return ['The fix: check readiness before routing. The loading worker is skipped until its model is in VRAM, then rejoins the rotation', a.node('w2').state ? '' : ' — it just did', '. (Load time is compressed here; in reality it took 3–4 minutes.)'];
      return ['nginx checks the API key, then applies ', ['code', 'limit_req'], ': ', ['b', '30 requests/minute per key, burst 10'], '. A runaway key gets rejected at the edge; the other engineers never notice. Rates are illustrative.'];
    },
    tick(dt, a) {
      const s = a.state;
      if (s.rr == null) s.rr = 0;
      if (a.mode === 'ready' && a.node('w2').state && a.t > s.readyAt) { a.node('w2').state = null; a.node('w2').badge = 'ready'; a.node('w2').badgeShort = 'ready'; a.float('w2', 'model loaded', '#22c55e'); }
      const ready = w => !a.node(w).state;

      const request = (from, onNginx) => a.send(from, 'nginx', { done: () => {
        if (onNginx && !onNginx()) return;
        a.send('nginx', 'router', { col: '#00e5ff', done: () => {
          let w;
          if (a.mode === 'ready') { for (let k = 0; k < 4; k++) { w = W[s.rr++ % 4]; if (ready(w)) break; } }
          else w = W[s.rr++ % 4];
          a.send('router', w, { col: '#f59e0b', done: () => {
            if (!ready(w)) {             // not loaded yet: the request fails, nobody is told why
              a.stat('err'); a.flash(w); a.float(w, 'error', '#ff4d6a');
              a.path([w, 'router', 'nginx', from], { col: '#ff4d6a', speed: 7, size: 0.1 });
              return;
            }
            a.flash(w, 0.5);
            a.path([w, 'router', 'nginx', from], { col: '#22c55e', speed: 7, size: 0.1 }, () => a.stat('ok'));
          } });
        } });
      } });

      if (a.every('devs', 0.42)) request('devs');
      if (a.mode === 'limit') {
        s.tokens = Math.min(10, s.tokens + dt * 0.5);       // refill 30/min, bucket of 10
        if (a.every('bot', 0.18)) request('bot', () => {
          if (s.tokens >= 1) { s.tokens -= 1; return true; }
          a.stat('lim'); a.flash('nginx', 0.5);
          if (a.every('limfloat', 0.7)) a.float('nginx', 'limited', '#ff4d6a');
          a.send('nginx', 'bot', { col: '#ff4d6a', speed: 7, size: 0.1 });
          return false;
        });
      }
    },
  });
})();
