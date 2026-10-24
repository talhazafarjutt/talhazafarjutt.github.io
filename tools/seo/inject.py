"""Write SEO head tags into every page from seo_pages.py. Idempotent: owns the block between SEO markers.
   Usage: python3 tools/seo/inject.py   (then regenerate sitemap.xml + cards if pages changed)"""
import html, json, re
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
R = os.path.abspath(os.path.join(HERE, "..", ".."))
from seo_pages import PAGES, SITE, TODAY
esc = lambda s: html.escape(s, quote=True)
PERSON = {
    "@type": "Person", "@id": SITE + "/#person", "name": "Talha Zafar", "url": SITE + "/",
    "image": SITE + "/img/talha-zafar.jpg", "jobTitle": "Backend, DevOps & LLMOps Engineer",
    "description": "Freelance backend, DevOps and LLMOps engineer: Python/FastAPI microservices, Kubernetes, self-hosted LLM inference (vLLM on GPUs) and security hardening.",
    "email": "mailto:talha.zafar.j@gmail.com",
    "address": {"@type": "PostalAddress", "addressLocality": "Lahore", "addressCountry": "PK"},
    "sameAs": ["https://github.com/talhazafarjutt", "https://www.linkedin.com/in/talhazafarj"],
    "knowsAbout": ["Python", "FastAPI", "Django", "NestJS", "Kubernetes", "K3s", "Docker", "DevOps", "LLMOps", "MLOps", "vLLM",
                   "LLM inference", "GPU infrastructure", "gRPC", "Redis", "PostgreSQL", "HashiCorp Vault", "Application security", "GDPR"],
}


def ld(page):
    if page["type"] == "website":
        graph = [
            {"@type": "ProfilePage", "@id": page["url"] + "#profile", "url": page["url"], "name": page["title"],
             "description": page["desc"], "inLanguage": "en", "dateModified": TODAY,
             "mainEntity": {"@id": SITE + "/#person"}, "isPartOf": {"@id": SITE + "/#website"}},
            PERSON,
            {"@type": "WebSite", "@id": SITE + "/#website", "url": SITE + "/", "name": "Talha Zafar",
             "inLanguage": "en", "publisher": {"@id": SITE + "/#person"}},
        ]
    else:
        graph = [
            {"@type": "BlogPosting", "@id": page["url"] + "#article", "headline": page["headline"],
             "description": page["desc"], "image": SITE + "/" + page["og"], "url": page["url"],
             "mainEntityOfPage": page["url"], "datePublished": page["published"], "dateModified": TODAY,
             "inLanguage": "en", "keywords": page["tags"],
             "author": {"@type": "Person", "@id": SITE + "/#person", "name": "Talha Zafar", "url": SITE + "/"},
             "publisher": {"@type": "Person", "@id": SITE + "/#person", "name": "Talha Zafar", "url": SITE + "/"}},
            {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Talha Zafar", "item": SITE + "/"},
                {"@type": "ListItem", "position": 2, "name": page["headline"], "item": page["url"]}]},
        ]
    data = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=1)
    return data.replace("</", "<\\/")


def block(page):
    img = SITE + "/" + page["og"]
    alt = page.get("headline", "Talha Zafar — Backend & DevOps Engineer")
    tags = [
        f'<link rel="canonical" href="{page["url"]}">',
        '<meta name="author" content="Talha Zafar">',
        '<meta name="robots" content="index, follow, max-image-preview:large">',
        '<meta name="theme-color" content="#FFF4D6">',
        '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
        '<link rel="icon" href="/favicon-96.png" type="image/png" sizes="96x96">',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        '<meta property="og:site_name" content="Talha Zafar">',
        '<meta property="og:locale" content="en_US">',
        f'<meta property="og:type" content="{page["type"]}">',
        f'<meta property="og:title" content="{esc(page.get("headline", page["title"]))}">',
        f'<meta property="og:description" content="{esc(page["desc"])}">',
        f'<meta property="og:url" content="{page["url"]}">',
        f'<meta property="og:image" content="{img}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        f'<meta property="og:image:alt" content="{esc(alt)}">',
    ]
    if page["type"] == "article":
        tags += [f'<meta property="article:published_time" content="{page["published"]}">',
                 f'<meta property="article:modified_time" content="{TODAY}">',
                 f'<meta property="article:author" content="{SITE}/">']
        tags += [f'<meta property="article:tag" content="{esc(t)}">' for t in page["tags"]]
    tags += [
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{esc(page.get("headline", page["title"]))}">',
        f'<meta name="twitter:description" content="{esc(page["desc"])}">',
        f'<meta name="twitter:image" content="{img}">',
        '<script type="application/ld+json">\n' + ld(page) + '\n</script>',
    ]
    return "<!-- SEO:start (generated from seo_pages.py) -->\n" + "\n".join(tags) + "\n<!-- SEO:end -->"


