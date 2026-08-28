# Splitzy — Feature Catalog

> **79 features**, every one discovered in the codebase. Status is honest: *Implemented* means a user
> can reach it and it works; *Partial* means it works but is incomplete or unreachable in one
> direction; *Missing* means the capability is expected or half-built but no user can use it.
>
> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**
> Cross-references: `BR-xxx` → [../requirements/business-rules.md](../requirements/business-rules.md) ·
> `API-xxx` → [../api/endpoints.md](../api/endpoints.md) ·
> `P-xx` → [personas.md](./personas.md)

---

## Index

| ID | Feature | Area | Status |
|---|---|---|---|
| FEAT-001 | Google OAuth sign-in | Identity | Implemented |
| FEAT-002 | Sign-out with local-data purge | Identity | Implemented |
| FEAT-003 | Session refresh & protected routes | Identity | Implemented |
| FEAT-004 | Guest (anonymous) usage | Identity | Implemented |
| FEAT-005 | Guest split limit + soft prompt | Identity | Implemented |
| FEAT-006 | Account ban enforcement | Identity | Implemented |
| FEAT-007 | Email/password auth | Identity | **Missing** |
| FEAT-008 | Password reset | Identity | **Missing** (N/A — no passwords) |
| FEAT-009 | Profile management | Identity | **Missing** |
| FEAT-010 | First-run onboarding tour | Onboarding | Implemented |
| FEAT-011 | Landing page (bilingual) | Marketing | Implemented |
| FEAT-012 | About page | Marketing | Implemented |
| FEAT-013 | FAQ page | Marketing | Implemented |
| FEAT-014 | Legal pages (privacy, terms) | Marketing | Partial (EN only) |
| FEAT-015 | Pricing page | Marketing | Implemented (flagged) |
| FEAT-016 | SEO entity graph, sitemap, robots | Marketing | Implemented |
| FEAT-017 | Social share card (OG/Twitter image) | Marketing | Implemented |
| FEAT-018 | Maintenance mode | Ops | Implemented |
| FEAT-019 | Single-receipt split wizard | Splitting | Implemented |
| FEAT-020 | Multiple-receipt split | Splitting | Implemented |
| FEAT-021 | Participant management | Splitting | Implemented |
| FEAT-022 | Participant name suggestions | Splitting | Implemented |
| FEAT-023 | Item entry & editing | Splitting | Implemented |
| FEAT-024 | Item assignment — equal | Splitting | Implemented |
| FEAT-025 | Item assignment — per quantity | Splitting | Implemented |
| FEAT-026 | Tax & service charge | Splitting | Implemented |
| FEAT-027 | Extra fees with per-fee split method | Splitting | Implemented |
| FEAT-028 | Discounts — three scopes | Splitting | Implemented |
| FEAT-029 | Payer selection | Splitting | Implemented |
| FEAT-030 | Per-person share calculation | Splitting | Implemented |
| FEAT-031 | Minimal-transfer settlement | Splitting | Implemented |
| FEAT-032 | Per-person audit breakdown | Splitting | Implemented |
| FEAT-033 | Payment info (bank / e-wallet) | Splitting | Implemented |
| FEAT-034 | Percentage / custom-amount split methods | Splitting | **Missing** |
| FEAT-035 | AI receipt scan | AI | Implemented |
| FEAT-036 | AI scan quota | AI | Implemented |
| FEAT-037 | Scan quota paywall | AI | Implemented |
| FEAT-038 | FX rate lookup & lock | AI / Travel | Implemented |
| FEAT-039 | Trip creation & management | Travel | Implemented |
| FEAT-040 | Trip receipts (cloud) | Travel | Implemented |
| FEAT-041 | Trip-level budget | Travel | Implemented |
| FEAT-042 | Per-participant budgets | Travel | Implemented |
| FEAT-043 | Multi-currency trips | Travel | Implemented |
| FEAT-044 | Settle-up ledger (manual payments) | Travel | Implemented |
| FEAT-045 | Per-receipt "mark share paid" | Travel | Implemented |
| FEAT-046 | Trip members | Travel | Implemented |
| FEAT-047 | Invite links | Travel | Implemented |
| FEAT-048 | Change-request approval workflow | Travel | Implemented |
| FEAT-049 | Offline outbox & sync status | Travel | Implemented |
| FEAT-050 | Guest → cloud trip sync | Travel | Implemented |
| FEAT-051 | Realtime trip updates | Travel | Implemented (flagged OFF) |
| FEAT-052 | Trip soft delete & restore | Travel | Implemented |
| FEAT-053 | Local draft autosave | Persistence | Implemented |
| FEAT-054 | Save & resume a split | Persistence | Implemented |
| FEAT-055 | Receipt history + search | Persistence | Implemented |
| FEAT-056 | History detail view | Persistence | Implemented |
| FEAT-057 | Delete a saved split | Persistence | **Partial — API only, no UI** |
| FEAT-058 | Restore a deleted split | Persistence | **Partial — API only, no UI** |
| FEAT-059 | Share link (server snapshot) | Sharing | Implemented |
| FEAT-060 | Hash share link | Sharing | Implemented |
| FEAT-061 | WhatsApp share & copy summary | Sharing | Implemented |
| FEAT-062 | Native share sheet | Sharing | Implemented |
| FEAT-063 | CSV export | Sharing | **Missing — built, unreachable** |
| FEAT-064 | Pro plan & entitlements | Money | Implemented |
| FEAT-065 | Xendit checkout | Money | Implemented (flagged OFF) |
| FEAT-066 | Payment webhook reconciliation | Money | Implemented (flagged OFF) |
| FEAT-067 | Pro expiry cron | Money | Implemented |
| FEAT-068 | Referral programme | Growth | Implemented |
| FEAT-069 | Welcome email | Growth | Implemented (inert w/o key) |
| FEAT-070 | Dashboard | Growth | Implemented |
| FEAT-071 | Admin user management | Admin | Implemented |
| FEAT-072 | Admin audit trail | Admin | Implemented |
| FEAT-073 | Admin activity feed | Admin | Implemented |
| FEAT-074 | Retention cleanup job | Admin | Partial — **[UNKNOWN]** if scheduled |
| FEAT-075 | PWA install & service worker | Platform | Implemented |
| FEAT-076 | Theme / dark mode | Platform | Implemented |
| FEAT-077 | i18n & locale switching | Platform | Partial |
| FEAT-078 | Error, loading & empty states | Platform | Partial |
| FEAT-079 | Observability (analytics, Sentry, health) | Platform | Partial |

