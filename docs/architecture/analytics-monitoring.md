# Splitzy — Analytics & Monitoring

> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**

---

## 0. Four separate telemetry systems **[IMPLEMENTED]**

Splitzy runs four distinct, deliberately separated observability streams. Confusing them is easy,
so the distinction is stated in the source itself.

| # | System | Store | Audience | Purpose |
|---|---|---|---|---|
| 1 | **PostHog** | third-party | product / growth | Conversion funnel: landing → scan → split → upgrade |
| 2 | **Sentry** | third-party | engineering | Uncaught exceptions + traces (browser, Node, Edge) |
| 3 | **`ActivityEvent`** | own Postgres | admin operator | Who was active today, and which feature they used |
| 4 | **`AdminAuditLog`** | own Postgres | compliance / forensics | Append-only trail of privileged admin mutations |

The comment at the top of [src/lib/analytics.ts](../../src/lib/analytics.ts) makes the 1-vs-3 split
explicit: *"This is distinct from the admin ActivityEvent monitoring — this feeds the conversion
funnel."*

---

## 1. PostHog — product analytics

### 1.1 Initialisation **[IMPLEMENTED]**

File: [src/lib/analytics.ts](../../src/lib/analytics.ts) (`"use client"`).

```ts
const KEY  = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

function getClient(): Promise<PostHog | null> {
  if (!isAnalyticsEnabled()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("posthog-js").then(({ default: posthog }) => {
      posthog.init(KEY as string, {
        api_host: HOST,
        capture_pageview: false,        // SPA pageviews are sent manually
        capture_pageleave: true,
        autocapture: false,             // explicit events only — keeps the funnel clean
        person_profiles: "identified_only",
      });
      return posthog;
    });
  }
  return clientPromise;
}
```

Key properties:

- **Lazily and dynamically imported.** `posthog-js` is only `import()`-ed when a key exists, so with
  analytics off the SDK is never initialised *and never shipped in the bundle*.
- **Memoised promise** — one client per page load.
- `isAnalyticsEnabled()` requires both `typeof window !== "undefined"` and a key, so it is a hard
  no-op server-side.
- Every helper (`capture`, `capturePageview`, `identify`, `resetAnalytics`) awaits `getClient()` and
  uses optional chaining, so all of them degrade to a silent no-op.

### 1.2 Development behaviour **[IMPLEMENTED]**

There is **no `NODE_ENV` check**. PostHog is gated purely on the presence of
`NEXT_PUBLIC_POSTHOG_KEY`. If a developer sets the key in `.env.local`, local traffic is captured
and mixed into the same project.
**[INFERRED]** The intended pattern is to simply leave the key unset outside production —
`.env.example` ships it blank.

### 1.3 Pageviews **[IMPLEMENTED]**

`AnalyticsProvider` is mounted once in the root layout and fires on every `usePathname()` change:

```ts
useEffect(() => { capturePageview(pathname); }, [pathname]);
// → posthog.capture("$pageview", { $current_url: pathname })
```

**[IMPLEMENTED]** Only the **pathname** is sent — no query string, so `?ref=`, `?trip=`,
`?resume=`, `?redirect=` and `?step=` never reach PostHog. The URL hash (which carries the entire
`/share#…` payload) is likewise excluded.

### 1.4 Complete event inventory **[IMPLEMENTED]**

Every `capture(...)` call site in the codebase:

