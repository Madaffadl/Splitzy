# Splitzy — External Integrations

> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**

---

## 0. Inventory

Every external service the codebase talks to. "Inert when unconfigured" means the integration
degrades to a documented no-op rather than throwing.

| # | Service | SDK? | Purpose | Gate | Inert when unconfigured |
|---|---|---|---|---|---|
| 1 | **Supabase** | `@supabase/supabase-js`, `@supabase/ssr` | Auth (Google OAuth), PostgreSQL, Realtime Broadcast | none — core | ❌ hard dependency |
| 2 | **Google Generative AI** | `@google/generative-ai` | Receipt vision extraction | `GEMINI_API_KEY` | ⚠️ returns a 500 |
| 3 | **Prisma → PostgreSQL** | `@prisma/client` | All persistence | none — core | ❌ hard dependency |
| 4 | **Xendit** | ✗ raw `fetch` | Pro checkout invoices + webhook | `FLAG_XENDIT_CHECKOUT` + `XENDIT_SECRET_KEY` | ✅ 404 |
| 5 | **Resend** | ✗ raw `fetch` | Welcome email | `RESEND_API_KEY` | ✅ silent no-op |
| 6 | **Upstash Redis** | ✗ raw `fetch` | Distributed rate limiting | `FLAG_DISTRIBUTED_RATE_LIMIT` + `UPSTASH_*` | ✅ falls back to in-memory |
| 7 | **open.er-api.com** | ✗ raw `fetch` | FX rates → IDR | none (keyless) | ⚠️ 500 + "enter the rate manually" |
| 8 | **PostHog** | `posthog-js` (dynamic import) | Product analytics | `NEXT_PUBLIC_POSTHOG_KEY` | ✅ never even imported |
| 9 | **Sentry** | `@sentry/nextjs` | Error monitoring | `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | ✅ never initialised |
| 10 | **Vercel** | platform | Hosting, cron, edge | — | — |
| 11 | **GitHub Actions** | platform | CI + encrypted DB backup | — | — |
| 12 | **Google Fonts** | `next/font` | Inter, self-hosted at build | — | — |
| 13 | **Google Search Console** | meta tag | Ownership verification | `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | ✅ tag omitted |

**[INFERRED]** Four of the seven HTTP integrations use raw `fetch` rather than an SDK, each with the
same stated reasons: no dependency, and it runs on any runtime. This is a consistent architectural
preference, not an accident.

---

## 1. Supabase

**Role:** identity provider *and* primary datastore. The only integration the app cannot run
without.

### 1.1 Surfaces used **[IMPLEMENTED]**

| Surface | Where | Credential |
|---|---|---|
| Auth — `signInWithOAuth`, `getUser`, `onAuthStateChange`, `signOut` | browser | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Auth — `exchangeCodeForSession` | `GET /api/auth/callback` | anon key |
| Auth — session refresh | `src/proxy.ts` (edge) | anon key |
| Auth — `getUser` from a raw cookie header | `lib/api-auth.ts` | anon key |
| PostgreSQL | Prisma, everywhere | `DATABASE_URL` (PgBouncer :6543), `DIRECT_URL` (:5432) |
| Realtime Broadcast (HTTP, stateless) | `lib/realtime.ts` | **`SUPABASE_SERVICE_ROLE_KEY`** |

### 1.2 Credentials **[IMPLEMENTED]**

- **Anon key** — public by design, inlined into the browser bundle.
- **Service-role key** — server-only, used solely to POST a broadcast signal. Never sent to the
  client. It is nonetheless a full-bypass key living in the same environment as the app.
- **Connection strings** — `DATABASE_URL` uses the transaction pooler; `DIRECT_URL` is the direct
  connection used for DDL and the backup workflow.

`.env.example` warns that Preview/Staging deployments must point at a **separate** Supabase project;
[ENVIRONMENT_ISOLATION.md](../ENVIRONMENT_ISOLATION.md) records that this was deferred and work
proceeds "prod-direct" with additive-only migrations. **[IMPLEMENTED]**