**Totals:** 79 features — **64 Implemented** · **3 Implemented but flag-disabled** · **7 Partial** · **5 Missing**.

---

## Area 1 — Identity & access

### FEAT-001 — Google OAuth sign-in
- **Status** Implemented · **Actor** P-04 → P-01/P-02 · **Evidence** [useAuth.ts](../../src/hooks/useAuth.ts), [api/auth/callback](../../src/app/api/auth/callback/route.ts)
- **Purpose** Establish an account so splits can be saved, trips synced, and Pro purchased.
- **Preconditions** Supabase configured. **Trigger** Any "Sign in" affordance, or a protected-route bounce.
- **Main flow** `signInWithOAuth(google, redirectTo=/api/auth/callback?next=…)` → Google consent → callback exchanges the code → `User` upsert → `logActivity(login)` → 302 to `next` → client fetches `/api/auth/me`.
- **Alternative** First-ever sign-in additionally processes a referral cookie and sends a welcome email.
- **Exception** No `code` → `/?error=no_code`. Exchange failure → `/?error=auth_failed`. DB upsert failure → login still succeeds (logged only), leaving a session with no `User` row.
- **Inputs** Google identity. **Outputs** Session cookies, `User` row, `dbUser` in context.
- **Rules** BR-040, BR-041, BR-042, BR-071 · **Deps** FEAT-003, FEAT-068, FEAT-069
- **UI** `AuthButton`, `LoginBanner` · **API** API-002, API-003 · **DB** `User`, `ActivityEvent`, `Referral`

### FEAT-002 — Sign-out with local-data purge
- **Status** Implemented · **Actor** P-01, P-02 · **Evidence** [useAuth.ts](../../src/hooks/useAuth.ts)
- **Purpose** End the session and stop the next person on a shared device inheriting data.
- **Trigger** Account menu → Sign out.
- **Main flow** `supabase.auth.signOut()` → remove 7 `localStorage` keys → clear context → "Signed out" toast.
- **Alternative** The same toast fires when a session silently expires (`AuthProvider` skips the first resolution so a never-logged-in visitor is not told they were signed out).
- **Exception** Storage unavailable → purge skipped silently.
- **Rules** BR-043 · **Deps** FEAT-001 · **UI** `AuthButton`, `ToastProvider` · **API** — · **DB** —
- **Gap** PostHog `resetAnalytics()` exists but is not called, so the anonymous distinct id survives.

### FEAT-003 — Session refresh & protected routes
- **Status** Implemented · **Actor** all · **Evidence** [src/proxy.ts](../../src/proxy.ts)
- **Purpose** Keep tokens fresh and gate `/multiple` and `/history`.
- **Main flow** Edge proxy refreshes the Supabase session on every matched navigation and copies refreshed cookies onto any redirect.
- **Alternative** A non-401 `getUser()` error lets the request through rather than false-redirecting a signed-in user.
- **Exception** Genuinely anonymous → `302 /?login=required&redirect=<path>`.
- **Rules** BR-044, BR-045 · **UI** `LoginBanner` · **API** — (proxy excludes `/api`) · **DB** —

### FEAT-004 — Guest usage
- **Status** Implemented · **Actor** P-04 · **Evidence** public `/single`, `/travel`; nullable `SharedSummary.createdById`
- **Purpose** Deliver full value with no account, which is the product's primary acquisition mechanic.
- **Main flow** Guest completes a split, creates a share link, and scans receipts — all without signing in.
- **Rules** BR-057, BR-058, BR-059 · **Deps** FEAT-019, FEAT-035, FEAT-059
- **Note** Guests are **not** subject to the AI scan quota; only the 10/min IP limit applies.

### FEAT-005 — Guest split limit + soft prompt
- **Status** Implemented · **Actor** P-04 · **Evidence** [useGuestLimit.ts](../../src/hooks/useGuestLimit.ts), [GuestLimitDialog](../../src/components/auth/GuestLimitDialog.tsx)
- **Purpose** Convert repeat guests without destroying their work.
- **Trigger** Advancing to the summary step for the 4th time (`MAX_GUEST_SPLITS = 3`).
- **Main flow** Counter in `localStorage` → dialog offering Google sign-in.
- **Alternative** "Later" dismisses it; **the split still completes**. The dialog is not a hard gate.
- **Rules** BR-057 · **API** — · **DB** —

### FEAT-006 — Account ban enforcement
- **Status** Implemented · **Actor** P-06 acts, target is any user · **Evidence** [api-auth.ts](../../src/lib/api-auth.ts)
- **Main flow** `getAuthUser` returns `null` when `bannedAt != null`, so every protected endpoint 401s.
- **Exception** Existing cookies are **not** revoked — enforcement is read-time only. `/api/auth/me` does not apply the guard, so a banned user still sees their own profile.
- **Rules** BR-043 · **API** API-050 · **DB** `User.bannedAt`

### FEAT-007 — Email/password authentication — **Missing**
No `signUp`, `signInWithPassword`, or `resetPasswordForEmail` call exists. Google OAuth is the only method. **[IMPLEMENTED]** absence.

### FEAT-008 — Password reset — **Missing / N/A**
There are no passwords, so there is nothing to reset. Listed because the Phase B brief asks for it.

