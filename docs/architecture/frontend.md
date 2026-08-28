# Splitzy — Frontend Architecture

> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**

---

## 1. App Router structure **[IMPLEMENTED]**

Every route discovered under `src/app/`. `S` = Server Component, `C` = Client Component
(`"use client"`).

### 1.1 Public / marketing

| Route | File | Kind | Notes |
|---|---|---|---|
| `/` | `app/page.tsx` | S | English landing. Renders `NewLanding` + `WebPage` and `FAQPage` JSON-LD |
| `/id` | `app/id/page.tsx` | S | Indonesian landing. Wraps content in `<div lang="id-ID">` |
| `/about` | `app/about/page.tsx` | S | `AboutContent` (EN) |
| `/id/about` | `app/id/about/page.tsx` | S | `AboutContent` (ID) |
| `/faq` | `app/faq/page.tsx` | S | `FaqContent` (EN) |
| `/id/faq` | `app/id/faq/page.tsx` | S | `FaqContent` (ID) |
| `/privacy` | `app/privacy/page.tsx` | S | `ContentPageShell`, `LAST_UPDATED = "3 August 2026"` |
| `/terms` | `app/terms/page.tsx` | S | `ContentPageShell` |
| `/pricing` | `app/pricing/page.tsx` | S (async) | `notFound()` unless `pricingPage` flag is on. Reads `?status=success\|failed` |

### 1.2 Tool routes

| Route | File | Kind | Notes |
|---|---|---|---|
| `/single` | `app/single/page.tsx` | S wrapper → `SingleSplitView` (C) | `Suspense fallback={null}` so `useSearchParams` doesn't force it dynamic |
| `/multiple` | `app/multiple/page.tsx` | S wrapper → `MultipleReceiptView` (C) | Same pattern. **Auth-gated in `proxy.ts`** |
| `/travel` | `app/travel/page.tsx` | S wrapper → `TravelSpendView` (C) | Same pattern; reads `?trip` / `?view` |

**[IMPLEMENTED]** The server-wrapper / client-view split exists so each tool route can export
`metadata` — a Client Component cannot. Before the split, `/single` inherited the root layout's
canonical, which pointed at the homepage and told Google the page was a duplicate. The comment in
[src/app/single/page.tsx](../../src/app/single/page.tsx) states this directly.

### 1.3 Authenticated surfaces

| Route | File | Kind | Notes |
|---|---|---|---|
| `/dashboard` | `app/dashboard/page.tsx` | S wrapper → `DashboardClient` (C) | `robots: { index: false, follow: false }` |
| `/history` | `app/history/page.tsx` | C | Renders its own sign-in gate instead of bouncing to the landing page |
| `/history/[id]` | `app/history/[id]/page.tsx` | C | Redirects to `/?login=required&redirect=…` when signed out |
| `/history/layout.tsx` | — | S | Thin layout that exists only to declare `noindex` for both history routes |
| `/admin` | `app/admin/page.tsx` | C | Admin console: users, quota, bans, roles, activity, audit |
| `/admin/layout.tsx` | — | S | `noindex` |

### 1.4 Public link surfaces

| Route | File | Kind | Notes |
|---|---|---|---|
| `/s/[code]` | `app/s/[code]/page.tsx` | S (async) | `dynamic = "force-dynamic"`. Reads `SharedSummary` straight from Prisma, renders read-only. Distinguishes *expired* from *not found* |
| `/share` | `app/share/page.tsx` | C | Decodes a base64 payload from `window.location.hash` — never sent to the server, so it works for guests and leaks nothing to request logs |
| `/invite/[token]` | `app/invite/[token]/page.tsx` | C | Fetches invite info, offers sign-in, then joins and routes to `/travel?trip=<id>` |

### 1.5 Operational / conventional

| File | Purpose |
|---|---|
| `app/layout.tsx` (S) | Root layout — the only `<html>`/`<body>` in the app |
| `app/error.tsx` (C) | Route-level error boundary; shows `error.message` only outside production |
| `app/not-found.tsx` (C) | 404 page |
| `app/maintenance/page.tsx` (C) + `layout.tsx` (S) | Maintenance page, `noindex` |
| `app/manifest.ts` | PWA manifest, served at `/manifest.webmanifest` |
| `app/robots.ts` | `robots.txt` |
| `app/sitemap.ts` | `sitemap.xml`, flag-aware |
| `app/opengraph-image.tsx` | 1200×630 `ImageResponse`, generated at build time |
| `app/twitter-image.tsx` | Twitter card image |
| `app/manifest-icons.test.ts` | Asserts declared manifest icon `sizes` match the real files on disk |

**[IMPLEMENTED]** There are **no `loading.tsx` files** anywhere. Loading state is handled inside
components (spinners, skeletons) and via explicit `Suspense` boundaries. There is exactly one
`error.tsx` (root) and one `not-found.tsx`.
Evidence: `git ls-files 'src/app/**'`.

