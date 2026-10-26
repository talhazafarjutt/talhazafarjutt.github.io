/* ── visits — portfolio visit log + private map dashboard (Cloudflare Worker) ──
   Bindings: DB → D1 database "portfolio".   Secret: DASH_PASSWORD (Settings → Variables and Secrets).
   Routes
     POST /            beacon from the portfolio (Origin-checked): one row per page view
     POST /e           event beacon (Origin-checked): lead clicks, Calendly bookings, reading time
     POST /contact     contact form (Origin-checked, JSON or form-encoded): validated, rate-limited, stored in messages
     GET  /dashboard   sign-in page, or the dashboard once signed in
     POST /login       password → signed session cookie (5 failures per IP in 15 min → locked out)
     POST /logout      ends the session
     GET  /api/visits  visit rows + event rows + messages for the dashboard (session required)
     GET  /dash.js     dashboard script (session required)
   Cron (daily): deletes visits and events older than 30 days, messages older than 180 days, old login attempts.
   Visitor-supplied fields (path, referrer, src, utm, event label, message fields, user agent, city, org) are only ever rendered with
   textContent on the dashboard — never as HTML. */

const SITE = 'https://talhazafarjutt.github.io';
const SESSION_DAYS = 7;
const MAX_FAILS = 5, LOCK_MINUTES = 15;
const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4';
const LEAFLET_JS_SRI = 'sha512-puJW3E/qXDqYp9IfhAI54BJEaWIfloJ7JWs7OeD5i6ruC9JZL1gERT1wjtwXFlh7CjE7ZJ+/vcRZRkIYIb6p4g==';
const LEAFLET_CSS_SRI = 'sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw==';
// what the site may report besides page views; anything else is dropped
const EVENT_TYPES = new Set(['cta', 'calendly_open', 'booked', 'resume', 'email', 'phone', 'linkedin', 'github', 'engage']);
const MESSAGE_DAYS = 180, MESSAGES_PER_IP_HOUR = 5;
const EMAIL_RE = /^[^\s@<>"'(),;:\\]+@[^\s@<>"'(),;:\\]+\.[^\s@<>"'(),;:\\]{2,}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = request.method + ' ' + url.pathname;
    try {
      await ensureSchema(env.DB);
      switch (route) {
        case 'POST /': return logVisit(request, env);
        case 'POST /e': return logEvent(request, env);
        case 'POST /contact': return saveMessage(request, env);
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
    await env.DB.prepare("DELETE FROM events WHERE ts < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')").run();
    await env.DB.prepare(`DELETE FROM messages WHERE ts < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-${MESSAGE_DAYS} days')`).run();
    await env.DB.prepare('DELETE FROM logins WHERE ts < ?').bind(Date.now() - 864e5).run();
  },
};

/* ── schema: add later columns and tables once per isolate ── */
let schemaReady = null;
function ensureSchema(db) {
  schemaReady ??= (async () => {
    // lat/lon: map · pv: page-view id that ties a visit to its events · utm: utm_source (ChatGPT adds utm_source=chatgpt.com)
    for (const sql of ['ALTER TABLE visits ADD COLUMN lat REAL', 'ALTER TABLE visits ADD COLUMN lon REAL',
                       'ALTER TABLE visits ADD COLUMN pv TEXT', 'ALTER TABLE visits ADD COLUMN utm TEXT']) {
      try { await db.prepare(sql).run(); } catch (e) { if (!/duplicate column/i.test(String(e && e.message || e))) throw e; }
    }
    await db.prepare('CREATE TABLE IF NOT EXISTS logins (ip TEXT NOT NULL, ts INTEGER NOT NULL)').run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, pv TEXT,
      ip TEXT, country TEXT, city TEXT, org TEXT, path TEXT, type TEXT NOT NULL, label TEXT, secs INTEGER, depth INTEGER)`).run();
    await db.prepare('CREATE INDEX IF NOT EXISTS events_ts ON events (ts)').run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, ip TEXT,
      country TEXT, city TEXT, org TEXT, page TEXT, name TEXT NOT NULL, email TEXT NOT NULL, company TEXT, message TEXT NOT NULL)`).run();
    await db.prepare('CREATE INDEX IF NOT EXISTS messages_ip_ts ON messages (ip, ts)').run();
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
    'INSERT INTO visits (ts, ip, country, region, city, org, lat, lon, path, referrer, src, ua, pv, utm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    new Date().toISOString(),
    request.headers.get('CF-Connecting-IP'),
    cf.country || null, cf.region || null, cf.city || null, cf.asOrganization || null,
    num(cf.latitude), num(cf.longitude),
    cut(data.path, 200), cut(data.ref, 300), cut(data.src, 60),
    cut(request.headers.get('User-Agent'), 300),
    pvId(data.pv), cut(data.utm, 60) || null
  ).run();
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': SITE } });
}

