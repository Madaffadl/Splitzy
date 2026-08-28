# Splitzy — System Overview

> Reverse-engineered from the codebase. Every claim carries an evidence label:
> **[IMPLEMENTED]** confirmed in code · **[INFERRED]** strongly implied ·
> **[ASSUMED]** reasonable business reading, unproven · **[UNKNOWN]** insufficient evidence.

---

## 1. What Splitzy is

**[IMPLEMENTED]** Splitzy is a bilingual (English / Bahasa Indonesia) Progressive Web App for
splitting shared bills. A user photographs a receipt, an AI vision model extracts the line items,
fees and discounts, the user assigns items to named people, and the app computes each person's
exact share and the *minimum set of transfers* needed to settle up.
Evidence: [src/app/api/parse-receipt/route.ts](../../src/app/api/parse-receipt/route.ts),
[src/lib/receipt/calculations.ts](../../src/lib/receipt/calculations.ts),
[src/lib/i18n/dictionaries/en.ts](../../src/lib/i18n/dictionaries/en.ts).

**[IMPLEMENTED]** Three product modes exist, each with its own route and view component:

| Mode | Route | View | Persistence model |
|---|---|---|---|
| Single receipt | `/single` | `SingleSplitView` | local-first (localStorage), optional server save |
| Multiple receipts | `/multiple` | `MultipleReceiptView` | local-first, optional server save, **auth-gated** |
| Travel Spend (trips) | `/travel` | `TravelSpendView` | local-first for guests, cloud-synced for signed-in users |

Evidence: [src/app/single/page.tsx](../../src/app/single/page.tsx),
[src/app/multiple/page.tsx](../../src/app/multiple/page.tsx),
[src/app/travel/page.tsx](../../src/app/travel/page.tsx),
[src/proxy.ts](../../src/proxy.ts) (`protectedPaths = ["/multiple", "/history"]`).

