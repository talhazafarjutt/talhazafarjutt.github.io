/* ── visits — portfolio visit log + private map dashboard (Cloudflare Worker) ──
   Bindings: DB → D1 database "portfolio".   Secret: DASH_PASSWORD (Settings → Variables and Secrets).
   Routes
     POST /            beacon from the portfolio (Origin-checked): one row per page view
     GET  /dashboard   sign-in page, or the dashboard once signed in
     POST /login       password → signed session cookie (5 failures per IP in 15 min → locked out)
     POST /logout      ends the session
     GET  /api/visits  rows for the dashboard (session required)
     GET  /dash.js     dashboard script (session required)
   Cron (daily): deletes visits older than 30 days and old login attempts.
   Visitor-supplied fields (path, referrer, src, user agent, city, org) are only ever rendered with
   textContent on the dashboard — never as HTML. */

const SITE = 'https://talhazafarjutt.github.io';
const SESSION_DAYS = 7;
const MAX_FAILS = 5, LOCK_MINUTES = 15;
const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4';
const LEAFLET_JS_SRI = 'sha512-puJW3E/qXDqYp9IfhAI54BJEaWIfloJ7JWs7OeD5i6ruC9JZL1gERT1wjtwXFlh7CjE7ZJ+/vcRZRkIYIb6p4g==';
const LEAFLET_CSS_SRI = 'sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw==';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = request.method + ' ' + url.pathname;
    try {
      await ensureSchema(env.DB);
      switch (route) {
        case 'POST /': return logVisit(request, env);
        case 'GET /dashboard': return (await signedIn(request, env)) ? page(DASHBOARD_HTML) : loginPage(env);
        case 'POST /login': return login(request, env, url);
        case 'POST /logout': return logout(request, url);
        case 'GET /api/visits':
          return (await signedIn(request, env)) ? visits(env, url) : json({ error: 'unauthorized' }, 401);
        case 'GET /dash.js':
          return (await signedIn(request, env))
            ? new Response(DASH_JS, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' } })
            : new Response('', { status: 401 });
        default: return new Response('Not found', { status: 404 });
      }
    } catch (err) {
      console.error(err);
      return new Response('Server error', { status: 500 });
    }
  },

  async scheduled(event, env) {
    await ensureSchema(env.DB);
    await env.DB.prepare("DELETE FROM visits WHERE ts < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')").run();
    await env.DB.prepare('DELETE FROM logins WHERE ts < ?').bind(Date.now() - 864e5).run();
  },
};

/* ── schema: add the map columns and the login-attempt table once per isolate ── */
let schemaReady = null;
function ensureSchema(db) {
  schemaReady ??= (async () => {
    for (const sql of ['ALTER TABLE visits ADD COLUMN lat REAL', 'ALTER TABLE visits ADD COLUMN lon REAL']) {
      try { await db.prepare(sql).run(); } catch (e) { if (!/duplicate column/i.test(String(e && e.message || e))) throw e; }
    }
    await db.prepare('CREATE TABLE IF NOT EXISTS logins (ip TEXT NOT NULL, ts INTEGER NOT NULL)').run();
  })().catch(e => { schemaReady = null; throw e; });
  return schemaReady;
}

/* ── beacon ── */
async function logVisit(request, env) {
  if (request.headers.get('Origin') !== SITE) return new Response('Not found', { status: 404 });
  let data = {};
  try { data = JSON.parse((await request.text()).slice(0, 2000)); } catch { /* keep defaults */ }
  const cf = request.cf || {};
  const cut = (v, n) => String(v || '').slice(0, n);
  const num = v => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : null);
  await env.DB.prepare(
    'INSERT INTO visits (ts, ip, country, region, city, org, lat, lon, path, referrer, src, ua) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    new Date().toISOString(),
    request.headers.get('CF-Connecting-IP'),
    cf.country || null, cf.region || null, cf.city || null, cf.asOrganization || null,
    num(cf.latitude), num(cf.longitude),
    cut(data.path, 200), cut(data.ref, 300), cut(data.src, 60),
    cut(request.headers.get('User-Agent'), 300)
  ).run();
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': SITE } });
}

