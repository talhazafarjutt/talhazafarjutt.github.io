"""SEO metadata for every page — titles ≤ ~65 chars, descriptions ≤ ~155 chars, facts from the pages themselves."""
SITE = "https://talhazafarjutt.github.io"
TODAY = "2026-10-15"

PAGES = [
    dict(file="index.html", url=SITE + "/", og="img/og/home.jpg", type="website",
         title="Talha Zafar — Freelance Backend & DevOps Engineer | FastAPI · K8s",
         desc="Freelance backend & DevOps engineer for hire: FastAPI APIs, Kubernetes, self-hosted LLM inference and security hardening. Remote worldwide — book a call.",
         card=dict(kicker="Freelance · Remote worldwide", title="Talha Zafar", size=96,
                   sub="Backend & DevOps engineer for hire",
                   tags=["FastAPI", "Kubernetes", "vLLM", "Vault"])),
    dict(file="blog/civitas-fraud-platform.html", og="img/og/civitas-fraud-platform.jpg", published="2026-09-11",
         headline="How a Fraud Platform Can Look Healthy While Catching Nothing",
         title="Fraud Detection Platform Case Study: Silent Failures — Talha Zafar",
         desc="How a fraud-detection platform looked healthy while scoring 0 of 61 transactions — async scoring, build-enforced security and measured performance work.",
         tags=["FastAPI", "Postgres", "Redis Streams", "Security", "Performance"],
         card=dict(kicker="Case study · Fraud detection", sub="Platform engineering notes · interactive 3D")),
    dict(file="blog/ingress-nginx-migration.html", og="img/og/ingress-nginx-migration.jpg", published="2026-07",
         headline="Replacing ingress-nginx in Production Without Breaking Anything",
         title="Replacing ingress-nginx with Gateway API in Production — Talha Zafar",
         desc="ingress-nginx was retired in March 2026. The exact cutover to Gateway API I ran: audit, parallel edges, one hostname at a time, zero dropped requests.",
         tags=["Kubernetes", "Gateway API", "ingress-nginx", "Migration"],
         card=dict(kicker="Kubernetes · Migration", sub="Step-by-step cutover · interactive 3D")),
    dict(file="blog/gpu-inference.html", og="img/og/gpu-inference.jpg", published="2026-03",
         headline="Running LLM Inference on 4× Tesla V100 — Bare Metal to Production",
         title="Self-Hosted LLM Inference on 4× V100 (vLLM, K3s) — Talha Zafar",
         desc="How to self-host an LLM on bare metal: 4× Tesla V100 GPUs, K3s, vLLM, a FastAPI load balancer and nginx API-key auth — ~$180/month vs ~$8,800 on AWS.",
         tags=["vLLM", "K3s", "GPU", "LLM inference", "FastAPI"],
         card=dict(kicker="Self-hosted LLM inference", sub="~$180/month vs ~$8,800 on AWS")),
    dict(file="blog/stripe-carding.html", og="img/og/stripe-carding.jpg", published="2026-02",
         headline="Stopping a Live Stripe Carding Attack — Zero Fraud Post-Deployment",
         title="Stopping a Stripe Card-Testing (Carding) Attack — Talha Zafar",
         desc="How to stop a card testing attack on Stripe: three Radar rules, Redis IP + BIN rate limits and HMAC between services. Fraud 12% → 0.02% in under 4 hours.",
         tags=["Stripe", "Security", "Redis", "HMAC", "Fraud prevention"],
         card=dict(kicker="Security · Incident response", sub="Fraud rate 12% → 0.02% · interactive 3D")),
    dict(file="blog/grpc-vs-rest.html", og="img/og/grpc-vs-rest.jpg", published="2026-01",
         headline="gRPC vs REST in Production — How We Cut Internal API Overhead by 40%",
         title="gRPC vs REST: 40% Overhead Reduction in Production — Talha Zafar",
         desc="Which is faster, gRPC or REST? Measured on 6 microservices: 42% lower internal latency, 76% smaller payloads — and when REST is still the right call.",
         tags=["gRPC", "REST", "FastAPI", "Microservices", "Python"],
         card=dict(kicker="Microservices · Performance", sub="−42% latency, −76% payload · interactive 3D")),
    dict(file="blog/vault-gdpr.html", og="img/og/vault-gdpr.jpg", published="2025-12",
         headline="Zero-Trust Secrets with HashiCorp Vault — GDPR-Compliant on Bare Metal",
         title="Zero-Trust Secrets with HashiCorp Vault — Talha Zafar",
         desc="Why use HashiCorp Vault? How we replaced .env files with AppRole auth, least-privilege policies, CI/CD secrets and on-prem audit logs for GDPR Article 32.",
         tags=["HashiCorp Vault", "Security", "GDPR", "AppRole", "DevOps"],
         card=dict(kicker="Security · GDPR", sub="Least-privilege secrets · interactive 3D")),
]
for p in PAGES:
    p.setdefault("url", f"{SITE}/{p['file']}")
    p.setdefault("type", "article")
    if p["type"] == "article":
        p["card"].update(title=p["headline"], tags=p["tags"][:3])
