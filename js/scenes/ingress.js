/* ingress-nginx → Gateway API — both edges in parallel, one hostname at a time */
(function () {
  const HOSTS = ['A', 'B', 'C', 'D'];
  const COL = { A: '#00e5ff', B: '#a855f7', C: '#f59e0b', D: '#22c55e' };
  const svc = (h, i) => ({ p: [4.4, -2.7 + i * 1.8], s: [1.2, 0.9, 1.1], c: '#cbd5e1', label: 'svc ' + h,
    info: 'The same backend Service before and after: the new HTTPRoutes point at exactly what the old Ingresses used.' });
  const step = (n, label, extra) => Object.assign({ id: 's' + n, label, reset: false, enter: a => setup(a, n) }, extra);

  Scene3D.mount('#scene3d', {
    aria: 'Interactive 3D model of the edge migration: clients resolve four hostnames through DNS to either the retired ingress-nginx edge or the new Gateway API edge, both pointing at the same backend services. Steps move one hostname at a time to the new edge, then scale the old controller to zero.',
    controls: 'steps',
    stats: [
      { k: 'old', label: 'Via ingress-nginx' },
      { k: 'neu', label: 'Via Gateway API' },
      { k: 'drop', label: 'Dropped', tone: () => 'ok' },
      { k: 'moved', label: 'Hostnames moved', fmt: v => v + ' / 4' },
    ],
    nodes: {
      users:   { p: [-8.8, 0], s: [1.1, 0.9, 1.1], c: '#e5e7eb', label: 'Clients',
                 info: 'Requests for four hostnames. Long-lived websockets stay pinned to whichever edge they connected to until they close.' },
      dns:     { p: [-5.2, 0], s: [1.2, 0.9, 1.2], c: '#94a3b8', label: 'DNS',
                 info: 'TTL dropped to 60 s a full day before the first cutover. Rollback is one record pointing back at the old IP — minutes, not hours.' },
      tester:  { p: [-5.2, 3.0], s: [1.1, 0.8, 1.1], c: '#e5e7eb', label: 'curl -H Host', short: 'curl',
                 info: 'Parity testing against the new LoadBalancer IP directly, before DNS changes: certificates, websockets, gRPC, real client IPs.' },
      old:     { p: [-0.6, -1.8], s: [1.5, 1.1, 1.5], c: '#ff6b81', label: 'ingress-nginx',
                 info: 'Retired March 2026: archived, no more patches, sitting at the public edge. Kept running the entire time as the rollback path.' },
      neu:     { p: [-0.6, 1.8], s: [1.5, 1.1, 1.5], c: '#00e5ff', label: 'Gateway API',
                 info: 'Installed alongside, with its own LoadBalancer Service and external IP. Gateways + HTTPRoutes converted with ingress2gateway, annotations by hand.' },
      ...Object.fromEntries(HOSTS.map((h, i) => ['svc' + h, svc(h, i)])),
    },
    edges: [['users', 'dns'], ['dns', 'old'], ['dns', 'neu'], ['tester', 'neu', { col: 'rgba(255,255,255,.12)' }],
            ...HOSTS.flatMap(h => [['old', 'svc' + h], ['neu', 'svc' + h]])],
    modes: [
      step(1, 'Both edges up, DNS unchanged', { reset: true }),
      step(2, 'Host A → Gateway API'),
      step(3, 'Host B → Gateway API'),
      step(4, 'Host C → Gateway API'),
      step(5, 'Host D → Gateway API'),
      step(6, 'Old edge scaled to zero'),
    ],
    noteKey: a => a.mode,
    noteTone: a => a.mode === 's6' ? 'ok' : '',
    note(a) {
      switch (a.mode) {
        case 's1': return ['New controller installed ', ['b', 'next to'], ' ingress-nginx with its own IP. Nothing about the old path changes. Test the new edge with ', ['code', 'curl -H "Host: …"'], ' against the new IP — before DNS — and check parity path by path.'];
        case 's2': return ['TTL is already 60 s. Move ', ['b', 'one low-risk hostname'], ' and watch it for a day: errors, latency percentiles, certificates, log volume. Rollback = one DNS record.'];
        case 's6': return ['Every hostname soaked ', ['b', '1–2 weeks'], ' on the new edge, then ingress-nginx was scaled to zero, left a week, and deleted — Helm release, old manifests and the old LoadBalancer IP. ', ['b', 'Zero dropped requests'], ' across the fleet.'];
        default: return ['Next hostname. There is no prize for cutting over fast — one at a time, a day of watching each, ingress-nginx still running as the rollback path.'];
      }
    },
    tick(dt, a) {
      const s = a.state;
      if (!s.moved) return;
      if (a.every('req', 0.3)) {
        const h = HOSTS[(s.k = ((s.k || 0) + 1) % 4)];
        const edge = s.moved.includes(h) ? 'neu' : 'old';
        a.path(['users', 'dns', edge, 'svc' + h], { col: COL[h] }, () => a.stat(edge === 'neu' ? 'neu' : 'old'));
      }
      if (a.mode === 's1' && a.every('test', 0.9)) a.path(['tester', 'neu', 'svc' + HOSTS[Math.floor(Math.random() * 4)]], { col: '#e5e7eb', size: 0.1 });
    },
  });

  function setup(a, n) {
    const moved = HOSTS.slice(0, Math.max(0, Math.min(4, n - 1)));
    a.state.moved = moved;
    a.set('moved', moved.length);
    a.node('old').state = n === 6 ? 'off' : null;
    a.node('old').badge = n === 6 ? 'scaled to zero' : moved.length === 4 ? 'idle · soaking' : ''; a.node('old').badgeShort = n === 6 ? 'off' : moved.length === 4 ? 'idle' : '';
    a.node('dns').badge = n >= 2 ? 'TTL 60 s' : '';
    a.node('tester').state = n === 1 ? null : 'off';
    for (const h of HOSTS) {
      a.edge('old', 'svc' + h).hidden = moved.includes(h) || n === 6;
      a.edge('neu', 'svc' + h).hidden = !moved.includes(h) && n !== 1;
      a.node('svc' + h).badge = moved.includes(h) ? 'on Gateway API' : ''; a.node('svc' + h).badgeShort = moved.includes(h) ? 'new' : '';
    }
  }
})();
