---
title: "How a Fraud Platform Can Look Healthy While Catching Nothing"
description: "A practical case study on silent fraud-platform failures: missing transaction identity fields, fake confidence from green dashboards, and the operational safeguards that make detection systems trustworthy."
tags:
  - Backend
  - Python
  - FastAPI
  - Postgres
  - Performance
  - Security
date: 2026-09-11
author: Talha Zafar
---

> Executive summary: This project was a financial-crime detection platform built to support public-sector fraud monitoring. The real problem was not model quality alone, but the fact that the system could appear healthy while silently dropping all of its incoming fraud signals. When the identity fields required by the risk engine were missing, the platform kept accepting transactions, the queue grew, and zero of 61 were ever scored. The lesson was operational: a fraud system must fail loudly at the boundaries, not just look healthy on the dashboard.
>
> For teams operating in regulated or high-risk money movement environments, the risks are familiar: green dashboards, silent data drift, weak observability, and policies that are hard to audit. This project was a reminder that detection value comes from reliable signal flow, not from the presence of a model.

The dashboard was green. The API was returning `202 PENDING` on every transaction. The worker was consuming from the Redis Stream without errors. Nothing in the logs looked wrong.

Zero of 61 transactions had been scored.

The adapter between my platform and the risk engine was missing four identity fields — `transaction_id`, `sender_id`, `receiver_id`, `timestamp`. Nothing threw at the boundary. The engine received payloads it could not act on, the backlog grew without bound, and a fraud-detection system detected no fraud while every health indicator said it was fine.

That bug is the reason I write these notes the way I do. It was not found by reading the code. It was found by running the code and counting rows.

---

## What this was

Civitas AI is an AI financial-crime intelligence platform aimed at public-sector fraud detection. I delivered a paid, fixed-price technical proof of concept for it, later extended toward a V1.

For clients, the practical value of this work was not just “we built an ML pipeline.” It was that we designed a system that could prove a decision path existed from transaction intake to alerting, authorization, and auditability. In fraud systems, the most expensive failure is not a single bad model — it is a pipeline that looks healthy while silently dropping the data the model needs to work.

Two engineers. A colleague owned the risk engine — model training, scoring logic, the four-signal design I describe below. That is their work and I describe it only to explain what my side had to support. I owned the entire platform: API, data model, database, security, performance, deployment, CI. Roughly 5,800 lines of platform Python, 18 HTTP endpoints, 259 automated tests, 3 migrations.

**The data was synthetic and public throughout — a PaySim-derived transaction set. No real bank, government, or personal data at any point.** In a fraud-detection context a reader should want that answered before anything else, so: it is answered. Every performance and detection number below was measured against synthetic data on non-production hardware, and I repeat that caveat wherever it matters.

It is a proof of concept deployed to staging. It is not in production and I do not claim it is.

---

## The shape of the system, and why

Four stages, asynchronous:

```
Transaction → ingest (202 PENDING) → Redis Stream → worker → risk engine
  → score persisted → alert raised above threshold → analyst → supervisor → audit
```

Three decisions did most of the work.

**Ingestion never blocks on scoring.** A submitted transaction is persisted and acknowledged with `202 PENDING` *before* the model is consulted. Scoring happens on a Redis Stream consumer group. This is not a throughput optimization; it is a financial-systems requirement. The money-movement path cannot fail because an ML service is slow or unavailable. If scoring is degraded, transactions still land, and the backlog drains when the scorer recovers. The alternative — synchronous scoring — makes the model a hard dependency of accepting money, which is the wrong coupling for any system in that position.

**Decision policy lives in the backend, not the model.** The engine returns a risk score. A configurable threshold decides what happens to it. The engine's response carries a `decision` field that I deliberately never obey — it is stored for comparison only. Whether a transaction is blocked or routed to review is policy. It must be explainable to a regulator, auditable after the fact, and changeable without shipping a new model. Baking that into model weights makes it all three of unexplainable, unauditable, and unchangeable.

**Scoring is append-only and version-stamped.** Scores are never overwritten; each one carries the engine version that produced it. Any historical decision can be reconstructed from the row that produced it, rather than from a mutable "current score" that has since drifted.

---

## The ML boundary

