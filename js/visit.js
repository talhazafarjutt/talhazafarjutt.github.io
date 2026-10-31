/* ── VISIT LOG — beacons to the Cloudflare Worker ──
   One beacon per page view, plus small event beacons for: clicks that mean "I might hire you"
   (book-a-call links, the Calendly button, a completed Calendly booking, resume, email, phone,
   LinkedIn, GitHub) and active reading time + scroll depth when the tab is hidden.
   Person / bot / agent: the visit carries automation flags (navigator.webdriver, HeadlessChrome,
   no languages) and the reading report carries which kinds of real input happened — no content of
   that input, only yes/no per kind.
   The Worker adds IP, country, city and network on its side; rows are kept 30 days.
   No cookies. Skipped for visitors who send Global Privacy Control or Do Not Track.
   Owner opt-out: open any page once with ?notrack to stop logging this browser (?track undoes it). */
(function () {
  'use strict';
  const ENDPOINT = 'https://visits.talha-zafar-j.workers.dev';
  const q = new URLSearchParams(location.search);
  try {
    if (q.has('notrack')) localStorage.setItem('notrack', '1');
    if (q.has('track')) localStorage.removeItem('notrack');
    if (localStorage.getItem('notrack') === '1') return;
  } catch (_) { /* storage blocked: log the visit as usual */ }
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;
  if (!navigator.sendBeacon || location.protocol !== 'https:') return;

  // random id for this page view only: ties its clicks and reading time to the visit; never stored
  const pv = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36)).replace(/[^a-z0-9]/gi, '').slice(0, 32);
  const path = location.pathname;
  const send = (route, data) => navigator.sendBeacon(ENDPOINT + route, new Blob([JSON.stringify(data)], { type: 'text/plain' }));

  const auto = [];
  if (navigator.webdriver) auto.push('webdriver');
  if (/HeadlessChrome/.test(navigator.userAgent)) auto.push('headless');
  if (!navigator.languages || !navigator.languages.length) auto.push('no-languages');
  send('/', { pv, path, ref: document.referrer, src: q.get('src') || '', utm: q.get('utm_source') || '', auto: auto.join(',') });

  /* ── lead actions ── */
  const text = el => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  function action(el) {
    if (el.id === 'calBtn' || el.hasAttribute('data-calendly')) return ['calendly_open', text(el)];
    if (el.dataset.topic) return ['cta', text(el)];
    const href = el.getAttribute('href') || '';
    if (/^mailto:/i.test(href)) return ['email', href.slice(7)];
    if (/^tel:/i.test(href)) return ['phone', href.slice(4)];
    if (/\.pdf(?:$|[?#])/i.test(href)) return ['resume', href.split('/').pop()];
    if (/#contact$/.test(href)) return ['cta', text(el)];
    let host = '';
    try { host = new URL(el.href, location.href).hostname; } catch (_) { return null; }
    if (/(^|\.)calendly\.com$/.test(host)) return ['calendly_open', text(el)];
    if (/(^|\.)linkedin\.com$/.test(host)) return ['linkedin', text(el)];
    if (/(^|\.)github\.com$/.test(host)) return ['github', text(el)];
    return null;
  }
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('a[href], #calBtn, [data-calendly], [data-topic]');
    const hit = el && action(el);
    if (hit) send('/e', { pv, path, type: hit[0], label: hit[1] });
  }, { capture: true, passive: true });

  // the Calendly popup reports a finished booking to this window
  window.addEventListener('message', e => {
    if (e.origin === 'https://calendly.com' && e.data && e.data.event === 'calendly.event_scheduled')
      send('/e', { pv, path, type: 'booked', label: '30-minute call' });
  });

  /* ── reading: active seconds (tab visible, visitor moved in the last minute) and deepest scroll ── */
  let active = 0, depth = 0, lastInput = Date.now(), sentSecs = 0;
  const measure = () => {
    const h = document.documentElement.scrollHeight;
    const d = h > 0 ? Math.round(Math.min(1, (scrollY + innerHeight) / h) * 100) : 100;
    if (d > depth) depth = d;
  };
  ['scroll', 'mousemove', 'keydown', 'touchstart', 'click'].forEach(t =>
    addEventListener(t, e => { if (!e.isTrusted) return; lastInput = Date.now(); if (t === 'scroll') measure(); }, { passive: true }));
  measure();
  setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastInput < 60000) active += 5;
  }, 5000);

  // evidence of a person (bitmask): 1 pointer moved across 8+ spots, 2 touch, 4 wheel, 8 typing.
  // Only trusted (browser-generated) events count; scripts dispatching fake events are ignored.
  let human = 0, spots = 0, lastSpot = '';
  addEventListener('mousemove', e => {
    if (!e.isTrusted || human & 1) return;
    const spot = (e.clientX >> 5) + ',' + (e.clientY >> 5);   // 32px cells: jitter in place doesn't count
    if (spot !== lastSpot) { lastSpot = spot; if (++spots >= 8) human |= 1; }
  }, { passive: true });
  addEventListener('touchstart', e => { if (e.isTrusted) human |= 2; }, { passive: true });
  addEventListener('wheel', e => { if (e.isTrusted) human |= 4; }, { passive: true });
  addEventListener('keydown', e => { if (e.isTrusted) human |= 8; }, { passive: true });

  let sentHuman = 0;
  function flush() {
    if ((active < 5 && !human) || (active === sentSecs && human === sentHuman)) return;   // nothing new
    sentSecs = active; sentHuman = human;
    send('/e', { pv, path, type: 'engage', secs: active, depth, h: human });
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('pagehide', flush);
})();
