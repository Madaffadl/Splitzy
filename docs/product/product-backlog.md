# Splitzy — Product Backlog

> **Placeholder.** The groomed, estimated and prioritised backlog is a **Phase D** deliverable.
>
> What follows is the **raw candidate list** produced as a by-product of Phases A and B: every gap,
> orphan and recommendation found while reading the code, gathered in one place with its evidence.
> It is deliberately **unprioritised and unestimated** — sequencing is the product owner's call, and
> several items depend on answers only they have (see [roadmap.md](./roadmap.md) §Questions).

**Source key:** `FR` functional requirement · `RNFR` recommended non-functional requirement ·
`TM §n` traceability-matrix section · `BR` business rule

---

## A — Unreachable functionality (built, tested, no user can use it)

| # | Candidate | Evidence | Note |
|---|---|---|---|
| A1 | Wire up **CSV export**, or delete the module | FR-065a, TM §10.1 | 110 lines with its own unit-test file and zero callers |
| A2 | Add a **delete** affordance for saved splits | FR-063, US-046 | API, service method and restore endpoint all exist |
| A3 | Add an **undo** for that deletion | FEAT-058 | The restore endpoint is already idempotent |
| A4 | Use or remove the **`EmptyState`** component | TM §10.1 | Zero consumers |
| A5 | Remove or use the 5 unused `supabaseDataService` methods | TM §10.3 | `ReceiptHistoryList` bypasses the service entirely |
| A6 | Decide the fate of the **legacy `/api/trips/*`** family | TM §10.2 | 10 endpoints, no caller, fully writable |

## B — Measurement

| # | Candidate | Evidence |
|---|---|---|
| B1 | **Fire `split_completed`** — the core conversion event | RNFR-026, TM §10.4 |
| B2 | Fire `mode_selected` | RNFR-030 |
| B3 | Call `identify()` on sign-in and `reset()` on sign-out | RNFR-029 |
| B4 | Move the four literal event names into `EVENTS` | RNFR-030 |
| B5 | Upload **Sentry source maps** (`withSentryConfig`) | RNFR-027 |
| B6 | Add `captureException` on handled failures — payments, sync, email, referral, outbox | RNFR-028 |
| B7 | Supply `ErrorBoundary.onError` | RNFR-028 |
| B8 | Send the `share.created` beacon, or drop it from the allowlist | TM §10.4 |
| B9 | Add API latency / error-rate monitoring and payment-failure alerting | RNFR-031 |

## C — Test coverage where risk actually sits

| # | Candidate | Evidence |
|---|---|---|
| C1 | **Authorization regression tests** — 403/404 for non-owner, non-member, non-admin | RNFR-013, TM §12 |
| C2 | Optimistic-locking tests (409 paths) | BR-087, AC-120 |
| C3 | Quota-enforcement tests, including the guest bypass | BR-059, AC-082 |
| C4 | Webhook idempotency test | BR-069, AC-134 |
| C5 | Admin audit-transaction test | BR-073, AC-142 |
| C6 | CSRF same-origin test | BR-088 |
| C7 | An E2E test that completes an actual split | AC coverage analysis |
| C8 | Automated accessibility testing in CI | RNFR-022 |

## D — Security & data

| # | Candidate | Evidence |
|---|---|---|
| D1 | Enable **Supabase RLS**, with policies committed to `prisma/sql/` | RNFR-014 |
| D2 | Move CSP from report-only to enforcing; remove `'unsafe-inline'`/`'unsafe-eval'` | RNFR-015 |
| D3 | Constant-time comparison for `XENDIT_WEBHOOK_TOKEN` and `CRON_SECRET` | RNFR-016 |
| D4 | Extract the handler pipeline into a `withAuth(...)` wrapper | RNFR-017 |
| D5 | Apply the ban guard to `/api/auth/me`; consider session revocation on ban | FR-008, RNFR-018 |
| D6 | Rate-limit `/api/fx-rate` — currently public, keyless, unlimited | NFR §5 |
| D7 | Change `GET = POST` on `/api/admin/cleanup` so a GET cannot hard-delete | FEAT-074 |
| D8 | Remove the personal email seeded in `prisma/sql/add_user_role.sql` | NFR §5 |
| D9 | Document `CLEANUP_TOKEN` and `NEXT_PUBLIC_APP_URL` in `.env.example` | Phase A §3 |
| D10 | Decide whether `paymentInfo` belongs in a 14-day public share snapshot | data-model §10 |

## E — Correctness & reliability