`FraudModelClient` is a typed Protocol with three interchangeable implementations:

- `StubClient` — deterministic fixtures
- `HttpClient` — remote scoring service
- `InProcessClient` — the engine loaded directly

This is the single decision that let two engineers work in parallel without blocking each other. I built the entire backend — ingestion, persistence, alerting, authorization, the case workflow — against `StubClient`, before the model existed. When the engine was ready, the system moved to in-process scoring without touching one line of API or database code.

The risk engine itself (my colleague's work) combines four independent signals: a supervised XGBoost model weighted at 60%, deterministic rules at 25%, an Isolation Forest anomaly detector at 10%, and network/graph analysis at 5%. A HIGH-severity rule applies a floor — a minimum risk score of 70 regardless of what the model produces.

The platform decision that matters here is that I persist **each signal separately**, not just the blended score. The reason is operational. The first question a supervisor asks about a flagged transaction is *"did the model flag this, or did a hard rule?"* — because a rule-driven flag is deterministic and defensible in a sentence, while a model-driven one needs its explanation attached before anyone acts on it. A single blended probability cannot answer that question, and by the time someone asks, the inputs are gone.

Reported evaluation on the synthetic holdout was PR-AUC 0.993 with roughly 99.5% recall. That is a number from synthetic data. It is not evidence of production banking performance and should not be read as any.

---

## Security as something the build enforces

I could list the controls. Lists of controls prove nothing, so here is what each one prevents.

**Rotating refresh tokens with family reuse detection.** If a stolen refresh token is replayed, the entire token family is revoked — not just the replayed token. The attacker and the legitimate user both get logged out, which is the correct outcome, because a replay means one of the two is compromised and you cannot tell which from the request.

**Scopes, not roles.** Permission is granted per action. An analyst and a supervisor are not different code paths with different `if` branches; they hold different scope sets against the same path. Role-branching is where authorization bugs live.

**Object-level authorization returns 404, never 403.** A 403 confirms the resource exists. A 404 leaks nothing. If you can distinguish "not yours" from "not there," you can enumerate the space of what exists by walking IDs.

**Four-eyes on case closure.** Closing a fraud case requires a separate `alerts:close` scope. No single actor confirms fraud alone.

**Two-layer idempotency** — a Redis fast path plus a database `UNIQUE` constraint as the source of truth. The database layer exists specifically because a cache miss must never permit a duplicate financial transaction. Redis is the optimization; the constraint is the guarantee.

**Layered rate limiting.** A tighter pre-authentication bucket keyed on source address absorbs unauthenticated floods and cannot be influenced by the caller, a per-principal bucket applies after authentication, and dedicated per-account login limits blunt credential stuffing against a single target.

Plus: OAuth2 with password and client-credentials grants, Argon2id hashing, RS256 JWTs for non-local environments, IBAN masking to the last four digits on every read path, RFC 9457 `problem+json` on every error so nothing leaks a stack trace, and a container that runs non-root from the first instruction with all Linux capabilities dropped, `no-new-privileges`, and a read-only root filesystem.

### The part I would build again first

`validate_production_safety()` runs at startup and **refuses to boot** if the configuration is unsafe: a default secret still in place, a wildcard CORS origin, HS256 in production, a missing durable queue, leftover demo credentials.

And it is enforced by an automated hardening suite with test names like `production_refuses_the_default_secret` and `signing_refuses_to_fall_back_to_the_hmac_secret`.

The argument: **a security control that lives in a document is a suggestion; one that fails the build is a guarantee.** A misconfigured deploy cannot reach an environment by accident, because the process will not start and the pipeline goes red before it gets the chance.

### Where that check lied to me

An early version of the startup check demanded RS256. The signing function, separately, quietly fell back to the HMAC secret when no key path was configured.

Boot passed. The check was satisfied. The **first token mint** then failed with `InvalidKeyError`.

The check was verifying the *setting*, not the *capability*. It confirmed that someone had written `RS256` in a config field; it never confirmed that a usable RS256 key existed. The fix was to verify at startup that the keys are present and parseable — to check the thing itself rather than the intention to do the thing.

The lesson is worse than "the check had a bug." A safety check that validates intent rather than reality is **worse than no check**, because it manufactures confidence. Without it I would have tested token minting by hand. With it, I trusted a green boot.

---

## Performance, measured

Three rounds of optimization. One was reverted.

| Round | Change | Slowest response under load | Verdict |
|---|---|---|---|
| Baseline | Hard-coded worker count, default pool sizing | 4,251 ms | Saturating early |
| 1 | Environment-driven concurrency, right-sized DB pool | 163 ms | Kept — 26× better |
| 2 | Query-level fixes: N+1 elimination, index coverage | ~27 ms avg | Kept |
| 3 | Parallelized Redis calls with `asyncio.gather` | 31.6 ms avg | **Reverted — measurably slower** |

Round 3 is the one I want to keep in the table. I was confident it would help: several independent Redis calls, obviously parallelizable, `asyncio.gather` is right there. It came back about 4.6 ms slower on average and I reverted it the same day. Sub-millisecond operations do not parallelize profitably — the coordination cost exceeded the work being coordinated. There was nothing to hide behind; the operations were simply too fast to be worth scheduling.

### Round 1 was a one-line Docker bug

The 26× did not come from clever code. The Docker image hard-coded `--workers 2` in its start command. uvicorn only consults the `WEB_CONCURRENCY` environment variable **when the `--workers` flag is absent**. So the variable was being silently ignored: a six-core host ran two workers with two-thirds of the machine idle, and every attempt to tune concurrency by environment did nothing at all.

The fix was deleting the flag. The same image is now correct on a laptop and on a large host, because the environment knob actually reaches the process.

I find this one instructive because the baseline number — 4,251 ms — looked like an architecture problem. It was a string in a Dockerfile.

### The read path, with the proof attached

Keyset (cursor) pagination throughout, with **no `OFFSET` anywhere**. The cost of fetching a page does not grow with how deep the page is, which is the failure mode that turns a fine-looking list endpoint into a timeout at page 400.

A composite index leading with the tenant column, `(team, booked_at, id)`. I did not assume it worked; I ran `EXPLAIN ANALYZE`:

```
WITH the index      Index Only Scan   0.05 ms   Heap Fetches: 0
WITHOUT it          Sort (full scan)  2.79 ms
```

55× on a small table. The multiple matters less than the shape: it is an index seek versus a sort, so the gap widens as the table grows rather than staying fixed.

Alongside that:

- A **partial index** covering only non-`COMPLETE` scoring statuses — about 1% of rows. Indexing the remaining 99% would have been a second copy of the table maintained on every write, for queries that never ask for it.
- **Whole-page joins**, so a 50-row page costs 2 queries instead of 101.
- All dashboard aggregates computed in **a single SQL pass with conditional counts**, rather than five separate queries assembled in Python.
- **Anchored prefix matching** (`external_ref%`) for search, because a leading wildcard forces a sequential scan and quietly discards the index you thought you were using.

### A portability decision I would make again

"Newest score per transaction" was first written with `LATERAL` — the natural Postgres tool for it, and the one I reached for without thinking.

The test suite runs on SQLite by design, where `LATERAL` is a syntax error. So the fastest query in the read path was the one query no test could execute.

I rewrote it as a portable, still index-backed `NOT EXISTS`. The principle: **a query the tests cannot execute is a query nobody checks.** Same reasoning applied to time-bucketing, where `date_trunc` became a form that also works with `strftime`.

### Methodology, because the numbers are worth exactly what the method is worth

**Load generation is open-loop.** Requests are offered at a fixed rate regardless of how fast the server responds, because that is how real traffic arrives — users do not politely wait for your p99 before clicking again. A closed-loop generator that waits for each response before sending the next hides the precise saturation you are hunting for. That is coordinated omission, and it makes a struggling system look calm.

**Five runs minimum before trusting any number.** A single run swings ±20% on cold caches. I published figures of 96 ms, then 69.9 ms, then 56.9 ms during Round 2 and later retracted all three as cold-start contaminated. The honest figure was around 27 ms. Those retractions are the reason I trust the 27.

**A benchmark that lied, caught before it shipped.** An early micro-benchmark showed tuples were 4.5× faster than lists. The result was wrong: the benchmark used *constant* tuples, which CPython folds at compile time into a single `RETURN_CONST`. It was measuring the interpreter returning a pre-built object — that is, measuring nothing. Re-measured with variables: 26.6 ms vs 33.4 ms. A real difference, and a much smaller one. **Verify the ruler before trusting the reading.**

**Two more predicted wins that were not.** `ORJSONResponse` turned out to be deprecated on the FastAPI version in use, and worse, it opted *out* of the faster Pydantic-direct serialization path — so the "optimization" was a regression. Reverted. Setting `n_jobs=-1` on the Isolation Forest: 12.42 ms versus 12.17 ms, which is noise. I recorded that one specifically so nobody on the project would spend an afternoon repeating it.

**One number I refused to publish.** I could not measure the system's true throughput ceiling, because the load generator competed with the server for the same cores. The evidence: three generators offering 75 rps together achieved only 32.3 rps, while the API sat at 146% of a possible 400% CPU and the client was 2.1% idle. The server was not the bottleneck; my measuring apparatus was. The correct conclusion is "this number is not knowable from this machine," and that is what went in the report instead of a flattering estimate.

**The track record, stated plainly:** three optimizations I predicted would help — parallelized Redis, ORJSON, `n_jobs=-1` — all failed when measured. The two changes that actually mattered were found by measuring, not by reasoning. That is the entire thesis of this section, and it is why the reverted row stays in the table.

---

## The container

Multi-stage build, final image **358 MB**. The compiler and development headers never reach the runtime image, compiled libraries are stripped, and test directories and bytecode caches are excluded.

The larger win was deciding what does not belong at runtime at all. Training-only libraries — pandas, shap, kagglehub, matplotlib — are deliberately omitted from the runtime image. Roughly a gigabyte of code that never executes in production, and every line of it part of the attack surface if it ships.

`xgboost-cpu` rather than plain `xgboost`, because the standard wheel pulls in NVIDIA CUDA libraries — 288 MB — into a container with no GPU.

---

## What running it revealed

Every bug in this section shares a property: reading the code did not find it, and executing the code did.

### The 0-of-61 adapter

Already described above: four missing identity fields, no error at the boundary, zero transactions scored, unbounded backlog, and every health signal green. The failure mode was silence. I found it by asking the database how many scores existed, not by reading the integration.

### A score of 92.84 stored as 1.0

The risk engine publishes `risk_score` on a **0–100** scale. My integration clamped it to 0–1.

So 92.84 was silently stored as 1.0. Not an error, not a crash — a completely plausible number. A confidence score of 1.0 looks like a maximally confident model. It was actually a clamp ceiling.

I caught it because 1.0 looked suspiciously clean sitting next to a `weighted_score` of 93.96. That is a bad detection mechanism. It relies on my noticing.

The fix documented the scale in *both* places and added regression tests that assert the scale explicitly — because this was the **second** unit-mismatch bug on the same boundary. The first: SHAP contributions bounded to [-1, 1], when SHAP values are unbounded log-odds and one real observed value was -8.84. Two bugs of the same species on the same seam meant the seam needed a test, not another careful read.

### A CI pipeline that had never run once

I added a CI pipeline and reported it as done without ever executing it.

Its first real run failed at the install step:

```
error: Multiple top-level packages discovered in a flat-layout: ['app', 'secrets', 'postman', 'alembic']
```

`pyproject.toml` never told setuptools which directory was the package. Behind that sat a second bug: `email-validator` was listed in the Dockerfile's hand-maintained dependency list but missing from `pyproject.toml`.

The root cause of both was **dependency-list drift**. Docker installed from one list, CI from another. Docker builds worked. The live deployment worked. CI could never have passed, and I would not have known until someone ran it.

*A pipeline you have not run is not a pipeline.* That one is mine to own.

---

If your fraud stack looks healthy on paper but never produces reliable alerts, the issue is rarely the model alone. It is often the signal pipeline, policy enforcement, or the audit trail around the decision. I help teams design and harden these systems so they fail loudly, prove the signal is reaching the right place, and remain explainable under operational pressure.

If you are building or reviewing a fraud-detection platform and want a second opinion on the architecture, data contracts, or risk workflow, I would be happy to talk.

### A validator that was dead code

A custom Pydantic validator existed to accept comma-separated CORS origins. It never ran. `pydantic-settings` JSON-decodes list-typed environment variables *before* any custom validator is reached, so a plain comma-separated value hard-crashed with a `JSONDecodeError` — from code written specifically to prevent that.

It looked correct in review. It had never once been exercised.

### Silent data loss behind a passing environment

Tearing down the local stack with `docker compose down -v` wiped the volume. Migrations re-ran automatically on the next boot; seeding did not. The result was a valid schema with zero users, where every login returned 401 and nothing anywhere reported a problem.

It recurred four times before I stopped treating it as an environment quirk and root-caused it. Fixed permanently with an idempotent `--if-empty` seed step wired into the compose stack.

### Three shell bugs that produced confidently wrong output

In the bash load-test harness:

- A `$(...)` command substitution ran authentication in a subshell, so the token never reached the parent. Every request 401'd.
- `$BASHPID` inside a command substitution named the *substitution's* subshell, so curl wrote one file while jq read another. Every response appeared to be missing its scoring field.
- `mawk` rejects function definitions inside rule blocks, so every percentile printed blank.

None of these errored loudly. All three produced output that looked like a finding. A measurement harness that is wrong is more dangerous than one that is broken, because a broken one tells you.

---

## Deploying it

Containerized backend, managed Postgres, managed Redis, separately hosted frontend, on a managed platform.

Two failures worth writing down because both cost real time:

Async Postgres drivers reject `sslmode=require`. It is a psycopg-only parameter; the async drivers want `ssl=require`. Every managed database that mandates TLS hits this, and the error does not point at the parameter.

A non-root container cannot read a mounted secret file whose permissions are locked to a different host UID. Correct container hardening plus correct file permissions, combining into a failure. Both sides individually right.

---

## Delivering it

Four things I did on the delivery side that I would do again.

**The client-facing deliverable included a "what this does not prove" section.** Synthetic data is not evidence of production performance. Recall cannot be reported, because reporting it requires knowing about the frauds that were never flagged. Precision is meaningless until analysts have closed real cases. Naming those limits made every other claim in the document more believable, which is the opposite of what it feels like while writing it.

**The metrics endpoint refuses to report recall.** It returns a note explaining why instead of a number. Declining to publish a flattering-but-unknowable metric is an engineering decision, and it is enforced in code rather than left to whoever writes the next slide.

**Scope discipline.** The client said explicitly: don't spend time on full production hardening yet. So the work was scoped to a staging-quality deployment, and the deferred hardening was listed explicitly — not silently skipped, and not silently gold-plated on their budget.

**Every limitation was paired with its remediation path.** No open wounds in client-facing material. A limitation with a plan is a roadmap item; a limitation without one is a liability.

---

## What this does not prove

- **Nothing here is evidence of production banking performance.** Synthetic data, synthetic holdout, non-production hardware. PR-AUC 0.993 on PaySim-derived data says the pipeline works end to end. It says nothing about real adversaries, who adapt.
- **Throughput ceiling: unmeasured.** Not "high" — unmeasured, for the reason given above. Establishing it needs a load generator on separate hardware.
- **Detection quality against adaptive fraud: unknown.** Synthetic fraud does not change behavior when you start catching it. Real fraud does.
- **It is a proof of concept on staging**, not a production system. The deferred hardening is deferred, and it is written down.

What would come next: load generation from isolated hardware to get a real ceiling, a shadow-mode period against live traffic before any decision is enforced, and analyst feedback loops closed so precision becomes measurable at all.

---

## What I would do differently

The dependency-list duplication.

Docker installed from a hand-maintained list in the Dockerfile. CI installed from `pyproject.toml`. They drifted, and because Docker was the path that actually ran, the drift was invisible until CI ran for the first time and could not install the application.

I fixed the symptom — the missing package, the setuptools configuration — and CI went green. I did not fix the cause. There are still two lists, and nothing prevents them from diverging again the next time someone adds a dependency in a hurry. The correct fix is one source of truth with the Dockerfile installing from `pyproject.toml` directly, and I know that, and it is not done.

That is the honest answer to "what would you change," because it is the one thing on this list that is still a known open weakness rather than a solved problem. Everything else in this article either shipped or got reverted with a measurement attached.