### 1.3 Data sent **[IMPLEMENTED]**

Everything the product stores: user profile (email, name, avatar URL, Google id), trips, receipt
payloads (item names, amounts, participant names, optional bank/e-wallet details), payments, share
snapshots, activity events with denormalised emails, admin audit entries.

### 1.4 Failure behaviour **[IMPLEMENTED]**

| Failure | Behaviour |
|---|---|
| DB unreachable | `/api/health` → `503 { status: "degraded", db: "down" }`; other endpoints throw a 500 |
| `getUser()` non-401 error in the proxy | Request is **let through** rather than false-redirecting a signed-in user |
| `User` upsert fails in the auth callback | Login is **not** blocked — the Supabase session is already valid; the failure is logged only |
| Broadcast POST fails | Swallowed; clients still refetch on focus/reconnect |

### 1.5 Notes

- **[IMPLEMENTED]** CSP allows `https://*.supabase.co` and `wss://*.supabase.co`; the root layout
  emits `preconnect` + `dns-prefetch` to the Supabase origin to overlap the TLS handshake with
  parsing.
- **[IMPLEMENTED]** A known benign Supabase Web Locks race is filtered out of Sentry via
  `ignoreErrors`.
- **[UNKNOWN]** Whether Row Level Security is enabled — no policy SQL exists in the repo.

---

## 2. Google Generative AI (Gemini)

Fully documented in [ai-integration.md](./ai-integration.md). Integration summary:

| Property | Value |
|---|---|
| Model | `gemini-2.5-flash` |
| Call site | `POST /api/parse-receipt` — the only file importing the SDK |
| Credential | `GEMINI_API_KEY`, server-only, module-scope client |
| Data sent | The resized receipt **image** + the extraction prompt. No user id, email, or app data |
| Timeout | 45 s client-side abort (upstream still completes and is still billed) |
| Cost controls | 10 scans/min/IP · 15 scans/month for authenticated free users · 5 MB payload cap · client-side resize to 1920 px |
| Failure | `504 UPSTREAM_TIMEOUT` on abort, `500 INTERNAL_ERROR` otherwise; unparsable output returns `200` with an empty item list |
| Gap | Guests bypass the monthly quota entirely |

---

## 3. Xendit — payments

**File:** [src/lib/billing/xendit.ts](../../src/lib/billing/xendit.ts) — a ~90-line `fetch` wrapper.

### 3.1 Outbound: create invoice **[IMPLEMENTED]**

```
POST https://api.xendit.co/v2/invoices
Authorization: Basic base64(`${XENDIT_SECRET_KEY}:`)     ← key as username, empty password
```

Body: `external_id`, `amount` (29 000), `currency: "IDR"`, `description`, `payer_email`,
`success_redirect_url`, `failure_redirect_url`, `invoice_duration` (default 24 h).
Response consumed: `{ id, invoice_url, status }`.

**Data sent to Xendit:** the buyer's **email address**, the amount, and a description. No name, no
receipt content, no trip data.

### 3.2 Checkout flow **[IMPLEMENTED]** — `POST /api/billing/checkout`

1. `isServerEnabled("xenditCheckout")` → else `404`.
2. `assertSameOrigin` → `getAuthUser` → reject if already Pro (`isProActive`) → rate limit 10/min.
3. `isXenditConfigured()` → else `500 "Payments are not configured"` (the flag can be on before keys
   are provisioned).
4. **Persist a `pending` `Payment` row *before* calling Xendit**, keyed on
   `externalId = "pro_<userId>_<Date.now()>"` — *"so the webhook always has a row to reconcile
   against, even if the response is lost."*
5. Create the invoice, store `xenditId` + `invoiceUrl`, return `{ invoiceUrl }`.
6. On error, mark the row `failed` (with `.catch(() => {})`) and return `500`.

### 3.3 Inbound: webhook **[IMPLEMENTED]** — `POST /api/webhooks/xendit`

