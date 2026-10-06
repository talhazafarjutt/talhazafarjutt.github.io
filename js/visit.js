/* ── VISIT LOG — one beacon per page view to the Cloudflare Worker ──
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
  const body = JSON.stringify({ path: location.pathname, ref: document.referrer, src: q.get('src') || '' });
  navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }));
})();
