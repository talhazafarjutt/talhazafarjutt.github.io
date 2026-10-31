# CLAUDE.md — talhazafarjutt.github.io

## Project
Static portfolio for Talha Zafar (Senior Backend & DevOps Engineer).
Deployed on GitHub Pages — auto-serves from the `main` branch root.
Live URL: https://talhazafarjutt.github.io

## Stack
- **Pure HTML/CSS/JS** — single `index.html`, no build tools, no npm, no frameworks
- **No axios** — native `fetch` API only (avoids known axios CVEs and supply chain risk)
- **No npm packages** — zero supply chain attack surface
- Google Fonts (JetBrains Mono + Space Grotesk) via official CDN link tag
- Calendly scheduling embed via official Calendly async widget script
- Canvas API for animated neural-network background

## Design palette
- Brand pair: **Nordic Indigo `#263BAA`** + **Vanilla Mist `#FFF4D6`** — tokens in `:root` of `css/style.css`
  (`--indigo`, `--vanilla`, derived `--fg` ink, `--night` dark panel, `--tint`, `--t2`/`--t3` text, `--ok`/`--warn`/`--bad`).
- Pages are vanilla with indigo type; dark "night" panels (`--night`) hold the terminal, blog 3D figures and code blocks.
- Text contrast floors: `--t3` (muted) ≥5.6:1 on vanilla, `--v2` ≥5.9:1 on indigo. Check new colours before adding them.
- `--c/--p/--g/--a` are neon data colours for the dark 3D figures only — never put them on vanilla.
- Share cards (`tools/seo/og.html`) and `favicon.svg` use the same palette; re-run `cards.py` after changing it.
- Intersection Observer API for scroll-triggered fade-ins

## Security Posture
- CSP `<meta>` header set in `index.html` — limits script/frame/font origins
- All external links use `rel="noopener noreferrer"`
- No `eval()`, no `innerHTML` with dynamic content, no inline event handlers
- `*.docx` / `*.pdf` gitignored — resume docs contain personal contact info
- Calendly loaded `async` from `assets.calendly.com` only (official domain)
- No jQuery, no lodash, no moment.js — nothing that could be hijacked

## Deployment (GitHub Pages)
The repo name `talhazafarjutt.github.io` makes GitHub Pages serve from `main` root automatically.
Just push `index.html` — no `gh-pages` branch or Actions workflow needed.

**Cache busting:** GitHub Pages serves assets with `cache-control: max-age=600`, so a returning visitor can get
new HTML with stale CSS/JS/images. Every local asset link carries `?v=YYYYMMDDnn` (date + sequence) — bump it in all pages
(`index.html`, `blog/*.html`) whenever you change a CSS, JS or image file:
`sed -i 's/?v=[0-9]*"/?v=NEWDATE"/g' index.html blog/*.html 404.html packages.html call.html audit.html llmops.html`

## SEO
- Page titles, descriptions, publish dates and share-card text live in **`tools/seo/seo_pages.py`** (single source of truth).
- `python3 tools/seo/inject.py` rewrites the `<!-- SEO:start … SEO:end -->` block in every page (canonical, Open Graph, Twitter,
  JSON-LD: ProfilePage/Person/WebSite on home, BlogPosting + BreadcrumbList on articles) and regenerates `sitemap.xml` and
  `llms.txt` (plain-text summary for AI assistants; its facts must match the site). Idempotent.
- `python3 tools/seo/cards.py` renders the 1200×630 share cards in `img/og/` + favicon PNGs (headless Chrome).
- Page types in `seo_pages.py`: `website` (home), `article` (BlogPosting) and `page` (WebPage + OfferCatalog from `offers`, used by `packages.html`).
- **New article:** add it to `seo_pages.py` → run `cards.py` and `inject.py` → add its card to the homepage blog grid → bump `?v=`.
- Keep titles ≤ ~65 chars and descriptions ≤ ~155; only state facts the page itself contains.
- `robots.txt` blocks `/cloudflare/`, `/tools/`, `blog/*.md`, `resume_source.html`. `404.html` is served by GitHub Pages for unknown URLs.
- Calendly's widget is loaded on demand (`loadCalendly()` in `js/main.js`), not on every page view.
- `google1056c66e0b3077ca.html` at the root is the Google Search Console ownership file (URL-prefix property) — never delete or edit it.
- After publishing changes, run `python3 tools/seo/indexnow.py` to notify Bing/IndexNow (key file `c32bbcbaf4d636a80c72007e798ebf97.txt` at the root must stay).
- Hero portrait uses `srcset` (330w/600w); regenerate `img/talha-zafar-330.*` if the photo changes.

## Calendly Setup
1. Create account at https://calendly.com
2. In `index.html`, find the `.calendly-inline-widget` div and update `data-url`:
   ```
   data-url="https://calendly.com/YOUR_USERNAME/30min"
   ```
3. `CAL_URL` in `js/main.js` carries `?background_color=fff4d6&text_color=161e4d&primary_color=263baa`
   to theme the popup to the vanilla/indigo palette — keep them (Calendly ignores them on plans without colour customisation).