### FEAT-009 — Profile management — **Missing**
Name, email and avatar are copied from Google on every sign-in (`user.upsert`). There is **no UI to edit a profile, change an email, or delete an account**. Account deletion is additionally blocked at the database level: five `User` relations use Prisma's default `Restrict`. **[IMPLEMENTED]** absence · **[INFERRED]** a data-subject deletion request could not currently be honoured through the app.

---

## Area 2 — Onboarding & marketing

### FEAT-010 — First-run onboarding tour
- **Status** Implemented · **Actor** P-04 · **Evidence** [OnboardingModal.tsx](../../src/components/onboarding/OnboardingModal.tsx)
- **Purpose** Show the payoff (who owes whom, minimal transfers) rather than describing it.
- **Preconditions** Pathname is exactly `/` and `localStorage["splitzy-onboarding-seen"]` is unset.
- **Main flow** A 3-step Radix dialog — *summary payoff → AI scan → share* — each pairing a localised benefit line with a small on-brand mock of the real UI. The final button **starts a real split** (`router.push("/single")`) rather than just closing.
- **Alternative** Back navigation between steps; Skip on step 1.
- **Exception** `localStorage` unavailable → the tour is skipped silently.
- **Analytics** `onboarding_started`, and `onboarding_completed` / `onboarding_skipped` with the step reached.
- **Rules** — · **UI** `Dialog` (focus trap, Escape, scroll lock, `aria-live` step announcement) · **API** — · **DB** —

### FEAT-011 — Landing page (bilingual)
- **Status** Implemented · **Actor** P-04 · **Evidence** [NewLanding.tsx](../../src/components/landing/NewLanding.tsx), `/` and `/id`
- **Sections** header · hero · preview mock · stats · problem · 3 feature blocks with visuals · how-it-works · mode cards · proof · testimonials · pricing teaser · FAQ accordion · final CTA · footer.
- **Note** A Server Component composing client islands (`ThemeToggle`, `AuthButton`, `LoginBanner`, `LocaleSync`), so the largest marketing surface stays out of the client bundle.
- **Gap** Stats and testimonials are **placeholder figures**.
- **Rules** BR-089, BR-092 · **API** — · **DB** —

### FEAT-012 / FEAT-013 — About & FAQ pages
- **Status** Implemented, both languages (`/about`, `/id/about`, `/faq`, `/id/faq`) · **Evidence** `AboutContent`, `FaqContent`
- The FAQ is mirrored as `FAQPage` JSON-LD on the landing page so answers can expand in search results.
- **Rules** BR-090 (hreflang reciprocity) · **API** — · **DB** —

### FEAT-014 — Legal pages — **Partial**
`/privacy` (last updated 3 August 2026) and `/terms` render via `ContentPageShell` with self-referencing canonicals. **English only**, single-URL, no dictionary usage — in a market that speaks Indonesian. **[IMPLEMENTED]** gap.

### FEAT-015 — Pricing page
- **Status** Implemented, behind `NEXT_PUBLIC_FLAG_PRICING_PAGE` · **Evidence** [pricing/page.tsx](../../src/app/pricing/page.tsx)
- **Main flow** Free vs Pro comparison, a 5-question objection-handling FAQ, and `UpgradeButton`.
- **Alternative** Flag off → `notFound()`, and `sitemap.ts` asks the same question so it never advertises a 404. Checkout not live → a disabled "Coming soon" button, so the page can ship publicly before revenue does.
- **Alternative** `?status=success` renders `SuccessCelebration`; `?status=failed` is handled.
- **Rules** BR-065 · **API** API-046 · **DB** `Payment`

### FEAT-016 — SEO entity graph, sitemap, robots
- **Status** Implemented · **Evidence** [structured-data.ts](../../src/lib/seo/structured-data.ts), `sitemap.ts`, `robots.ts`
- **Purpose** Win a **contested brand name** by making the entity claim machine-readable.
- **Main flow** `Organization` + `WebSite` + `SoftwareApplication` JSON-LD with stable `@id`s on every route; per-page canonicals; reciprocal hreflang on the three bilingual routes; a flag-aware sitemap; `robots.txt` disallowing `/api/`, `/s/`, `/share`, `/invite/`.
- **Business rule** **No `aggregateRating` or `review` markup is ever emitted**, because the ratings on the page are placeholders and marking up fabricated reviews violates Google's spam policies. An E2E test enforces this.
- **Rules** BR-089…BR-094 · **API** — · **DB** —

### FEAT-017 — Social share card
- **Status** Implemented · **Evidence** [opengraph-image.tsx](../../src/app/opengraph-image.tsx), `twitter-image.tsx`
- A build-time 1200×630 `ImageResponse`. Replaced the raw 1920×2194 portrait logo, which every platform centre-cropped into an unreadable sliver — directly costing click-throughs on the WhatsApp shares that are Splitzy's main distribution.

### FEAT-018 — Maintenance mode
- **Status** Implemented · **Actor** P-06 · **Evidence** [src/proxy.ts](../../src/proxy.ts)
- `MAINTENANCE_MODE=true` redirects all traffic to `/maintenance`; when off, `/maintenance` redirects back to `/`. The page is `noindex`, deliberately — indexing it risks Google showing "Splitzy is under maintenance" as the brand result.

---

## Area 3 — Core splitting

