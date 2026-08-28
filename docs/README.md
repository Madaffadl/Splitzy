# Splitzy — Documentation

**Read time: 5 minutes.** This page is the entry point. It assumes no technical background. Every
claim links to the document that evidences it.

---

## 1. What Splitzy is

Splitzy is an **Indonesian bill-splitting web app**. You photograph a restaurant receipt, its AI
reads the items and prices, you tap which person had what, and it tells everyone exactly what they
owe — down to a fair share of the tax, service charge and any discount.

It runs in a browser and installs to a phone's home screen like an app, without an app store.

**Who it is for:** groups of friends splitting a meal, and travellers sharing costs across a whole
trip. [personas.md](./product/personas.md) · [product-vision.md](./product/product-vision.md)

**What makes it different:** most splitting apps ask you to type in a total and divide it. Splitzy
starts from the receipt itself and splits **by what each person actually consumed**, then distributes
tax and service proportionally. Nobody argues about the person who only had a coffee.
[value-proposition.md](./product/value-proposition.md)

---

## 2. What it does today

Three ways to use it, all live:

| Mode | For | Sign-in? |
|---|---|---|
| **Single receipt** | One bill, one group | No |
| **Multiple receipts** | Several bills settled together | Yes |
| **Travel spend** | A whole trip, multiple people paying, shared ledger | Yes |

Around it: Google sign-in, saved history, a shareable read-only summary link you can send on
WhatsApp, trip invitations, Indonesian and English throughout most of the product, offline use, a
referral scheme, and an admin area.

**79 features** are catalogued. 64 are fully built and working, 3 are built but switched off behind
a flag, 7 are partly built, and 5 are described somewhere but not implemented.
[feature-catalog.md](./product/feature-catalog.md)

**Not yet earning money.** Paid "Pro" tiers are fully built — pricing page, checkout, payment
provider, entitlements — and turned **off** behind a feature flag. Someone made a deliberate
decision to build it and wait. [product-overview.md](./product/product-overview.md)

---

## 3. How it is built, in one paragraph

A modern web application (Next.js 16 / React) with a PostgreSQL database hosted on Supabase, Google
sign-in, and Google's Gemini AI reading the receipts. The money calculations are pure, isolated code
with no network or interface mixed in — which is why they are the best-tested part of the system. The
app works offline and syncs changes back when the connection returns.
[system-overview.md](./architecture/system-overview.md) ·
[architecture.md](./architecture/architecture.md)

---

## 4. The honest assessment

### What is genuinely good

**The maths is right, and it is proven.** Every rounding remainder is deliberately assigned to
someone, so the parts always sum exactly to the total. 648 automated tests cover this.
[test-strategy.md](./qa/test-strategy.md)

**Offline handling is unusually sophisticated** for a product this size — a durable queue,
conflict detection, no lost edits. [architecture.md](./architecture/architecture.md)

**Security discipline is consistent.** Every one of the 54 server endpoints applies the same
protections in the same order. The AI's output is treated as untrusted and validated before use.
[security-audit.md](./security/security-audit.md)

**Documented decisions.** Where the original author deferred a hard question, they wrote it down in
the code rather than leaving it silent. That is rare and it made this analysis much faster.

### What is not

**One live security defect was found and fixed during this review.** A page that was supposed to
require sign-in was serving itself to anyone. The fix is deployed and verified. The concerning part
is not the bug — it is that **no test in the entire codebase would have caught it**, and it was found
only by opening the app in a browser. [ux-audit.md](./ux/ux-audit.md)

**The product cannot see itself.** It does not record when someone finishes a split, and it does not
report errors that were caught rather than crashed. So nobody can currently answer *what fraction of
visitors succeed* or *what is failing in production*. Both tools are installed and half-wired.
[analytics-monitoring.md](./architecture/analytics-monitoring.md)

**A surprising amount of finished work is unreachable.** A CSV export with its own tests and no
button. A delete function, fully built and secured, that nothing calls. Ten server endpoints nobody
uses. [product-gaps.md](./analysis/product-gaps.md)

**The share page — the one screen non-users actually see — is in English only,** in an Indonesian
market, and it is the page that asks someone to transfer money.
[ux-debt.md](./analysis/ux-debt.md)

**Fabricated social proof is live.** The landing page carries invented user counts and three named
testimonials from people who do not exist. Notably, the team understood the risk well enough to add
an automated test blocking star-rating markup — but left the claims on the page.

---

## 5. What to do about it

Four weeks of work covers nearly everything with a real payoff.
Full plan: [roadmap.md](./product/roadmap.md)

| Phase | Effort | What it achieves |
|---|---|---|
| **0 — Verify** | ½ day | Answer four questions only a dashboard can answer. Two could delete work from Phase 1 |
| **1 — Critical stability** | 1 week | Close the remaining path to the bug that was just fixed, and make sure the next one is caught by a test |
| **2 — Make it visible** | 1 week | Turn on the measurement and error reporting that are already installed |
| **3 — Finish what exists** | 2 weeks | Connect the built-but-unreachable work; fix accessibility; translate the share page |
| **4 — Harden** | 3 weeks | The remaining security findings, performance, structure |
| **5 — Product bets** | — | Decide with data, not with this document |