---

## 2. Layout hierarchy **[IMPLEMENTED]**

```
app/layout.tsx  (RootLayout — the only <html>)
├── <html lang={HTML_LANG[DEFAULT_LOCALE]}>   ← "en"
├── preconnect + dns-prefetch to the Supabase origin
└── <body class={Inter}>
    ├── <JsonLd data={siteGraph(DEFAULT_DICT)} />        Organization + WebSite + SoftwareApplication
    └── ThemeProvider   (next-themes, attribute="class", defaultTheme="light")
        └── ToastProvider        ← wraps AuthProvider so auth can fire toasts
            └── AuthProvider
                ├── skip link ("Skip to content", WCAG 2.4.1)
                ├── <RegisterServiceWorker />
                ├── <PwaInstallTelemetry />
                ├── <AnalyticsProvider />
                ├── <OnboardingModal />
                ├── <Suspense><RefCapture /></Suspense>   ← uses useSearchParams
                └── <div id="main-content"> {children} </div>
```

Nested layouts: `app/history/layout.tsx`, `app/admin/layout.tsx`, `app/maintenance/layout.tsx` —
all three are **metadata-only** server layouts that return `children` unchanged. Their sole job is
declaring `robots: { index: false }` for Client-Component pages that cannot export `metadata`.

**[IMPLEMENTED]** `ToastProvider` deliberately wraps `AuthProvider` so `AuthProvider` can call
`useToast()` — it fires a "Signed out" toast when a session expires, skipping the very first auth
resolution so a visitor who was simply never logged in is not told they were signed out.

**[IMPLEMENTED]** There is no per-locale root layout. The Indonesian tree sets `lang` on a content
wrapper instead, because splitting into per-locale root layouts would force a full page reload on
every cross-locale navigation. Rationale documented in
[src/app/id/page.tsx](../../src/app/id/page.tsx).

---

## 3. Client vs Server component usage

**[IMPLEMENTED]** Of the 28 `.tsx` files under `app/`, **20 are Server Components** and **8 are
Client Components**. Across the whole of `src/`, 59 files carry `"use client"` (pages + components
+ hooks + `lib/analytics.ts` + `lib/i18n/use-locale.ts`).

The dividing rule observed throughout:

- **Server** — anything that needs `metadata`, reads the DB directly (`/s/[code]`), or is
  static marketing copy.
- **Client** — anything interactive, anything touching `localStorage`, and anything using the
  Supabase browser client.

**[INFERRED]** `NewLanding` is *not* marked `"use client"`; it is a Server Component that composes
client islands (`ThemeToggle`, `AuthButton`, `LoginBanner`, `LocaleSync`) — keeping the largest
marketing surface out of the client bundle.

---

## 4. Component inventory **[IMPLEMENTED]**

| Directory | Components |
|---|---|
| `components/ui/` | `button`, `badge`, `card`, `checkbox`, `dialog`, `empty-state`, `icons`, `input`, `label`, `select`, `skeleton`, `spinner`, `sticky-action-bar`, `textarea`, `toast`, `Logo` |
| `components/receipt/` | `ReceiptInput` (AI scan), `ReceiptEditor`, `ItemsTable`, `ParticipantManager`, `FeesInput`, `DiscountsInput`, `SummaryPanel`, `Stepper` |
| `components/pages/` | `SingleSplitView` (914 L), `MultipleReceiptView` (675 L), `TravelSpendView` (2086 L), `AboutContent`, `FaqContent` |
| `components/providers/` | `ThemeProvider`, `AuthProvider`, `AnalyticsProvider`, `ErrorBoundary`, `RegisterServiceWorker`, `PwaInstallTelemetry` |
| `components/layout/` | `AppFooter`, `ContentPageShell`, `ThemeToggle` |
| `components/auth/` | `AuthButton`, `GuestLimitDialog` |
| `components/billing/` | `UpgradeButton`, `ScanQuotaPaywall`, `SuccessCelebration` |
| `components/dashboard/` | `DashboardClient` |
| `components/history/` | `ReceiptHistoryList`, `ReceiptHistoryCard` |
| `components/i18n/` | `LocaleSwitcher`, `LocaleSync` |
| `components/landing/` | `NewLanding`, `LoginBanner` |
| `components/onboarding/` | `OnboardingModal` |
| `components/referral/` | `RefCapture`, `ReferralCard` |
| `components/seo/` | `JsonLd` |
| `components/travel/` | `ChangeRequests` (`ChangeOpList`, `ReviewInbox`, `ProposalBar`) |

**[IMPLEMENTED]** `icons.tsx` is a single re-export barrel over `lucide-react`, so icon usage across
the app goes through one module.

