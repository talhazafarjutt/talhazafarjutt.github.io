/* Stripe carding attack — and the three layers that stopped it */
(function () {
  const IPS = 9, BINS = 4;      // "8–10 rotating IPs", "most cards from the same 3–4 BIN ranges"

  Scene3D.mount('#scene3d', {
    aria: 'Interactive 3D model of the carding attack: a card-testing script calls the payment service directly while real customers come through the API gateway. Steps add Stripe Radar rules, Redis rate limiting on IP plus BIN prefix, and HMAC request signing between services.',
    controls: 'steps',
    status: { label: 'Fraud rate', value: '12%', tone: 'bad' },
    stats: [
      { k: 'att', label: 'Card tests sent' },
      { k: 'stripe', label: 'Reached Stripe', tone: (v, a) => a.mode === 'hmac' ? 'ok' : v ? 'bad' : null },
      { k: 'blocked', label: 'Blocked' },
      { k: 'ok', label: 'Customer charges OK', tone: v => v ? 'ok' : null },
    ],
    nodes: {
      attacker: { p: [-7.2, -2.4], s: [1.3, 1.0, 1.3], c: '#ff4d6a', label: 'Card-testing script', short: 'Script',
                  info: '$0.99 test charges from 8–10 rotating IPs, one user-agent, different card numbers — but mostly from the same 3–4 BIN ranges.' },
      customers:{ p: [-7.2, 2.4], s: [1.2, 0.9, 1.2], c: '#e5e7eb', label: 'Customers',
                  info: 'Real users. The goal: stop the attack without blocking any of them — and none were.' },
      gateway:  { p: [-3.6, 2.4], s: [1.3, 1.0, 1.3], c: '#00e5ff', label: 'API gateway', short: 'Gateway',
                  info: 'The intended way in. The attacker skipped it entirely.' },
      payment:  { p: [0, 0], s: [1.6, 1.2, 1.6], c: '#f59e0b', label: 'Payment service', short: 'Payment',
                  info: '/api/checkout. Before the fix it had no authentication between itself and the API: anyone with the URL could call it.' },
      redis:    { p: [0, -3.4], s: [1.2, 0.7, 1.2], c: '#ff2d55', label: 'Redis · IP + BIN', short: 'Redis',
                  info: 'Hourly counters: more than 5 attempts per IP, or more than 2 per IP + BIN prefix, returns 429.' },
      stripe:   { p: [4.4, 0], s: [1.7, 1.3, 1.7], c: '#635bff', label: 'Stripe · Radar', short: 'Stripe',
                  info: 'Radar rules evaluate at Stripe\'s edge before the charge is attempted: high-risk country + micro-amount, per-IP velocity, review new international cards.' },
    },
    edges: [['attacker', 'payment', { col: 'rgba(255,77,106,.45)' }], ['customers', 'gateway'], ['gateway', 'payment'],
            ['payment', 'redis'], ['payment', 'stripe']],
    modes: [
      { id: 'open', label: 'Before — open endpoint', enter(a) { a.node('redis').state = 'off'; a.status('12%', 'bad'); } },
      { id: 'radar', label: 'Layer 1 — Radar rules', enter(a) { a.node('redis').state = 'off'; a.status('falling', 'bad'); } },
      { id: 'bin', label: 'Layer 2 — IP + BIN limit', enter(a) { a.status('falling', 'bad'); } },
      { id: 'hmac', label: 'Layer 3 — HMAC signing', enter(a) { a.status('0.02%', 'ok'); } },
    ],
    noteTone: a => a.mode === 'hmac' ? 'ok' : a.mode === 'open' ? 'bad' : '',
    note(a) {
      switch (a.mode) {
        case 'open': return [['b', '400+ failed charges in two hours'], ', all $0.99. The script called the payment service ', ['b', 'directly'], ' — there was no authentication between it and the API — so every card test reached Stripe. Fraud rate: 12%, heading for an account-suspension warning.'];
        case 'radar': return ['Layer 1: three Radar rules at Stripe\'s edge killed ', ['b', 'about 60%'], ' of the attack volume. But IP rotation means a per-IP rule only slows the attacker down.'];
        case 'bin': return ['Layer 2: Redis counters on ', ['b', 'IP + BIN prefix'], ' — more than 5 per IP or 2 per IP+BIN in an hour returns ', ['code', '429'], '. Attackers rotate IPs; they can\'t rotate away from a stolen dump\'s BIN.'];
        default: return ['Layer 3: ', ['b', 'HMAC-SHA256'], ' signing. The payment service only accepts requests signed by our backend, verified with ', ['code', 'hmac.compare_digest'], '; direct calls get ', ['code', '401'], '. End state: 12% → 0.02%, no legitimate customer blocked, under 4 hours start to finish.'];
      }
    },
    tick(dt, a) {
      const s = a.state;
      if (!s.ip) Object.assign(s, { ip: {}, bin: {}, n: 0 });
      const decline = () => { a.stat('stripe'); a.flash('stripe', 0.6); if (a.every('dec', 0.9)) a.float('stripe', 'declined', '#ff4d6a'); };
      const block = (id, text) => { a.stat('blocked'); a.flash(id, 0.6); if (a.every('blk' + id, 0.8)) a.float(id, text, '#ff4d6a'); };

      if (a.every('attack', 0.28)) {
        a.stat('att');
        const ip = s.n % IPS, bin = Math.floor(Math.random() * BINS); s.n++;
        a.send('attacker', 'payment', { col: '#ff4d6a', done: () => {
          if (a.mode === 'hmac') { block('payment', '401 · no signature'); a.send('payment', 'attacker', { col: '#ff4d6a', size: 0.1, speed: 7 }); return; }
          const toStripe = () => a.send('payment', 'stripe', { col: '#ff4d6a', done: () => {
            if (a.mode !== 'open' && Math.random() < 0.6) { block('stripe', 'Radar block'); return; }
            decline();
          } });
          if (a.mode === 'open' || a.mode === 'radar') return toStripe();
          a.send('payment', 'redis', { col: '#ff2d55', size: 0.1, speed: 7, done: () => {
            s.ip[ip] = (s.ip[ip] || 0) + 1;
            const k = ip + ':' + bin; s.bin[k] = (s.bin[k] || 0) + 1;
            const limited = s.ip[ip] > 5 || s.bin[k] > 2;
            a.send('redis', 'payment', { col: limited ? '#ff4d6a' : '#ff2d55', size: 0.1, speed: 7, done: () => limited ? block('payment', '429') : toStripe() });
          } });
        } });
      }
      if (a.every('cust', 1.1)) {
        a.path(['customers', 'gateway', 'payment'], { col: '#e5e7eb' }, () => {
          const charge = () => a.send('payment', 'stripe', { col: '#22c55e', done: () => {
            a.stat('ok'); a.send('stripe', 'payment', { col: '#22c55e', size: 0.1, speed: 7 });
          } });
          if (a.mode === 'bin' || a.mode === 'hmac') a.path(['payment', 'redis', 'payment'], { col: '#ff2d55', size: 0.1, speed: 7 }, charge);
          else charge();
        });
      }
    },
  });
})();
