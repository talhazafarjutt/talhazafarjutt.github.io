"""The three packages — single source for packages.html (grid), call.html / audit.html / llmops.html,
their SEO entries (seo_pages.py) and their LinkedIn/share banners (cards.py).
Fields marked HTML are inserted as-is: escape & as &amp; and only use trusted markup.
No prices until Talha supplies real figures (CLAUDE.md: no invented prices)."""

OFFERS = [
    dict(
        slug="call", file="call.html", topic="call", dark=False,
        kicker="Free", name="Discovery call", h1='Free <span>discovery call</span>',
        price="$0", price_note="30 minutes · video call",
        for_html="For teams that want a second opinion before committing to anything.",
        sections=[("", [
            "You walk me through your system and what's hurting",
            "I point out the biggest risks and quick wins I can see",
            "An honest answer on whether I'm the right person for it",
            "No obligation",
        ])],
        after_html="",
        cta=("Book a free call →", "calendly"),
        proof_html="",
        summary="Free 30-minute video call: your system, the biggest risks and quick wins, and whether I'm the right fit.",
        schema_price="0",
        seo_title="Free 30-Minute Discovery Call — Talha Zafar",
        seo_desc="Book a free 30-minute video call: walk me through your system, get the biggest risks and quick wins, and an honest answer on whether I'm the right fit.",
        banner=dict(price="Free", lines=["30-minute video call", "Your biggest risks and quick wins", "Honest fit check — no obligation"]),
    ),
    dict(
        slug="audit", file="audit.html", topic="audit", dark=False,
        kicker="Fixed price", name="Security &amp; infrastructure audit", h1='Security &amp; infrastructure <span>audit</span>',
        price="Fixed price", price_note="quoted after the free call",
        for_html="For teams running production on Kubernetes, VMs or bare metal who want to know where they're exposed.",
        sections=[
            ("What I review", [
                "Kubernetes / K3s, ingress and TLS — including ingress-nginx end-of-life exposure",
                "Secrets: <code>.env</code> files, CI variables and keys, with a plan to move them into Vault or your cloud's secret manager",
                "CI/CD: SAST, container and secret scanning in the pipeline",
                "APIs: OWASP Top 10, auth between services, rate limits",
                "Payments, if you take them: card-testing defences on Stripe",
            ]),
            ("You get", [
                "A written report, findings ranked from critical to nice-to-have",
                "A fix plan with the effort for each item",
                "A walkthrough call — and I can implement the fixes if you want",
            ]),
        ],
        after_html="",
        cta=("Request an audit →", "topic"),
        proof_html='Based on work like <a href="blog/vault-gdpr.html">Vault &amp; GDPR</a>, <a href="blog/stripe-carding.html">a live carding attack</a> and <a href="blog/ingress-nginx-migration.html">the ingress-nginx migration</a>.',
        summary="Fixed-price review of Kubernetes, ingress and TLS, secrets, CI/CD, API security and payments, with a written report and fix plan.",
        schema_price=None,
        seo_title="Security & Infrastructure Audit (Fixed Price) — Talha Zafar",
        seo_desc="Fixed-price audit of Kubernetes, ingress and TLS, secrets, CI/CD scanning, API security and payments, with a written report, fix plan and walkthrough.",
        banner=dict(price="Fixed price", lines=["Kubernetes, ingress & TLS · secrets · CI/CD", "APIs (OWASP) · payments", "Written report + fix plan + walkthrough"]),
    ),
    dict(
        slug="llmops", file="llmops.html", topic="llmops", dark=True,
        kicker="Long-term", name="LLM infrastructure (LLMOps)", h1='LLM infrastructure <span>(LLMOps)</span>',
        price="Monthly retainer or full-time", price_note="let's talk",
        for_html="For products that need their own LLM inference — for cost, data residency or control.",
        sections=[("What I do", [
            "Self-hosted inference with vLLM on GPUs, on Kubernetes / K3s",
            "An API gateway with keys, per-key rate limits and readiness checks, so restarts don't fail requests",
            "Monitoring, alerting and capacity planning",
            "Cost control: one 4× V100 cluster I built ran at ~$180/month against ~$8,800 for the closest AWS instance",
            "The backend and DevOps around it: FastAPI services, CI/CD, secrets",
        ])],
        after_html="Long-term contract or full-time role · remote · PKT (UTC+5)",
        cta=("Discuss LLM work →", "topic"),
        proof_html='Case study: <a href="blog/gpu-inference.html">LLM inference on 4× Tesla V100</a>.',
        summary="Long-term or full-time: self-hosted vLLM inference on GPUs and Kubernetes, an API gateway with keys and rate limits, monitoring and cost control.",
        schema_price=None,
        seo_title="LLMOps & LLM Infrastructure Engineer for Hire — Talha Zafar",
        seo_desc="Long-term or full-time LLMOps: self-hosted vLLM on GPUs and Kubernetes, an API gateway with keys and rate limits, monitoring and cost control.",
        banner=dict(price="Retainer or full-time", lines=["Self-hosted vLLM on GPUs + Kubernetes", "Gateway: keys, rate limits, readiness checks", "~$180/month vs ~$8,800 on AWS (4× V100)"]),
    ),
]

TOPIC_LABELS = [("call", "Free discovery call"), ("audit", "Security &amp; infrastructure audit"),
                ("llmops", "LLM infrastructure (long-term / full-time)"), ("other", "Something else")]
