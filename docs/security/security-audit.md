# Splitzy — Security Audit (posture & controls)

> **Public document.** It records *what controls exist and how they are implemented*.
> Specific exploitable detail — bypass paths, affected endpoints, reproduction — is kept out of this
> file and written to `docs/security/FINDINGS-PRIVATE.md`, which is **gitignored** and must never be
> committed.
>
> This was a **defensive code review plus a rendering pass** against a local production build.
> Nothing was attacked, and no live environment was probed.
>
> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[MISSING]** · **[UNKNOWN]** ·
> **[VISUAL-VERIFIED]**

---

## Executive summary

| Dimension | Assessment |
|---|---|
| **Application-layer authorization** | Consistently applied and well reasoned. Every endpoint gates itself; existence is not disclosed to non-members |
| **Input validation** | Thorough. Hand-written validators on every write shape, with bounds, cross-field rules and drift-guard tests |
| **CSRF, headers, secrets** | Solid. Same-origin enforcement on all mutations, full header set, no secret reachable from the browser |
| **Defence in depth** | **Weak.** No database-level authorization is present in the repository, so a single missed guard is a complete bypass |
| **Verification** | **Weak.** Zero automated tests assert any authorization rule |
| **One control did not hold** | Route protection failed for anonymous users — reproduced in a browser, then **fixed and re-verified**. See VULN-001 |
| **Dependencies** | **10 advisories (9 high, 1 moderate)**, including one that affects proxy behaviour in this exact Next.js version range |

**[INFERRED]** The security work here is above average for a project of this size — the reasoning is
written down, the patterns are consistent, and information disclosure has clearly been thought
about. Its weakness is not design but **assurance**: nothing tests the rules, and nothing backs them
up if one is missed.

---

## 1. Authentication

### SEC-001 — Identity provider
**Control** Supabase Auth, Google OAuth as the only method.
**Implementation** **[IMPLEMENTED]**
**Evidence** [useAuth.ts](../../src/hooks/useAuth.ts), [api/auth/callback](../../src/app/api/auth/callback/route.ts)
**Notes** No passwords exist, so password strength, reuse, rotation and reset are out of scope
entirely. Verified by grep: only `getUser`, `onAuthStateChange`, `signInWithOAuth`, `signOut` and
`exchangeCodeForSession` are used.

### SEC-002 — Session transport
**Control** JWT access + refresh tokens in HTTP cookies written by `@supabase/ssr`; never in
`localStorage`.
**Implementation** **[IMPLEMENTED]** · **Evidence** `@supabase/ssr` defaults
**Notes** Cookie attributes are set by the library, not by application code. `SameSite=Lax` is
relied upon by the CSRF design (SEC-017). `Secure` and `httpOnly` are **[INFERRED]** from library
defaults — not asserted anywhere in this repository, and not verifiable from source.

### SEC-003 — Session refresh
**Control** Refreshed at the edge on every matched navigation; refreshed cookies are copied onto
redirects so no loop occurs.
**Implementation** **[IMPLEMENTED]** · **Evidence** [src/proxy.ts](../../src/proxy.ts)

### SEC-004 — Route protection (edge)
**Control** `/multiple` and `/history*` require a session.
**Implementation** ✅ **[IMPLEMENTED]** — was broken, now fixed. See **VULN-001** (private).
**Evidence** [src/proxy.ts](../../src/proxy.ts) `protectedPaths`
**Notes** **[VISUAL-VERIFIED]** This audit found an anonymous request to `/multiple` returning HTTP
200 with the complete tool — the guard tested `status !== 401`, but a session-less request throws
`AuthSessionMissingError` with status **400**. Fixed after the audit: the guard now matches on
`isAuthRetryableFetchError`, and `MultipleReceiptView` gained a page-level gate so the route no
longer depends on the proxy alone. Re-verified: anonymous `GET /multiple` → **307**.

### SEC-005 — Page-level gates
**Control** Independent client-side gates on `/history`, `/history/[id]`, `/admin`, `/dashboard`.
**Implementation** **[IMPLEMENTED]**
**Notes** These were the reason three of the four protected surfaces behaved correctly while SEC-004
was broken. `/multiple` was the one screen without a gate of its own; it now has one, so every
protected surface holds independently of the proxy.

### SEC-006 — API authentication
**Control** Every protected handler calls `getAuthUser(request)`; the proxy deliberately excludes
`/api`, so no route inherits protection it did not ask for.
**Implementation** **[IMPLEMENTED]** · **Evidence** [lib/api-auth.ts](../../src/lib/api-auth.ts)
**Notes** Memoised per request with React `cache()` keyed on the cookie header.