**If you only do one thing:** Phase 0. It is half a day of reading configuration screens, and it
could remove a week of Phase 1 work — or reveal that live payment code is running untested.

**64 improvement items** are catalogued, prioritised and traced to evidence.
[product-backlog.md](./product/product-backlog.md) (stakeholder view) ·
[improvement-backlog.md](./analysis/improvement-backlog.md) (full detail)

**42 of the 64 are small** — under a day each. This is a product that needs finishing, not rebuilding.

---

## 6. Documentation index

**50 documents produced by this project**, plus the 4 operations documents the team had already
written (listed last, and left untouched). Everything in the first group was produced by reading the
source code, running the test suite, building the application, and rendering it in a real browser.

### Start here
| Document | What it answers |
|---|---|
| [product/product-overview.md](./product/product-overview.md) | What the product is and what state it is in |
| [architecture/system-overview.md](./architecture/system-overview.md) | How it is built, at a glance |
| [product/roadmap.md](./product/roadmap.md) | What to do next, in order |

### Architecture — how it works *(Phase A)*
| Document | Covers |
|---|---|
| [system-overview.md](./architecture/system-overview.md) | The whole system in one read |
| [architecture.md](./architecture/architecture.md) | Layers, data flow, local-first sync |
| [frontend.md](./architecture/frontend.md) | Components, routing, state |
| [backend.md](./architecture/backend.md) | Server handlers, services, validation |
| [authentication.md](./architecture/authentication.md) | Google sign-in and sessions |
| [authorization.md](./architecture/authorization.md) | Who may do what, and where it is enforced |
| [ai-integration.md](./architecture/ai-integration.md) | Gemini receipt scanning |
| [analytics-monitoring.md](./architecture/analytics-monitoring.md) | What is measured (and what is not) |
| [i18n-localization.md](./architecture/i18n-localization.md) | Indonesian and English |
| [pwa.md](./architecture/pwa.md) | Installability, offline, service worker |
| [integrations.md](./architecture/integrations.md) | External services |

### Database *(Phase A)*
[data-model.md](./database/data-model.md) · [entities.md](./database/entities.md) ·
[relationships.md](./database/relationships.md) · [erd.md](./database/erd.md)

### API *(Phase A)*
[api-overview.md](./api/api-overview.md) · [endpoints.md](./api/endpoints.md) — all 54 endpoints

### Flows *(Phase A)*
[authentication.md](./flows/authentication.md) · [expense-flow.md](./flows/expense-flow.md) ·
[split-bill-flow.md](./flows/split-bill-flow.md) ·
[settlement-flow.md](./flows/settlement-flow.md) · [ai-scan-flow.md](./flows/ai-scan-flow.md)

### Product *(Phase B)*
| Document | Covers |
|---|---|
| [product-overview.md](./product/product-overview.md) | State of the product |
| [product-vision.md](./product/product-vision.md) | What it is trying to be |
| [personas.md](./product/personas.md) | Who uses it |
| [value-proposition.md](./product/value-proposition.md) | Why they would |
| [feature-catalog.md](./product/feature-catalog.md) | All 79 features with status |
| [user-journeys.md](./product/user-journeys.md) | End-to-end paths |
| [product-backlog.md](./product/product-backlog.md) | 65 prioritised items *(Phase D)* |
| [roadmap.md](./product/roadmap.md) | Five phases *(Phase D)* |

### Requirements *(Phase B)*
| Document | Covers |
|---|---|
| [functional-requirements.md](./requirements/functional-requirements.md) | 79 requirements |
| [non-functional-requirements.md](./requirements/non-functional-requirements.md) | 86 quality + 43 reverse-engineered |
| [user-stories.md](./requirements/user-stories.md) | 60 stories |
| [acceptance-criteria.md](./requirements/acceptance-criteria.md) | 162 criteria, with test coverage |
| [business-rules.md](./requirements/business-rules.md) | 94 rules extracted from code |
| [traceability-matrix.md](./requirements/traceability-matrix.md) | Feature → requirement → story → test |

### UX *(Phase C)*
| Document | Covers |
|---|---|
| [screen-inventory.md](./ux/screen-inventory.md) | All 22 screens |
| [information-architecture.md](./ux/information-architecture.md) | Navigation and hierarchy |
| [user-flows.md](./ux/user-flows.md) | Step-by-step interaction paths |
| [ux-audit.md](./ux/ux-audit.md) | 23 findings, many measured in a browser |
| [design-system.md](./ux/design-system.md) | Tokens, components, typography |

### Security *(Phase C)*
[security-audit.md](./security/security-audit.md) — 33 controls, what is enforced and where.

> Specific exploitable detail is held in a **private, git-ignored** file and is deliberately not part
> of this public documentation. This page and the backlog reference those findings **by identifier
> only**.

### Quality *(Phase C)*
[test-strategy.md](./qa/test-strategy.md) · [test-cases.md](./qa/test-cases.md) (118 cases) ·
[regression-suite.md](./qa/regression-suite.md)