- `404` when the flag or `XENDIT_WEBHOOK_TOKEN` is unconfigured.
- Authenticated by `x-callback-token === XENDIT_WEBHOOK_TOKEN`. **No CSRF check** — correctly, since
  Xendit's servers are not same-origin.
- Unknown `external_id` → **`200 { received: true }`**, so Xendit stops retrying something that can
  never reconcile.
- `PAID` / `SETTLED`: atomic claim
  `updateMany({ where: { externalId, status: { not: "paid" } } })`. `count === 0` ⇒ duplicate
  delivery ⇒ `200 { alreadyProcessed: true }`. Otherwise set the user to `plan: "pro"` with
  `proExpiresAt = extendProExpiry(current, periodDays)`.
- `EXPIRED`: flip a still-`pending` row to `expired`.
- Sequential single-statement writes, **no interactive transaction**, to stay PgBouncer-safe.

### 3.4 Observations

| # | Note | Label |
|---|---|---|
| 1 | `verifyWebhookToken` uses `===` despite the comment calling it "constant-time-ish" | **[IMPLEMENTED]** |
| 2 | No signature verification beyond the shared token — that is Xendit's documented mechanism | **[IMPLEMENTED]** |
| 3 | Pro is a **one-time 30-day purchase, never auto-renewing**; `extendProExpiry` stacks from the later of now / current expiry so buying early wastes nothing | **[IMPLEMENTED]** |
| 4 | A checkout failure logs to `console.error` only — no Sentry capture, no alert | **[IMPLEMENTED]** |
| 5 | Whether the flag is on in production | **[UNKNOWN]** |

---

## 4. Resend — transactional email

**File:** [src/lib/email.ts](../../src/lib/email.ts).

```
POST https://api.resend.com/emails
Authorization: Bearer ${RESEND_API_KEY}
```

| Property | Value |
|---|---|
| From | `EMAIL_FROM` or `Splitzy <onboarding@splitzy.my.id>` |
| `reply_to` | **`adminsplitzy@gmail.com` — hardcoded** |
| Only message | `sendWelcomeEmail(to, name)` — sent once, on first sign-in, from the auth callback |
| Data sent | Recipient email + first name only |
| Inert | `sendEmail` returns `false` immediately when `RESEND_API_KEY` is unset |
| Failure | Logged, returns `false`; the caller `.catch()`es so login is never blocked |
| Content | Inline-styled HTML, English only, links to `${BRAND.siteUrl}/single` and `mailto:${BRAND.supportEmail}` |

**[IMPLEMENTED]** The hardcoded `reply_to` Gmail address is inconsistent with
[brand.ts](../../src/lib/brand.ts), which exists specifically because *"the footer hardcoded a
personal Gmail / Instagram / WhatsApp; those are removed in favour of product-owned channels so the
app reads as a product, not a personal side-project."* The same class of value survives here.

**[IMPLEMENTED]** No other transactional email exists — no receipt, no invite email, no payment
confirmation, no password reset (there are no passwords).

---

## 5. Upstash Redis — distributed rate limiting

**File:** [src/lib/rate-limit-redis.ts](../../src/lib/rate-limit-redis.ts).

| Property | Value |
|---|---|
| Transport | Upstash REST API over `fetch` — works on Node **and** Edge, no SDK |
| Algorithm | One sorted set per key, scored by timestamp. A single pipelined round-trip does: trim expired → add current → count → refresh TTL → read oldest (for an accurate `Retry-After`) |
| Gate | `FLAG_DISTRIBUTED_RATE_LIMIT` **and** both `UPSTASH_REDIS_REST_URL`/`_TOKEN` |
| Loading | `await import("@/lib/rate-limit-redis")` inside the async check, so the module never loads when the flag is off |
| Failure | **Throws**, and the caller *fails open* to the in-memory limiter — "rather than dropping the request" |
| Data sent | Only rate-limit keys: `"<scope>:u:<userId>"` or `"<scope>:ip:<address>"` |