### SEC-007 — Suspension enforcement
**Control** `getAuthUser` returns `null` when `bannedAt` is set, so every protected endpoint 401s.
**Implementation** ⚠️ **[IMPLEMENTED], with two gaps** — `/api/auth/me` does not apply the guard, and
existing sessions are not revoked (enforcement is read-time only).
**Evidence** [lib/api-auth.ts](../../src/lib/api-auth.ts), [api/auth/me](../../src/app/api/auth/me/route.ts)

---

## 2. Authorization

### SEC-008 — Saved splits: creator-only write
**Control** `createdById` is the only column granting update, delete or restore. Payer and assignees
cannot write.
**Implementation** **[IMPLEMENTED]** · **Evidence** `api/receipts/[id]`

### SEC-009 — Saved splits: involvement-based read
**Control** Readable by creator ∨ payer ∨ item assignee ∨ member of the receipt's trip.
**Implementation** **[IMPLEMENTED]**
**Notes** Uses an *auth-first* pattern: a minimal `select` decides access before any nested payload
is fetched, so an unauthorised request costs almost no work.

### SEC-010 — Trips: owner-write, member-review
**Control** Members cannot write canonical trip state; their edits become change requests requiring
owner approval.
**Implementation** **[IMPLEMENTED]** · **Evidence** [trip-access.ts](../../src/lib/travel/trip-access.ts)
**Notes** Applied uniformly across all 18 travel endpoints. On approval, every operation is
re-validated against the **live** participant set before any write.

### SEC-011 — Existence non-disclosure
**Control** `getTripAccess` returns `null` for both "does not exist" and "no access", and every
caller answers **404**. Soft-deleted rows also return 404, not 403.
**Implementation** **[IMPLEMENTED]** · **[INFERRED]** a deliberate anti-enumeration choice.

### SEC-012 — Scoped writes (IDOR resistance)
**Control** Mutations put the ownership predicate in the `WHERE` clause rather than checking first
and writing second — e.g. `updateMany({ where: { id, createdById: user.id, deletedAt: null } })`,
`deleteMany({ where: { id: pid, tripId: id } })`.
**Implementation** **[IMPLEMENTED]**
**Notes** This closes the check-then-act window structurally. Nested ids (`[rid]`, `[pid]`,
`[crid]`, `[token]`) are always paired with their parent id, so a valid id from another trip matches
zero rows.

### SEC-013 — Admin access
**Control** `isAdmin` = DB `role === "admin"` ∨ email in `ADMIN_BOOTSTRAP_EMAILS`. No email is
hardcoded in source; the allowlist is a deliberate lockout-recovery mechanism.
**Implementation** **[IMPLEMENTED]** · **Evidence** [admin-auth.ts](../../src/lib/admin/admin-auth.ts)
**Notes** All `/api/admin/*` handlers return **403** — not 401 — even to anonymous callers.
One caveat: `prisma/sql/add_user_role.sql` seeds a real personal email address in a committed file.

### SEC-014 — Admin self-lockout guards
**Control** An admin may change their own plan and quota, but cannot ban themselves or revoke their
own admin role; a bootstrap admin's role cannot be revoked at all.
**Implementation** **[IMPLEMENTED]**

### SEC-015 — Privileged-action audit trail
**Control** Every admin mutation writes an `AdminAuditLog` row **inside the same transaction** as the
change — *"an action that can't be recorded is never applied."* No foreign key, so the trail survives
account deletion; actor and target emails are snapshots. Never swept.
**Implementation** **[IMPLEMENTED]** · **[INFERRED]** genuinely non-repudiable.

### SEC-016 — Database-level authorization (RLS)
**Control** Row Level Security as defence in depth.
**Implementation** **[MISSING] from the repository** — no policy SQL exists anywhere in
`prisma/sql/`; **[UNKNOWN]** whether policies are enabled directly in the Supabase project.
**Notes** This is the single most consequential gap. Prisma connects with a full-privilege
connection string, so **application code is the only authorization layer**. One missed guard in one
handler is a complete bypass, with nothing behind it. Verifiable in one query:

```sql
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;
```

---

## 3. Input handling