### Analysis *(Phase D)*
| Document | Covers |
|---|---|
| [product-gaps.md](./analysis/product-gaps.md) | 34 gaps between what is documented and what exists |
| [technical-debt.md](./analysis/technical-debt.md) | 32 debt items |
| [ux-debt.md](./analysis/ux-debt.md) | 14 UX debt items |
| [improvement-backlog.md](./analysis/improvement-backlog.md) | 64 open items, full detail |

### Operations *(pre-existing, written by the team)*
[API_VERSIONING.md](./API_VERSIONING.md) · [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) ·
[ENVIRONMENT_ISOLATION.md](./ENVIRONMENT_ISOLATION.md) · [PWA_ICONS.md](./PWA_ICONS.md)

---

## 7. How to read the evidence labels

Every claim in this documentation carries one:

| Label | Means |
|---|---|
| **[IMPLEMENTED]** | Verified in source code, a test run, a build, or a browser |
| **[INFERRED]** | A reasonable conclusion from evidence, stated as such |
| **[ASSUMED]** | A working assumption, flagged so it can be challenged |
| **[UNKNOWN]** | Not determinable from the repository — needs a person or a dashboard |
| **[TECHNICAL-ONLY]** | Reflects code analysis alone; needs business validation |

---

# Final Assessment

Scored 1–10. **Conservative convention:** where a fact is **[UNKNOWN]**, the score assumes the less
favourable answer, and states what it becomes if the favourable one is true.

## Product maturity — **6 / 10**

Three complete, coherent modes serving a real and specific job, with a genuine differentiator
(consumption-based splitting from a photographed receipt). It works end to end today.

Held back by: the product computes who owes whom and then stops — no reminders, no notifications, no
way for a participant to see their own obligations. Revenue is built and switched off. Five described
features do not exist, seven are partly wired. It is a complete tool, not yet a complete product.

## Technical maturity — **7 / 10**

The strongest dimension. Clean layering, a pure and thoroughly-tested money engine, a genuinely
sophisticated offline sync layer with a durable outbox and optimistic locking, uniform server-side
validation, and a coherent design system. 648 tests across 36 files, all green.

Held back by: two files over 1 000 lines, an unfinished data migration leaving two orphaned tables
and ten dead endpoints, hand-applied database migrations with no history, and — most consequentially
— **CI does not block deployment**, so all of the above is advisory.

## Security maturity — **5 / 10**

*Assumes Row Level Security is **not** enabled. If it is, this becomes **6.5**.*

Consistent per-endpoint discipline: authentication, CSRF, rate limiting and schema validation applied
in the same order everywhere, with AI output treated as untrusted. That uniformity is real strength.

Held back by: application code is the **only** authorization layer, and **no test anywhere asserts an
authorization rule** — a live auth bypass was found by rendering the app, not by the test suite. A
dependency advisory covering exactly this class of failure is still open. Eleven further findings
remain, none critical.

## UX & accessibility maturity — **6 / 10**

Real craft in places: honest empty states, validation that disables the action and says why,
consistent error patterns, careful contrast work documented in the stylesheet, full bilingual support
in the core product.

Held back by: the craft is **unevenly applied**. Five screens have no top-level heading while
marketing pages assert theirs in automated tests. The dashboard silently renders nothing on failure
while five other screens handle it well. Dark mode's primary button colour measures 3.27:1 —
below the accessibility threshold, everywhere. The share page is English-only. Nine of fourteen UX
debt items are the same shape: *a good pattern exists here and was not extended.*

## Operational readiness — **4 / 10**

*Assumes the retention job is unscheduled and the monitoring keys are unset. If both are configured,
this becomes **6**.*

Disaster recovery, environment isolation and API versioning are documented by the team, and an
automated backup workflow exists.

Held back by: the product is effectively **flying blind** — the conversion event never fires, handled
errors are never reported, and no source maps are uploaded. A documented data-retention policy has no
confirmed schedule, meaning expired share links containing bank details may persist indefinitely. CI
is not a deploy gate. Dependency advisories are invisible to the pipeline.

---

## Overall — **5.6 / 10**

**[INFERRED]** The distribution matters more than the average. Splitzy scores well where things are
*hard* — correct money maths, offline conflict resolution, uniform request handling — and poorly
where things are *easy but unglamorous*: firing one analytics event, scheduling one cron job, adding
one heading, writing the test for the rule that matters most.

That is an encouraging shape. Capability gaps take quarters to close. **Completion gaps take weeks**,
and four of the five weakest scores rise materially on work already itemised in
[roadmap.md](./product/roadmap.md) Phases 0–3.

The single most valuable half-day available is Phase 0: four dashboard lookups that could remove a
week of Critical work, or reveal that untested payment code is already live.

---

*Produced by reverse-engineering the codebase across four phases: architecture and data model,
features and requirements, UX / security / PWA / QA, and gap analysis. No claim here rests on
anything other than the source code, a test run, a production build, or the application rendered in
a browser.*
