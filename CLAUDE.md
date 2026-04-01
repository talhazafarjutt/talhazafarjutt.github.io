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

## Calendly Setup
1. Create account at https://calendly.com
2. In `index.html`, find the `.calendly-inline-widget` div and update `data-url`:
   ```
   data-url="https://calendly.com/YOUR_USERNAME/30min"
   ```
3. The `?background_color=0a0a1a&text_color=e2e8f0&primary_color=00e5ff` query params
   theme the widget to match the dark design — keep them.

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

## Content Updates
All content is in `index.html`. Sections in order:
1. **Hero** — name, typewriter roles, CTA buttons
2. **About** — bio paragraphs, stats, contact card
3. **Skills** — four terminal panels (backend, devops, data/cloud, security)
4. **Experience** — timeline cards (Augai → BoolMind → Techleadz)
5. **Projects** — three project cards
6. **Contact** — contact links + Calendly embed