**[IMPLEMENTED]** `JsonLd` escapes `<` as `<` when serialising, so a stray `</script>` inside a
string value can never break out of the tag. It needs no CSP nonce because
`application/ld+json` is data, not script.

---

## 5. State management **[IMPLEMENTED]**

### 5.1 Hooks

| Hook | File | Responsibility |
|---|---|---|
| `useAuth` / `useAuthProvider` | `hooks/useAuth.ts` | Supabase session + `/api/auth/me` DB user; `signIn(redirectTo)`, `signOut()` (which also purges 7 localStorage keys) |
| `useLocalStorage` | `hooks/useLocalStorage.ts` | Typed persistence returning `[value, set, reset, persistError]`. Classifies failures as `quota` or `unavailable` across Chrome/Firefox/Safari quirks |
| `useHybridState` | `hooks/useHybridState.ts` | Same API; currently delegates to localStorage for guest **and** authenticated users |
| `useTravelData` | `hooks/useTravelData.ts` | The cloud sync engine — see §6 |
| `useSaveSplit` | `hooks/useSaveSplit.ts` | Save/resume for Single and Multiple; remembers `{id, version, expiresAt, shareCode}` so a second press updates rather than duplicates |
| `useGuestLimit` | `hooks/useGuestLimit.ts` | `MAX_GUEST_SPLITS = 3` before a sign-in prompt |
| `useNameSuggestions` | `hooks/useNameSuggestions.ts` | Recalls previously used participant names |
| `usePaidSettlements` | `hooks/usePaidSettlements.ts` | Settle-up checkbox state |
| `usePersistErrorToast` | `hooks/usePersistErrorToast.ts` | Turns a `PersistError` into a user-visible toast |

### 5.2 Storage keys **[IMPLEMENTED]**

| Key | Written by | Cleared on sign-out |
|---|---|---|
| `splitbill-single` | Single editor draft | yes |
| `splitbill-trips` | legacy trips | yes |
| `splitzy-history` | local history | yes |
| `splitzy-guest-splits-count` | `useGuestLimit` | yes |
| `splitzy-travel` | guest Travel store | no (guest-scoped) |
| `splitzy-travel-mirror` | per-account cloud mirror | yes |
| `splitzy-travel-outbox` | pending receipt writes | yes |
| `splitzy-travel-proposals` | member change buffers | — |
| `splitzy-travel-draft` | in-progress travel receipt | yes |
| `splitzy-locale` | `LocaleSync` / `LocaleSwitcher` | no (a preference, not data) |
| `splitzy-onboarding-seen` | `OnboardingModal` | no |
| `splitzy-activity:<feature>:<type>` (sessionStorage) | `logFeatureUsage` dedupe | session-scoped |

The mirror/outbox/proposal keys store `{ uid, data }` and a payload belonging to a different account
is ignored, so a shared device never shows one user's trips to the next.

---

## 6. The Travel Spend data layer **[IMPLEMENTED]**

`useTravelData` is the most involved piece of client architecture. Mechanisms it implements:

1. **Guest vs cloud branch** — guests use `localStorage` only; signed-in users use `/api/travel`.
2. **Per-account mirror** — last-known trips, for instant and offline paint. A failed mirror write
   is *reported*, not swallowed: it is the actual trip data between loads, so silent quota failure
   used to lose a whole day of receipts.
3. **Durable outbox** ([travel-outbox.ts](../../src/lib/travel/travel-outbox.ts)) — receipt
   add/update/delete are applied locally at once and queued. Ops **coalesce** per receipt
   (`add`+`update` → `add`; `add`+`delete` → both cancel), survive reloads, and drain when online.
   Only receipts are queued, because they use client-generated IDs and an idempotent server upsert,
   so replay is safe without temp-ID remapping.
4. **Per-trip write queue** (`tripWriteQueues`) — serialises writes so two rapid PUTs never send the
   same `expectedVersion` (a false 409), and a receipt write never overtakes a participant edit it
   depends on.
5. **Load sequence guard** (`loadSeqRef`) — a slow initial load that resolves late is dropped
   instead of clobbering trips a later sync already added.
6. **Sync status** — `deriveSyncStatus(pendingWrites, syncError, conflict)` produces one of
   `idle | saving | error | conflict`; conflict outranks in-flight.
7. **Member proposals** — a member's edits accumulate as `ChangeOp[]` and are overlaid on the
   server trip via `applyOpsToTrip` so they see their own pending changes.

---

## 7. Forms and validation **[IMPLEMENTED]**

No form library. Pattern:

- Controlled inputs, local `useState`.
- Client-side caps in [input-limits.ts](../../src/lib/receipt/input-limits.ts) and
  [limits.ts](../../src/lib/limits.ts) — `MAX_FEES_PER_RECEIPT = 50`,
  `MAX_DISCOUNTS_PER_RECEIPT = 100`, `MAX_AMOUNT = 1_000_000_000`.
  The header of `limits.ts` explains why they are shared: the forms used to allow a 51st fee that
  only the share request rejected, with an error the user could not act on.
