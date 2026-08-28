# Splitzy — Non-Functional Requirements

> Two clearly separated registers: **Implemented NFRs** (evidenced in code) and **Recommended NFRs**
> (gaps identified during this documentation pass). Nothing here has been changed in the codebase.
>
> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**
> IDs: `NFR-xxx` implemented · `RNFR-xxx` recommended.

---

## Summary by category

| Category | Implemented | Recommended | Overall assessment |
|---|---|---|---|
| Performance | 7 | 3 | Good — deliberate work on payload size, caching and static rendering |
| Scalability | 4 | 4 | Adequate for current scale, with known ceilings documented in-code |
| Availability | 3 | 3 | Single point of failure, mitigated by an owned backup |
| Reliability | 8 | 2 | **Strongest area** — durable outbox, optimistic locking, atomic claims |
| Security | 11 | 6 | Solid application layer; **no database-level backstop** |
| Maintainability | 7 | 3 | Single-definition discipline is unusually good |
| Accessibility | 6 | 4 | Reasonable affordances, **zero automated verification** |
| Observability | 5 | 6 | **Weakest area** — installed but largely unwired |
| Compatibility | 5 | 1 | Broad, mobile-first |
| Responsiveness | 4 | 1 | Mobile-first throughout |
| Usability | 7 | 2 | Error copy is genuinely well-considered |
| SEO | 8 | 2 | **Best-verified area** — E2E-guarded |
| PWA compliance | 6 | 3 | Every criterion under our control is met |
| i18n | 5 | 3 | Strong infrastructure, incomplete coverage |
| **Total** | **86** | **43** | |

---

## 1. Performance

| ID | Requirement | Implementation | Evidence |
|---|---|---|---|
| NFR-001 | Split calculations shall be instant and require no network | The entire money engine is pure, synchronous, client-side TypeScript | `lib/receipt/calculations.ts` |
| NFR-002 | The three tool routes shall be statically prerendered (`○`) | Client views wrapped in `Suspense` so `useSearchParams` does not force dynamic rendering — an explicit constraint that also drove the client-side locale design | `app/single`, `/multiple`, `/travel` |
| NFR-003 | Trip detail payloads shall stay bounded | Receipts were removed from `GET /api/trips/[id]` — *"embedding all receipts here was producing 50k-row payloads on large trips"* | `api/trips/[id]` |
| NFR-004 | Receipt list pagination shall not degrade with depth | Keyset (cursor) pagination with a tuple inequality and `limit + 1` look-ahead, skipping `COUNT(*)` | `api/receipts` |
| NFR-005 | Authentication shall cost at most one round trip per request | `getAuthUser` memoised with React `cache()`, keyed on the cookie header | `lib/api-auth.ts` |
| NFR-006 | External rate lookups shall be cached | 1-hour in-process `Map` **plus** a 1-hour Next fetch cache | `api/fx-rate` |
| NFR-007 | Upload payloads shall be minimised client-side | Canvas resize to ≤ 1920 px at JPEG q0.85 before upload | `ReceiptInput.tsx` |

Also observed: `preconnect` + `dns-prefetch` to the Supabase origin; self-hosted Inter via
`next/font`; a build-time OG image; auth-first minimal `select` before full fetches.

| ID | Recommendation | Rationale |
|---|---|---|
| RNFR-001 | Paginate or lazily hydrate `GET /api/travel` | It returns every trip fully hydrated, capped only at 200 trips. The code itself flags this: *"If genuinely large accounts appear, switch to summary list + lazy per-trip detail loading."* |
| RNFR-002 | Add a client data cache (SWR / React Query) | There is none, so `/history`, the dashboard and the admin console refetch on every mount |
| RNFR-003 | Establish performance budgets and measure Core Web Vitals | No LCP/INP/CLS measurement exists anywhere |

---

## 2. Scalability

| ID | Requirement | Implementation | Evidence |
|---|---|---|---|
| NFR-008 | The application tier shall be stateless and horizontally scalable | Next.js on Vercel serverless; no server-side session state | — |
| NFR-009 | Database connections shall be pooled | `DATABASE_URL` targets Supabase PgBouncer (6543); `DIRECT_URL` (5432) is reserved for DDL and backups | `.env.example` |
| NFR-010 | Transactions shall be pooler-safe | Array-form `$transaction` only — interactive transactions over PgBouncer intermittently reported errors on committed statements | `apply-change-ops.ts` |
| NFR-011 | Hot query paths shall be indexed | 20 indexes, each documented with the query pattern it serves | `prisma/schema.prisma` |

