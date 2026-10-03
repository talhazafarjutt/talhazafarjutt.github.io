/* gRPC vs REST — the agent-task hot path across six services */
(function () {
  const HOT = ['gateway', 'orch', 'router', 'queue', 'orch'];     // as written: Gateway → Orchestrator → LLM Router → Task Queue → Orchestrator
  const M = {   // measured in the article: Orchestrator → LLM Router, 5,000 requests each way
    rest: { avg: 12.3, p95: 18.1, payload: 1420, e2e: 180 },
    grpc: { avg: 7.1, p95: 10.2, payload: 342, e2e: 108 },
  };
  const ms = v => v.toFixed(1) + ' ms';

  Scene3D.mount('#scene3d', {
    aria: 'Interactive 3D model of the six services: a public request enters the API gateway over REST, then an agent task hops Gateway to Orchestrator to LLM Router to Task Queue and back to the Orchestrator. In REST mode each internal hop opens a new connection and carries a 1.4 KB JSON payload; in gRPC mode the hops reuse persistent HTTP/2 channels and carry 342-byte Protobuf messages.',
    stats: [
      { k: 'avg', label: 'Orch→Router avg', fmt: v => ms(v / 10) },
      { k: 'p95', label: 'Orch→Router p95', fmt: v => ms(v / 10) },
      { k: 'payload', label: 'Payload', fmt: v => v.toLocaleString('en-US') + ' B' },
      { k: 'e2e', label: 'Agent task p95', fmt: v => v + ' ms' },
      { k: 'tcp', label: 'New TCP conns (sim)' },
    ],
    nodes: {
      client: { p: [-7.6, 0], s: [1.0, 0.9, 1.0], c: '#e5e7eb', label: 'Public client', short: 'Client',
                info: 'Browsers and partners. The public API stayed REST with OpenAPI docs throughout — browsers can\'t speak gRPC natively.' },
      gateway:{ p: [-4.4, 0], s: [1.3, 1.0, 1.3], c: '#00e5ff', label: 'API Gateway', short: 'Gateway',
                info: 'REST outside, gRPC inside. Each service got a gRPC server alongside its FastAPI REST server during the migration.' },
      orch:   { p: [-0.6, 0], s: [1.7, 1.3, 1.7], c: '#a855f7', label: 'Agent Orchestrator', short: 'Orchestrator',
                info: 'Hottest path: Orchestrator → LLM Router was migrated first, measured, then the next path followed. Two weeks, zero downtime.' },
      router: { p: [3.4, -2.4], s: [1.4, 1.1, 1.4], c: '#f59e0b', label: 'LLM Router',
                info: 'The benchmarked hop: 5,000 requests each way with identical payloads.' },
      queue:  { p: [3.4, 2.4], s: [1.4, 0.9, 1.4], c: '#22c55e', label: 'Task Queue',
                info: 'Part of the five-hop chain every agent task paid for.' },
      user:   { p: [-2.6, -3.6], s: [1.1, 0.8, 1.1], c: '#94a3b8', label: 'User Service', short: 'Users',
                info: 'One of the six FastAPI services — not on the agent-task hot path.' },
      billing:{ p: [0.6, -4.0], s: [1.1, 0.8, 1.1], c: '#94a3b8', label: 'Billing',
                info: 'One of the six FastAPI services — not on the agent-task hot path.' },
    },
    edges: [['client', 'gateway', { col: 'rgba(245,158,11,.5)' }], ['gateway', 'orch'], ['orch', 'router'], ['router', 'queue'], ['queue', 'orch'],
            ['orch', 'user', { col: 'rgba(255,255,255,.1)' }], ['orch', 'billing', { col: 'rgba(255,255,255,.1)' }]],
    modes: [
      { id: 'rest', label: 'REST · JSON · HTTP/1.1', enter: a => setMode(a, 'rest') },
      { id: 'grpc', label: '✓ gRPC · Protobuf · HTTP/2', tone: 'ok', enter: a => setMode(a, 'grpc') },
    ],
    noteTone: a => a.mode === 'grpc' ? 'ok' : 'bad',
    note(a) {
      if (a.mode === 'rest') return ['Every agent task paid for ', ['b', 'five synchronous hops'], ', each with JSON serialization and a ', ['b', 'fresh TCP connection'], ' (keep-alive wasn\'t tuned). Measured on Orchestrator → LLM Router, 5,000 requests: avg 12.3 ms, 1,420-byte payloads. No schema between services, so field renames broke consumers twice.'];
      return ['One ', ['b', 'persistent HTTP/2 channel'], ' per service pair, Protobuf on the wire, the ', ['code', '.proto'], ' as an enforced contract. Same hop, same 5,000 requests: avg 7.1 ms (', ['b', '−42%'], '), payloads 342 bytes (', ['b', '−76%'], '). The public edge stays REST.'];
    },
    tick(dt, a) {
      const rest = a.mode === 'rest';
      // gRPC: channels are opened once at startup and then reused
      if (!rest && !a.state.channels) { a.state.channels = true; a.stat('tcp', 4); }
      if (!a.every('task', 1.6)) return;
      // public hop is REST in both modes
      a.send('client', 'gateway', { col: '#f59e0b', size: 0.17, done: () => hop(1) });
      // animation speed is proportional to the measured averages (12.3 ms vs 7.1 ms)
      const speed = rest ? 3.3 : 5.7, size = rest ? 0.2 : 0.1, col = rest ? '#ff9f43' : '#00e5ff';
      function hop(i) {
        if (i >= HOT.length) return a.path(['orch', 'gateway', 'client'], { col: '#f59e0b', size: 0.17, speed: 6 });
        const from = HOT[i - 1], to = HOT[i];
        const go = () => a.send(from, to, { col, size, speed, done: () => hop(i + 1) });
        if (!rest) return go();
        // REST: a new connection per call — a handshake round trip before the payload moves
        a.stat('tcp');
        a.send(from, to, { col: '#94a3b8', size: 0.06, speed: 9, arc: 0.1, done: () =>
          a.send(to, from, { col: '#94a3b8', size: 0.06, speed: 9, arc: 0.1, done: go }) });
      }
    },
  });

  function setMode(a, m) {
    const v = M[m];
    a.set('avg', v.avg * 10); a.set('p95', v.p95 * 10); a.set('payload', v.payload); a.set('e2e', v.e2e);
    for (const [x, y] of [['gateway', 'orch'], ['orch', 'router'], ['router', 'queue'], ['queue', 'orch']]) {
      const e = a.edge(x, y); e.solid = m === 'grpc'; e.col = m === 'grpc' ? 'rgba(0,229,255,.55)' : null;
    }
  }
})();