### FEAT-019 — Single-receipt split wizard
- **Status** Implemented · **Actor** P-04, P-01 · **Evidence** [SingleSplitView.tsx](../../src/components/pages/SingleSplitView.tsx)
- **Purpose** The zero-friction core loop: one bill, several people, a fair answer.
- **Preconditions** None — public. **Trigger** `/single`, the landing CTA, the dashboard, or the end of onboarding.
- **Main flow** Three steps — **participants → bill → summary** — with the current step **in the URL** as `?step=<id>`; `router.push` forward, `router.replace` for backward jumps.
- **Alternative** `?resume=<id>` rehydrates a saved split · `?lang=` sets the locale · beforeunload warning when mid-fill.
- **Exception** Resume failure → toast and reset to `/single`. Guest cap → `GuestLimitDialog` (non-blocking).
- **Rules** BR-001…BR-018, BR-057 · **Deps** FEAT-021, FEAT-023, FEAT-030, FEAT-035
- **UI** `Stepper`, `ParticipantManager`, `ReceiptEditor`, `SummaryPanel`, `StickyActionBar` · **API** API-045, API-010, API-008 · **DB** `Receipt`
- **Note** Exactly **one** back control, in the header, doing what the system back gesture does. Both are pinned by [e2e/wizard-navigation.spec.ts](../../e2e/wizard-navigation.spec.ts), written after the step lived only in React state and the Android back button left the page instead of returning a step.

### FEAT-020 — Multiple-receipt split
- **Status** Implemented · **Actor** P-01 (signed in) · **Evidence** [MultipleReceiptView.tsx](../../src/components/pages/MultipleReceiptView.tsx)
- **Purpose** Several receipts with **different payers**, settled once. A "split" is one named group of receipts shared by the same people.
- **Preconditions** *Intended:* authenticated. ⚠️ **Phase C found the gate does not hold** — an anonymous request renders the full tool ([UX-001](../ux/ux-audit.md)).
- **Main flow** Define participants once → add N receipts, each with its own payer/items/fees/discounts → one aggregated summary with wallet stats and a minimised transfer set.
- **Alternative** `?resume=<id>` · save/update the whole split as one document.
- **Rules** BR-019…BR-034 · **API** API-010, API-012, API-045, API-008 · **DB** `Receipt.payloadJson`
- **Note** Deliberately absent from the sitemap because the proxy 307s crawlers; the code flags making it publicly viewable as an open product decision.

### FEAT-021 — Participant management
- **Status** Implemented · **Evidence** [ParticipantManager.tsx](../../src/components/receipt/ParticipantManager.tsx)
- Add / rename / remove named participants (≤ 100, name ≤ 100 chars), each optionally carrying `paymentInfo` and, in Travel, a personal `budget`. Duplicate-name warning. Removing a participant strips their assignments from every item.
- **Rules** BR-080, BR-081 · **DB** `participantsJson`

### FEAT-022 — Participant name suggestions
- **Status** Implemented · **Evidence** [useNameSuggestions.ts](../../src/hooks/useNameSuggestions.ts)
- A local frequency+recency ranked history (≤ 30 names, `localStorage`) so regular companions autocomplete. Never leaves the device; quota errors are non-critical — autocomplete just stops growing.

### FEAT-023 — Item entry & editing
- **Status** Implemented · **Evidence** [ItemsTable.tsx](../../src/components/receipt/ItemsTable.tsx)
- Name, qty, unit price, total per line; ≤ 200 items; amounts ≤ 1e9. Rows arrive from the AI scan or are typed by hand — **the manual path costs no quota and is the documented fallback when scans run out**.
- **Rules** BR-080 · **DB** `payloadJson.items`

### FEAT-024 / FEAT-025 — Item assignment
- **Status** Implemented · **Evidence** [calculations.ts](../../src/lib/receipt/calculations.ts)
- **Equal** — `assignedToIds[]`, `item.total / n`, remainder to the first assignee (BR-002, BR-004).
- **Per quantity** — `assignments[{ participantId, qty }]`, share = `(qty / totalQty) × total`, remainder to the person with the most units (BR-001, BR-003). Preferred whenever present.
- **Edge** An item assigned to nobody still counts toward the receipt subtotal, so the payer absorbs it (BR-005).

### FEAT-026 — Tax & service charge
- **Status** Implemented · Allocated **proportionally to each person's subtotal**, remainder to the largest subtotal. Zero-subtotal receipts split them equally instead, *"otherwise the payer would be left with phantom credit and the ledger would not balance."*
- **Rules** BR-006, BR-007, BR-008

### FEAT-027 — Extra fees with per-fee split method
- **Status** Implemented · **Evidence** [FeesInput.tsx](../../src/components/receipt/FeesInput.tsx), `allocateFees`
- Delivery, platform, packaging, small-order, surcharge, tip. Each fee carries its own `splitMethod`: `"equal"` (divided across **all** participants regardless of what they ordered) or `"proportional"`. ≤ 50 fees.
- **Rules** BR-009, BR-010, BR-011