**[IMPLEMENTED]** Only two call sites use the async variant (`parse-receipt`, `billing/checkout`).
Every other endpoint uses the synchronous in-memory limiter, so **turning the flag on today would
change the behaviour of two endpoints out of ~30 rate-limited ones.**

---

## 6. open.er-api.com — FX rates

**File:** [src/app/api/fx-rate/route.ts](../../src/app/api/fx-rate/route.ts).

| Property | Value |
|---|---|
| Endpoint | `GET https://open.er-api.com/v6/latest/<CODE>` |
| Auth | **None** — free tier, no API key |
| Contract | `GET /api/fx-rate?from=VND` → `{ rate, currency, updatedAt }`, where `rate` = IDR per 1 unit |
| Validation | Uppercased, trimmed, `.slice(0,10)`, must match `/^[A-Z]{2,10}$/`; `IDR` short-circuits to `rate: 1` |
| Caching | Process-local `Map` with a 1-hour TTL **plus** `fetch(..., { next: { revalidate: 3600 } })` |
| Data sent | Only the currency code — no user data |
| Failure | Logged, then `500 "Failed to fetch exchange rate. Enter the rate manually."` |
| Auth on our side | **None** — the endpoint is public and unrate-limited |

**[IMPLEMENTED]** The rate is **locked onto the receipt** at creation time (`Receipt.fxRate`), so a
later rate change never retroactively alters a settled split. `needsFxRate()` flags a foreign
receipt whose rate is missing or invalid, because `receiptInBaseCurrency` returns such a receipt
untouched and its native amounts would otherwise flow into IDR totals at 1:1.

**[IMPLEMENTED]** This is the only integration with **no key, no rate limit, and no auth** on our
side. An unauthenticated caller can drive arbitrary upstream requests (bounded by the 1-hour cache
per currency code, so the practical ceiling is one upstream call per code per hour per instance).

---

## 7. PostHog & 8. Sentry

Both fully documented in [analytics-monitoring.md](./analytics-monitoring.md). Integration summary:

| | PostHog | Sentry |
|---|---|---|
| Package | `posthog-js` | `@sentry/nextjs` |
| Loading | `import("posthog-js")` only when a key exists | Static, but every `init` is DSN-guarded |
| Data sent | Pathname pageviews + 11 explicit events. **No PII** — no email, name, receipt title, or amount | Stack traces, `environment`. `sendDefaultPii: false`; Session Replay off |
| Identification | `identify()` exists but is **never called** | `setUser()` never called |
| Failure | Silent no-op | Silent no-op |
| Gap | `split_completed` and `mode_selected` are declared but never fired | No source-map upload; no `captureException` on any handled path |

---

## 9. Vercel

| Capability | Usage | Evidence |
|---|---|---|
| Hosting | Next.js 16, edge proxy + serverless functions + static assets | — |
| **Cron** | One job: `/api/cron/expire-pro` at `0 3 * * *` | [vercel.json](../../vercel.json) |
| Injected env | `VERCEL_ENV`, `NEXT_PUBLIC_VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_REGION`, `NEXT_RUNTIME` | health route, Sentry configs |
| Cron authentication | `Authorization: Bearer ${CRON_SECRET}`; the route `503`s if the secret is unset so it can never run anonymously | [cron/expire-pro](../../src/app/api/cron/expire-pro/route.ts) |
| `x-vercel-cron` header | Accepted as an alternative credential by `/api/admin/cleanup` | [admin/cleanup](../../src/app/api/admin/cleanup/route.ts) |
| Trusted headers | `x-forwarded-for` (rate-limit key), `Host` (CSRF allowlist) | `lib/rate-limit.ts`, `lib/api-auth.ts` |

**[IMPLEMENTED]** `POST /api/admin/cleanup` is **not** in `vercel.json`, yet it accepts
`x-vercel-cron: 1`. **[UNKNOWN]** whether it is scheduled by some external means; as configured, it
appears never to run automatically — which means expired shares, lapsed saved splits, expired
invites and 30-day-old activity events are not being swept.

---

## 10. GitHub Actions

### CI — [ci.yml](../../.github/workflows/ci.yml) **[IMPLEMENTED]**

