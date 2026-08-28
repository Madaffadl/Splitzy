# Splitzy — Technical Debt

> **32 items** across seven categories, synthesised from Phases A–C.
>
> **Effort** Small ≈ under a day · Medium ≈ a few days · Large ≈ a week or more.
> **Severity** reflects the cost of leaving it, not the difficulty of fixing it.
>
> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[UNKNOWN]**

---

## Summary

| Category | Items | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| Architecture | 5 | 1 | 2 | 2 | — |
| Code quality | 5 | — | 1 | 3 | 1 |
| **Test coverage** | 6 | **1** | **3** | 2 | — |
| Dependency | 3 | — | 2 | — | 1 |
| Configuration | 5 | — | 2 | 2 | 1 |
| Documentation | 2 | — | — | 1 | 1 |
| Performance | 6 | — | 1 | 4 | 1 |
| **Total** | **32** | **2** | **11** | **14** | **5** |

**[INFERRED]** The debt is unusually *shallow* for a codebase this size — no tangled architecture, no
copy-paste sprawl, no mystery code. Its intent is documented better than most commercial projects.
The debt concentrates almost entirely in **assurance** (what verifies the code) and **completion**
(what was built and not connected), not in the code itself.

---

## Architecture debt

### TD-001
**Category** Architecture · **Severity** **Critical** · **Effort** Medium
**Description** No database-level authorization. Every access decision is TypeScript inside a route
handler; Prisma connects with a full-privilege string. No RLS policy exists in the repository.
**Location** `prisma/sql/` (absence), `src/lib/prisma.ts`
**Risk if left** A single missed guard in a single handler is a complete data breach with nothing
behind it. **This is not hypothetical — VULN-001 was exactly that class of mistake and it shipped.**
It has been fixed, but the structural property that allowed it is unchanged.
**Note** **[UNKNOWN]** whether RLS is enabled in the Supabase project (GAP-032).

### TD-002
**Category** Architecture · **Severity** High · **Effort** Medium
**Description** Unfinished Expand–Contract migration. The relational receipt model
(`ReceiptItem`, `ItemAssignment`) coexists with the JSON payload model that superseded it. Both are
writable.
**Location** `prisma/schema.prisma`, `src/app/api/trips/*`
**Risk if left** Two ways to represent the same thing, one of which is structurally incapable of
expressing a real split. Any new reader must learn both, and any new query must know which to trust.

### TD-003
**Category** Architecture · **Severity** High · **Effort** Medium
**Description** Guard-by-convention. The seven-step handler pipeline (CSRF → auth → rate limit →
load → authorize → validate → write) is a convention each handler re-implements by hand. Nothing
enforces the sequence.
**Location** every file under `src/app/api/`
**Risk if left** A new route is secure only if its author remembers all seven steps in order. The
pipeline is applied consistently today, which is a credit to discipline rather than to design.

### TD-004
**Category** Architecture · **Severity** Medium · **Effort** Small
**Description** Two parallel trip APIs. `/api/trips/*` (relational, 10 endpoints) and
`/api/travel/*` (payload, 18 endpoints). Only the latter is used.
**Location** `src/app/api/trips/`
**Risk if left** 10 fully-writable endpoints of live attack surface serving no user (GAP-023).

### TD-005
**Category** Architecture · **Severity** Medium · **Effort** Large
**Description** Single point of failure: Supabase is both the identity provider and the only
datastore, on a free tier with no managed backups.
**Location** `src/lib/prisma.ts`, `src/lib/supabase/*`
**Risk if left** Total outage on Supabase loss. Mitigated — genuinely well — by an owned daily
encrypted `pg_dump` and a written DR runbook, but the RTO of 4 hours is **[UNKNOWN]** because no
drill has been run.

---

## Code quality debt

### TD-006
**Category** Code quality · **Severity** High · **Effort** Large
**Description** `TravelSpendView.tsx` is **2 086 lines** — the largest file in the app, containing
the trip list, receipt editor, budgets card, members card, settle-up card, change-request review and
half a dozen dialogs.
**Location** `src/components/pages/TravelSpendView.tsx`
**Risk if left** It is where UX inconsistencies will accumulate, and the hardest file to change
safely. Not currently broken — it is well-organised for its size — but every future Travel feature
lands here.