| ID | Recommendation | Rationale |
|---|---|---|
| RNFR-004 | Migrate all rate limiting to the distributed store | Only 2 of ~30 rate-limited endpoints use `enforceRateLimitAsync`, so enabling the flag changes almost nothing; the in-memory limiter is per-instance by design |
| RNFR-005 | Index `users.created_at` | The admin list orders by `(created_at DESC, id DESC)` with an unindexed `ILIKE '%…%'` search |
| RNFR-006 | Make the AI quota check atomic | `checkScanQuota` then `incrementScanCount` is a read-then-write, so concurrent scans can exceed the cap |
| RNFR-007 | Plan the Contract step of the Expand–Contract migration | `receipt_items` and `item_assignments` remain writable alongside the payload model |

---

## 3. Availability

| ID | Requirement | Implementation | Evidence |
|---|---|---|---|
| NFR-012 | The system shall expose a liveness and readiness probe | `GET /api/health` — `SELECT 1`, 200/503, latency, uptime, commit, region, `no-store` | `api/health` |
| NFR-013 | The system shall support a planned-maintenance mode | `MAINTENANCE_MODE` env flag, bidirectional in the proxy | `src/proxy.ts` |
| NFR-014 | Recovery objectives shall be defined and documented | RPO ≤ 24 h, RTO ≤ 4 h | [DISASTER_RECOVERY.md](../DISASTER_RECOVERY.md) |

| ID | Recommendation | Rationale |
|---|---|---|
| RNFR-008 | Configure an external uptime monitor against `/api/health` | The probe exists; **[UNKNOWN]** whether anything calls it |
| RNFR-009 | Validate the stated RTO with a DR drill | The runbook itself records that RTO ≤ 4 h is unvalidated |
| RNFR-010 | Reduce the single point of failure | Supabase is auth *and* database on a free tier with no managed backups |

---

## 4. Reliability

The strongest area of the codebase.

| ID | Requirement | Implementation | Evidence |
|---|---|---|---|
| NFR-015 | A user's work shall survive loss of connectivity | Durable outbox with per-receipt coalescing, drained on reconnect | `travel-outbox.ts` |
| NFR-016 | A retryable failure shall never be discarded as permanent | 5xx and 429 requeue; only 4xx discards | `useTravelData.ts` |
| NFR-017 | Concurrent edits shall not silently overwrite | Optimistic `version` with an atomic conditional update → `409` | `api/receipts/[id]`, `api/travel/[id]` |
| NFR-018 | Single-fire operations shall be idempotent | Atomic status claims on the webhook and change-request review; `upsert` on client-generated ids; unique `externalId` and `refereeId` | multiple |
| NFR-019 | Dependent operations shall not race | Per-trip promise queue | `useTravelData.ts` |
| NFR-020 | Telemetry and notification failures shall never break the operation they observe | Every `logActivity`, `broadcastTripChange`, `sendWelcomeEmail`, `processReferral`, `incrementScanCount` and share-refresh call is caught | multiple |
| NFR-021 | A failed local persist shall be visible to the user | `PersistError` classified as `quota` or `unavailable` and surfaced as a toast | `useLocalStorage.ts` |
| NFR-022 | Data shall be independently backed up | Daily `pg_dump -Fc` via a pinned `postgres:17` image, GPG AES-256 encrypted, 30-day artifact retention, with a small-dump sanity gate | `.github/workflows/backup.yml` |

| ID | Recommendation | Rationale |
|---|---|---|
| RNFR-011 | Add an idempotency key to `TripPayment` | Payments are append-only with no dedupe, so a double-tap across devices can double-settle |
| RNFR-012 | Preserve a discarded outbox op for recovery | A `permanent` failure surfaces one generic message and loses the receipt content entirely |

---

## 5. Security