Two jobs on push-to-`main` and every PR, with `concurrency` cancelling superseded runs:

- **verify** (15 min): `npm ci` → lint → `tsc --noEmit` → `vitest run` → `next build`
- **e2e** (20 min, `needs: verify`): Chromium install → build → `playwright test`

Both use **placeholder** env values inline — the build only inlines `NEXT_PUBLIC_*` and runs
`prisma generate` offline, so no live service is contacted and no real secret is needed.

### Backup — [backup.yml](../../.github/workflows/backup.yml) **[IMPLEMENTED]**

Daily at 18:00 UTC (01:00 WIB), plus `workflow_dispatch` for on-demand runs before risky migrations.

1. Fail fast if `SUPABASE_DIRECT_URL` or `BACKUP_PASSPHRASE` is missing.
2. `docker run --rm postgres:17 … pg_dump "$DBURL" --no-owner --no-privileges -Fc` — a pinned newer
   client safely dumping an older server.
3. **Sanity gate**: a dump under 2000 bytes is treated as a failure, so a silently-empty dump is
   never stored as if it were good.
4. `gpg --cipher-algo AES256 --symmetric`, then `rm -f` the plaintext.
5. Upload as an artifact, 30-day retention, `if-no-files-found: error`.

**[IMPLEMENTED]** The rationale is explicit: the production DB is on the Supabase **free tier**,
which has no scheduled backups, so this is the only thing guaranteeing the RPO in
[DISASTER_RECOVERY.md](../DISASTER_RECOVERY.md).

Required secrets: `SUPABASE_DIRECT_URL`, `BACKUP_PASSPHRASE`.

---

## 11. Google Fonts & Search Console **[IMPLEMENTED]**

- **Inter** via `next/font/google` with `subsets: ["latin"]` — self-hosted at build time, so no
  runtime request to Google. CSP nonetheless allows `fonts.googleapis.com` and `fonts.gstatic.com`.
- **Search Console** ownership is asserted with a meta tag rendered only when
  `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` is set. The layout comment notes verification is the
  prerequisite for everything else in SEO: without it there is no index-coverage report, no query
  data, and no way to submit the sitemap.

---

## 12. Not integrated **[IMPLEMENTED]**

Worth stating so their absence is not mistaken for a gap in this document: no Stripe/PayPal
(Xendit only), no Twilio/WhatsApp Business API (WhatsApp sharing is a plain `wa.me` link), no S3 or
any blob storage (receipt images are never persisted — they go to Gemini and are discarded), no
Cloudinary, no Algolia, no Segment, no LaunchDarkly, no Auth0/Clerk, no Redis beyond the
rate-limit store.

---

## 13. Cross-cutting risks

| # | Risk | Label |
|---|---|---|
| 1 | **Single point of failure.** Supabase is auth *and* database. Its loss is a total outage; the DR runbook is the only mitigation | **[IMPLEMENTED]** |
| 2 | Payment, email, and referral failures reach `console.error` only — no alerting anywhere | **[IMPLEMENTED]** |
| 3 | `/api/fx-rate` is public, keyless and unrate-limited | **[IMPLEMENTED]** |
| 4 | `SUPABASE_SERVICE_ROLE_KEY` is a full-bypass credential held for one narrow use (broadcast) | **[IMPLEMENTED]** |
| 5 | `reply_to` in outbound email is a hardcoded personal Gmail | **[IMPLEMENTED]** |
| 6 | Webhook and cron secrets are compared with `===`, not constant-time | **[IMPLEMENTED]** |
| 7 | The cleanup job appears unscheduled, so retention policies may not be executing | **[UNKNOWN]** / **[IMPLEMENTED]** absence from `vercel.json` |
| 8 | Every third-party call except Gemini has no explicit timeout — a slow upstream ties up a worker | **[IMPLEMENTED]** |
| 9 | No secret rotation procedure is documented for Gemini, Xendit, Resend, Upstash, or the Supabase service-role key | **[UNKNOWN]** |