/* ── auth ── */
async function login(request, env, url) {
  if (request.headers.get('Origin') !== url.origin) return new Response('Forbidden', { status: 403 });
  if (!env.DASH_PASSWORD) return loginPage(env);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const since = Date.now() - LOCK_MINUTES * 60e3;
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM logins WHERE ip = ? AND ts > ?').bind(ip, since).first();
  if (n >= MAX_FAILS) return loginPage(env, `Too many attempts. Try again in ${LOCK_MINUTES} minutes.`, 429);

  const form = await request.formData();
  if (!(await sameSecret(String(form.get('password') || ''), env.DASH_PASSWORD))) {
    await env.DB.prepare('INSERT INTO logins (ip, ts) VALUES (?, ?)').bind(ip, Date.now()).run();
    return loginPage(env, 'Wrong password.', 401);
  }
  await env.DB.prepare('DELETE FROM logins WHERE ip = ?').bind(ip).run();
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const token = exp + '.' + b64url(await crypto.subtle.sign('HMAC', await sessionKey(env), enc(String(exp))));
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/dashboard',
      'Set-Cookie': `__Host-visits=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`,
    },
  });
}

function logout(request, url) {
  if (request.headers.get('Origin') !== url.origin) return new Response('Forbidden', { status: 403 });
  return new Response(null, {
    status: 303,
    headers: { Location: '/dashboard', 'Set-Cookie': '__Host-visits=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0' },
  });
}

async function signedIn(request, env) {
  if (!env.DASH_PASSWORD) return false;
  const m = /(?:^|;\s*)__Host-visits=(\d+)\.([\w-]+)/.exec(request.headers.get('Cookie') || '');
  if (!m || Number(m[1]) < Date.now()) return false;
  try { return await crypto.subtle.verify('HMAC', await sessionKey(env), unb64url(m[2]), enc(m[1])); }
  catch { return false; }
}

// session key derives from the password: changing DASH_PASSWORD signs everyone out
async function sessionKey(env) {
  const raw = await crypto.subtle.digest('SHA-256', enc(env.DASH_PASSWORD + '|visits-session-v1'));
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

// compare fixed-length digests in constant time, so response timing reveals nothing about the password
async function sameSecret(a, b) {
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc(s))));
  const p = new Uint8Array(x), q = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < p.length; i++) diff |= p[i] ^ q[i];
  return diff === 0;
}

/* ── data ── */
async function visits(env, url) {
  const days = Math.min(30, Math.max(1, parseInt(url.searchParams.get('days'), 10) || 7));
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { results } = await env.DB.prepare(
    'SELECT ts, ip, country, region, city, org, lat, lon, path, referrer, src, ua FROM visits WHERE ts >= ? ORDER BY id DESC LIMIT 5000'
  ).bind(since).all();
  return json({ days, rows: results });
}

/* ── responses ── */
const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: https://tile.openstreetmap.org https://cdnjs.cloudflare.com; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',   // OSM tile policy: browsers must send the site origin
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
};
const page = (body, status = 200) => new Response(body, { status, headers: PAGE_HEADERS });
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