### SEC-017 — Request-body validation
**Control** Hand-written runtime validators for every POST/PUT shape, throwing `ValidationError` and
returning `400 VALIDATION_FAILED` with the offending field.
**Implementation** **[IMPLEMENTED]** · **Evidence** [validation.ts](../../src/lib/validation.ts),
`shared-summary.ts`, `saved-splits.ts`, `travel-cloud.ts`
**Notes** No schema library. Bounds are enforced on every field (200 items, 100 participants,
50 fees, 100 discounts, amounts ≤ 1e9, payloads ≤ 256 KB, change batches ≤ 200 ops). Validator
output types alias the canonical client types, with a drift-guard test proving no field is silently
dropped. Cross-field rules exist where settlement correctness depends on them.

### SEC-018 — Referential validation inside JSON
**Control** Participant ids referenced by assignments, discounts, payments and payers are validated
against the trip's live participant set — on write, **and again at change-request approval**.
**Implementation** **[IMPLEMENTED]**
**Notes** Necessary because participants live in `jsonb` and no database constraint can enforce
this.

### SEC-019 — AI output treated as untrusted
**Control** Model output is parsed with a quote-aware balanced-brace extractor, then every field is
re-derived, bounded, coerced and range-checked.
**Implementation** **[IMPLEMENTED]** · **Evidence** `api/parse-receipt`
**[INFERRED]** Correct posture for an LLM boundary — the model is treated as a hostile input source.

### SEC-020 — Upload constraints
**Control** Base64 length ≤ 7 000 000 (~5 MB) → 413; MIME allowlist → 415; client-side downscale to
1920 px before upload.
**Implementation** **[IMPLEMENTED]**

### SEC-021 — Output encoding / XSS
**Control** React escapes all interpolated content by default. The single `dangerouslySetInnerHTML`
in the codebase is `JsonLd`, which serialises with `JSON.stringify` and escapes `<` to `<` so a
`</script>` inside any string value cannot break out.
**Implementation** **[IMPLEMENTED]** · **Evidence** [JsonLd.tsx](../../src/components/seo/JsonLd.tsx)
**Notes** No `innerHTML`, no `eval`, no `new Function`, no unsanitised markdown renderer. The share
payload is `JSON.parse`d and shape-validated, never rendered as HTML.

---

## 4. Request-level protections

### SEC-022 — CSRF
**Control** `assertSameOrigin` on every state-changing handler: `Origin` or `Referer` must match the
request `Host` (or `NEXT_PUBLIC_APP_URL`). Missing `Host` → 400; mismatch → 403. Pairs with
`SameSite=Lax` cookies.
**Implementation** **[IMPLEMENTED]**
**Notes** Three endpoints correctly opt out because they are not same-origin callers and
authenticate with a shared secret instead: the Xendit webhook, the cron route and the cleanup route.

### SEC-023 — Webhook authentication
**Control** `x-callback-token` compared against `XENDIT_WEBHOOK_TOKEN`; 404 when unconfigured.
**Implementation** ⚠️ **[IMPLEMENTED]** with a caveat — the comparison is `===`, not constant-time,
despite a comment describing it as *"constant-time-ish"*.

### SEC-024 — Scheduled-job authentication (fail-closed)
**Control** `GET /api/cron/expire-pro` requires `Authorization: Bearer ${CRON_SECRET}` and returns
**503** when the secret is unset, so it can never run anonymously.
`POST /api/admin/cleanup` accepts the same pattern or Vercel's `x-vercel-cron: 1`, and 503s when
neither is configured.
**Implementation** **[IMPLEMENTED]** · **[INFERRED]** fail-closed is the right default here.
**Notes** `export const GET = POST` on the cleanup route means a **GET performs destructive hard
deletes** — unusual, and it makes the endpoint reachable by anything that follows links or
pre-fetches, if the credential ever leaks.

### SEC-025 — Rate limiting
**Control** Per-scope sliding window keyed per user when authenticated, else per IP. Limits 10–120
per minute; 429 with `Retry-After`.
**Implementation** ⚠️ **[IMPLEMENTED], partially effective**
**Notes** The in-memory limiter is per-instance by design, so on multi-instance serverless the
effective limit multiplies by the instance count. An Upstash-backed distributed limiter exists behind
`FLAG_DISTRIBUTED_RATE_LIMIT`, but **only 2 of ~30 rate-limited endpoints use the async path**, so
enabling the flag changes almost nothing today. `/api/fx-rate` is public, keyless and **not
rate-limited at all**.