## Resume Files
Six `.docx` files (backend/devops × local/germany variants) live in the repo root locally
but are gitignored and never pushed. To share a resume, export to PDF and host separately
or send directly.

## Key Files
| File | Purpose |
|------|---------|
| `index.html` | Entire site — edit here for any content/design changes |
| `.gitignore` | Excludes docx, pdf, secrets, node_modules |
| `CLAUDE.md` | This file |
| `js/scene3d.js` + `css/scene3d.css` | Dependency-free 3D figure engine used by every blog post (canvas 2D, auto-fit camera) |
| `js/visit.js` | Visit log: one `sendBeacon` per page view to the Cloudflare Worker `visits.talha-zafar-j.workers.dev` (D1 db `portfolio`, tables `visits` + `events`, 30-day cron cleanup), plus `POST /e` event beacons: lead clicks (`cta`, `calendly_open`, `booked` via Calendly postMessage, `resume`, `email`, `phone`, `linkedin`, `github`) and `engage` (active seconds + scroll depth on tab hide). A random per-page-view `pv` id links events to the visit; `utm_source` is logged (ChatGPT adds `utm_source=chatgpt.com`). Skips GPC/DNT; `?notrack` opts this browser out. Footer privacy note must list what is logged. Worker URL must stay in `connect-src` of every page with a CSP |
| `cloudflare/visits-worker.js` | Source of the `visits` Worker (pasted into the Cloudflare editor, not served by Pages): beacon endpoint, password-protected map dashboard at `/dashboard` (secret `DASH_PASSWORD`; one non-wrapping world, zoom bounded from world-fits-box to level 13, dashed ~10 km 'approximate area' ring per spot, dark/light map toggle, table rows fly the map to that visitor (zoom 11); range defaults to 30 days (= retention); Leads and All-visits tables are paged (25–250) with a text filter on visits; ↻ Refresh button + 60 s auto-refresh; filters: bots by UA, cloud/hosting networks by org name; panels: Messages (contact form, kept 180 days, all shown), lead actions, Companies & organisations (orgs that are not ISP/mobile, cloud or relay/VPN — research only, never mention the visit), AI-assistant sources (referrer or utm_source), reading per page), `/api/visits`, daily cleanup. Render visitor data with `textContent` only |
| `js/contact.js` | Contact form on the homepage (`#contact`) and every article (above `.bp-footer-nav`): posts JSON as `text/plain` to the Worker `POST /contact`; without JS the same form posts form-encoded and the Worker answers with a confirmation page. Spam traps: hidden `website` field + minimum fill time; Worker also rate-limits 5/IP/hour and validates name/email/message. Messages are stored in D1 `messages` |
| `js/scenes/*.js` | One scene per post: nodes, edges, modes, `tick()`. Facts in tooltips/notes must come from that post |

## Content Updates
All content is in `index.html`. A fixed top bar (`#site-nav`, links highlight the section in view — `syncNav()` in
`js/main.js`) sits above these sections, in order (proof before biography — the page is aimed at freelance clients):
1. **Hero** — name, static role line, one-line pitch, two CTAs (book a call, case studies); impact strip + "Production work at" row
2. **Services** (`#services`) — three "how I help" cards linking to articles
3. **Work** (`#projects`) — three project cards: result first, then a "Read the case study" link
4. **Articles** (`#blog`) — six article cards
5. **About** (`#about`) — bio + "At a glance" card
6. **Experience** (`#experience`) — timeline cards (Augai → BoolMind → Techleadz)
7. **Skills** (`#skills`) — four tag panels
8. **Process** (`#process`) — four steps, first call to handover
9. **Contact** (`#contact`) — contact links + Calendly button + contact form (`js/contact.js`)

**Packages — single source `tools/seo/offers.py`.** Edit offers there, then run `python3 tools/seo/offers_build.py`
(rebuilds the grid + form inside `packages.html` between `PKG`/`FORM` markers and regenerates `call.html`, `audit.html`,
`llmops.html` from `packages.html`'s shell — never hand-edit those three), then `inject.py` and `cards.py`
(banners `img/og/{packages,call,audit,llmops}.jpg`: these are the LinkedIn Featured images, one per link).

**`packages.html`** — the shareable offers page (linked from the top bar, the Services section and every article's nav):
Free discovery call (`$0`, opens Calendly via `data-calendly`), Security & infrastructure audit (fixed price, quoted after the
call) and LLM infrastructure / LLMOps (monthly retainer or full-time). Buttons with `data-topic` pre-select the package in the
request form, and `contact.js` prefixes the message with it. **No prices are shown until Talha gives real figures** — put
them in `offers.py` (`price`, `price_note`, `schema_price`, `banner.price`) and rebuild.

Keep it professional: no custom cursor, no typing effects, no fake terminal chrome; text ≥ 12px (`.75rem`).
Every number on the page must come from an article or the resume; no invented testimonials, clients or prices.