function loginPage(env, error = '', status = 200) {
  const setup = !env.DASH_PASSWORD;
  const msg = setup ? 'Set the DASH_PASSWORD secret on this Worker first (Settings → Variables and Secrets).' : error;
  return page(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Visitors · sign in</title><style>${BASE_CSS}
.box{max-width:340px;margin:18vh auto 0;padding:2rem;border:1px solid var(--line);background:var(--panel)}
h1{font-size:1.05rem;margin:0 0 .3rem}p{color:var(--dim);font-size:.82rem;margin:0 0 1.4rem}
label{display:block;font:600 .62rem var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin-bottom:.4rem}
input{width:100%;box-sizing:border-box;padding:.7rem .8rem;background:#000;border:1px solid var(--line);color:#fff;font-size:.95rem}
input:focus{outline:2px solid var(--cyan);outline-offset:1px}
button{margin-top:1rem;width:100%;padding:.75rem;background:var(--red);border:0;color:#fff;font:700 .78rem var(--mono);letter-spacing:.08em;cursor:pointer}
.err{color:#ff6b81;font-size:.8rem;margin-top:.9rem;min-height:1em}</style></head>
<body><form class="box" method="post" action="/login">
<h1>Portfolio visitors</h1><p>Private dashboard · talhazafarjutt.github.io</p>
<label for="pw">Password</label><input id="pw" name="password" type="password" autocomplete="current-password" required autofocus${setup ? ' disabled' : ''}>
<button type="submit"${setup ? ' disabled' : ''}>Sign in</button><div class="err" role="alert">${escapeHtml(msg)}</div></form></body></html>`, status);
}

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = s => new TextEncoder().encode(s);
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

const BASE_CSS = `:root{--bg:#080808;--panel:#0e0e12;--line:rgba(255,255,255,.09);--dim:rgba(255,255,255,.5);--cyan:#00e5ff;--red:#C8102E;--green:#22c55e;--mono:ui-monospace,"JetBrains Mono",SFMono-Regular,Menlo,monospace;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:#fff;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}`;

const DASHBOARD_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Portfolio visitors</title>
<link rel="stylesheet" href="${LEAFLET}/leaflet.min.css" integrity="${LEAFLET_CSS_SRI}" crossorigin="anonymous" referrerpolicy="no-referrer">
<style>${BASE_CSS}
header{display:flex;flex-wrap:wrap;gap:.8rem;align-items:center;justify-content:space-between;padding:1rem 1.4rem;border-bottom:1px solid var(--line)}
h1{font-size:1rem;margin:0}h1 span{color:var(--dim);font-weight:400}
.ctl{display:flex;gap:.7rem;align-items:center;flex-wrap:wrap;font:600 .7rem var(--mono);color:var(--dim)}
select,.ctl button{background:#000;color:#fff;border:1px solid var(--line);padding:.45rem .6rem;font:600 .72rem var(--mono);cursor:pointer}
.ctl label{display:flex;gap:.35rem;align-items:center;cursor:pointer}
main{padding:1.2rem 1.4rem 2rem;display:grid;gap:1rem}
.kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.8rem}
.kpi{background:var(--panel);border:1px solid var(--line);padding:.8rem 1rem}
.kpi b{display:block;font:700 1.5rem var(--mono);font-variant-numeric:tabular-nums}
.kpi span{font:600 .58rem var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.card{background:var(--panel);border:1px solid var(--line);min-width:0}
.card h2{margin:0;padding:.7rem 1rem;font:600 .62rem var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line);display:flex;justify-content:space-between}
#map{height:min(56vh,560px);background:#0b0d10}
#map .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.82) contrast(.92) saturate(.6)}  /* light OSM tiles → dark */
.days{display:flex;align-items:flex-end;gap:3px;height:70px;padding:.6rem 1rem}
.days div{flex:1;background:var(--cyan);opacity:.75;min-height:2px}
.grid2{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem}
table{width:100%;border-collapse:collapse;font-size:.8rem}
th{text-align:left;font:600 .58rem var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--dim);padding:.5rem 1rem;border-bottom:1px solid var(--line)}
td{padding:.45rem 1rem;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:top;overflow-wrap:anywhere}
td.n{text-align:right;font-family:var(--mono);color:var(--cyan);white-space:nowrap}
.scroll{max-height:480px;overflow:auto}
.muted{color:var(--dim)}.tag{color:var(--green);font-family:var(--mono)}
.empty{padding:1rem;color:var(--dim);font-size:.8rem}
.leaflet-popup-content-wrapper,.leaflet-popup-tip{background:#111318;color:#fff;border:1px solid var(--line)}
.leaflet-popup-content{margin:.7rem .9rem;font-size:.8rem;line-height:1.5}
.pop b{display:block;font-size:.9rem}.pop .muted{font-size:.74rem}
.leaflet-container a{color:var(--cyan)}
@media(max-width:900px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.grid2{grid-template-columns:1fr}header,main{padding-left:1rem;padding-right:1rem}}
</style></head><body>
<header><h1>Portfolio visitors <span>· talhazafarjutt.github.io</span></h1>
<div class="ctl"><label>Range <select id="range"><option value="1">24 hours</option><option value="7" selected>7 days</option><option value="30">30 days</option></select></label>
<label><input type="checkbox" id="bots" checked> Hide bots</label><span id="updated"></span>
<form method="post" action="/logout"><button type="submit">Sign out</button></form></div></header>
<main>
<section class="kpis">
<div class="kpi"><b id="k-views">–</b><span>Page views</span></div>
<div class="kpi"><b id="k-uniq">–</b><span>Unique visitors</span></div>
<div class="kpi"><b id="k-cty">–</b><span>Countries</span></div>
<div class="kpi"><b id="k-org">–</b><span>Networks / companies</span></div>
<div class="kpi"><b id="k-src">–</b><span>Tagged links opened</span></div></section>
<section class="card"><h2>Where visitors are <span id="nogeo"></span></h2><div id="map"></div></section>
<section class="card"><h2>Views per day</h2><div class="days" id="days"></div></section>
<section class="grid2">
<div class="card"><h2>Networks / companies</h2><div class="scroll" id="t-org"></div></div>
<div class="card"><h2>Countries</h2><div class="scroll" id="t-country"></div></div>
<div class="card"><h2>Pages</h2><div class="scroll" id="t-page"></div></div>
<div class="card"><h2>Came from</h2><div class="scroll" id="t-from"></div></div></section>
<section class="card"><h2>Recent visits</h2><div class="scroll" id="t-recent"></div></section>
</main>
<script src="${LEAFLET}/leaflet.min.js" integrity="${LEAFLET_JS_SRI}" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script src="/dash.js"></script></body></html>`;

/* ── dashboard client (served as /dash.js) ── */
function dashboard() {
  'use strict';
  const $ = id => document.getElementById(id);
  const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp|curl|wget|python|go-http|okhttp|monitor|uptime/i;
  const OWN = 'talhazafarjutt.github.io';
  let rows = [], fitted = false;

  const map = L.map('map', { worldCopyJump: true }).setView([25, 15], 2);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, referrerPolicy: 'strict-origin-when-cross-origin',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  const layer = L.layerGroup().addTo(map);

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const flag = cc => (cc && /^[A-Z]{2}$/i.test(cc) ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '');
  const place = r => [r.city, r.region && r.region !== r.city ? r.region : '', r.country].filter(Boolean).join(', ');
  const host = ref => { try { const h = new URL(ref).hostname; return h === OWN ? '' : h.replace(/^www\./, ''); } catch { return ''; } };
  const device = ua => {
    ua = ua || '';
    const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
    const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
    return [br, os].filter(Boolean).join(' · ') || (ua ? ua.slice(0, 40) : '—');
  };
  const ago = ts => {
    const s = (Date.now() - Date.parse(ts)) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  function table(id, head, body) {
    const box = $(id); box.replaceChildren();
    if (!body.length) { box.append(el('div', 'empty', 'Nothing yet.')); return; }
    const t = el('table'), tr = el('tr');
    head.forEach(h => tr.append(el('th', null, h)));
    t.append(tr);
    for (const cells of body) {
      const row = el('tr');
      for (const c of cells) row.append(c instanceof Node ? (() => { const td = el('td'); td.append(c); return td; })() : el('td', typeof c === 'number' ? 'n' : null, c == null || c === '' ? '—' : String(c)));
      t.append(row);
    }
    box.append(t);
  }
  function top(id, label, list, key) {
    const counts = new Map();
    for (const r of list) { const k = key(r); if (k) counts.set(k, (counts.get(k) || 0) + 1); }
    table(id, [label, 'Views'], [...counts].sort((a, b) => b[1] - a[1]).slice(0, 40));
  }

  function popup(s) {
    const box = el('div', 'pop');
    box.append(el('b', null, flag(s.country) + ' ' + (s.place || 'Unknown place')));
    box.append(el('div', null, s.n + (s.n === 1 ? ' view' : ' views') + ' · ' + s.ips.size + (s.ips.size === 1 ? ' visitor' : ' visitors')));
    const orgs = [...s.orgs].sort((a, b) => b[1] - a[1]).slice(0, 4).map(o => o[0]).join(', ');
    if (orgs) box.append(el('div', 'muted', orgs));
    if (s.tags.size) box.append(el('div', 'tag', 'tag: ' + [...s.tags].join(', ')));
    box.append(el('div', 'muted', 'last seen ' + ago(s.last)));
    return box;
  }

  function render() {
    const v = $('bots').checked ? rows.filter(r => !BOT.test(r.ua || '')) : rows;
    $('k-views').textContent = v.length;
    $('k-uniq').textContent = new Set(v.map(r => r.ip)).size;
    $('k-cty').textContent = new Set(v.map(r => r.country).filter(Boolean)).size;
    $('k-org').textContent = new Set(v.map(r => r.org).filter(Boolean)).size;
    $('k-src').textContent = v.filter(r => r.src).length;

    // map: one circle per ~10 km cell, sized by views
    layer.clearLayers();
    const spots = new Map();
    let noGeo = 0;
    for (const r of v) {
      if (r.lat == null || r.lon == null) { noGeo++; continue; }
      const k = (+r.lat).toFixed(1) + ',' + (+r.lon).toFixed(1);
      let s = spots.get(k);
      if (!s) spots.set(k, s = { lat: +r.lat, lon: +r.lon, n: 0, country: r.country, place: place(r), orgs: new Map(), ips: new Set(), tags: new Set(), last: r.ts });
      s.n++; s.ips.add(r.ip);
      if (r.org) s.orgs.set(r.org, (s.orgs.get(r.org) || 0) + 1);
      if (r.src) s.tags.add(r.src);
      if (r.ts > s.last) s.last = r.ts;
    }
    const pts = [];
    for (const s of spots.values()) {
      const tagged = s.tags.size > 0;
      L.circleMarker([s.lat, s.lon], {
        radius: 5 + Math.sqrt(s.n) * 3, weight: 1.5,
        color: tagged ? '#22c55e' : '#00e5ff', fillColor: tagged ? '#22c55e' : '#00e5ff', fillOpacity: 0.35,
      }).bindPopup(popup(s)).addTo(layer);     // popup is a DOM node: visitor data never becomes HTML
      pts.push([s.lat, s.lon]);
    }
    $('nogeo').textContent = noGeo ? noGeo + ' without coordinates (logged before the map existed)' : '';
    if (pts.length && !fitted) { map.fitBounds(pts, { padding: [40, 40], maxZoom: 5 }); fitted = true; }

    // views per day
    const days = new Map();
    for (const r of v) days.set(r.ts.slice(0, 10), (days.get(r.ts.slice(0, 10)) || 0) + 1);
    const span = +$('range').value, max = Math.max(1, ...days.values()), bars = $('days');
    bars.replaceChildren();
    for (let i = span - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), n = days.get(d) || 0;
      const b = el('div'); b.style.height = (n / max * 100) + '%'; b.title = d + ': ' + n + ' views'; bars.append(b);
    }

    top('t-org', 'Network', v, r => r.org);
    top('t-country', 'Country', v, r => (r.country ? flag(r.country) + ' ' + r.country : null));
    top('t-page', 'Page', v, r => r.path || '/');
    top('t-from', 'Source', v, r => (r.src ? 'tag: ' + r.src : host(r.referrer) || (r.referrer ? 'internal' : 'direct')));
    table('t-recent', ['When', 'Where', 'Network', 'IP', 'Page', 'Tag', 'From', 'Device'], v.slice(0, 200).map(r => [
      ago(r.ts), (flag(r.country) + ' ' + place(r)).trim(), r.org, r.ip, r.path, r.src, host(r.referrer), device(r.ua),
    ]));
  }

  async function load() {
    const res = await fetch('/api/visits?days=' + $('range').value, { credentials: 'same-origin', cache: 'no-store' });
    if (res.status === 401) { location.reload(); return; }
    if (!res.ok) { $('updated').textContent = 'Load failed (' + res.status + ')'; return; }
    rows = (await res.json()).rows || [];
    render();
    $('updated').textContent = 'updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  $('range').addEventListener('change', () => { fitted = false; load(); });
  $('bots').addEventListener('change', render);
  load();
  setInterval(load, 60000);
}
const DASH_JS = '(' + dashboard.toString() + ')();';