| ID | Requirement | Implementation | Evidence |
|---|---|---|---|
| NFR-023 | Session tokens shall be held in HTTP cookies, never in `localStorage` | `@supabase/ssr` defaults | — |
| NFR-024 | State-changing requests shall be same-origin | `assertSameOrigin` on every mutation except the three secret-authenticated machine endpoints | `lib/api-auth.ts` |
| NFR-025 | Security headers shall be set globally | HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` | `next.config.mjs` |
| NFR-026 | A Content Security Policy shall be defined | Full directive set, currently **report-only** so violations can be observed before enforcement | same |
| NFR-027 | Secrets shall never reach the browser | Gemini, Xendit, Resend, Upstash and the Supabase service-role key are all server-only; public flags gate UI only | `lib/flags.ts` |
| NFR-028 | Every mutating endpoint shall be rate-limited | Per-scope sliding window, keyed per user or per IP, 10–120/min | `lib/rate-limit.ts` |
| NFR-029 | Untrusted input shall be validated at the boundary | Hand-written validators for every POST/PUT shape, with output types aliased to the canonical client types and a drift-guard test | `lib/validation.ts`, `travel-cloud.ts` |
| NFR-030 | The system shall not disclose which emails have accounts | `POST /api/trips/[id]/members` returns an identical generic success in all cases | `api/trips/[id]/members` |
| NFR-031 | The system shall not disclose the existence of resources the caller cannot access | `getTripAccess` returns `null` for both cases; soft-deleted rows return 404, not 403 | `trip-access.ts` |
| NFR-032 | Privileged actions shall be auditable and non-repudiable | Audit row written in the same transaction as the change; FK-free so it survives deletion | `api/admin/users/[id]` |
| NFR-033 | Backups containing PII shall be encrypted at rest | GPG AES-256 before upload, plaintext removed | `backup.yml` |

| ID | Recommendation | Priority | Rationale |
|---|---|---|---|
| RNFR-013 | **Add authorization regression tests** | **High** | No test anywhere asserts that a non-owner gets 403/404. The entire permission model is guaranteed by code review alone |
| RNFR-014 | **Enable Supabase RLS as defence in depth**, with policies committed to `prisma/sql/` | **High** | **[UNKNOWN]** whether RLS exists; no policy SQL is in the repo, so a single missing guard is a full bypass |
| RNFR-015 | Move CSP from report-only to enforcing, and remove `'unsafe-inline'`/`'unsafe-eval'` via nonces | Medium | The policy exists but currently blocks nothing |
| RNFR-016 | Use constant-time comparison for `XENDIT_WEBHOOK_TOKEN` and `CRON_SECRET` | Medium | Both use `===`, despite one comment calling it "constant-time-ish" |
| RNFR-017 | Extract the handler pipeline into a wrapper | Medium | Security depends on each new route remembering all seven steps in order |
| RNFR-018 | Revoke sessions on ban, and apply the ban guard to `/api/auth/me` | Low | Enforcement is read-time only and inconsistent |

Additional observations: `/api/fx-rate` is public, keyless and unrate-limited;
`GET = POST` on `/api/admin/cleanup` means a GET performs destructive deletes; a real personal email
address is committed in `prisma/sql/add_user_role.sql`.

---

## 6. Maintainability

| ID | Requirement | Implementation | Evidence |
|---|---|---|---|
| NFR-034 | The codebase shall be fully type-checked in strict mode | `strict: true`, `tsc --noEmit` in CI | `tsconfig.json`, `ci.yml` |
| NFR-035 | Every push and PR shall pass lint, type-check, unit tests and a production build | GitHub Actions with concurrency cancellation | `ci.yml` |
| NFR-036 | Critical E2E flows shall be verified against a production build | Playwright on Chromium, port 3100, gated on the verify job | `playwright.config.ts` |
| NFR-037 | Each rule shall have exactly one definition | Shared limits, event constants, audit slugs, plan prices and mode names each live in one module — several with tests asserting they cannot drift | `limits.ts`, `plans.ts`, `app-copy.test.ts` |
| NFR-038 | Non-obvious decisions shall be documented at the point of implementation | Comments consistently record the failure that motivated the code, not just what it does | throughout |
| NFR-039 | Schema changes shall be additive and safe to apply before deploy | Every file in `prisma/sql/` uses `IF NOT EXISTS` and is Expand-only | `prisma/sql/` |
| NFR-040 | Server-only code shall never reach the client bundle | The `activity.ts` / `-server.ts` / `-client.ts` split, applied consistently | `lib/activity*.ts` |

| ID | Recommendation | Rationale |
|---|---|---|
| RNFR-019 | Adopt a migration tool with a history table | No `prisma/migrations/`; drift between `schema.prisma` and production is only detectable by inspection, and a type inconsistency already exists (`referrals` uses `TIMESTAMPTZ`) |
| RNFR-020 | Decompose `TravelSpendView` (2 086 lines) and `useTravelData` (1 128 lines) | The two largest files, and the natural next refactor |
| RNFR-021 | Remove dead code | `csv-export.ts`, `EmptyState`, 5 unused data-service methods, 10 orphaned API endpoints, 3 unfired analytics constants |

---

## 7. Accessibility

| ID | Requirement | Implementation | Evidence |
|---|---|---|---|
| NFR-041 | A skip link shall bypass repeated navigation (WCAG 2.4.1) | `.sr-only` / `focus:not-sr-only` anchor to `#main-content` | `app/layout.tsx` |
| NFR-042 | Modals shall trap focus, handle Escape and lock scroll | Radix `Dialog` throughout — the onboarding modal was specifically migrated to it from a hand-rolled `fixed inset-0` div that had none of these | `OnboardingModal.tsx` |
| NFR-043 | Icon-only controls shall be labelled | `aria-label` on back buttons, the locale switcher, copy buttons and spinners | throughout |
| NFR-044 | Touch targets shall meet the 44 px minimum | `h-11` / `min-h-[44px]` with `touch-manipulation` on tappable chrome | throughout |
| NFR-045 | Dynamic state changes shall be announced | `aria-live="polite"` step announcement; `role="alert"` on the error-boundary fallback | `OnboardingModal.tsx`, `ErrorBoundary.tsx` |
| NFR-046 | Motion shall respect user preference | A global `prefers-reduced-motion` rule, referenced by the celebration component | `globals.css` |