const pvId = v => String(v || '').replace(/[^a-z0-9]/gi, '').slice(0, 32) || null;

/* ── event beacon: lead clicks, Calendly bookings, reading time ── */
async function logEvent(request, env) {
  if (request.headers.get('Origin') !== SITE) return new Response('Not found', { status: 404 });
  const done = new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': SITE } });
  let d = {};
  try { d = JSON.parse((await request.text()).slice(0, 1000)); } catch { return done; }
  if (!EVENT_TYPES.has(d.type)) return done;
  const cf = request.cf || {};
  const cut = (v, n) => String(v || '').slice(0, n);
  const clamp = (v, lo, hi) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };
  const engage = d.type === 'engage';
  await env.DB.prepare(
    'INSERT INTO events (ts, pv, ip, country, city, org, path, type, label, secs, depth) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    new Date().toISOString(), pvId(d.pv), request.headers.get('CF-Connecting-IP'),
    cf.country || null, cf.city || null, cf.asOrganization || null,
    cut(d.path, 200), d.type, engage ? null : cut(d.label, 80) || null,
    engage ? clamp(d.secs, 0, 7200) : null, engage ? clamp(d.depth, 0, 100) : null
  ).run();
  return done;
}

/* ── contact form ── JSON from contact.js, or a plain form post when JavaScript is off ── */
async function saveMessage(request, env) {
  if (request.headers.get('Origin') !== SITE) return new Response('Not found', { status: 404 });
  const isForm = /application\/x-www-form-urlencoded/i.test(request.headers.get('Content-Type') || '');
  const raw = (await request.text()).slice(0, 8000);
  let d = {};
  try { d = isForm ? Object.fromEntries(new URLSearchParams(raw)) : JSON.parse(raw); } catch { d = {}; }
  const reply = (status, error) => isForm
    ? new Response(formReplyPage(status === 200 ? '' : error), { status, headers: PAGE_HEADERS })
    : json(error ? { error } : { ok: true }, status, { 'Access-Control-Allow-Origin': SITE });
  const clean = (v, n) => String(v || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);
  const name = clean(d.name, 80), email = clean(d.email, 120), company = clean(d.company, 100);
  const message = clean(d.message, 2000), page = clean(d.page, 200);
  // spam traps: the hidden "website" field is left empty by people; bots that fill it get a quiet "ok"
  if (clean(d.website, 200)) return reply(200);
  if (!isForm && Number(d.t) < 2500) return reply(200);          // filled in faster than a person can type
  if (!name) return reply(400, 'Please add your name.');
  if (!EMAIL_RE.test(email)) return reply(400, 'Please check your email address.');
  if (message.length < 10) return reply(400, 'Please add a sentence about what you need.');
  const ip = request.headers.get('CF-Connecting-IP');
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM messages WHERE ip = ? AND ts > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')").bind(ip).first();
  if (recent && recent.n >= MESSAGES_PER_IP_HOUR) return reply(429, 'Too many messages from this connection. Please email talha.zafar.j@gmail.com instead.');
  const cf = request.cf || {};
  await env.DB.prepare('INSERT INTO messages (ts, ip, country, city, org, page, name, email, company, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(new Date().toISOString(), ip, cf.country || null, cf.city || null, cf.asOrganization || null, page || null, name, email, company || null, message).run();
  return reply(200);
}
function formReplyPage(error) {
  const title = error ? 'Message not sent' : 'Message received';
  const body = error ? escapeHtml(error) : 'Thanks — I reply within 24 hours.';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FFF4D6;color:#161E4D;font:16px/1.6 system-ui,sans-serif}main{max-width:520px;padding:2rem}h1{color:#263BAA}a{color:#263BAA;font-weight:700}</style></head>
<body><main><h1>${title}</h1><p>${body}</p><p><a href="${SITE}/#contact">← Back to the site</a></p></main></body></html>`;
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
  const [visitRows, eventRows, messageRows] = await env.DB.batch([
    env.DB.prepare('SELECT ts, ip, country, region, city, org, lat, lon, path, referrer, src, ua, pv, utm FROM visits WHERE ts >= ? ORDER BY id DESC LIMIT 5000').bind(since),
    env.DB.prepare('SELECT ts, pv, ip, country, city, org, path, type, label, secs, depth FROM events WHERE ts >= ? ORDER BY id DESC LIMIT 10000').bind(since),
    // messages are leads: always all of them (kept 180 days), whatever the range
    env.DB.prepare('SELECT ts, ip, country, city, org, page, name, email, company, message FROM messages ORDER BY id DESC LIMIT 1000'),
  ]);
  return json({ days, rows: visitRows.results, events: eventRows.results, messages: messageRows.results });
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
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
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
.ctl button:hover:not(:disabled){border-color:var(--cyan)}.ctl button:disabled{opacity:.55;cursor:progress}
.ctl button.primary{border-color:var(--cyan);color:var(--cyan);padding:.45rem .9rem}
.scroll.paged{max-height:none}
.pager{display:flex;gap:.5rem;align-items:center;justify-content:flex-end;flex-wrap:wrap;padding:.55rem 1rem;border-top:1px solid var(--line);font:600 .7rem var(--mono);color:var(--dim)}
.pager button,.pager select{background:#000;color:#fff;border:1px solid var(--line);padding:.35rem .6rem;font:600 .7rem var(--mono);cursor:pointer}
.pager button:disabled{opacity:.35;cursor:default}
tr.go{cursor:pointer}tr.go:hover td,tr.go:focus td{background:rgba(0,229,255,.07)}tr.go:focus{outline:none}
#q{background:#000;color:#fff;border:1px solid var(--line);padding:.4rem .6rem;font:400 .75rem var(--mono);letter-spacing:0;text-transform:none;min-width:min(340px,100%)}
.card h2 label{display:inline-flex;gap:.3rem;align-items:center;cursor:pointer}
#map.light .leaflet-tile-pane{filter:none}
.pop button{margin-top:.55rem;background:var(--cyan);color:#000;border:0;padding:.35rem .65rem;font:700 .7rem var(--mono);cursor:pointer}
.ctl label{display:flex;gap:.35rem;align-items:center;cursor:pointer}
main{padding:1.2rem 1.4rem 2rem;display:grid;gap:1rem}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.8rem}
.kpi{background:var(--panel);border:1px solid var(--line);padding:.8rem 1rem}
.kpi b{display:block;font:700 1.5rem var(--mono);font-variant-numeric:tabular-nums}
.kpi span{font:600 .58rem var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.card{background:var(--panel);border:1px solid var(--line);min-width:0}
.card h2{margin:0;padding:.7rem 1rem;font:600 .62rem var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.card h2 span{letter-spacing:.04em;text-transform:none;font-weight:400}
.lead-booked{color:var(--green);font-weight:700}
.msg-text{white-space:pre-wrap;max-width:46ch;display:block}
td a{color:var(--cyan)}
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
<div class="ctl"><label>Range <select id="range"><option value="1">24 hours</option><option value="7">7 days</option><option value="30" selected>30 days (everything kept)</option></select></label>
<label><input type="checkbox" id="bots" checked> Hide bots</label>
<label title="Google, AWS, Azure, OVH, Hetzner, GTT and other hosting networks: mostly crawlers. May also hide a few VPN users."><input type="checkbox" id="cloud" checked> <span id="cloud-l">Hide cloud networks</span></label><span id="updated"></span>
<button type="button" id="refresh" class="primary" title="Fetch the latest visits from the database">↻ Refresh</button>
<form method="post" action="/logout"><button type="submit">Sign out</button></form></div></header>
<main>
<section class="kpis">
<div class="kpi"><b id="k-views">–</b><span>Page views</span></div>
<div class="kpi"><b id="k-uniq">–</b><span>Unique visitors</span></div>
<div class="kpi"><b id="k-cty">–</b><span>Countries</span></div>
<div class="kpi"><b id="k-org">–</b><span>Networks / companies</span></div>
<div class="kpi"><b id="k-src">–</b><span>Tagged links opened</span></div>
<div class="kpi"><b id="k-msg">–</b><span>Messages</span></div>
<div class="kpi"><b id="k-lead">–</b><span>Lead actions</span></div>
<div class="kpi"><b id="k-book">–</b><span>Calls booked</span></div>
<div class="kpi"><b id="k-ai">–</b><span>From AI assistants</span></div>
<div class="kpi"><b id="k-read">–</b><span>Avg. reading time</span></div></section>
<section class="card"><h2>Messages <span>from the contact form · kept 180 days · all shown, whatever the range</span></h2><div class="scroll paged" id="t-msgs"></div><div class="pager" id="p-msgs"></div></section>
<section class="card"><h2>Where visitors are <span><span id="nogeo"></span> click a row in the tables to zoom to that visitor · <label><input type="checkbox" id="dark" checked> Dark map</label></span></h2><div id="map"></div></section>
<section class="card"><h2>Views per day</h2><div class="days" id="days"></div></section>
<section class="card"><h2>Lead actions <span>booking clicks, bookings, resume, email, phone, LinkedIn, GitHub</span></h2><div class="scroll paged" id="t-leads"></div><div class="pager" id="p-leads"></div></section>
<section class="card"><h2>Companies &amp; organisations <span>networks that are not home/mobile ISPs, clouds or VPNs — research these, don't mention the visit</span></h2><div class="scroll paged" id="t-cos"></div><div class="pager" id="p-cos"></div></section>
<section class="grid2">
<div class="card"><h2>Networks / companies</h2><div class="scroll" id="t-org"></div></div>
<div class="card"><h2>Countries</h2><div class="scroll" id="t-country"></div></div>
<div class="card"><h2>Pages</h2><div class="scroll" id="t-page"></div></div>
<div class="card"><h2>Came from</h2><div class="scroll" id="t-from"></div></div></section>
<section class="card"><h2>Reading per page <span>active time = tab visible and the visitor moved in the last minute</span></h2><div class="scroll" id="t-read"></div></section>
<section class="card"><h2>All visits <input id="q" type="search" placeholder="Filter: city, country, network, IP, page, source…" aria-label="Filter visits"></h2><div class="scroll paged" id="t-recent"></div><div class="pager" id="p-recent"></div></section>
</main>
<script src="${LEAFLET}/leaflet.min.js" integrity="${LEAFLET_JS_SRI}" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script src="/dash.js"></script></body></html>`;

/* ── dashboard client (served as /dash.js) ── */
function dashboard() {
  'use strict';
  const $ = id => document.getElementById(id);
  const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp|curl|wget|python|go-http|okhttp|monitor|uptime/i;
  const OWN = 'talhazafarjutt.github.io';
  // hosting / cloud networks: real people rarely browse from these, crawlers usually do
  const CLOUD = /\b(Google(?! Fiber)|Amazon|AWS|Microsoft|Azure|DigitalOcean|Linode|Akamai Connected Cloud|OVH|Hetzner|Oracle|Alibaba|Tencent|GTT|Leaseweb|M247|Choopa|Vultr|Constant Company|Contabo|Scaleway|Datacamp|Zenlayer|Hurricane Electric|Psychz|QuadraNet|ColoCrossing|IONOS|Hostinger|Kamatera|Hostwinds|Servers\.com|Equinix|Facebook|Meta Platforms|Yandex|Baidu|ByteDance|Censys|FranTech)\b/i;
  // answer engines, matched on the referrer host or utm_source (ChatGPT adds utm_source=chatgpt.com)
  const AI = [[/(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$/, 'ChatGPT'], [/(^|\.)perplexity\.ai$/, 'Perplexity'],
    [/(^|\.)claude\.ai$/, 'Claude'], [/(^|\.)copilot\.microsoft\.com$/, 'Copilot'], [/(^|\.)gemini\.google\.com$/, 'Gemini'],
    [/(^|\.)deepseek\.com$/, 'DeepSeek'], [/(^|\.)you\.com$/, 'You.com'], [/(^|\.)phind\.com$/, 'Phind'], [/(^|\.)meta\.ai$/, 'Meta AI'],
    [/(^|\.)(grok\.com|x\.ai)$/, 'Grok'], [/(^|\.)mistral\.ai$/, 'Mistral'], [/(^|\.)poe\.com$/, 'Poe']];
  // home / mobile internet providers and privacy relays/VPNs: a visit from these says nothing about an employer
  const ISP = /\b(Telecom|Telekom|Telecommunications?|Communications?|Broadband|Cable|Kabel|Internet|Wireless|Mobile|Mobil|Cellular|Fiber|Fibre|DSL|ISP|Vodafone|Comcast|Charter|Spectrum|Verizon|AT&T|T-Mobile|Sprint|Cox|RCN|Frontier|CenturyLink|Lumen|Virgin|Sky|BT|TalkTalk|Orange|Bouygues|SFR|Free SAS|Telefonica|Movistar|Telia|Telenor|Jazz|Zong|Ufone|PTCL|Nayatel|Wateen|Storm ?Fiber|Jio|Airtel|Etisalat|STC|Mobily|Rogers|Bell Canada|Telus|Shaw|Optus|Telstra|Swisscom|KPN|Ziggo|Proximus|Liberty Global|UPC|Eir|O2|Deutsche Telekom|1&1|Versatel|NetCologne|M-net|Ooredoo|Zain|Turkcell|Vivo|Claro|Tigo|Digi|Iliad|Fastweb|Tele2|Elisa|Starlink)\b/i;
  const RELAY = /\b(Apple|iCloud|Private Relay|Akamai|Cloudflare|Fastly|Nord|Mullvad|Proton|Surfshark|ExpressVPN|Tefincom|Packethub|Datacamp|M247|Zscaler)\b/i;
  const ACTION = { cta: 'Clicked “book a call” link', calendly_open: 'Opened booking calendar', booked: 'Booked a call',
    resume: 'Downloaded resume', email: 'Clicked email', phone: 'Clicked phone', linkedin: 'Opened LinkedIn', github: 'Opened GitHub' };
  let rows = [], events = [], messages = [], fitted = false;

  // One copy of the world: no wrapping, panning stops at its edges, and zoom is bounded —
  // out to "world fills the box" (so no repeated maps or empty bands), in to neighbourhood level.
  // IP geolocation is only city-accurate, so each spot also gets a dashed ~10 km "approximate area" ring.
  const WORLD = [[-85.05, -180], [85.05, 180]];
  const MAX_ZOOM = 13, FOCUS_ZOOM = 11, AREA_M = 10000;
  const map = L.map('map', {
    worldCopyJump: false, maxBounds: WORLD, maxBoundsViscosity: 1, maxZoom: MAX_ZOOM,
  });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    noWrap: true, bounds: WORLD, maxZoom: MAX_ZOOM, referrerPolicy: 'strict-origin-when-cross-origin',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  // lowest zoom at which the 256px-per-tile world covers the whole map box
  function fitMinZoom() {
    const size = map.getSize(), z = Math.ceil(Math.log2(Math.max(size.x, size.y) / 256));
    map.setMinZoom(z);
    if (map.getZoom() < z) map.setZoom(z);
    return z;
  }
  map.setView([25, 15], fitMinZoom());
  window.addEventListener('resize', () => { map.invalidateSize(); fitMinZoom(); });
  const layer = L.layerGroup().addTo(map);
  const markers = new Map();          // spot key → marker, so table rows can open them
  let openKey = null;
  const spotKey = (lat, lon) => (+lat).toFixed(1) + ',' + (+lon).toFixed(1);
  function focus(lat, lon) {
    if (lat == null || lon == null) return;
    const m = markers.get(spotKey(lat, lon));
    $('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    map.flyTo([+lat, +lon], FOCUS_ZOOM, { duration: 0.8 });
    if (m) {
      // open once the flight lands; the timer covers browsers that skip the animation
      let shown = false;
      const show = () => { if (!shown) { shown = true; m.openPopup(); } };
      map.once('moveend', show);
      setTimeout(show, 1200);
    }
  }
  $('dark').addEventListener('change', () => $('map').classList.toggle('light', !$('dark').checked));

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const flag = cc => (cc && /^[A-Z]{2}$/i.test(cc) ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '');
  const place = r => [r.city, r.region && r.region !== r.city ? r.region : '', r.country].filter(Boolean).join(', ');
  const host = ref => { try { const h = new URL(ref).hostname; return h === OWN ? '' : h.replace(/^www\./, ''); } catch { return ''; } };
  const aiName = r => {
    const h = host(r.referrer), u = String(r.utm || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    for (const [re, name] of AI) if ((h && re.test(h)) || (u && re.test(u))) return name;
    return '';
  };
  const source = r => {
    if (r.src) return 'tag: ' + r.src;
    const ai = aiName(r);
    if (ai) return 'AI · ' + ai;
    if (r.utm) return 'utm: ' + r.utm;
    return host(r.referrer) || (r.referrer ? 'internal' : 'direct');
  };
  const dur = s => (s == null ? '—' : s < 60 ? Math.round(s) + 's' : Math.floor(s / 60) + 'm ' + String(Math.round(s % 60)).padStart(2, '0') + 's');
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

  const tdOf = c => {
    if (c instanceof Node) { const td = el('td'); td.append(c); return td; }
    return el('td', typeof c === 'number' ? 'n' : null, c == null || c === '' ? '—' : String(c));
  };
  // paged table: page + page size per table survive refreshes; rows with coordinates zoom the map
  const paging = {};
  function pagedTable(id, head, items, toCells, coords) {
    const st = paging[id] ??= { page: 0, size: 25 };
    const pages = Math.max(1, Math.ceil(items.length / st.size));
    st.page = Math.max(0, Math.min(st.page, pages - 1));
    const box = $('t-' + id); box.replaceChildren();
    if (!items.length) box.append(el('div', 'empty', 'Nothing yet.'));
    else {
      const t = el('table'), tr = el('tr');
      head.forEach(h => tr.append(el('th', null, h)));
      t.append(tr);
      for (const it of items.slice(st.page * st.size, (st.page + 1) * st.size)) {
        const row = el('tr');
        for (const c of toCells(it)) row.append(tdOf(c));
        const xy = coords(it);
        if (xy) {
          row.className = 'go'; row.tabIndex = 0; row.title = 'Show on map';
          row.addEventListener('click', () => focus(xy[0], xy[1]));
          row.addEventListener('keydown', e => { if (e.key === 'Enter') focus(xy[0], xy[1]); });
        }
        t.append(row);
      }
      box.append(t);
    }
    const bar = $('p-' + id); bar.replaceChildren();
    const size = el('select');
    for (const n of [25, 50, 100, 250]) { const o = el('option', null, n + ' per page'); o.value = n; o.selected = n === st.size; size.append(o); }
    size.addEventListener('change', () => { st.size = +size.value; st.page = 0; render(); });
    const prev = el('button', null, '‹ Prev'), next = el('button', null, 'Next ›');
    prev.type = next.type = 'button';
    prev.disabled = st.page === 0; next.disabled = st.page >= pages - 1;
    prev.addEventListener('click', () => { st.page--; render(); });
    next.addEventListener('click', () => { st.page++; render(); });
    const from = items.length ? st.page * st.size + 1 : 0, to = Math.min(items.length, (st.page + 1) * st.size);
    bar.append(size, el('span', null, from + '–' + to + ' of ' + items.length), prev, el('span', null, 'page ' + (st.page + 1) + ' / ' + pages), next);
  }

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
    box.append(el('div', 'muted', 'location is approximate (IP-based, city level)'));
    const zoom = el('button', null, 'Zoom to area');
    zoom.type = 'button';
    zoom.addEventListener('click', () => map.flyTo([s.lat, s.lon], FOCUS_ZOOM, { duration: 0.8 }));
    box.append(zoom);
    return box;
  }

  function render() {
    const hideCloud = $('cloud').checked;
    let v = $('bots').checked ? rows.filter(r => !BOT.test(r.ua || '')) : rows;
    const cloudN = v.filter(r => CLOUD.test(r.org || '')).length;
    if (hideCloud) v = v.filter(r => !CLOUD.test(r.org || ''));
    $('cloud-l').textContent = 'Hide cloud networks' + (cloudN ? ' (' + cloudN + ')' : '');
    const ev = hideCloud ? events.filter(e => !CLOUD.test(e.org || '')) : events;

    // reading: the longest report per page view wins (one is sent each time the tab is hidden)
    const read = new Map();
    for (const e of ev) if (e.type === 'engage' && e.pv) {
      const o = read.get(e.pv) || { secs: 0, depth: 0 };
      read.set(e.pv, { secs: Math.max(o.secs, e.secs || 0), depth: Math.max(o.depth, e.depth || 0) });
    }
    const leads = ev.filter(e => e.type !== 'engage');
    const seen = v.map(r => r.pv && read.get(r.pv)).filter(Boolean);

    $('k-views').textContent = v.length;
    $('k-uniq').textContent = new Set(v.map(r => r.ip)).size;
    $('k-cty').textContent = new Set(v.map(r => r.country).filter(Boolean)).size;
    $('k-org').textContent = new Set(v.map(r => r.org).filter(Boolean)).size;
    $('k-src').textContent = v.filter(r => r.src).length;
    const since = Date.now() - (+$('range').value) * 864e5;
    $('k-msg').textContent = messages.filter(m => Date.parse(m.ts) >= since).length;
    $('k-lead').textContent = leads.length;
    $('k-book').textContent = leads.filter(e => e.type === 'booked').length;
    $('k-ai').textContent = v.filter(r => aiName(r)).length;
    $('k-read').textContent = seen.length ? dur(seen.reduce((a, x) => a + x.secs, 0) / seen.length) : '—';

    // map: one circle per ~10 km cell, sized by views
    const keep = openKey;
    layer.clearLayers(); markers.clear();
    const spots = new Map();
    let noGeo = 0;
    for (const r of v) {
      if (r.lat == null || r.lon == null) { noGeo++; continue; }
      const k = spotKey(r.lat, r.lon);
      let s = spots.get(k);
      if (!s) spots.set(k, s = { lat: +r.lat, lon: +r.lon, n: 0, country: r.country, place: place(r), orgs: new Map(), ips: new Set(), tags: new Set(), last: r.ts });
      s.n++; s.ips.add(r.ip);
      if (r.org) s.orgs.set(r.org, (s.orgs.get(r.org) || 0) + 1);
      if (r.src) s.tags.add(r.src);
      if (r.ts > s.last) s.last = r.ts;
    }
    const pts = [];
    for (const [k, s] of spots) {
      const tagged = s.tags.size > 0, col = tagged ? '#22c55e' : '#00e5ff';
      L.circle([s.lat, s.lon], { radius: AREA_M, color: col, weight: 1, dashArray: '4 5', fillOpacity: 0.05, interactive: false }).addTo(layer);
      const m = L.circleMarker([s.lat, s.lon], {
        radius: 5 + Math.sqrt(s.n) * 3, weight: 1.5, color: col, fillColor: col, fillOpacity: 0.35,
      }).bindPopup(popup(s)).addTo(layer);     // popup is a DOM node: visitor data never becomes HTML
      m.on('popupopen', () => { openKey = k; });
      m.on('popupclose', () => { if (openKey === k) openKey = null; });
      markers.set(k, m);
      pts.push([s.lat, s.lon]);
    }
    if (keep && markers.has(keep)) markers.get(keep).openPopup();
    $('nogeo').textContent = noGeo ? noGeo + ' without coordinates (logged before the map existed)' : '';
    if (pts.length && !fitted) { map.fitBounds(pts, { padding: [40, 40], maxZoom: 5 }); fitted = true; }
    else if (!pts.length && !fitted) map.setView([25, 15], map.getMinZoom());

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
    top('t-from', 'Source', v, source);

    // events carry no coordinates: borrow them from the same page view, else the same IP
    const byPv = new Map(), byIp = new Map();
    for (const r of rows) if (r.lat != null && r.lon != null) {
      if (r.pv && !byPv.has(r.pv)) byPv.set(r.pv, [r.lat, r.lon]);
      if (r.ip && !byIp.has(r.ip)) byIp.set(r.ip, [r.lat, r.lon]);
    }
    pagedTable('leads', ['When', 'Action', 'Detail', 'Page', 'Where', 'Network', 'IP'], leads, e => [
      ago(e.ts), e.type === 'booked' ? el('span', 'lead-booked', '✓ ' + ACTION.booked) : ACTION[e.type] || e.type,
      e.label, e.path, (flag(e.country) + ' ' + [e.city, e.country].filter(Boolean).join(', ')).trim(), e.org, e.ip,
    ], e => byPv.get(e.pv) || byIp.get(e.ip) || null);

    const pages = new Map();
    for (const r of v) {
      const k = r.path || '/', p = pages.get(k) || { views: 0, n: 0, secs: 0, depth: 0, deep: 0 };
      p.views++;
      const x = r.pv && read.get(r.pv);
      if (x) { p.n++; p.secs += x.secs; p.depth += x.depth; if (x.depth >= 75) p.deep++; }
      pages.set(k, p);
    }
    table('t-read', ['Page', 'Views', 'Measured', 'Avg. time', 'Avg. scroll', 'Scrolled ≥ 75%'],
      [...pages].sort((a, b) => b[1].views - a[1].views).map(([k, p]) => [
        k, p.views, p.n, p.n ? dur(p.secs / p.n) : '—', p.n ? Math.round(p.depth / p.n) + '%' : '—', p.n ? Math.round(p.deep / p.n * 100) + '%' : '—',
      ]));

    // messages: reply goes to the address they typed (validated by the Worker), text only ever as textContent
    const SAFE_EMAIL = /^[^\s@<>"'(),;:\\]+@[^\s@<>"'(),;:\\]+\.[^\s@<>"'(),;:\\]{2,}$/;
    pagedTable('msgs', ['When', 'Name', 'Email', 'Company', 'Message', 'Page', 'Where', 'Network'], messages, m => {
      let mail = m.email;
      if (SAFE_EMAIL.test(m.email || '')) {
        mail = el('a', null, m.email);
        mail.href = 'mailto:' + m.email + '?subject=' + encodeURIComponent('Re: your message on talhazafarjutt.github.io');
      }
      return [ago(m.ts), m.name, mail, m.company, el('span', 'msg-text', m.message), m.page,
        (flag(m.country) + ' ' + [m.city, m.country].filter(Boolean).join(', ')).trim(), m.org];
    }, m => byIp.get(m.ip) || null);

    // companies: organisation networks only (not home/mobile ISPs, clouds, relays/VPNs)
    const cos = new Map();
    for (const r of v) {
      const org = r.org || '';
      if (!org || ISP.test(org) || RELAY.test(org) || CLOUD.test(org)) continue;
      const c = cos.get(org) || { org, views: 0, ips: new Set(), pages: new Set(), secs: 0, last: r.ts, where: (flag(r.country) + ' ' + place(r)).trim(), lat: r.lat, lon: r.lon, leads: 0 };
      c.views++; c.ips.add(r.ip); c.pages.add(r.path || '/');
      const x = r.pv && read.get(r.pv); if (x) c.secs += x.secs;
      if (r.ts > c.last) c.last = r.ts;
      if (c.lat == null && r.lat != null) { c.lat = r.lat; c.lon = r.lon; }
      cos.set(org, c);
    }
    for (const e of leads) { const c = cos.get(e.org || ''); if (c) c.leads++; }
    pagedTable('cos', ['Organisation', 'Views', 'Visitors', 'Pages read', 'Reading time', 'Lead actions', 'Last seen', 'Where', 'Research'],
      [...cos.values()].sort((a, b) => b.leads - a.leads || b.secs - a.secs || b.views - a.views), c => {
        const look = el('a', null, 'LinkedIn ↗');
        look.href = 'https://www.linkedin.com/search/results/companies/?keywords=' + encodeURIComponent(c.org);
        look.target = '_blank'; look.rel = 'noopener noreferrer';
        look.addEventListener('click', e => e.stopPropagation());     // don't also fly the map
        return [c.org, c.views, c.ips.size, [...c.pages].join(', '), c.secs ? dur(c.secs) : '—', c.leads, ago(c.last), c.where, look];
      }, c => (c.lat != null ? [c.lat, c.lon] : null));

    const q = $('q').value.trim().toLowerCase();
    const list = q ? v.filter(r => [place(r), r.country, r.org, r.ip, r.path, source(r), device(r.ua)].join(' ').toLowerCase().includes(q)) : v;
    pagedTable('recent', ['When', 'Where', 'Network', 'IP', 'Page', 'Time', 'Scroll', 'From', 'Device'], list, r => {
      const x = r.pv && read.get(r.pv);
      return [ago(r.ts), (flag(r.country) + ' ' + place(r)).trim(), r.org, r.ip, r.path, x ? dur(x.secs) : '', x ? x.depth + '%' : '', source(r), device(r.ua)];
    }, r => (r.lat != null && r.lon != null ? [r.lat, r.lon] : null));
  }

  let loading = null;
  function load() {
    // one request at a time: the 60 s timer and the button share it
    loading ??= (async () => {
      const btn = $('refresh');
      btn.disabled = true; btn.textContent = '↻ Refreshing…';
      try {
        const res = await fetch('/api/visits?days=' + $('range').value + '&t=' + Date.now(), { credentials: 'same-origin', cache: 'no-store' });
        if (res.status === 401) { location.reload(); return; }
        if (!res.ok) { $('updated').textContent = 'Load failed (' + res.status + ')'; return; }
        const data = await res.json();
        rows = data.rows || []; events = data.events || []; messages = data.messages || [];
        render();
        $('updated').textContent = 'updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      } catch {
        $('updated').textContent = 'Load failed (network)';
      } finally {
        btn.disabled = false; btn.textContent = '↻ Refresh'; loading = null;
      }
    })();
    return loading;
  }
  $('refresh').addEventListener('click', load);
  $('range').addEventListener('change', () => { fitted = false; for (const k in paging) paging[k].page = 0; load(); });
  $('q').addEventListener('input', () => { if (paging.recent) paging.recent.page = 0; render(); });
  $('bots').addEventListener('change', render);
  $('cloud').addEventListener('change', render);
  load();
  setInterval(load, 60000);
}
// Wrangler bundles with esbuild keep_names, which inserts __name(fn, 'name') calls into function
// bodies — so dashboard.toString() references a helper the browser doesn't have. Define it.
const DASH_JS = 'var __name = function (f) { return f; };\n(' + dashboard.toString() + ')();';
