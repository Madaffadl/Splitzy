# Splitzy — Roadmap

> **Placeholder.** The full roadmap is a **Phase D** deliverable. This file exists so Phase B's
> output structure is complete and so the raw material Phase D will need is captured while it is
> fresh.
>
> Nothing below is a commitment, a priority call, or a schedule. Sequencing and scope are the product
> owner's decisions.

---

## What Phase D will need, and where it already exists

| Input | Source |
|---|---|
| Everything the product does today | [feature-catalog.md](./feature-catalog.md) — 79 features with honest status |
| What is required but absent | [../requirements/functional-requirements.md](../requirements/functional-requirements.md) — 4 gaps, 7 partials, 3 dark |
| What is built but unreachable | [../requirements/traceability-matrix.md](../requirements/traceability-matrix.md) §10 |
| Quality and platform gaps | [../requirements/non-functional-requirements.md](../requirements/non-functional-requirements.md) — 43 recommendations, `RNFR-001` … `RNFR-043` |
| Where the risk actually sits | [traceability-matrix.md](../requirements/traceability-matrix.md) §12 — 12 untested high-risk rules |
| Strategic constraints | [product-vision.md](./product-vision.md) §3, §6 |

---

## Candidate themes emerging from Phase A + B

Unordered. Each is stated with the evidence that produced it, not with an assigned priority.

### T1 — Finish what is already built
Two complete, tested capabilities are unreachable (CSV export, delete a saved split); ten legacy
endpoints have no caller; three analytics constants are never fired. The cheapest available value in
the codebase, and the easiest to justify.

### T2 — Make the funnel measurable
`split_completed` is declared and never sent, `identify()` is never called, and Sentry has no
source-map upload and zero `captureException` calls. Until this changes, no claim about conversion,
retention or reliability can be validated — which also means no roadmap item after this one can be
evaluated.

### T3 — Close the authorization test gap
Twelve business rules covering authorization, money and integrity have no automated verification,
and the product has no database-level backstop (**[UNKNOWN]** whether RLS is enabled). The money
math is at 100 % coverage; the permission model is at 11 %.

### T4 — Decide the monetisation switch
Checkout and the webhook are complete and flag-disabled. Related open questions: whether unmetered
guest scanning is an accepted acquisition cost, and whether *"Priority AI processing"* is a promise
to implement or copy to remove.

### T5 — Complete the Indonesian experience
The share page — the product's primary non-user touchpoint — plus the legal pages, pricing,
dashboard, history and invite flow are all English-only, in a market that speaks Indonesian.

### T6 — Replace fabricated social proof
Landing statistics and testimonials are placeholders. The rating markup is deliberately withheld to
avoid a search-policy violation, which means the trust liability is understood but unresolved.

### T7 — Confirm and harden operations
Whether the retention cleanup job is scheduled; whether an uptime monitor exists; whether Preview
deployments point at a separate database; validating the stated RTO with a drill.

### T8 — Reduce structural debt
`TravelSpendView` (2 086 lines) and `useTravelData` (1 128 lines); the unfinished Expand–Contract
migration leaving `receipt_items` and `item_assignments` writable; hand-applied SQL with no
migration history.

### T9 — Product decisions deferred in code comments
Three are recorded in the source as open, with the reasoning already written down:
making `/multiple` publicly viewable in a read-only state (`sitemap.ts`);
whether trip members should ever write directly (`trip-access.ts`);
whether to revisit a custom PWA install prompt once telemetry exists (`PwaInstallTelemetry.tsx`).

---

## Questions Phase D must resolve before sequencing

Carried forward from Phases A and B; each blocks a real prioritisation decision.

| # | Question | Blocks |
|---|---|---|
| 1 | Is Row Level Security enabled on any table? | T3 |
| 2 | Is `POST /api/admin/cleanup` scheduled anywhere? | T7 |
| 3 | What are the production values of the four feature flags, and are the PostHog and Sentry keys set? | T2, T4 |
| 4 | Is Pro intended to launch, and on what trigger? | T4 |
| 5 | Is unmetered guest AI scanning an accepted cost? | T4 |
| 6 | Should CSV export and split deletion ship, or be deleted? | T1 |
| 7 | Is account deletion required? It is currently impossible at the schema level | T3, T8 |
| 8 | What is the intended fate of the placeholder stats and testimonials? | T6 |
| 9 | Should the legacy `/api/trips/*` family be retired? | T1, T8 |
| 10 | Is percentage / custom-amount splitting deliberately out of scope? | product scope |

---

*Phase D will supersede this file. Until then, treat it as an index into the evidence, not as a
plan.*
