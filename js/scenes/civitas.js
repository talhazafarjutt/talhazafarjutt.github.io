/* Civitas — the scoring pipeline, and the 0-of-61 adapter bug */
Scene3D.mount('#scene3d', {
  aria: 'Interactive 3D model of the scoring pipeline: transactions enter the ingest API, are persisted to Postgres, queued on a Redis Stream, consumed by a worker and scored by the risk engine. Scores above the threshold raise alerts that flow to an analyst, a supervisor and the audit trail. In bug mode the dashboard stays healthy while zero transactions are scored and the stream backlog grows.',
  status: { label: 'Dashboard', value: 'Healthy', tone: 'ok' },
  stats: [
    { k: 'acc', label: 'Accepted · 202' },
    { k: 'scored', label: 'Scored',
      fmt: (v, a) => a.mode === 'bug' && a.get('acc') ? v + ' / ' + a.get('acc') : String(v),
      tone: (v, a) => a.mode === 'bug' && a.get('acc') > 0 ? 'bad' : null },
    { k: 'backlog', label: 'Backlog' },
    { k: 'alerts', label: 'Alerts' },
  ],
  nodes: {
    src:    { p: [-7.6, -2.2], s: [0.9, 0.9, 0.9], c: '#e5e7eb', label: 'Transactions', short: 'Txns',
              info: 'Synthetic, PaySim-derived transactions. No real bank, government or personal data at any point.' },
    ingest: { p: [-5.0, -2.2], s: [1.3, 1.1, 1.3], c: '#00e5ff', label: 'Ingest API',
              info: 'Persists the transaction and answers 202 PENDING before the model is consulted. Money movement never waits on ML.' },
    pg:     { p: [-5.0, 0.7], s: [1.1, 0.8, 1.1], c: '#38bdf8', label: 'Postgres',
              info: 'Source of truth. A UNIQUE constraint backs the Redis idempotency fast path, so a cache miss can never admit a duplicate transaction.' },
    stream: { p: [-1.9, -2.2], s: [2.4, 0.55, 1.0], c: '#ff2d55', label: 'Redis Stream', short: 'Stream',
              info: 'Consumer-group queue between ingestion and scoring. If scoring is slow or down, work waits here instead of failing payments.' },
    worker: { p: [1.2, -2.2], s: [1.1, 1.0, 1.1], c: '#a855f7', label: 'Worker',
              info: 'Consumes the stream and calls the engine through FraudModelClient, a typed Protocol with Stub, HTTP and in-process adapters.' },
    engine: { p: [4.1, -2.2], s: [1.5, 1.5, 1.5], c: '#F5C519', label: 'Risk engine', short: 'Engine',
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
  },
  edges: [['src', 'ingest'], ['ingest', 'pg'], ['ingest', 'stream'], ['stream', 'worker'], ['worker', 'engine'],
          ['engine', 'scores'], ['scores', 'alert'], ['alert', 'analyst'], ['analyst', 'sup'], ['sup', 'audit']],
  modes: [
    { id: 'bug', label: '↺ The 0-of-61 bug' },
    { id: 'fixed', label: '✓ Apply the fix', tone: 'ok', reset: false },   // keep the backlog: watch the fix drain it
  ],
  noteTone: a => a.mode === 'bug' ? 'bad' : 'ok',
  noteKey: a => a.state.spawned >= 61,
  note(a) {
    if (a.mode !== 'bug') return ['Adapter fixed: the backlog drains, every transaction gets a score, and only scores over the threshold become alerts. Rates here are illustrative, not measured.'];
    return ['Every request got ', ['code', '202'], '. The worker ran. Nothing threw. The adapter was missing ',
      ['code', 'transaction_id'], ', ', ['code', 'sender_id'], ', ', ['code', 'receiver_id'], ' and ', ['code', 'timestamp'],
      a.state.spawned >= 61 && a.get('acc') === 61 ? ' — so 0 of 61 transactions were ever scored.' : ' — so nothing gets scored.'];
  },
  tick(dt, a) {
    const s = a.state;
    if (!s.queue) Object.assign(s, { queue: [], spawned: 0, pending: 0, lastFail: -9, lastScore: -9 });
    const bug = a.mode === 'bug';
    const toStream = item => { if (!item.queued) { item.queued = true; s.pending++; } s.queue.push(item); };

    // ingest: the incident was exactly 61 transactions
    if (a.every('spawn', bug ? 0.3 : 0.5) && (!bug || s.spawned < 61)) {
      s.spawned++;
      const item = {};
      a.send('src', 'ingest', { done: () => {
        a.stat('acc'); a.flash('ingest', 0.6);
        if (a.get('acc') % 3 === 1) a.float('ingest', '202', '#00e5ff');
        a.send('ingest', 'src', { col: '#00e5ff', size: 0.08, speed: 7 });
        a.send('ingest', 'pg', { col: '#38bdf8', size: 0.08, speed: 6 });
        a.send('ingest', 'stream', { done: () => toStream(item) });
      } });
    }
    // worker drains the stream
    if (s.queue.length && a.every('work', bug ? 0.45 : 0.22)) {
      const item = s.queue.shift();
      a.path(['stream', 'worker', 'engine'], { col: '#a855f7' }, () => {
        if (a.mode === 'bug') {
          a.flash('engine');
          if (a.t - s.lastFail > 1.4) { a.float('engine', 'missing 4 fields', '#ff4d6a'); s.lastFail = a.t; }
          // scoring failed silently: the message is never acked and stays pending
          a.path(['engine', 'worker', 'stream'], { col: '#ff4d6a', size: 0.13 }, () => toStream(item));
          return;
        }
        const high = Math.random() < 0.2;
        const score = high ? 72 + Math.floor(Math.random() * 26) : 4 + Math.floor(Math.random() * 50);
        a.stat('scored'); s.pending--;
        if (high || a.t - s.lastScore > 0.8) { a.float('engine', 'score ' + score, high ? '#f59e0b' : '#22c55e'); s.lastScore = a.t; }
        a.send('engine', 'scores', { col: high ? '#f59e0b' : '#22c55e', done: () => {
          if (!high) return;
          a.send('scores', 'alert', { col: '#f59e0b', done: () => {
            a.stat('alerts'); a.flash('alert'); a.float('alert', 'ALERT', '#f59e0b');
            a.path(['alert', 'analyst', 'sup', 'audit'], { col: '#f59e0b', speed: 3.6 });
          } });
        } });
      });
    }
    a.set('backlog', s.pending);
    a.node('stream').lift = Math.ceil(Math.min(s.pending, 72) / 24) * 0.27;
  },
  // stream backlog: one cube per pending message, stacked on the Redis Stream
  decorate(a, box) {
    const n = a.node('stream'), shown = Math.min(a.state.pending || 0, 72);
    for (let i = 0; i < shown; i++) {
      const layer = (i / 24) | 0, r = i % 24, col = r % 8, row = (r / 8) | 0;
      box(n.p[0] - n.s[0] / 2 + 0.15 + col * 0.3, n.p[1] - n.s[2] / 2 + 0.2 + row * 0.3, 0.24, 0.24, 0.24,
          n.s[1] + 0.02 + layer * 0.27, a.mode === 'bug' ? '#ff4d6a' : '#ffa0af');
    }
  },
});