### TD-007
**Category** Code quality · **Severity** Medium · **Effort** Large
**Description** `useTravelData.ts` is **1 128 lines** implementing a per-account mirror, a durable
outbox, a per-trip write queue, a load-sequence guard, sync-status derivation and a member proposal
buffer.
**Location** `src/hooks/useTravelData.ts`
**Risk if left** The most intricate logic in the product lives in one hook. It is well-tested
(`travel-outbox`, `travel-sync`, `useTravelData` specs) which materially reduces the risk — this is
Medium rather than High for that reason.

### TD-008
**Category** Code quality · **Severity** Medium · **Effort** Small
**Description** Magic strings across a fetch boundary. The scan client throws `__QUOTA__` and
`__TIMEOUT__` as `Error` messages and matches on them — duplicating the `code` field the response
already carries.
**Location** `src/components/receipt/ReceiptInput.tsx`
**Risk if left** Two sources of truth for the same signal; a `code` rename silently breaks the
client.

### TD-009
**Category** Code quality · **Severity** Medium · **Effort** Small
**Description** Two success shapes — `{ ok: true }` vs `{ success: true }` — split along the two
generations of handler (GAP-019).
**Location** `src/app/api/travel/*` vs `src/app/api/receipts/*`, `trips/*`
**Risk if left** Cosmetic now; a real cost for any future API consumer.

### TD-010
**Category** Code quality · **Severity** Low · **Effort** Small
**Description** Four handlers return errors without the `code` field the error contract promises:
`/api/auth/me`, `/api/cron/expire-pro`, `/api/admin/cleanup`, and the generic success of
`/api/trips/[id]/members`.
**Location** as listed
**Risk if left** The contract states `code` is stable and branchable; these four break that promise.

---

## Test coverage debt

The largest concentration, and the one that matters most.

### TD-011
**Category** Test coverage · **Severity** **Critical** · **Effort** Medium
**Description** **Zero tests assert any authorization rule.** No test anywhere checks that a
non-owner receives 403, that a non-member receives 404, or that a non-admin is refused.
**Location** `src/**/*.test.ts` (absence); 12 rules listed in
[../qa/test-strategy.md](../qa/test-strategy.md) §5
**Risk if left** This is the debt that already cost something. VULN-001 was a live authorization
bypass, found by rendering the app rather than by a test, and **a five-line test would have caught
it**. It is fixed; nothing prevents the next one.

### TD-012
**Category** Test coverage · **Severity** High · **Effort** Medium
**Description** Zero route-handler tests. All 36 Vitest files test pure modules. CSRF, quota
enforcement, optimistic locking, the admin audit transaction and webhook idempotency are verified
only by reading the code.
**Location** `src/app/api/**` (absence)
**Risk if left** Revenue correctness (TC-113, duplicate-webhook idempotency) is unverified, and
`FLAG_XENDIT_CHECKOUT` is one env var away from being live.

### TD-013
**Category** Test coverage · **Severity** High · **Effort** Small
**Description** No `npm audit` in CI. Nine high-severity advisories are currently invisible to the
pipeline.
**Location** `.github/workflows/ci.yml`
**Risk if left** Dependency vulnerabilities accumulate silently — including one that affects the
proxy this app depends on for route protection (TD-017).

### TD-014
**Category** Test coverage · **Severity** High · **Effort** Small
**Description** **No E2E test completes a split.** The 15 E2E tests are 13 SEO regressions and 2
navigation assertions.
**Location** `e2e/`
**Risk if left** The core user journey has no end-to-end coverage. Phase C demonstrated the wizard is
scriptable, so the cost is low and the gap is a choice.

### TD-015
**Category** Test coverage · **Severity** Medium · **Effort** Small
**Description** No coverage reporting, no threshold, no CI gate.
**Location** `vitest.config.ts`
**Risk if left** Coverage can erode without anyone noticing.

### TD-016
**Category** Test coverage · **Severity** Medium · **Effort** Small
**Description** `reuseExistingServer: !process.env.CI` in the Playwright config. Locally a stale
server from a previous build is reused, so tests can pass against old code.
**Location** `playwright.config.ts`
**Risk if left** False local passes — the exact failure mode that makes a developer trust a green run
they should not.

---

## Dependency debt