### FEAT-028 — Discounts, three scopes
- **Status** Implemented · **Evidence** [DiscountsInput.tsx](../../src/components/receipt/DiscountsInput.tsx), `calculateDiscountCredits`
- `receipt` (everyone, proportional to base total) · `item` (that item's consumers, proportional to their item share) · `participant` (a personal voucher). `amount` or `percent`; percentages resolve against a **pre-discount** base so they never compound; each person's credit is **capped at their base share**. ≤ 100 discounts.
- **Rules** BR-012…BR-016

### FEAT-029 — Payer selection
- **Status** Implemented · One participant per receipt is the payer. A payer never owes their own receipt. In Multiple mode each receipt has its own payer, which is the entire point of the mode.
- **Rules** BR-029, BR-082

### FEAT-030 — Per-person share calculation
- **Status** Implemented · **Evidence** [calculations.ts](../../src/lib/receipt/calculations.ts)
- `total = subtotal + tax + service + fees − discount`, recomputed synchronously on every keystroke. Pure, no I/O, reused by the editor, the server-rendered share page and the history detail view.
- **Rules** BR-017, BR-018

### FEAT-031 — Minimal-transfer settlement
- **Status** Implemented · Two-phase `minimizeTransactions`: exact-match elimination (so a clean 1-to-1 debt is not shattered by the greedy pass), then largest-debtor/largest-creditor greedy. `buildSettlementTrace` can replay it step by step to explain *why* A pays B.
- **Rules** BR-026, BR-027, BR-028 · **[INFERRED]** greedy is a heuristic, not provably minimal.

### FEAT-032 — Per-person audit breakdown
- **Status** Implemented · `getPersonShareDetails` → `ItemBreakdown[]` showing, per item, the units that person took, the item total, how many shared it, and their share. This is the implementation behind the About page's *"every rupiah is traceable"*.

### FEAT-033 — Payment info per participant
- **Status** Implemented · **Evidence** [payment-info.ts](../../src/lib/receipt/payment-info.ts)
- Optional bank / e-wallet, account number, account holder name — rendered in the summary, the export text and the share snapshot, so the person who owes money knows where to send it. All-empty clears the object.
- **Privacy note** These details travel into `SharedSummary.payload` and are readable by anyone holding the link.

### FEAT-034 — Percentage / custom-amount split methods — **Missing**
Splitzy splits by **consumption** (items), not by percentage or arbitrary amounts. `Discount` supports a `percent` type, but there is no "split this bill 60/40" mode. **[IMPLEMENTED]** absence — a deliberate model choice, and the main functional divergence from competitors.

---

## Area 4 — AI

### FEAT-035 — AI receipt scan
- **Status** Implemented · **Actor** all, guests included · **Evidence** [api/parse-receipt](../../src/app/api/parse-receipt/route.ts), [ReceiptInput.tsx](../../src/components/receipt/ReceiptInput.tsx)
- **Trigger** "Scan receipt" (camera, `capture="environment"`) or "Upload photo".
- **Main flow** Read as data URL → canvas resize to ≤ 1920 px / JPEG q0.85 → `navigator.onLine` pre-check → POST → CSRF, rate limit 10/min, optional auth, quota → Gemini 2.5 Flash with a 45 s abort → fence-stripping balanced-JSON extraction → every field re-derived and bounded → items, tax, service, fees, discounts, currency returned.
- **Alternative** Non-IDR currency detected → `/api/fx-rate` lookup locks an FX rate. Item-scope discounts are matched `itemName` → item UUID by fuzzy bidirectional substring; **no match downgrades to receipt scope rather than dropping the discount**.
- **Exception** Offline → a specific offline message *before* any request. Timeout → `504 UPSTREAM_TIMEOUT` → *"Scanning took too long"* (deliberately distinct, because a generic error sent users off re-cropping a fine photo). Quota → paywall. Unparsable → `200` with an empty item list and **no quota consumed**.
- **Rules** BR-059…BR-064, BR-085, BR-086 · **API** API-045, API-007 · **DB** `User.aiScanCount`
- **Privacy** The image goes to Google; it is never stored by Splitzy. No user identity accompanies it.

### FEAT-036 — AI scan quota
- **Status** Implemented · `FREE_SCAN_LIMIT = 15`/month; per-user `aiScanLimit` override; window resets to 00:00 UTC on the 1st; active Pro is unlimited. Surfaced on the dashboard as a progress bar and via `GET /api/me/quota`.
- **Rules** BR-059…BR-063 · **Gap** check and increment are not atomic, so concurrent scans can exceed the cap slightly. Guests bypass it entirely.

### FEAT-037 — Scan quota paywall
- **Status** Implemented · **Evidence** [ScanQuotaPaywall.tsx](../../src/components/billing/ScanQuotaPaywall.tsx)
- Explicitly tells the user two things the previous version omitted: that they can **still add items by hand at no cost**, and either an upgrade CTA (pricing live) or *"your free scans reset at the start of next month"* (pricing dark). Ships safely in both states.

### FEAT-038 — FX rate lookup & lock
- **Status** Implemented · `GET /api/fx-rate?from=CODE` → `open.er-api.com`, keyless, 1-hour in-process cache plus a 1-hour Next fetch cache. The returned rate is **locked onto the receipt**, so a later market move cannot retroactively change a settled split. Failure tells the user to enter the rate manually.
- **Rules** BR-035…BR-039 · **Gap** the endpoint is public, keyless and **unrate-limited**.

---

## Area 5 — Travel Spend

### FEAT-039 — Trip creation & management
- **Status** Implemented · Name (≤ 200), optional budget (≤ 1e12), participants, receipts. Guests keep trips in `localStorage`; signed-in users get a cloud `Trip` with an optimistic-lock `version`.
- **Rules** BR-049, BR-087 · **API** API-025, API-026, API-027, API-028 · **DB** `Trip`

### FEAT-040 — Trip receipts (cloud)
- **Status** Implemented · One `TripReceipt` row per receipt, storing the full client `Receipt` as JSON, keyed by the **client-generated** receipt id so the server write is an idempotent `upsert` — which is what makes offline replay safe.
- **Rules** BR-049, BR-081 · **API** API-031, API-032, API-033 · **DB** `TripReceipt`

### FEAT-041 / FEAT-042 — Budgets
- **Status** Implemented · **Trip budget** (`Trip.budget`) with spent-vs-target display; **per-participant budgets** (`Participant.budget`) with an individual progress bar, over/under label, and per-person spend measured as their share of every receipt (settled included — this is total spend, not outstanding debt).
- **UI** `IndividualBudgets` card

### FEAT-043 — Multi-currency trips
- **Status** Implemented · 14 currencies (`TRAVEL_CURRENCIES`), each receipt carrying `currency` + locked `fxRate`; all settlement in IDR. Foreign settle-up payments display as `฿1.000 ≈ Rp 480.000`. `needsFxRate` flags a foreign receipt with no usable rate, because it would otherwise enter IDR totals at 1:1.
- **Rules** BR-035…BR-039

### FEAT-044 — Settle-up ledger
- **Status** Implemented · Append-only `TripPayment` rows are the **single source of truth for what has been settled**. Manual `from → to → amount` with optional note, currency and FX rate. Supports **partial** payments. Applied once, at trip level.
- **Rules** BR-023, BR-024, BR-025, BR-030 · **API** API-034, API-035 · **DB** `TripPayment`

### FEAT-045 — Per-receipt "mark share paid"
- **Status** Implemented · A checkbox per participant per receipt, stored as a ledger payment whose `source` is `share:<receiptId>:<participantId>`. Records **only the remaining debt** (`owed − already paid`), because recording the full share on top of a partial manual payment used to over-settle and flip the payer negative. Already-covered shares show a toast and write nothing. A whole-receipt toggle marks every owing non-payer at once.
- **Rules** BR-030, BR-031, BR-032

### FEAT-046 — Trip members
- **Status** Implemented · Account-level membership via `TripMember`, distinct from participants. Owner sees the member list with avatars, roles and join dates.
- **Rules** BR-049, BR-050 · **UI** `MembersCard`

### FEAT-047 — Invite links
- **Status** Implemented · Owner mints a 128-bit `base64url` token with a **7-day TTL**; the public landing page shows the trip name and who invited you; joining is idempotent and routes straight to the trip (not to a trip list). Owner can list and revoke.
- **Rules** BR-052, BR-053 · **API** API-036…API-038, API-043, API-044
- **Privacy note** `invitedBy` falls back to the inviter's **email** when their name is null, so a leaked link discloses an address.

### FEAT-048 — Change-request approval workflow
- **Status** Implemented · **The distinguishing feature of the collaboration model.** Members cannot write the trip; their edits accumulate as `ChangeOp[]` in a local proposal buffer, are overlaid on their own view, and are submitted as a `TripChangeRequest`. The owner reviews a human-readable diff and approves or declines with a note. On approve, every op is re-validated against the **live** participant set before any DB write, then applied in one array-form transaction with an atomic status claim.
- **Rules** BR-049, BR-051, BR-081, BR-087 · **API** API-039…API-042 · **UI** `ChangeOpList`, `ReviewInbox`, `ProposalBar`

### FEAT-049 — Offline outbox & sync status
- **Status** Implemented · Receipt writes apply to a per-account mirror immediately and queue in a durable outbox that survives reloads. Ops **coalesce** per receipt (`add`+`delete` cancel out entirely). The drain distinguishes retryable (offline, 5xx, 429) from permanent (4xx) from `REVIEW_REQUIRED` (migrated into the proposal buffer rather than dropped). A per-trip write queue stops a receipt write overtaking a participant edit it depends on. Status surfaces as `idle | saving | error | conflict`.
- **Rules** BR-087 · **Evidence** [travel-outbox.ts](../../src/lib/travel/travel-outbox.ts), [useTravelData.ts](../../src/hooks/useTravelData.ts)

### FEAT-050 — Guest → cloud trip sync
- **Status** Implemented · On sign-in, a dialog offers to push local trips to the cloud; `POST /api/travel` accepts the whole trip — participants and receipts — in one request.

### FEAT-051 — Realtime trip updates — **flagged OFF**
- **Status** Implemented behind `NEXT_PUBLIC_FLAG_REALTIME` · After each trip write the server posts a **signal only** (no data) to a per-trip Supabase Broadcast channel; clients refetch through the normal authenticated API. Inert when off — trips still update on focus and reconnect.

### FEAT-052 — Trip soft delete & restore
- **Status** Implemented · Owner-only soft delete with an owner-only restore. Unlike the legacy trips API, the travel delete performs **no cascade** — children have no `deletedAt` and simply become unreachable until the 30-day hard delete.
- **Rules** BR-074, BR-075

---

## Area 6 — Persistence & sharing

### FEAT-053 — Local draft autosave
- **Status** Implemented · Every keystroke mirrors to `localStorage`. `useLocalStorage` distinguishes `quota` from `unavailable` failures across Chrome/Firefox/Safari quirks and **surfaces them as a toast** rather than swallowing them.
- **Rules** — · **Evidence** [useLocalStorage.ts](../../src/hooks/useLocalStorage.ts), `usePersistErrorToast`

### FEAT-054 — Save & resume a split
- **Status** Implemented · An explicit Save parks the whole split as one document server-side, with a **7-day TTL reset on every save**. The hook remembers `{id, version, expiresAt, shareCode}` so a second press updates rather than duplicates, and a save from another device is a clear `409` conflict rather than a silent overwrite. Resume via `?resume=<id>`.
- **Rules** BR-072, BR-087 · **API** API-010, API-011, API-012

### FEAT-055 — Receipt history + search
- **Status** Implemented · Debounced (300 ms) search across receipt and trip names, paginated, with an expiry countdown per card and a "Continue" link that reopens the right editor.
- **API** API-009 · **UI** `ReceiptHistoryList`, `ReceiptHistoryCard`

### FEAT-056 — History detail view
- **Status** Implemented · Read-only summary of a saved split. Reads through `receiptsFromDetail`, not the flat columns — reading the flat projection silently dropped fees and discounts, which is how this page came to show a different Grand Total than the editor did for the very same split.

### FEAT-057 — Delete a saved split — **Partial**
`DELETE /api/receipts/[id]` is implemented, rate-limited, creator-gated and soft-deleting.
`supabaseDataService.deleteReceipt()` wraps it. **Neither has a caller.** `ReceiptHistoryCard`
offers only "Continue" — there is **no delete affordance anywhere in the UI**, so a user cannot
remove a saved split and must wait 7 days for it to lapse. **[IMPLEMENTED]** gap.

### FEAT-058 — Restore a deleted split — **Partial**
`POST /api/receipts/[id]/restore` is implemented and idempotent. No UI reaches it, and since nothing
in the UI can delete, nothing can reach a restorable state either. **[IMPLEMENTED]** gap.

### FEAT-059 — Share link (server snapshot)
- **Status** Implemented · **Actor** anyone, guests included · Creates a `SharedSummary` with an unguessable 8-character code and a **14-day TTL**, rendered server-side at `/s/<code>`. Re-saving the underlying split **refreshes that link in place** rather than minting a rival, and `updatedAt` tells the viewer when the numbers last moved — *"an amount that can move silently after everyone agreed on it is worse than a stale one."* Expired and not-found render as distinct states.
- **Rules** BR-073, BR-079 · **API** API-008 · **DB** `SharedSummary`

### FEAT-060 — Hash share link
- **Status** Implemented · `/share#<base64url payload>` — the payload lives in the URL fragment, so it **never reaches the server**, works for guests, and leaks nothing into request logs. Versioned, capped at 8 000 encoded characters, shape-validated on decode.

### FEAT-061 — WhatsApp share & copy summary
- **Status** Implemented · A formatted text summary — per-person amounts, the transfer list, and each recipient's payment details — copied to the clipboard or opened in WhatsApp via a `wa.me` deep link. **[INFERRED]** this is the product's primary distribution mechanism.
- **Analytics** `share_whatsapp`

### FEAT-062 — Native share sheet
- **Status** Implemented · `navigator.share({ title, url })` with a clipboard fallback when unavailable or cancelled.

### FEAT-063 — CSV export — **Missing (built, unreachable)**
[csv-export.ts](../../src/lib/receipt/csv-export.ts) is a complete 110-line module: RFC-4180
quoting, a UTF-8 BOM so Excel and Sheets read accents correctly, an items table, a per-person
breakdown, bill totals, and a slugged dated filename. It has a **dedicated unit-test file**. It has
**zero callers outside that test**. No button, menu item or keyboard path reaches it, so the
capability does not exist for users. **[IMPLEMENTED]** — the strongest single instance of built-but-
unreachable functionality in the codebase.

---

## Area 7 — Money & growth

### FEAT-064 — Pro plan & entitlements
- **Status** Implemented · `isProActive` = `plan === "pro"` **and** (`proExpiresAt` null ⇒ forever, else in the future). `extendProExpiry` stacks from the later of now / current expiry, so buying while still Pro wastes nothing.
- **Rules** BR-065, BR-066, BR-067 · **Note** the advertised *"Priority AI processing"* has **no implementation**.

### FEAT-065 — Xendit checkout — **flagged OFF**
- **Status** Implemented behind `FLAG_XENDIT_CHECKOUT` (404 when off). A `pending` `Payment` row is written **before** the Xendit call *"so the webhook always has a row to reconcile against, even if the response is lost"*; the user is then redirected to a hosted invoice. Already-Pro users are refused.
- **Rules** BR-068, BR-070 · **API** API-046

### FEAT-066 — Payment webhook reconciliation — **flagged OFF**
- **Status** Implemented · `x-callback-token` authentication (no CSRF — correctly, Xendit is not same-origin). An unknown `external_id` is acknowledged `200` so Xendit stops retrying. `PAID`/`SETTLED` uses an atomic status claim, making duplicate deliveries a no-op, then grants Pro.
- **Rules** BR-069 · **API** API-047

### FEAT-067 — Pro expiry cron
- **Status** Implemented · Daily at 03:00 UTC, `Bearer CRON_SECRET`, refuses to run if the secret is unset. Downgrades lapsed Pro; `{ lt: now }` excludes `NULL` so admin-comped Pro is never touched. A tidiness job — read-time checks already treat expired Pro as free.
- **API** API-048

### FEAT-068 — Referral programme
- **Status** Implemented · `?ref=CODE` → a 30-day `SameSite=Lax` cookie → credited on **first** sign-in only → 14 days of Pro for the referrer. Codes are minted lazily on first dashboard visit from an unambiguous 32-symbol alphabet. Self-referral rejected; the unique constraint on `referee_id` makes double-claims a silent no-op.
- **Rules** BR-071 · **API** API-005 · **UI** `ReferralCard` (copy-to-clipboard, totals) · **DB** `Referral`

### FEAT-069 — Welcome email
- **Status** Implemented, inert without `RESEND_API_KEY` · One HTML email on first sign-in, with a "Split a bill" CTA. Failure is caught and logged; login is never blocked.
- **Gap** English only; `reply_to` is a hardcoded personal Gmail, inconsistent with `BRAND.supportEmail`.

### FEAT-070 — Dashboard
- **Status** Implemented · Signed-in home: a personalised greeting, the **AI scan quota as a progress bar** (or a Pro badge), the referral card, and three quick-start mode cards. An upgrade link appears only when the pricing flag is live.
- **API** API-004, API-005

---

## Area 8 — Admin

### FEAT-071 — Admin user management
- **Status** Implemented · **Actor** P-06 · Cursor-paginated user list; debounced search on email/name; `all | free | pro | banned` filters; **global counters that ignore the current filter** so they stay honest. A per-user drawer exposes: change plan, reset quota, set a custom scan limit (0–10 000 or null), ban/unban, grant/revoke admin, and view their trips. Self-lockout guards prevent banning yourself or revoking your own admin role; a bootstrap admin's role cannot be revoked at all.
- **Rules** BR-054, BR-055, BR-056, BR-060 · **API** API-049, API-050, API-051

### FEAT-072 — Admin audit trail
- **Status** Implemented · Every privileged mutation writes an `AdminAuditLog` row **in the same transaction** as the change — *"an action that can't be recorded is never applied."* No FK to `users`, so the trail survives account deletion; actor and target emails are snapshots. Rendered by a pure `describeAuditEntry` shared between API and UI so slugs cannot drift. Never swept.
- **API** API-053

### FEAT-073 — Admin activity feed
- **Status** Implemented · A per-day view of who was active and in which mode, with a 500-event feed **plus** exact DB-side `COUNT(DISTINCT …) FILTER` aggregates, so the summary counters are never truncated. The window is sent by the client as `[from, to)` in the **admin's local time**, so "today" matches their wall clock.
- **API** API-052 · **DB** `ActivityEvent`

### FEAT-074 — Retention cleanup job — **Partial**
- **Status** Implemented, **[UNKNOWN]** whether scheduled · One transaction sweeps six things: receipts/trips soft-deleted > 30 days, lapsed saved splits, expired share links, expired invites, and activity events older than 30 days. Fail-closed auth (503 when unconfigured).
- **Gaps** Not present in `vercel.json`; `CLEANUP_TOKEN` is absent from `.env.example`; `export const GET = POST` means a GET performs destructive hard deletes. **If it is not scheduled, no retention policy in the product is actually being applied.**

---

## Area 9 — Platform

### FEAT-075 — PWA install & service worker
- **Status** Implemented · Manifest with correct 192/512/maskable icons (dimensions asserted against the real files by a unit test), iOS `appleWebApp` tags, and a hand-written service worker: network-first for navigations, stale-while-revalidate for static assets, pass-through for `/api/*` and cross-origin.
- **Deliberate non-feature** `beforeinstallprompt` is observed **passively** — no `preventDefault()`, no custom install CTA — so Chrome's own install UI is left intact. The cost, `userChoice`, is knowingly accepted. Three telemetry events exist purely as a **health check** after a manifest defect silently broke Android installs.
- **Evidence** [pwa.md](../architecture/pwa.md)

### FEAT-076 — Theme / dark mode
- **Status** Implemented · `next-themes`, class strategy, default light, `disableTransitionOnChange`, `suppressHydrationWarning`. A `ThemeToggle` appears in most headers.

### FEAT-077 — i18n & locale switching — **Partial**
- **Status** Partial · Two dictionaries (~1 000 lines each) typed so a missing key is a **build error**, plus tests asserting placeholder parity and that Indonesian strings were actually translated rather than pasted. The marketing tree takes its locale from the URL; the tool routes take it from a persisted preference (`?lang=` → `localStorage` → `navigator.language`), because they must stay statically prerendered.
- **Gaps** `/privacy`, `/terms`, `/pricing`, `/history`, `/dashboard`, `/s/<code>`, `/share`, `/invite`, `/admin`, error pages, server-side API error messages and the welcome email are **English-only**. The share page — the main non-user touchpoint — is among them.

### FEAT-078 — Error, loading & empty states — **Partial**
- **Status** Partial · Three tiers of error handling: `app/error.tsx` (route-level), a section-level `ErrorBoundary` with an optional label, and toasts. Loading uses spinners, one `Skeleton` consumer, and `Suspense fallback={null}` where hydration is instant. Inline empty-state copy exists in history and travel.
- **Gaps** There are **no `loading.tsx` files anywhere**, so route transitions have no streamed skeleton; the `EmptyState` UI component exists with **zero consumers**; `ErrorBoundary.onError` — written explicitly for error reporting — is never supplied.

### FEAT-079 — Observability — **Partial**
- **Status** Partial · PostHog (11 events, dynamically imported, key-gated, no PII), Sentry (three runtimes, DSN-gated, `sendDefaultPii: false`), `ActivityEvent`, `AdminAuditLog`, and `GET /api/health`.
- **Gaps** `split_completed` and `mode_selected` declared but never fired; `identify()` never called so no person profiles exist; **no Sentry source-map upload** and **zero `captureException` calls**, so every handled failure — payments, sync, email, referral, outbox — is `console`-only.

### Cross-cutting: rate limiting, feature flags, health
- **Rate limiting** [BR-064, BR-088] — per-scope, per-user-or-IP sliding window, with an Upstash-backed distributed variant behind a flag. **Only two endpoints use the async (distributed-capable) path.**
- **Feature flags** — a central registry where every flag defaults OFF; public flags resolved through a static map because a dynamic `process.env[key]` lookup is not inlined by the bundler.
- **Health** — `GET /api/health` returns DB liveness, latency, uptime, commit SHA and region, `no-store`.

---

## Cross-cutting findings

### Built but unreachable **[IMPLEMENTED]**

| Item | Detail |
|---|---|
| `csv-export.ts` | Complete + unit-tested, zero UI callers (FEAT-063) |
| Delete / restore a saved split | API + service method, zero UI callers (FEAT-057, FEAT-058) |
| `supabaseDataService` | 5 of 7 methods unused — `deleteReceipt`, `getReceipts`, `getTrips`, `getTrip`, `createTrip` |
| Legacy `/api/trips/*` | 10 endpoints, no caller in the shipped frontend |
| `EmptyState` component | Zero consumers |
| `EVENTS.splitCompleted`, `.modeSelected`, `.pricingViewed` | Declared, never fired |
| `BEACON_TYPES` `"share.created"` | Allowlisted, never sent |
| `identify()`, `resetAnalytics()` | Exported, never called |
| `ErrorBoundary.onError` | Prop written for error reporting, never passed |

### Advertised but not implemented **[IMPLEMENTED]**

| Claim | Reality |
|---|---|
| "Priority AI processing" (`PRO_FEATURES`) | Pro and free share the same model, rate limit and queue |
| "Receipt history synced across devices" (`FREE_FEATURES`) | Only for explicitly saved splits, which then expire in 7 days |
| Landing stats and testimonials | Placeholder figures |

### Open questions

| # | Question | Label |
|---|---|---|
| 1 | Is CSV export meant to ship, or be deleted? | **[UNKNOWN]** |
| 2 | Should users be able to delete a saved split before its TTL? | **[UNKNOWN]** |
| 3 | Is the cleanup job scheduled anywhere? | **[UNKNOWN]** |
| 4 | Should the legacy `/api/trips/*` family be retired? | **[UNKNOWN]** |
| 5 | Is account deletion required, given the DB currently forbids it? | **[UNKNOWN]** |
| 6 | Is percentage/custom-amount splitting deliberately out of scope? | **[UNKNOWN]** |