### SEC-026 — Concurrency integrity
**Control** Optimistic locking via an integer `version` with an atomic conditional update; atomic
status claims for single-fire operations (webhook payment, change-request review); idempotent
`upsert` on client-generated ids; unique constraints as idempotency keys (`externalId`, `refereeId`).
**Implementation** **[IMPLEMENTED]**
**Notes** One gap: `TripPayment` has no idempotency key, so a retried or double-tapped settle-up can
create two rows.

### SEC-027 — Information-disclosure controls
**Control** `POST /api/trips/[id]/members` returns an identical generic success whether the email is
unregistered, already a member, or newly added — preventing account enumeration by trip owners.
`/api/auth/me` strips the raw `role` column and returns only a derived boolean.
**Implementation** **[IMPLEMENTED]**
**Notes** One counter-example is documented privately (VULN-004).

---

## 5. Platform and configuration

### SEC-028 — Security headers
**Control** Applied to `/:path*` in `next.config.mjs`.
**Implementation** **[IMPLEMENTED]**

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000` (no `includeSubDomains`/`preload` — deliberately reversible) |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` |
| `X-API-Version` | `1` on `/api/*` |

**Notes** Denying `camera` is safe precisely because receipt capture uses `<input
capture="environment">`, which needs no permission — a considered pairing.

### SEC-029 — Content Security Policy
**Control** A full directive set, shipped as **`Content-Security-Policy-Report-Only`**.
**Implementation** ⚠️ **[IMPLEMENTED] but not enforcing**
**Notes** The policy currently blocks nothing. `script-src` still requires `'unsafe-inline'` and
`'unsafe-eval'` because Next emits inline bootstrap scripts; tightening to nonces is noted in-code
as a later step. Allowlist: Google Fonts, `lh3.googleusercontent.com`, `*.supabase.co` +
`wss://*.supabase.co`, `accounts.google.com`. `object-src 'none'`, `base-uri 'self'`,
`frame-ancestors 'self'`, `upgrade-insecure-requests` are all present.