### TD-017
**Category** Dependency · **Severity** High · **Effort** Small
**Description** **9 high + 1 moderate advisories**, all with fixes available. The one that matters:
`next@16.2.10` carries a **Middleware / Proxy bypass in App Router** advisory covering the installed
range, plus a Server Actions DoS.
**Location** `package.json`
**Risk if left** Splitzy enforces route protection, canonical-host redirect, the `/en` redirect and
maintenance mode **entirely in the proxy**. An advisory that bypasses the proxy targets exactly that.
VULN-001 was one path to that failure and is fixed; **this is a second, independent path and remains
open.** Upgrading also clears `postcss` and `nanoid`.

### TD-018
**Category** Dependency · **Severity** High · **Effort** Small
**Description** No automated dependency scanning — no Dependabot, no Renovate, no audit step.
**Location** `.github/`
**Risk if left** See TD-013 and TD-017. Nothing surfaces the next advisory either.

### TD-019
**Category** Dependency · **Severity** Low · **Effort** Small
**Description** `lucide-react` is a dependency with **zero imports** (GAP-026).
**Location** `package.json`
**Risk if left** Dead weight, plus a `LucideIcon` type alias that actually resolves to Phosphor.

---

## Configuration debt

### TD-020
**Category** Configuration · **Severity** High · **Effort** Small
**Description** No migration history. There is no `prisma/migrations/`; schema changes are
hand-written SQL applied through the Supabase SQL editor.
**Location** `prisma/sql/`
**Risk if left** Drift between `schema.prisma` and production is detectable only by inspection. One
inconsistency already exists — `referrals` uses `TIMESTAMPTZ` where every other table uses
`timestamp(3)`. There are also no down-migrations.

### TD-021
**Category** Configuration · **Severity** High · **Effort** Small
**Description** CI is **not a deploy gate**. Vercel deploys from `main` independently, so a red CI
run does not block production.
**Location** `.github/workflows/ci.yml`, Vercel project settings
**Risk if left** The quality gate is advisory. Everything above it — tests, type-check, build — can
be bypassed by merging.

### TD-022
**Category** Configuration · **Severity** Medium · **Effort** Small
**Description** Two environment variables are used in code and absent from `.env.example`:
`CLEANUP_TOKEN` and `NEXT_PUBLIC_APP_URL`.
**Location** `.env.example`, `src/app/api/admin/cleanup/route.ts`, `src/lib/api-auth.ts`
**Risk if left** `CLEANUP_TOKEN` being unset means the cleanup route falls back to accepting the
`x-vercel-cron` header alone.

### TD-023
**Category** Configuration · **Severity** Medium · **Effort** Small
**Description** No environment validation at boot. Missing variables surface as runtime failures —
`process.env.NEXT_PUBLIC_SUPABASE_URL!` is non-null-asserted in three places.
**Location** `src/lib/supabase/*`, `src/proxy.ts`
**Risk if left** A misconfigured deploy fails at first request rather than at startup, and the error
does not name the missing variable.

### TD-024
**Category** Configuration · **Severity** Low · **Effort** Small
**Description** A real personal email address is committed in `prisma/sql/add_user_role.sql` to seed
the first admin, and `email.ts` hardcodes a personal Gmail as `reply_to` — inconsistent with
`BRAND.supportEmail`, the constant introduced specifically to remove personal channels.
**Location** as listed
**Risk if left** Targeting aid for the most privileged account; permanent in git history.

---

## Documentation debt

### TD-025
**Category** Documentation · **Severity** Medium · **Effort** Small
**Description** `README.md` is stale. It states **Next.js 15** (the project runs 16), and describes
only Single and Trip mode — omitting Travel Spend, Pro, referrals, the admin console, i18n and the
PWA entirely.
**Location** `README.md`
**Risk if left** The repository's front door misrepresents the product. Now especially visible, since
`docs/` describes it accurately.

### TD-026
**Category** Documentation · **Severity** Low · **Effort** Small
**Description** Seven orphaned comment headers in `globals.css` — *"Shimmer Effect"*, *"Rotating
Animation"*, *"Morphing Shape"*, *"Particle Float"* and others — with no rules beneath them.
**Location** `src/app/globals.css`
**Risk if left** Cosmetic; makes the file read as larger than it is.

---

## Performance debt

### TD-027
**Category** Performance · **Severity** High · **Effort** Medium
**Description** `GET /api/travel` returns **every** trip fully hydrated — participants, receipts,
members, payments — bounded only by `take: 200`.
**Location** `src/app/api/travel/route.ts`
**Risk if left** Response size grows with total historical usage, not with what the screen shows. The
code flags this itself: *"If genuinely large accounts appear, switch to summary list + lazy per-trip
detail loading."*