| ID | Recommendation | Priority | Rationale |
|---|---|---|---|
| RNFR-022 | Add automated a11y testing (axe / pa11y in CI) | **High** | **Zero** automated accessibility verification exists |
| RNFR-023 | Verify colour contrast in both themes | Medium | Never measured |
| RNFR-024 | Test the split wizard with a screen reader | Medium | The core flow is a multi-step form with dynamic totals |
| RNFR-025 | Audit keyboard-only completion of a full split | Medium | Item assignment is the likeliest problem area |

---

## 8. Observability

The weakest area: the tooling is installed, and largely unwired.

| ID | Requirement | Implementation | Evidence |
|---|---|---|---|
| NFR-047 | Uncaught errors shall be capturable on all three runtimes | Sentry client / server / edge via `instrumentation.ts`, each DSN-guarded | `sentry.*.config.ts` |
| NFR-048 | Error reporting shall not send PII by default | `sendDefaultPii: false`; Session Replay disabled | same |
| NFR-049 | Known benign noise shall be filtered | One `ignoreErrors` entry for a Supabase Web Locks race | `instrumentation-client.ts` |
| NFR-050 | Product events shall be captured without PII | 11 PostHog events; `autocapture: false`; pathname-only pageviews | `lib/analytics.ts` |
| NFR-051 | Operators shall be able to see daily usage and privileged actions | `ActivityEvent` feed with exact DB-side aggregates; `AdminAuditLog` | `api/admin/*` |

| ID | Recommendation | Priority | Rationale |
|---|---|---|---|
| RNFR-026 | **Fire `split_completed`** | **High** | The core conversion event is declared and never sent, so the funnel the analytics exist for has no completion |
| RNFR-027 | **Upload Sentry source maps** (`withSentryConfig`) | **High** | Absent, so every stack trace will be minified |
| RNFR-028 | **Capture handled errors** | **High** | Zero `captureException` calls; payment, sync, email, referral and outbox failures are `console`-only. `ErrorBoundary.onError` exists precisely for this and is never supplied |
| RNFR-029 | Call `identify()` on sign-in and `reset()` on sign-out | Medium | No person profiles exist, and a shared device merges identities |
| RNFR-030 | Fire `mode_selected`; move the four literal event names into `EVENTS` | Medium | Declared-but-unfired constants, and drift the constant map exists to prevent |
| RNFR-031 | Add API latency and error-rate monitoring, plus alerting on payment failures | Medium | Neither exists |