**[IMPLEMENTED]** The market is Indonesia: IDR is the base settlement currency, pricing is in
Rupiah, and the AI prompt is tuned for Indonesian receipt vocabulary (`PB1`, `PPN`, `Ongkos Kirim`,
`Diskon Member`). Multi-currency is supported for travel, always converted back to IDR via a
locked FX rate.
Evidence: [src/lib/billing/plans.ts](../../src/lib/billing/plans.ts),
[src/lib/currencies.ts](../../src/lib/currencies.ts),
[src/app/api/parse-receipt/route.ts:179-190](../../src/app/api/parse-receipt/route.ts#L179-L190).

---

## 2. Technology stack

### 2.1 Runtime & framework

| Technology | Version (package.json) | Purpose | Why (evidence) |
|---|---|---|---|
| **Next.js** | `^16.1.1` | Full-stack framework — App Router, route handlers, metadata API, image optimisation | [package.json](../../package.json) |
| **React** | `^19.0.0` | UI runtime; Server + Client Components | [package.json](../../package.json) |
| **React DOM** | `^19.0.0` | DOM renderer | [package.json](../../package.json) |
| **TypeScript** | `~5.9.0` | `strict: true`, `noEmit`, path alias `@/* → ./src/*` | [tsconfig.json](../../tsconfig.json) |
| **Node.js** | 22 in CI | Build/runtime target | [.github/workflows/ci.yml](../../.github/workflows/ci.yml) |
| **Turbopack** | bundled with Next | Dev bundler; `turbopack.root` pinned to repo root | [next.config.mjs](../../next.config.mjs) |

**[IMPLEMENTED]** Next.js 16 naming: the edge middleware lives at `src/proxy.ts`, not
`src/middleware.ts`. Next 16 renamed the convention; the file still exports a default handler and a
`config.matcher`. Evidence: [src/proxy.ts](../../src/proxy.ts).

**[INFERRED]** The README claims "Next.js 15 (App Router)" — that is stale. `package.json` pins
`^16.1.1`. Evidence: [README.md](../../README.md) vs [package.json](../../package.json).

### 2.2 UI & styling

| Technology | Version | Purpose |
|---|---|---|
| **Tailwind CSS** | `^3.4.1` | Utility-first styling; custom theme in [tailwind.config.ts](../../tailwind.config.ts) |
| **PostCSS** | `^8` | Tailwind pipeline ([postcss.config.mjs](../../postcss.config.mjs)) |
| **Radix UI** | checkbox `^1.1.3`, dialog `^1.1.4`, label `^2.1.1`, select `^2.1.4`, slot `^1.1.1` | Unstyled accessible primitives |
| **class-variance-authority** | `^0.7.1` | Variant-driven component APIs (`button.tsx`, `badge.tsx`) |
| **clsx** + **tailwind-merge** | `^2.1.1` / `^3.6.0` | `cn()` helper in [src/lib/utils.ts](../../src/lib/utils.ts) |
| **next-themes** | `^0.4.6` | Dark mode via `class` attribute; default `light` |
| **lucide-react** | `^1.24.0` | Icon set, re-exported through [src/components/ui/icons.tsx](../../src/components/ui/icons.tsx) |
| **@phosphor-icons/react** | `^2.1.10` | Additional icons |
| **next/font (Inter)** | — | Self-hosted Google font, `subsets: ["latin"]` |

**[INFERRED]** The `src/components/ui/*` set (button, card, dialog, input, label, select, checkbox,
badge, skeleton, spinner, toast, textarea, empty-state, sticky-action-bar) is a hand-rolled
**shadcn/ui-style** layer — Radix primitives + CVA + Tailwind — rather than the shadcn CLI output.
There is no `components.json`. Evidence: [src/components/ui/](../../src/components/ui/).

### 2.3 State management

**[IMPLEMENTED]** There is **no state library** (no Redux/Zustand/Jotai/TanStack Query). State is:

- React `useState`/`useReducer` inside the three big view components.
- `useLocalStorage` — typed localStorage hook that surfaces `PersistError` (`quota` | `unavailable`)
  so a failed write is visible instead of silent.
  [src/hooks/useLocalStorage.ts](../../src/hooks/useLocalStorage.ts)
- `useHybridState` — same API, currently delegates to localStorage for both guest and
  authenticated users. [src/hooks/useHybridState.ts](../../src/hooks/useHybridState.ts)
- `useTravelData` — the one genuinely complex store: a local-first cloud sync layer with a
  per-account mirror, a durable **outbox**, an optimistic-lock version, and a member
  change-request buffer. 1128 lines.
  [src/hooks/useTravelData.ts](../../src/hooks/useTravelData.ts)
- React Context for auth only: `AuthContext` in
  [src/hooks/useAuth.ts](../../src/hooks/useAuth.ts), provided by
  [AuthProvider](../../src/components/providers/AuthProvider.tsx).

### 2.4 Forms

**[IMPLEMENTED]** No form library (no react-hook-form, no Formik, no zod). Forms are controlled
inputs with hand-written validation:

- Client: input caps in [src/lib/receipt/input-limits.ts](../../src/lib/receipt/input-limits.ts) and
  shared ceilings in [src/lib/limits.ts](../../src/lib/limits.ts).
- Server: bespoke runtime validators in [src/lib/validation.ts](../../src/lib/validation.ts)
  (502 lines) throwing `ValidationError`. The file states the reason explicitly: *"Avoids adding zod
  as a dependency for the small number of POST/PUT shapes we actually validate. If validation needs
  grow, swap to zod."*

### 2.5 Data layer

| Technology | Version | Purpose |
|---|---|---|
| **Prisma ORM** | `^6.19.3` (`prisma` + `@prisma/client`) | Schema, client generation, all DB access |
| **PostgreSQL** | via Supabase | Single primary datastore |
| **Supabase Postgres pooler** | — | `DATABASE_URL` = PgBouncer port 6543; `DIRECT_URL` = 5432 |

**[IMPLEMENTED]** `prisma generate` runs in both `postinstall` and `build`. There is **no
`prisma/migrations/` directory** — migrations are hand-written SQL in
[prisma/sql/](../../prisma/sql/) applied through the Supabase SQL editor, because (per the file
headers) `prisma db push` is blocked by the sandbox.
Evidence: [package.json](../../package.json), [prisma/sql/](../../prisma/sql/).

**[IMPLEMENTED]** PgBouncer transaction pooling constrains the code: interactive
`$transaction(async tx => …)` is avoided in favour of the array form.
Evidence: [src/lib/travel/apply-change-ops.ts](../../src/lib/travel/apply-change-ops.ts) header comment.

### 2.6 Authentication

| Technology | Version | Purpose |
|---|---|---|
| **@supabase/supabase-js** | `^2.103.0` | Auth client |
| **@supabase/ssr** | `^0.10.2` | Cookie-based session for Server Components, route handlers, proxy |

**[IMPLEMENTED]** Google OAuth is the only sign-in method. See
[authentication.md](./authentication.md).

### 2.7 AI

| Technology | Version | Purpose |
|---|---|---|
| **@google/generative-ai** | `^0.24.1` | Gemini SDK |
| **Model** | `gemini-2.5-flash` | Receipt vision extraction |

**[IMPLEMENTED]** Server-side only, in `POST /api/parse-receipt`. See
[ai-integration.md](./ai-integration.md).

### 2.8 Analytics & monitoring

| Technology | Version | Purpose | Default state |
|---|---|---|---|
| **posthog-js** | `^1.410.2` | Product funnel analytics | **inert** — dynamically imported only when `NEXT_PUBLIC_POSTHOG_KEY` is set |
| **@sentry/nextjs** | `^10.69.0` | Error + trace monitoring (client, server, edge) | **inert** — every `Sentry.init` is guarded by a DSN env var |
| **ActivityEvent** (in-house) | — | Admin-facing per-user feature usage log | always on for signed-in users |
| **AdminAuditLog** (in-house) | — | Append-only trail of privileged admin mutations | always on |

See [analytics-monitoring.md](./analytics-monitoring.md).

### 2.9 Payments, email, rate limiting

| Technology | Purpose | Gate |
|---|---|---|
| **Xendit Invoice API** (raw `fetch`, no SDK) | One-time Rp 29.000 → 30 days of Pro | `FLAG_XENDIT_CHECKOUT` **and** `XENDIT_SECRET_KEY` |
| **Resend REST API** (raw `fetch`, no SDK) | Welcome email on first sign-in | `RESEND_API_KEY` |
| **Upstash Redis REST** (raw `fetch`, no SDK) | Distributed sliding-window rate limit | `FLAG_DISTRIBUTED_RATE_LIMIT` + `UPSTASH_*` |
| **open.er-api.com** | Free FX rates (no key) | always on, 1-hour in-memory cache |

**[INFERRED]** A consistent architectural choice: every third-party integration is a thin
`fetch` wrapper rather than an SDK, and each is inert until its env var exists. The stated reasons
are "no dependency" and "runs on any runtime".
Evidence: [src/lib/billing/xendit.ts](../../src/lib/billing/xendit.ts),
[src/lib/email.ts](../../src/lib/email.ts),
[src/lib/rate-limit-redis.ts](../../src/lib/rate-limit-redis.ts).

### 2.10 Testing

| Technology | Version | Scope |
|---|---|---|
| **Vitest** | `^4.1.10` | Unit tests, `environment: "node"`, globals on, `e2e/**` excluded |
| **@testing-library/react** | `^16.3.2` | Component testing |
| **happy-dom** | `^20.10.6` | DOM for tests; a setup shim re-installs `localStorage` because Node 26 defines it as a getter-only accessor |
| **Playwright** | `^1.62.1` | E2E against a production build on port 3100, Chromium only |

**[IMPLEMENTED]** 36 unit test files exist, weighted heavily toward money math and validation
(`calculations.test.ts`, `calculations-extended.test.ts`, `settle-up.test.ts`,
`validation.test.ts`, `shared-summary.test.ts`, `travel-*.test.ts`, `entitlements.test.ts`).
Two E2E specs: [e2e/smoke.spec.ts](../../e2e/smoke.spec.ts) (rendering + a substantial SEO
regression suite) and [e2e/wizard-navigation.spec.ts](../../e2e/wizard-navigation.spec.ts).
Evidence: `git ls-files '*.test.ts'`, [vitest.config.ts](../../vitest.config.ts),
[playwright.config.ts](../../playwright.config.ts).

### 2.11 Linting

**[IMPLEMENTED]** ESLint `^9.39.5` flat config with `eslint-config-next ^16.1.1`.
Evidence: [eslint.config.mjs](../../eslint.config.mjs).

### 2.12 Deployment & CI/CD

| Technology | Purpose |
|---|---|
| **Vercel** | Hosting. `vercel.json` declares one cron: `/api/cron/expire-pro` daily at 03:00 UTC |
| **GitHub Actions — CI** | On push to `main` and every PR: lint → `tsc --noEmit` → `vitest run` → `next build` → Playwright E2E (gated on the first job) |
| **GitHub Actions — Backup** | Daily 18:00 UTC `pg_dump -Fc` via `postgres:17` Docker image, GPG AES-256 encrypted, uploaded as a 30-day artifact |

Evidence: [vercel.json](../../vercel.json), [.github/workflows/ci.yml](../../.github/workflows/ci.yml),
[.github/workflows/backup.yml](../../.github/workflows/backup.yml).

**[IMPLEMENTED]** CI needs no real secrets — the build only inlines `NEXT_PUBLIC_*` and runs
`prisma generate` offline; placeholder env values are supplied inline.

---

## 3. Environment variables

Every variable declared in [.env.example](../../.env.example), plus two found in code but
**absent** from the example file.

| Variable | Scope | Purpose | Behaviour when unset |
|---|---|---|---|
| `GEMINI_API_KEY` | server | Google Gemini vision key | `/api/parse-receipt` returns `INTERNAL_ERROR` |
| `MAINTENANCE_MODE` | server | `"true"` redirects all traffic to `/maintenance` | normal operation |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | public | Footer/legal contact | falls back to `support@splitzy.my.id` |
| `ADMIN_BOOTSTRAP_EMAILS` | server | Comma-separated lockout-recovery admin allowlist | empty set; admin comes only from the DB `role` column |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL | auth + realtime broken (non-null asserted in code) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key | same |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Realtime broadcast sender | broadcast silently skipped |
| `DATABASE_URL` | server | Prisma runtime connection (PgBouncer, 6543) | all DB access fails |
| `DIRECT_URL` | server | Prisma direct connection (5432), used for DDL/backup | migrations/backup fail |
| `NEXT_PUBLIC_FLAG_PRICING_PAGE` | public flag | `/pricing` page + upgrade prompts | OFF → `/pricing` calls `notFound()` and is dropped from the sitemap |
| `NEXT_PUBLIC_FLAG_REALTIME` | public flag | Live trip collaboration broadcast | OFF → clients refetch on focus/reconnect only |
| `FLAG_XENDIT_CHECKOUT` | server flag | Checkout + webhook routes | OFF → both return 404 |
| `FLAG_DISTRIBUTED_RATE_LIMIT` | server flag | Upstash-backed limiter | OFF → per-instance in-memory limiter |
| `XENDIT_SECRET_KEY` | server | Xendit Basic-auth key | checkout returns `INTERNAL_ERROR` even with the flag on |
| `XENDIT_WEBHOOK_TOKEN` | server | `x-callback-token` verification value | webhook returns 404 |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | server | Distributed limiter store | falls back to in-memory |
| `SENTRY_DSN` | server | Sentry server + edge DSN | SDK never initialises |
| `NEXT_PUBLIC_SENTRY_DSN` | public | Sentry browser DSN (also a server fallback) | SDK never initialises |
| `SENTRY_TRACES_SAMPLE_RATE` | server | Trace sampling | defaults to `0.1` |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | public | Browser trace sampling | defaults to `0.1` |
| `NEXT_PUBLIC_POSTHOG_KEY` | public | PostHog project key | `posthog-js` is never imported or shipped |
| `NEXT_PUBLIC_POSTHOG_HOST` | public | PostHog ingest host | defaults to `https://us.i.posthog.com` |
| `CRON_SECRET` | server | Bearer token for `/api/cron/*` | cron route returns **503** |
| `RESEND_API_KEY` | server | Transactional email | `sendEmail` returns `false`, sends nothing |
| `EMAIL_FROM` | server | Verified sender | defaults to `Splitzy <onboarding@splitzy.my.id>` |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | public | Search Console meta tag | tag omitted |
| **`CLEANUP_TOKEN`** | server | **Not in `.env.example`.** Bearer token for `POST /api/admin/cleanup`. Without it the route 503s unless the caller sends `x-vercel-cron: 1` | cleanup unusable outside Vercel Cron |
| **`NEXT_PUBLIC_APP_URL`** | public | **Not in `.env.example`.** Extra allowed origin for the CSRF same-origin check | only the request `Host` is trusted |

Evidence for the two undocumented ones:
[src/app/api/admin/cleanup/route.ts:27](../../src/app/api/admin/cleanup/route.ts#L27),
[src/lib/api-auth.ts](../../src/lib/api-auth.ts) (`assertSameOrigin`).

Vercel-injected (read, never set by us): `VERCEL_ENV`, `NEXT_PUBLIC_VERCEL_ENV`,
`VERCEL_GIT_COMMIT_SHA`, `VERCEL_REGION`, `NEXT_RUNTIME`, `NODE_ENV`, `CI`. **[IMPLEMENTED]**

---

## 4. Feature flags

**[IMPLEMENTED]** Central registry at [src/lib/flags.ts](../../src/lib/flags.ts). Every flag
defaults **OFF**; a missing or empty env var means disabled. Truthy values: `1`, `true`, `on`, `yes`.

Public flags must be resolved through a static map (`PUBLIC_FLAG_VALUE`) because the bundler only
inlines `process.env.NEXT_PUBLIC_FOO` when written as a literal — a dynamic `process.env[name]`
lookup reads `undefined` in the browser.

Contracted (graduated to permanent, no longer flagged): the new landing page, the dashboard, and
onboarding. Dropped without ever being wired: `designSystemV2`. **[IMPLEMENTED]**

---

## 5. Repository map

```
Splitzy/
├── .github/workflows/     ci.yml, backup.yml
├── docs/                  this documentation + 4 pre-existing runbooks
├── e2e/                   Playwright specs (smoke, wizard-navigation)
├── prisma/
│   ├── schema.prisma      15 models
│   └── sql/               hand-applied additive migrations
├── public/                sw.js, PWA icons, brand images
├── src/
│   ├── app/               App Router: 22 pages + 40 route handler files
│   ├── components/        auth, billing, dashboard, history, i18n, landing,
│   │                      layout, onboarding, pages, providers, receipt,
│   │                      referral, seo, travel, ui
│   ├── hooks/             10 hooks (auth, storage, travel data, save, quota)
│   ├── lib/               admin, billing, data, i18n, receipt, seo, supabase,
│   │                      travel + cross-cutting utilities
│   ├── types/index.ts     canonical client-side domain types
│   ├── proxy.ts           edge middleware (Next 16 naming)
│   ├── instrumentation.ts / instrumentation-client.ts
│   └── sentry.{server,edge}.config.ts
├── next.config.mjs        security headers, CSP (report-only), X-API-Version
├── vercel.json            cron schedule
└── tailwind.config.ts
```

---

## 6. Known gaps and open questions

| # | Item | Label |
|---|---|---|
| 1 | `CLEANUP_TOKEN` and `NEXT_PUBLIC_APP_URL` are used in code but missing from `.env.example` | **[IMPLEMENTED]** gap |
| 2 | No `prisma/migrations/` — schema drift between `schema.prisma` and production can only be verified manually | **[IMPLEMENTED]** risk |
| 3 | CSP is **report-only**; `'unsafe-inline'`/`'unsafe-eval'` still present in `script-src` | **[IMPLEMENTED]** |
| 4 | Whether Supabase Row Level Security is enabled on any table — no policy SQL exists in the repo | **[UNKNOWN]** |
| 5 | Whether `POST /api/admin/cleanup` is actually scheduled anywhere (`vercel.json` declares only the Pro-expiry cron) | **[UNKNOWN]** |
| 6 | README states Next.js 15 and omits Travel/Pro/admin entirely | **[IMPLEMENTED]** staleness |

---

*See also: [architecture.md](./architecture.md) · [frontend.md](./frontend.md) ·
[backend.md](./backend.md) · [../database/data-model.md](../database/data-model.md) ·
[../api/api-overview.md](../api/api-overview.md)*