- Server re-validates everything; the client never sets a limit the server does not enforce.

### The `/single` wizard **[IMPLEMENTED]**

Three steps (`participants` → `bill` → `summary`) with the **current step in the URL** as
`?step=<id>`. `router.push` on forward, `router.replace` on backward jumps. There is exactly one
back control, in the header, and it does exactly what the system back gesture does. Both behaviours
are pinned by [e2e/wizard-navigation.spec.ts](../../e2e/wizard-navigation.spec.ts), which exists
because the step used to live in React state only — so the Android back button left the page
instead of returning a step, and two differently-behaving "Back" controls were visible at once.

---

## 8. Data fetching **[IMPLEMENTED]**

| Pattern | Where |
|---|---|
| Direct Prisma in a Server Component | `/s/[code]` only |
| `fetch("/api/…")` in `useEffect` | history, history detail, invite, dashboard quota, admin |
| Thin typed service object | [`supabaseDataService`](../../src/lib/data/supabase-data-service.ts) — `getReceipts`, `getReceiptDetail`, `saveSplit`, … |
| Supabase browser SDK | auth only (`getUser`, `onAuthStateChange`, `signInWithOAuth`, `signOut`), plus realtime subscribe when flagged |

There is no SWR/React Query layer: no request dedupe, no cache, no background revalidation. On the
server side, `getAuthUser` is memoised per-request with React `cache()` keyed on the cookie header,
so repeated calls in one handler cost one Supabase + one Prisma round trip.

---

## 9. Error handling and loading state **[IMPLEMENTED]**

Three tiers:

1. **`app/error.tsx`** — route-level. Renders the raw `error.message` only when
   `NODE_ENV !== "production"`.
2. **`ErrorBoundary`** ([providers/ErrorBoundary.tsx](../../src/components/providers/ErrorBoundary.tsx))
   — a section-level class boundary with an optional `label` and `onError` hook, so a thrown
   calculation blanks one panel (e.g. the split summary) rather than the whole page. Used inside
   `ReceiptEditor`.
3. **Toasts** — `ToastProvider` with `success | error | info` variants and optional actions.
   `useSaveSplit` uses this to distinguish a `VERSION_CONFLICT` ("Saved somewhere else") from a
   generic failure, because retrying a conflict blindly would clobber the newer copy.

Loading state: `Spinner`/`Loader2`, `Skeleton`, `EmptyState`, and explicit `isLoading` flags. The
`Suspense` boundaries around the tool views use `fallback={null}` on purpose — those views hydrate
instantly from `localStorage`, so a skeleton would only flash.

---

## 10. Theming **[IMPLEMENTED]**

- `next-themes` with `attribute="class"`, `defaultTheme="light"`, `disableTransitionOnChange`.
- `ThemeToggle` in the header of most surfaces.
- Brand palette (mirrored in `tailwind.config.ts`, `globals.css` and `opengraph-image.tsx`):
  charcoal `#1b1d17`, olive `#3a4a1f` (also `theme_color` and `viewport.themeColor`), cream
  `#fbfaf5` (manifest `background_color`), accent `#c8d96f`.
- `suppressHydrationWarning` on `<html>` because the theme class is applied before hydration.

---

## 11. Accessibility notes **[IMPLEMENTED]**

Observed, not audited:

- Skip link to `#main-content` (WCAG 2.4.1).
- `aria-label` on icon-only controls (back buttons, locale switcher, spinners).
- Radix primitives supply focus management and dialog semantics.
- `role="alert"` on the error-boundary fallback.
- Touch targets sized `h-11` (44 px) with `touch-manipulation` on tappable chrome.
- `.sr-only` / `focus:not-sr-only` utility pattern for the skip link.

**[UNKNOWN]** No automated a11y testing (axe, pa11y) exists in the repo.

---

## 12. Frontend risks and observations

| # | Observation | Label |
|---|---|---|
| 1 | `TravelSpendView` is 2086 lines and `useTravelData` is 1128 — the two largest files in the app and the natural next refactor target | **[IMPLEMENTED]** |
| 2 | No data-fetch cache means `/history` and the dashboard refetch on every mount | **[IMPLEMENTED]** |
| 3 | Tool pages show one frame of English before the stored locale is read after hydration — an accepted trade-off documented in `use-locale.ts` | **[IMPLEMENTED]** |
| 4 | `useHybridState` promises a future Supabase branch that does not exist yet | **[IMPLEMENTED]** |
| 5 | No `loading.tsx` anywhere, so route transitions have no streamed skeleton | **[IMPLEMENTED]** |