---

## 9. Compatibility

| ID | Requirement | Implementation |
|---|---|---|
| NFR-052 | Modern evergreen browsers shall be supported | ES2017 target, Next 16 / React 19 |
| NFR-053 | iOS Safari shall be a first-class target | `appleWebApp` meta tags, `navigator.standalone` detection, explicit `atob` padding in the share decoder |
| NFR-054 | Storage-API differences shall be handled | `PersistError` classification across Chrome's `QuotaExceededError`, Firefox's `NS_ERROR_DOM_QUOTA_REACHED` and Safari's code-only variant |
| NFR-055 | Receipt capture shall work without a camera permission | `<input capture="environment">`, which is why `Permissions-Policy: camera=()` is safe |
| NFR-056 | Exported files shall open correctly in Excel and Sheets | UTF-8 BOM in the CSV writer *(module unreachable — see FR-065a)* |

| ID | Recommendation | Rationale |
|---|---|---|
| RNFR-032 | Define and document a browser support matrix | None is stated anywhere; E2E runs Chromium only |

---

## 10. Responsiveness

| ID | Requirement | Implementation |
|---|---|---|
| NFR-057 | Layouts shall be mobile-first | Tailwind `sm:`/`md:` progressive enhancement throughout |
| NFR-058 | Primary actions shall sit in the thumb zone on mobile | `StickyActionBar` in all three editors |
| NFR-059 | The header shall not shift as auth resolves | `AuthButton` renders a same-height skeleton while loading |
| NFR-060 | Wizard navigation shall match platform expectations | The step is in the URL, so the Android back button and iOS back gesture return one step |

| ID | Recommendation | Rationale |
|---|---|---|
| RNFR-033 | Add responsive visual regression tests | E2E sets a 375×667 viewport for wizard tests only |

---

## 11. Usability

| ID | Requirement | Implementation | Evidence |
|---|---|---|---|
| NFR-061 | Error messages shall name the actual failure | Offline, timeout, quota, validation and conflict each get distinct copy — because a generic failure *"sent them off cropping a photo that was fine all along"* | `ReceiptInput.tsx`, `api-response.ts` |
| NFR-062 | A blocked action shall always offer a way forward | The scan paywall says items can still be added by hand; the guest dialog offers "Later"; a 404 offers Home and Back | multiple |
| NFR-063 | Destructive and lossy states shall be recoverable | Soft delete with restore; an undo action on receipt delete; a `beforeunload` guard mid-fill | multiple |
| NFR-064 | There shall be exactly one way to go back | One header control, matching the system gesture — E2E-asserted | `wizard-navigation.spec.ts` |
| NFR-065 | Copy shall not contradict itself across surfaces | Mode names are asserted equal between the landing page and the app | `app-copy.test.ts` |
| NFR-066 | Numbers shown to a group shall be honest about staleness | The share page displays when the content last changed | `SharedSummary.updatedAt` |
| NFR-067 | A confirmation shall be offered before irreversible group-visible actions | Delete dialogs in Multiple and Travel; an admin confirm dialog | multiple |

| ID | Recommendation | Rationale |
|---|---|---|
| RNFR-034 | Warn when an item is assigned to nobody | The cost silently shifts to the payer (BR-005) with no indication |
| RNFR-035 | Surface `needsFxRate` prominently wherever a converted total is shown | The engine flags it, but correctness depends on every surface remembering to check |

---

## 12. SEO

The best-verified area: eight behaviours are guarded by E2E tests.

| ID | Requirement | Implementation | Verified |
|---|---|---|---|
| NFR-068 | Every indexable page shall declare a self-referencing canonical | Per-page `alternates.canonical`; deliberately **no** site-wide canonical | ✅ E2E |
| NFR-069 | Bilingual routes shall emit reciprocal hreflang plus `x-default` | Only the three routes that exist in both languages | ✅ E2E |
| NFR-070 | A single canonical host shall be enforced | Apex → `www` 301, exact string match to avoid a redirect loop | ✅ E2E |
| NFR-071 | Retired URLs shall redirect rather than 404 | `/en/*` → un-prefixed, 301 | ✅ E2E |
| NFR-072 | Private surfaces shall be noindexed, not robots-disallowed | So Google can actually read the directive | ✅ E2E |
| NFR-073 | The sitemap shall list only reachable 200 URLs | `/multiple` excluded; `/pricing` flag-aware | ✅ E2E |
| NFR-074 | A consistent entity graph shall appear on every route | `Organization` + `WebSite` + `SoftwareApplication` with stable `@id`s | ✅ E2E |
| NFR-075 | No rating or review markup shall be emitted while the underlying figures are placeholders | Deliberate omission | ✅ E2E |