| Event name | Constant | Properties | Fired from |
|---|---|---|---|
| `$pageview` | `EVENTS.pageview` | `{ $current_url: pathname }` | [AnalyticsProvider.tsx:12](../../src/components/providers/AnalyticsProvider.tsx#L12) |
| `scan_started` | `EVENTS.scanStarted` | *(none)* | [ReceiptInput.tsx:143](../../src/components/receipt/ReceiptInput.tsx#L143) |
| `scan_completed` | `EVENTS.scanCompleted` | `{ items: number, currency: string }` | [ReceiptInput.tsx:216](../../src/components/receipt/ReceiptInput.tsx#L216) |
| `scan_quota_hit` | `EVENTS.quotaHit` | *(none)* | [ReceiptInput.tsx:230](../../src/components/receipt/ReceiptInput.tsx#L230) |
| `share_whatsapp` | `EVENTS.shareWhatsapp` | *(none)* | [SummaryPanel.tsx:940](../../src/components/receipt/SummaryPanel.tsx#L940), [:1766](../../src/components/receipt/SummaryPanel.tsx#L1766) |
| `upgrade_clicked` | `EVENTS.upgradeClicked` | `{ price_label: string }` | [UpgradeButton.tsx:24](../../src/components/billing/UpgradeButton.tsx#L24) |
| `upgrade_clicked` | `EVENTS.upgradeClicked` | `{ source: "scan_paywall" }` | [ScanQuotaPaywall.tsx:34](../../src/components/billing/ScanQuotaPaywall.tsx#L34) |
| `pro_upgrade_success` | *(string literal — no constant)* | *(none)* | [SuccessCelebration.tsx:12](../../src/components/billing/SuccessCelebration.tsx#L12) |
| `onboarding_started` | *(string literal — no constant)* | *(none)* | [OnboardingModal.tsx:134](../../src/components/onboarding/OnboardingModal.tsx#L134) |
| `onboarding_completed` | *(string literal — no constant)* | `{ step: number }` | [OnboardingModal.tsx:147](../../src/components/onboarding/OnboardingModal.tsx#L147) — fired when the user finishes the tour |
| `onboarding_skipped` | *(string literal — no constant)* | `{ step: number }` | [OnboardingModal.tsx:147](../../src/components/onboarding/OnboardingModal.tsx#L147) — same call site, chosen by a ternary; also fires on dismiss/Escape |
| `pwa_install_prompt_available` | `EVENTS.installPromptAvailable` | `{ platforms: string[] \| null }` | [PwaInstallTelemetry.tsx:37](../../src/components/providers/PwaInstallTelemetry.tsx#L37) |
| `pwa_app_installed` | `EVENTS.appInstalled` | *(none)* | [PwaInstallTelemetry.tsx:43](../../src/components/providers/PwaInstallTelemetry.tsx#L43) |
| `pwa_launched_standalone` | `EVENTS.launchedStandalone` | *(none)* | [PwaInstallTelemetry.tsx:59](../../src/components/providers/PwaInstallTelemetry.tsx#L59) |

**[IMPLEMENTED] Declared but never fired.** Three constants exist in `EVENTS` with zero call sites:

| Constant | Value | Consequence |
|---|---|---|
| `EVENTS.modeSelected` | `"mode_selected"` | The landing → tool step of the funnel is not measured |
| `EVENTS.splitCompleted` | `"split_completed"` | **The core conversion event is never sent** — the funnel has no completion |
| `EVENTS.pricingViewed` | `"pricing_viewed"` | Pricing-page views are only visible as a `$pageview` |

**[INFERRED]** The stated purpose of PostHog is the funnel "landing → scan → split → upgrade", but
two of those four stages (`mode_selected`, `split_completed`) emit nothing. As shipped the funnel is
`$pageview → scan_started → scan_completed → upgrade_clicked → pro_upgrade_success`.

Four events are also inconsistent: `pro_upgrade_success`, `onboarding_started`,
`onboarding_completed` and `onboarding_skipped` are raw string literals rather than `EVENTS`
entries, which is the drift the constant map exists to prevent.

### 1.5 User identification **[IMPLEMENTED]**

`identify()` and `resetAnalytics()` are **exported but never called** — verified by grep across
`src/`. Consequently:

- `person_profiles: "identified_only"` means **no person profiles are ever created**.
- All events are attributed to the anonymous PostHog distinct id.
- Sign-out does not reset the distinct id, so events before and after a sign-out on a shared device
  share one anonymous identity.
- Cross-device funnel stitching is impossible.

**[INFERRED]** This is almost certainly unintentional — the helpers were written for exactly this
purpose and left unwired.

### 1.6 Feature flags **[IMPLEMENTED]**

PostHog feature flags are **not used**. Flags come from env vars via
[src/lib/flags.ts](../../src/lib/flags.ts), whose header names PostHog as the future swap-in:
*"When we need instant flips or percentage rollouts, swap the reader body for PostHog/Vercel Flags —
call sites stay the same."*

### 1.7 Privacy posture **[IMPLEMENTED]**

| Setting | Value | Effect |
|---|---|---|
| `autocapture` | `false` | No automatic click/input capture — no risk of harvesting participant names or amounts from the DOM |
| `capture_pageview` | `false` | Manual, pathname-only |
| `capture_pageleave` | `true` | Time-on-page |
| `person_profiles` | `"identified_only"` | No profiles, since `identify` is never called |
| Session Replay | not configured | Off |

No event carries an email, a participant name, a receipt title, or a money amount. The most
sensitive properties in the whole inventory are `items` (a count) and `currency` (an ISO code).
**[IMPLEMENTED]**

There is **no cookie banner or consent gate** in the codebase; PostHog initialises on first use
whenever the key is set. **[IMPLEMENTED]** — whether that is compliant for the target market was
not assessed.

---

## 2. Sentry — error monitoring

### 2.1 Wiring **[IMPLEMENTED]**

Next.js instrumentation hooks, three runtimes, three configs:

| File | Runtime | Loaded by |
|---|---|---|
| [src/instrumentation-client.ts](../../src/instrumentation-client.ts) | browser | Next loads it automatically |
| [src/sentry.server.config.ts](../../src/sentry.server.config.ts) | Node.js | `instrumentation.ts` when `NEXT_RUNTIME === "nodejs"` |
| [src/sentry.edge.config.ts](../../src/sentry.edge.config.ts) | Edge | `instrumentation.ts` when `NEXT_RUNTIME === "edge"` |

[src/instrumentation.ts](../../src/instrumentation.ts) also exports `onRequestError`, which
lazy-imports `captureRequestError` and forwards uncaught errors from Server Components and route
handlers. The lazy import keeps the SDK out of runtimes that never error.

`instrumentation-client.ts` exports `onRouterTransitionStart = Sentry.captureRouterTransitionStart`
unconditionally — required by `@sentry/nextjs` to instrument App Router navigations, and a no-op
when Sentry is not initialised.

### 2.2 Configuration **[IMPLEMENTED]**

| Option | Client | Server | Edge |
|---|---|---|---|
| `dsn` | `NEXT_PUBLIC_SENTRY_DSN` | `SENTRY_DSN \|\| NEXT_PUBLIC_SENTRY_DSN` | same as server |
| `tracesSampleRate` | `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1` | `SENTRY_TRACES_SAMPLE_RATE ?? 0.1` | same |
| `environment` | `NEXT_PUBLIC_VERCEL_ENV \|\| NODE_ENV` | `VERCEL_ENV \|\| NODE_ENV` | same |
| `sendDefaultPii` | `false` | `false` | `false` |
| `replaysSessionSampleRate` | `0` | — | — |
| `replaysOnErrorSampleRate` | `0` | — | — |

**[IMPLEMENTED] Every `Sentry.init` is inside `if (dsn) { … }`.** With no DSN the SDK is completely
inert — no network calls, no initialisation. The stated intent is *"safe to ship to production dark,
then activate by setting SENTRY_DSN in the deploy environment."*

**[IMPLEMENTED]** `sendDefaultPii: false` on all three runtimes means IPs and request headers are
not attached.

**[IMPLEMENTED]** Session Replay is explicitly disabled on both sample rates, "privacy + bundle
cost; enable later".

### 2.3 Noise filtering **[IMPLEMENTED]**

One `ignoreErrors` entry, client only:

```ts
/Lock .* was released because another request stole it/
```

Documented as a *"Known Supabase Web Locks race condition — benign, session stays valid."*

### 2.4 Custom captures, breadcrumbs, context **[IMPLEMENTED]**

**None.** Grepping `Sentry.` across `src/` returns only the three config files and
`instrumentation.ts`. There is no `captureException`, no `captureMessage`, no `setUser`, no
`setTag`, no `addBreadcrumb`, no custom span anywhere in application code.

Consequences:

- Errors reach Sentry only through the automatic integrations: unhandled browser exceptions and
  rejections, and `onRequestError`.
- Every deliberately-caught error — the swallowed `logActivity` failure, the swallowed
  `broadcastTripChange` failure, the swallowed welcome-email failure, the swallowed share-link
  refresh, the Gemini failures, the `catch {}` in `travel-outbox` drain — goes to `console.error`
  and **nowhere else**. `ErrorBoundary` exposes an `onError` prop *for exactly this purpose*
  ("useful for shipping to error monitoring (Sentry etc.) without coupling the boundary to it") and
  no caller passes one.
- No user context is attached, so an error cannot be tied to an account.

### 2.5 Source maps **[UNKNOWN]**

`next.config.mjs` does **not** wrap the config in `withSentryConfig`, and there is no
`sentry.properties`, no `SENTRY_AUTH_TOKEN` in `.env.example`, and no upload step in
[ci.yml](../../.github/workflows/ci.yml).

**[INFERRED]** Source maps are therefore **not uploaded to Sentry**, so server and client stack
traces will be minified and hard to read. `@sentry/nextjs` is installed and the instrumentation
files are correct, but the build-plugin half of the integration is absent.

---

## 3. `ActivityEvent` — in-house usage log

### 3.1 Purpose **[IMPLEMENTED]**

Per the model comment: *"one row per meaningful completed action, so the admin can see who was
active on a given day and which feature they used."* Single and Multiple modes are local-only and
leave no server trace, so those events arrive via a client beacon.

### 3.2 Three-file split **[IMPLEMENTED]**

| File | Contains | Why separate |
|---|---|---|
| [activity.ts](../../src/lib/activity.ts) | Types, `BEACON_FEATURES`, `BEACON_TYPES`, `parseBeacon`, `featureLabel`, `describeActivity` | Pure — importable by client, server and admin UI without dragging Prisma into the client bundle |
| [activity-server.ts](../../src/lib/activity-server.ts) | `logActivity()` — the Prisma insert | Server only |
| [activity-client.ts](../../src/lib/activity-client.ts) | `logFeatureUsage()` — the fetch beacon | Client only |

### 3.3 What is recorded **[IMPLEMENTED]**

| Feature | Types allowed | Written by |
|---|---|---|
| `account` | `login` | server, in `GET /api/auth/callback` |
| `single` | `split.created` | client beacon — [SingleSplitView.tsx:325](../../src/components/pages/SingleSplitView.tsx#L325) |
| `multiple` | `split.created` | client beacon — [MultipleReceiptView.tsx:272](../../src/components/pages/MultipleReceiptView.tsx#L272) |
| `travel` | `receipt.added` | client beacon — [TravelSpendView.tsx:1196](../../src/components/pages/TravelSpendView.tsx#L1196) |

The beacon allowlist is bounded: `BEACON_FEATURES = ["single","multiple","travel"]` and
`BEACON_TYPES = ["split.created","share.created","receipt.added"]`. `parseBeacon` rejects anything
else, *"so a tampered client can't write arbitrary strings into the log."* `login` is deliberately
excluded from the beacon allowlist — it is only ever written server-side.

**[IMPLEMENTED]** `share.created` is in the allowlist but has **no call site** — no beacon currently
reports a share.

### 3.4 Beacon transport **[IMPLEMENTED]**

`logFeatureUsage(feature, type = "split.created")`:

- **De-duplicated once per feature+type per browser session** via `sessionStorage`
  (`splitzy-activity:<feature>:<type>`), so ten receipts in Multiple produce one
  "used Multiple today" event, not ten.
- Uses `fetch(..., { keepalive: true })`, fire-and-forget, double-wrapped in `try/catch` so it can
  never disrupt the user's flow.
- No-op server-side and, at the API, a no-op for guests (`POST /api/activity` returns 401).

`POST /api/activity` — CSRF-checked, auth-required, rate-limited to 60/min/user, returns
**`202 No Content`** ("accepted telemetry; nothing for the client to read").

### 3.5 Storage, reads and retention **[IMPLEMENTED]**

- Model: `ActivityEvent { id, userId, userEmail (denormalised snapshot), feature, type, metadata,
  createdAt }`, indexed on `createdAt DESC` and `(userId, createdAt DESC)`, `ON DELETE CASCADE`
  from `users`.
- Read by `GET /api/admin/activity?from&to` — a 500-row capped feed **plus** exact aggregates
  computed in a raw SQL `COUNT(DISTINCT user_id) FILTER (WHERE …)`, so the summary counters are
  never truncated regardless of window size. Returns `truncated: false` explicitly.
- The window comes from the client as `[from, to)` in the **admin's local time**, so "today" matches
  the operator's wall clock instead of a server-guessed timezone.
- Retention: hard-deleted after **30 days** by `POST /api/admin/cleanup`
  (`RETENTION_DAYS`), on the grounds that it is telemetry, not user data.

### 3.6 Privacy note **[IMPLEMENTED]**

`userEmail` is stored as a denormalised snapshot on every row, so this table *does* contain PII —
unlike PostHog. It is admin-only, cascade-deleted with the user, and swept at 30 days.

---

## 4. `AdminAuditLog` — privileged-action trail **[IMPLEMENTED]**

| Property | Value |
|---|---|
| Written by | `PATCH /api/admin/users/[id]` — the only writer |
| Actions | `plan.change`, `quota.reset`, `quota.limit`, `user.ban`, `user.unban`, `role.grant`, `role.revoke` |
| Payload | `{ actorId, actorEmail, action, targetUserId, targetEmail, metadata: { from, to } }` |
| Integrity | The `user.update` and `adminAuditLog.createMany` run **in one transaction** — *"an action that can't be recorded is never applied"* |
| Durability | **No FK to `users`** on purpose, so the trail survives account deletion; emails are snapshots taken at write time |
| Mutability | Append-only by convention — application code only ever inserts and reads |
| Retention | **Never swept.** The cleanup job does not touch this table |
| Read by | `GET /api/admin/audit` — newest 50, admin only |
| Rendering | `describeAuditEntry()` in [admin-audit.ts](../../src/lib/admin/admin-audit.ts), a pure function shared by API and UI so slugs cannot drift |

---

## 5. Health check **[IMPLEMENTED]**

`GET /api/health` — Node runtime, `dynamic = "force-dynamic"`, `Cache-Control: no-store`.

```jsonc
{
  "status": "ok" | "degraded",
  "db": "ok" | "down",
  "dbLatencyMs": 12,
  "uptimeMs": 84213,
  "commit": "6e6ea4e",      // VERCEL_GIT_COMMIT_SHA, 7 chars
  "region": "sin1",
  "nodeEnv": "production",
  "timestamp": "2026-08-27T…"
}
```

`200` when `SELECT 1` succeeds, `503` otherwise. Intentionally small and stable so it is cheap for
uptime monitors to poll. **[UNKNOWN]** whether an external monitor is actually configured against it.

---

## 6. Coverage matrix

| Signal | Instrumented? | Where |
|---|---|---|
| Page views | ✅ pathname only | PostHog |
| Landing → mode selection | ❌ constant exists, unused | — |
| AI scan start / success / quota | ✅ | PostHog |
| Split completed | ❌ **constant exists, unused** | — |
| WhatsApp share | ✅ | PostHog |
| Upgrade click / success | ✅ | PostHog |
| Onboarding start | ✅ | PostHog |
| Onboarding completion / skip (with the step reached) | ✅ | PostHog |
| PWA install funnel | ✅ 3 events | PostHog |
| Per-user daily feature usage | ✅ | `ActivityEvent` |
| Sign-in | ✅ | `ActivityEvent` |
| Admin mutations | ✅ | `AdminAuditLog` |
| Uncaught client errors | ✅ *(if DSN set)* | Sentry |
| Uncaught server / RSC errors | ✅ *(if DSN set)* | Sentry `onRequestError` |
| Handled/swallowed errors | ❌ `console` only | — |
| Sync failures, outbox drain failures | ❌ `console` only | — |
| API latency / error rates | ❌ | — |
| DB liveness | ✅ on demand | `/api/health` |
| Payment failures | ❌ `console.error` only | — |

---

## 7. Gaps and recommendations

| # | Gap | Impact | Label |
|---|---|---|---|
| 1 | `split_completed` and `mode_selected` are declared but never fired | The funnel PostHog was added for has no completion event — conversion cannot be measured | **[IMPLEMENTED]** |
| 2 | `identify()` never called | No person profiles, no cross-device attribution, no sign-out reset | **[IMPLEMENTED]** |
| 3 | No Sentry source-map upload (`withSentryConfig` absent) | Stack traces will be minified | **[INFERRED]** |
| 4 | No `Sentry.captureException` on any handled error path | Every deliberately-caught failure — sync, payment, email, referral, outbox — is invisible in production | **[IMPLEMENTED]** |
| 5 | `ErrorBoundary.onError` is never supplied | Section-level crashes are not reported | **[IMPLEMENTED]** |
| 6 | No `Sentry.setUser` | Errors cannot be tied to an account, even though `sendDefaultPii: false` would still allow an internal id | **[IMPLEMENTED]** |
| 7 | Four events use raw string literals instead of `EVENTS` constants | The drift the constant map exists to prevent | **[IMPLEMENTED]** |
| 8 | `share.created` beacon type is allowlisted but never sent | Dead vocabulary | **[IMPLEMENTED]** |
| 9 | No dev/prod separation for PostHog beyond leaving the key unset | Easy to pollute the production project from a laptop | **[IMPLEMENTED]** |
| 10 | No analytics consent mechanism | Compliance posture for the target market | **[UNKNOWN]** |
| 11 | Whether Sentry and PostHog DSN/keys are actually set in production | Both systems may be entirely dark today | **[UNKNOWN]** |