for p in PAGES:
    path = f"{R}/{p['file']}"
    s = open(path).read()
    s, n = re.subn(r"<title>.*?</title>", f"<title>{esc(p['title'])}</title>", s, count=1, flags=re.S); assert n == 1, path
    s, n = re.subn(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{esc(p["desc"])}">', s, count=1); assert n == 1, path
    s = re.sub(r'<link rel="icon" type="image/svg\+xml" href="data:[^"]*">\n', "", s)          # inline icons → real files
    s = re.sub(r"<!-- SEO:start.*?<!-- SEO:end -->\n", "", s, flags=re.S)
    s = s.replace("</title>\n", "</title>\n" + block(p) + "\n", 1)
    if p["type"] == "article":   # machine-readable publish date on the visible byline
        s, n = re.subn(r'(class="bp-meta[^"]*"><span>)([A-Z][a-z]{2} \d{4})(</span>)',
                       lambda m: f'{m.group(1)}<time datetime="{p["published"]}">{m.group(2)}</time>{m.group(3)}', s, count=1)
        assert n == 1 or '<time datetime=' in s, path
    open(path, "w").write(s)
    print(f"{p['file']:40s} title={len(p['title'])} desc={len(p['desc'])}")

# sitemap.xml from the same page list
urls = "\n".join(
    f"  <url>\n    <loc>{p['url']}</loc>\n    <lastmod>{TODAY}</lastmod>\n"
    f"    <image:image><image:loc>{SITE}/{p['og']}</image:loc></image:image>\n  </url>" for p in PAGES)
open(f"{R}/sitemap.xml", "w").write('<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
    + urls + "\n</urlset>\n")
print("sitemap.xml:", len(PAGES), "URLs")

# llms.txt (llmstxt.org): a plain summary for AI assistants and answer engines. Facts only from the site.
articles = "\n".join(f"- [{p['headline']}]({p['url']}): {p['desc']}" for p in PAGES if p["type"] != "website")
open(f"{R}/llms.txt", "w").write(f"""# Talha Zafar — Freelance Backend, DevOps & LLMOps Engineer

> Freelance backend, DevOps and LLMOps engineer based in Lahore, Pakistan (PKT, UTC+5), working remotely worldwide.
> 4+ years in production since Sep 2022: Python/FastAPI microservices, Kubernetes (K3s), self-hosted LLM inference
> with vLLM on GPUs, and security hardening (HashiCorp Vault, OWASP, GDPR). Available for freelance projects.

## What he does
- LLMOps / self-hosted LLM inference: vLLM on bare-metal K3s, a FastAPI load balancer and an nginx API gateway with key auth and rate limits. One 4× Tesla V100 (32 GB) cluster served 10k+ requests a day at ~$180/month, against ~$8,800/month for AWS's closest 4× V100 instance.
- Backend APIs: Python and Node microservices holding sub-100ms P95 at 10k+ daily requests; gRPC between six services (40% less internal API overhead than REST); Redis caching that cut database load 60%.
- Security and DevOps: zero-trust secrets with HashiCorp Vault, GitHub Actions CI/CD with SAST, container and secret scanning; stopped a live Stripe carding attack (fraud rate 12% → 0.02%).

## Case studies
{articles}

## Contact
- Book a 30-minute call: https://calendly.com/talha-zafar-j/30min
- Email: talha.zafar.j@gmail.com
- LinkedIn: https://www.linkedin.com/in/talhazafarj
- GitHub: https://github.com/talhazafarjutt
- Portfolio: {SITE}/
""")
print("llms.txt: written")