### SEC-030 — Secret management
**Control** Server-only secrets are never prefixed `NEXT_PUBLIC_`: `GEMINI_API_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN`, `RESEND_API_KEY`,
`UPSTASH_*`, `CRON_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `ADMIN_BOOTSTRAP_EMAILS`.
**Implementation** **[IMPLEMENTED]**
**Notes** `flags.ts` states the rule explicitly — public flags gate UI only, *"never gate a secret
with one"* — and the two revenue endpoints use **server** flags for that reason. Two variables used
in code are missing from `.env.example`: `CLEANUP_TOKEN` and `NEXT_PUBLIC_APP_URL`.

### SEC-031 — Dependency security
**Control** Dependabot-style review.
**Implementation** ⚠️ **[MISSING]** — no automated dependency scanning in CI.
**Measured** `npm audit` reports **10 advisories: 9 high, 1 moderate.** All have fixes available.

| Package | Severity | Advisory (summary) |
|---|---|---|
| **`next` 16.2.10** | **high** | **Proxy/middleware bypass in App Router**, plus a Server Actions DoS. The installed version is inside the affected range |
| `postcss` | high | XSS via unescaped `</style>`; arbitrary file read via `sourceMappingURL` |
| `sharp` (transitive) | high | Inherited libvips CVEs |
| `js-yaml` | high | Quadratic CPU consumption |
| `nanoid` | high | Infinite loop on zero size |
| `brace-expansion` | high | DoS via unbounded expansion |
| `prisma` / `@prisma/config` / `deepmerge-ts` | high | Stack exhaustion on recursive merge |
| `dompurify` (transitive) | moderate | XSS via detached subtree |

**[INFERRED]** The `next` advisory deserves priority attention: this application relies on
proxy-based route protection, and a proxy-bypass advisory applies to the installed version. Combined
with VULN-001 that is **two independent routes to the same failure**. Upgrading Next also resolves
`postcss` and `nanoid`.

**Also** `lucide-react` is a dependency with **zero imports** — removable surface area.

### SEC-032 — Backups and data at rest
**Control** Daily `pg_dump -Fc`, **GPG AES-256 encrypted before upload**, plaintext deleted, 30-day
artifact retention, with a small-dump sanity gate that fails the job rather than storing an empty
backup.
**Implementation** **[IMPLEMENTED]** · **Evidence** [backup.yml](../../.github/workflows/backup.yml)
**Notes** Necessary because the production database is on the Supabase free tier with no managed
backups. Encryption at rest for the live database is **[UNKNOWN]** (a Supabase platform property).

### SEC-033 — Data retention
**Control** One transactional sweep removes soft-deleted rows after 30 days, lapsed saved splits,
expired share links, expired invites, and activity events older than 30 days.
**Implementation** ⚠️ **[IMPLEMENTED], possibly not running** — the endpoint exists but is **not
present in `vercel.json`**, and **[UNKNOWN]** whether anything schedules it. If not, every stated
retention policy is unenforced and personal data accumulates indefinitely.

---

## 6. Privacy posture

| Data | Handling | Label |
|---|---|---|
| Receipt images | Sent to Google Gemini, **never stored by Splitzy**. No user identity accompanies the image | **[IMPLEMENTED]** |
| Disclosure at point of upload | **Present and localised** in both languages, rendered beside the scan control | **[VISUAL-VERIFIED]** |
| Bank / e-wallet details | Stored in JSON payloads and copied into public share snapshots readable by anyone with the link | **[IMPLEMENTED]** — see VULN-005 |
| Email | `users`, plus denormalised snapshots in `activity_events` and `admin_audit_logs`; sent to Xendit and Resend | **[IMPLEMENTED]** |
| Analytics | PostHog carries **no PII** — `autocapture: false`, pathname-only pageviews, no `identify()` | **[IMPLEMENTED]** |
| Error monitoring | `sendDefaultPii: false`, Session Replay off | **[IMPLEMENTED]** |
| Account deletion | **Not possible** — no UI, and five `User` relations use `Restrict`, so the database refuses it | **[IMPLEMENTED]** gap |

**[INFERRED]** The last row is a compliance exposure: a data-subject erasure request could not be
honoured through the application today.

---

## 7. Assurance — the largest structural weakness

| Question | Answer |
|---|---|
| Do automated tests assert any authorization rule? | **No.** Not one test anywhere asserts a non-owner receives 403 or 404 |
| Do automated tests cover any route handler? | **No.** All 36 Vitest files test pure modules |
| Is there a database-level backstop? | **[UNKNOWN]** — none in the repository |
| Is there dependency scanning in CI? | **No** |
| Is there security-relevant runtime monitoring? | **No** — zero `captureException` calls; no alerting |

**[INFERRED]** Splitting engine coverage is 100 %; authorization coverage is 0 %. The tests protect
the arithmetic and leave the permission model — where the consequences are worse — entirely to code
review. This is the finding to act on first, because it is what would have caught VULN-001.

---

## 8. Control summary

| Status | Count | Controls |
|---|---|---|
| **[IMPLEMENTED]** | 25 | SEC-001, 002, 003, **004** *(fixed)*, 005, 006, 008, 009, 010, 011, 012, 013, 014, 015, 017, 018, 019, 020, 021, 022, 026, 027, 028, 030, 032 |
| **[IMPLEMENTED] with caveats** | 6 | SEC-007 (inconsistent), 023 (not constant-time), 024 (GET deletes), 025 (partial), 029 (report-only), 033 (may not run) |
| **[MISSING]** | 2 | SEC-016 (RLS absent from repo), SEC-031 (no dependency scanning) |

---

## 9. Recommendations, ranked

| # | Recommendation | Why |
|---|---|---|
| 1 | ~~Fix route protection (SEC-004)~~ | ✅ **Done.** Guard narrowed to `isAuthRetryableFetchError`; page-level gate added |
| 2 | **Upgrade Next.js** past the proxy-bypass advisory | A second, independent path to the same failure; also clears `postcss` and `nanoid` |
| 3 | **Add authorization regression tests** | The only way these rules stop depending on reviewer memory |
| 4 | **Enable RLS**, committing policies to `prisma/sql/` | Turns one missed guard from a breach into a blocked query |
| 5 | **Confirm the cleanup job is scheduled** | Otherwise no retention policy is enforced |
| 6 | Add `npm audit` to CI and resolve the remaining 8 advisories | None are currently detected automatically |
| 7 | Wire error reporting (`captureException`, `ErrorBoundary.onError`, source maps) | Security failures are currently invisible in production |
| 8 | Move CSP to enforcing; constant-time secret comparison; remove `GET = POST` on cleanup; rate-limit `/api/fx-rate` | Hardening backlog |
| 9 | Resolve account deletion | Compliance exposure, currently blocked at the schema level |

---

*Specific vulnerability detail, reproduction and affected code paths: `FINDINGS-PRIVATE.md`
(gitignored, not for public commit).*