### TD-028
**Category** Performance · **Severity** Medium · **Effort** Medium
**Description** No client-side data cache. `/history`, the dashboard and the admin console refetch on
every mount.
**Location** `src/lib/data/supabase-data-service.ts` and direct `fetch` calls
**Risk if left** Redundant requests and visible re-loading on every navigation.

### TD-029
**Category** Performance · **Severity** Medium · **Effort** Small
**Description** The admin user list orders by `(created_at DESC, id DESC)` with an unindexed
`ILIKE '%…%'` search; `users.created_at` has no index.
**Location** `prisma/schema.prisma`, `src/app/api/admin/users/route.ts`
**Risk if left** Full scan plus sort on every admin page load. Trivial today, linear in user count.

### TD-030
**Category** Performance · **Severity** Medium · **Effort** Small
**Description** The FX rate cache is an unbounded in-process `Map`. The currency regex admits any
2–10 uppercase letters, so many thousands of distinct keys are reachable, with **no eviction and no
size cap** — unlike the rate limiter's map, which is capped at 10 000.
**Location** `src/app/api/fx-rate/route.ts`
**Risk if left** Slow per-instance memory growth, reachable by an unauthenticated caller (the
endpoint has no rate limit either).

### TD-031
**Category** Performance · **Severity** Medium · **Effort** Small
**Description** The AI quota check is read-then-write: `checkScanQuota` then `incrementScanCount` are
separate statements.
**Location** `src/lib/scan-quota.ts`
**Risk if left** Concurrent scans can exceed the monthly cap. Small overage, direct cost.

### TD-032
**Category** Performance · **Severity** Low · **Effort** Small
**Description** The in-memory rate limiter is per-instance; when its map hits 10 000 entries it is
**cleared wholesale**, resetting every bucket.
**Location** `src/lib/rate-limit.ts`
**Risk if left** Documented as best-effort, which is honest. The wholesale clear is a brief window
where all limits reset at once.

---

## What is *not* debt

Worth stating, because a debt register that only lists problems misrepresents the codebase.

| Property | Evidence |
|---|---|
| **Money math is exhaustively tested** | 100 % of 30 acceptance criteria; every rounding remainder deliberately assigned and asserted |
| **Intent is documented at the point of implementation** | Comments record the *failure that motivated the code*, not just what it does — `sticky-action-bar.tsx`, `globals.css`, `apply-change-ops.ts` |
| **Single-definition discipline** | Shared limits, event constants, audit slugs, plan prices and mode names each live in one module, several with drift-guard tests |
| **Bundle safety** | The `activity.ts` / `-server.ts` / `-client.ts` split keeps Prisma out of the client, applied consistently |
| **Offline durability** | A real outbox with op coalescing, retryable-vs-permanent classification and replay idempotency |
| **Concurrency** | Optimistic locking and atomic status claims used correctly wherever they matter |
| **Design tokens carry their reasoning** | Measured contrast ratios recorded beside the values |

---

## Remediation order

Ranked by risk removed per unit of effort, not by severity alone.

| # | Item | Severity | Effort | Why here |
|---|---|---|---|---|
| 1 | **TD-017** upgrade Next.js | High | Small | Closes the second path to the failure VULN-001 already demonstrated; clears two other advisories |
| 2 | **TD-011** authorization tests | Critical | Medium | The debt that already cost something |
| 3 | **TD-013 / TD-018** audit in CI | High | Small | One line; makes the next TD-017 self-reporting |
| 4 | **TD-001** enable RLS | Critical | Medium | Turns "one missed guard = breach" into "one missed guard = blocked query" |
| 5 | **TD-021** make CI a deploy gate | High | Small | Everything above is advisory until this is true |
| 6 | **TD-014** one E2E for the core journey | High | Small | Cheapest coverage of the most-used path |
| 7 | **TD-012** handler tests for billing | High | Medium | Must precede switching revenue on |
| 8 | **TD-025** fix the README | Medium | Small | The front door contradicts the documentation |
| 9 | **TD-002 / TD-004** retire the legacy trip API | High/Med | Medium | Removes surface area and two orphaned entities together |
| 10 | **TD-006 / TD-007** decompose Travel | High/Med | Large | Highest effort, no user-visible return — do it when Travel next needs a feature |