| # | Candidate | Evidence |
|---|---|---|
| E1 | Make the AI quota check atomic | RNFR-006, BR-063 |
| E2 | Add an idempotency key to `TripPayment` | RNFR-011 |
| E3 | Preserve a discarded outbox op so the receipt content is recoverable | RNFR-012 |
| E4 | Warn when an item is assigned to nobody — the cost silently moves to the payer | RNFR-034, BR-005 |
| E5 | Surface `needsFxRate` wherever a converted total is shown | RNFR-035, BR-039 |
| E6 | Confirm the retention cleanup job is scheduled | FR-074 |
| E7 | Configure an uptime monitor against `/api/health` | RNFR-008 |
| E8 | Run a DR drill to validate the stated RTO | RNFR-009 |

## F — Localisation

| # | Candidate | Evidence |
|---|---|---|
| F1 | Translate `/s/<code>` and `/share` — the primary non-user touchpoint | RNFR-041 |
| F2 | Translate `/privacy` and `/terms` | RNFR-042 |
| F3 | Translate `/pricing`, `/dashboard`, `/history`, `/invite` | FR-078 |
| F4 | Localise server-side API error messages surfaced in toasts | FR-078 |
| F5 | Localise the welcome email; fix its hardcoded personal `reply_to` | FEAT-069 |
| F6 | Generalise `alternateLanguages()` and `LocaleSwitcher` beyond two locales | RNFR-043 |

## G — Product decisions already flagged in the code

| # | Candidate | Where it is recorded |
|---|---|---|
| G1 | Make `/multiple` publicly viewable read-only so it can be indexed | `app/sitemap.ts` comment |
| G2 | Revisit whether trip members should ever write directly | `trip-access.ts` |
| G3 | Revisit a custom PWA install prompt once telemetry exists | `PwaInstallTelemetry.tsx` |
| G4 | Replace or remove the placeholder stats and testimonials | `structured-data.ts`, RNFR-036 |
| G5 | Decide whether *"Priority AI processing"* is built or removed | `billing/plans.ts` |
| G6 | Decide whether guest AI scanning stays unmetered | BR-059 |

## H — Absent capabilities (only if the product wants them)

Listed because they are conventional in this category, **not** because their absence is a defect.
Several may be deliberate scope choices.

| # | Candidate | Note |
|---|---|---|
| H1 | Profile editing | FR-011 |
| H2 | Account deletion | FR-012 — currently impossible; five `Restrict` FKs |
| H3 | Persistent groups (as opposed to episodic trips) | Competitive gap |
| H4 | Recurring expenses | Competitive gap |
| H5 | A participant-side view ("all splits I'm part of") | Competitive gap |
| H6 | Push notifications / payment reminders | No `PushManager` anywhere |
| H7 | Percentage or custom-amount splitting | FEAT-034 — Splitzy splits by consumption only |
| H8 | Real settle-up in Single/Multiple modes | BR-033 — currently cosmetic and local |
| H9 | Receipt image retention | Images are discarded after the scan |

## I — Engineering health

| # | Candidate | Evidence |
|---|---|---|
| I1 | Decompose `TravelSpendView` (2 086 L) and `useTravelData` (1 128 L) | RNFR-020 |
| I2 | Adopt a migration tool with a history table | RNFR-019 |
| I3 | Fix the `TIMESTAMPTZ` vs `timestamp(3)` inconsistency in `referrals` | data-model §9 |
| I4 | Complete the Expand–Contract migration (`receipt_items`, `item_assignments`) | RNFR-007, TM §13 |
| I5 | Add a client data cache to stop refetch-on-every-mount | RNFR-002 |
| I6 | Migrate all rate limiting to the distributed path | RNFR-004 |
| I7 | Index `users.created_at` | RNFR-005 |
| I8 | Update the README — it states Next.js 15 and omits Travel, Pro and admin entirely | Phase A §2.1 |
| I9 | Add `loading.tsx` for streamed route transitions | FEAT-078 |
| I10 | Add an offline fallback page and a service-worker update prompt | RNFR-038, RNFR-040 |
| I11 | Exclude authenticated pages from the SW navigation cache | RNFR-039 |

---

## Counts

| Group | Items |
|---|---|
| A — Unreachable functionality | 6 |
| B — Measurement | 9 |
| C — Test coverage | 8 |
| D — Security & data | 10 |
| E — Correctness & reliability | 8 |
| F — Localisation | 6 |
| G — Flagged product decisions | 6 |
| H — Absent capabilities | 9 |
| I — Engineering health | 11 |
| **Total candidates** | **73** |

---

*Phase D will groom, estimate, prioritise and sequence these. Until then, this is an inventory —
not a plan, and not a recommendation about order.*