| ID | Recommendation | Rationale |
|---|---|---|
| RNFR-036 | Replace or remove placeholder stats and testimonials | They are a trust liability, and the most credible-looking element is the fabricated one |
| RNFR-037 | Give the tool routes Indonesian counterparts, or make `/multiple` publicly viewable read-only | The highest-value keyword pages currently have no Indonesian URL, and `/multiple` is excluded from the sitemap. `sitemap.ts` itself names this as an open product decision |

---

## 13. PWA compliance

| ID | Requirement | Implementation | Verified |
|---|---|---|---|
| NFR-076 | A valid manifest shall be served with name, `start_url`, scope and `display: standalone` | `app/manifest.ts` | — |
| NFR-077 | Declared icon dimensions shall match the real files | Unit test reads each PNG's IHDR chunk | ✅ unit |
| NFR-078 | Icons shall be square and under 300 KB | Same test | ✅ unit |
| NFR-079 | A dedicated maskable icon shall exist | Not shared with `purpose: "any"` | ✅ unit |
| NFR-080 | The precache list shall reference only files that exist | Test parses `APP_SHELL` from `sw.js` | ✅ unit |
| NFR-081 | Install success shall be measurable | Three telemetry events, added after a silent install failure | — |

| ID | Recommendation | Rationale |
|---|---|---|
| RNFR-038 | Add a dedicated offline fallback page | Navigation currently falls back to the cached `/` |
| RNFR-039 | Exclude authenticated pages from the service-worker navigation cache | Sign-out clears `localStorage` but not the SW cache |
| RNFR-040 | Add an update-available prompt | `skipWaiting()` + `clients.claim()` swap assets under an open tab silently |

---

## 14. Internationalisation

| ID | Requirement | Implementation | Evidence |
|---|---|---|---|
| NFR-082 | A missing translation key shall fail the build | `en` is typed against `typeof id` | TypeScript |
| NFR-083 | Interpolation placeholders shall match across languages | Asserted in tests | `app-copy.test.ts` |
| NFR-084 | Translations shall be genuine, not copied | Specific strings asserted to differ between languages | same |
| NFR-085 | Mode names shall be identical between marketing and product | Asserted in tests | same |
| NFR-086 | Locale choice shall persist across the marketing → tool boundary | `?lang=` param plus a conditional `localStorage` write | `use-locale.ts` |

| ID | Recommendation | Priority | Rationale |
|---|---|---|---|
| RNFR-041 | Translate `/s/<code>` and `/share` | **High** | The share page is the primary non-user touchpoint, in a market that speaks Indonesian |
| RNFR-042 | Translate `/privacy` and `/terms` | **High** | Legal documents presented to Indonesian users in English only |
| RNFR-043 | Generalise `alternateLanguages()` beyond two locales | Low | It hardcodes the two-locale shape, as does `LocaleSwitcher` |

---

## Top recommendations, ranked

| # | Recommendation | ID | Why first |
|---|---|---|---|
| 1 | Add authorization regression tests | RNFR-013 | The permission model is the product's highest-risk surface and has **zero** test coverage |
| 2 | Fire `split_completed` | RNFR-026 | Without it, no claim about conversion can be measured or validated |
| 3 | Enable Supabase RLS as defence in depth | RNFR-014 | Today one missing guard in one handler is a complete bypass |
| 4 | Capture handled errors in Sentry + upload source maps | RNFR-027, RNFR-028 | Payment, sync and email failures are currently invisible in production |
| 5 | Confirm the cleanup job is scheduled | *(FR-074)* | If it is not, every retention policy the product states is unenforced |
| 6 | Translate the share page and legal pages | RNFR-041, RNFR-042 | The viral surface and the legal surface are both English-only |
| 7 | Add automated accessibility testing | RNFR-022 | Good affordances exist with nothing preventing regression |
