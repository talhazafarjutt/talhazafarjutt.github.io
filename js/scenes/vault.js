/* Vault — from a shared .env and a forgotten SSH key to AppRole + per-service policies */
(function () {
  const SVC = { api: 'api-service', billing: 'billing', llm: 'llm-router' };

  Scene3D.mount('#scene3d', {
    aria: 'Interactive 3D model of secrets access. Before: every service reads one shared .env file and a former developer\'s SSH key still authenticates with no audit trail. After: Vault runs in an isolated LXD container on the German server behind nginx; CI and services log in with AppRole, read only their own paths, get denied elsewhere, and every access is written to a local audit log.',
    status: { label: 'Audit trail', value: 'none', tone: 'bad' },
    stats: [
      { k: 'reads', label: 'Secret reads' },
      { k: 'audited', label: 'Audited', tone: (v, a) => a.mode === 'before' ? 'bad' : v ? 'ok' : null },
      { k: 'denied', label: 'Denied by policy' },
      { k: 'ssh', label: 'Ex-dev SSH logins', tone: v => v ? 'bad' : null },
    ],
    nodes: {
      server: { kind: 'frame', p: [0.9, 0], s: [7.6, 1.5, 8.4], c: '#94a3b8', label: 'Bare-metal server · Germany', short: 'Server · DE' },
      lxd:    { kind: 'frame', p: [3.0, 1.15], s: [2.8, 1.3, 5.4], c: '#F5C519', label: 'LXD · vault-server', short: 'LXD' },
      ci:     { p: [-9.0, -3.0], s: [1.2, 0.9, 1.1], c: '#e5e7eb', label: 'GitHub Actions', short: 'CI',
                info: 'role_id stored as a plain variable (non-sensitive, like a username). Each run asks for a fresh secret_id, swaps it for a short-lived token, then fetches only what it needs.' },
      api:    { p: [-9.0, -1.0], s: [1.2, 0.9, 1.1], c: '#00e5ff', label: SVC.api, short: 'api',
                info: 'Policy: read/list on secret/data/api-service/*, explicit deny on billing/* and llm-router/*.' },
      billing:{ p: [-9.0, 1.0], s: [1.2, 0.9, 1.1], c: '#a855f7', label: SVC.billing,
                info: 'Before Vault it could read the LLM router\'s tokens from the shared .env. "We just assumed it wouldn\'t use them."' },
      llm:    { p: [-9.0, 3.0], s: [1.2, 0.9, 1.1], c: '#f59e0b', label: SVC.llm, short: 'llm',
                info: 'Reads its own path only once policies are in place.' },
      env:    { p: [-5.4, 3.4], s: [1.4, 0.5, 1.0], c: '#ff4d6a', label: '.env · every secret', short: '.env',
                info: 'One gitignored file with all secrets, a Notion doc with the "real" values, passwords sent over Slack DMs. Rotated when someone remembered.' },
      exdev:  { p: [-5.4, -3.4], s: [1.1, 0.8, 1.0], c: '#ff4d6a', label: 'Ex-developer key', short: 'Ex-dev key',
                info: 'Temporary SSH access for an urgent deploy that was never revoked. Still authenticating six months after he left — with no log of what it touched.' },
      ssh:    { p: [-1.4, -2.8], s: [1.1, 0.8, 1.1], c: '#94a3b8', label: 'Host SSH',
                info: 'Access to the server itself.' },
      nginx:  { p: [-1.4, 0.8], s: [1.2, 1.0, 1.2], c: '#38bdf8', label: 'nginx · TLS', short: 'nginx',
                info: 'Terminates TLS (Let\'s Encrypt). Vault\'s port 8200 is never exposed directly — nginx is the only thing that talks to it from outside the container.' },
      vault:  { p: [3.0, -0.3], s: [1.6, 1.3, 1.6], c: '#F5C519', label: 'Vault',
                info: 'AppRole auth: secret_id TTL 1 h, token TTL 30 min (max 2 h). Rotation is one Vault write; services pick it up on the next token refresh.' },
      audit:  { p: [3.0, 2.5], s: [1.5, 0.5, 1.1], c: '#22c55e', label: 'Audit log', short: 'Audit',
                info: 'vault audit enable file — every access with timestamp and service identity, kept on hardware we control. The log that matters during an incident and a GDPR Article 32 audit.' },
    },
    edges: [['ci', 'nginx'], ['api', 'nginx'], ['billing', 'nginx'], ['llm', 'nginx'], ['nginx', 'vault'], ['vault', 'audit', { solid: true, col: 'rgba(34,197,94,.4)' }],
            ['env', 'billing', { col: 'rgba(255,77,106,.35)' }], ['env', 'llm', { col: 'rgba(255,77,106,.35)' }], ['env', 'api', { col: 'rgba(255,77,106,.35)' }],
            ['exdev', 'ssh', { col: 'rgba(255,77,106,.35)' }]],
    modes: [
      { id: 'before', label: 'Before — .env + forgotten keys',
        enter(a) { for (const n of ['vault', 'audit', 'nginx']) a.node(n).state = 'off'; a.status('none', 'bad'); } },
      { id: 'after', label: '✓ Vault + AppRole', tone: 'ok',
        enter(a) {
          a.node('env').state = 'off'; a.node('exdev').state = 'off'; a.node('exdev').badge = 'revoked';
          for (const x of ['api', 'billing', 'llm']) a.edge('env', x).hidden = true;
          a.edge('exdev', 'ssh').hidden = true; a.status('every access', 'ok');
        } },
    ],
    noteTone: a => a.mode === 'after' ? 'ok' : 'bad',
    note(a) {
      if (a.mode === 'before') return ['A developer who had left ', ['b', 'six months earlier'], ' still had an SSH key that authenticated — and nobody could say what it touched. Every service read the same ', ['code', '.env'], ', so billing could see the LLM router\'s tokens. Trust without enforcement.'];
      return ['Vault in an isolated LXD container, behind nginx for TLS. CI and services log in with ', ['b', 'AppRole'], ' (secret_id 1 h, token 30 min), read only their own path, and ', ['code', 'api-service'], ' is explicitly denied billing/ and llm-router/. Every access lands in the local audit log — secret retrieval never leaves the rack.'];
    },
    tick(dt, a) {
      if (a.mode === 'before') {
        if (a.every('env', 0.7)) {
          const svc = ['api', 'billing', 'llm'][Math.floor(Math.random() * 3)];
          a.send('env', svc, { col: '#ff4d6a', done: () => { a.stat('reads'); if (a.every('allf', 1.6)) a.float(svc, 'all secrets', '#ff4d6a'); } });
        }
        if (a.every('ssh', 2.4)) a.send('exdev', 'ssh', { col: '#ff4d6a', done: () => { a.stat('ssh'); a.flash('ssh'); a.float('ssh', 'no log', '#ff4d6a'); } });
        return;
      }
      const s = a.state;
      const auditIt = () => { a.stat('audited'); a.send('vault', 'audit', { col: '#22c55e', size: 0.08, speed: 6, arc: 0.1 }); };
      const read = (svc, path, allowed) => a.path([svc, 'nginx', 'vault'], { col: a.node(svc).c }, () => {
        auditIt();
        if (!allowed) {
          a.stat('denied'); a.flash('vault'); a.float('vault', 'deny · ' + path, '#ff4d6a');
          a.path(['vault', 'nginx', svc], { col: '#ff4d6a', size: 0.1, speed: 7 });
          return;
        }
        a.stat('reads');
        a.path(['vault', 'nginx', svc], { col: '#22c55e', size: 0.1, speed: 7 });
      });
      if (a.every('svc', 0.9)) {
        const svc = ['api', 'billing', 'llm'][s.n = ((s.n || 0) + 1) % 3];
        read(svc, SVC[svc] + '/*', true);
      }
      if (a.every('cross', 3.4)) read('api', 'billing/*', false);          // the policy's explicit deny, exercised
      if (a.every('ci', 4.2)) {
        // fresh secret_id → short-lived token → fetch
        a.path(['ci', 'nginx', 'vault'], { col: '#e5e7eb' }, () => {
          auditIt(); a.float('vault', 'secret_id · 1 h', '#F5C519');
          a.path(['vault', 'nginx', 'ci'], { col: '#F5C519', size: 0.1, speed: 7 }, () =>
            a.path(['ci', 'nginx', 'vault'], { col: '#e5e7eb' }, () => {
              auditIt(); a.stat('reads'); a.float('vault', 'token · 30 min', '#F5C519');
              a.path(['vault', 'nginx', 'ci'], { col: '#22c55e', size: 0.1, speed: 7 });
            }));
        });
      }
    },
  });
})();
