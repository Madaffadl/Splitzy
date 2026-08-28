# Splitzy — Screen Inventory

> **22 screens** — 20 routes with a `page.tsx`, plus the two conventional screens (`error.tsx`,
> `not-found.tsx`) a user can land on.
>
> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]** ·
> **[VISUAL-VERIFIED]** — confirmed by rendering the production build in Chromium during this phase.
>
> **Rendering was performed.** Unlike the Phase C brief's default assumption, responsive and visual
> behaviour below is not guessed: a production build was served on `localhost:3200` and every public
> screen captured at 390×844 (iPhone 13) and 1440×900, in light and dark, with automated measurement
> of overflow, touch-target size, accessible names and computed contrast. Items still marked
> **[REQUIRES VISUAL CHECK]** are those behind authentication, which the harness could not reach.

---

## Index

| ID | Route | Access | Rendering | Verified |
|---|---|---|---|---|
| SCR-001 | `/` | public | static ○ | ✅ mobile · desktop · dark |
| SCR-002 | `/id` | public | static ○ | ✅ mobile · desktop |
| SCR-003 | `/about` | public | static ○ | ✅ mobile · desktop |
| SCR-004 | `/id/about` | public | static ○ | ✅ (via `/about` parity) |
| SCR-005 | `/faq` | public | static ○ | ✅ mobile · desktop |
| SCR-006 | `/id/faq` | public | static ○ | ✅ (parity) |
| SCR-007 | `/privacy` | public | static ○ | ✅ mobile · desktop |
| SCR-008 | `/terms` | public | static ○ | ✅ mobile · desktop |
| SCR-009 | `/pricing` | public (flagged) | dynamic ƒ | ✅ mobile · desktop · dark |
| SCR-010 | `/single` | public | static ○ | ✅ full wizard driven |
| SCR-011 | `/multiple` | **intended auth-only** | static ○ | ⚠️ **rendered anonymously — see UX-001** |
| SCR-012 | `/travel` | public (local) / auth (cloud) | static ○ | ✅ mobile · desktop · dark |
| SCR-013 | `/dashboard` | auth | static ○ | ✅ signed-out gate only |
| SCR-014 | `/history` | auth | static ○ | ✅ signed-out gate only |
| SCR-015 | `/history/[id]` | auth | dynamic ƒ | **[REQUIRES VISUAL CHECK]** |
| SCR-016 | `/admin` | admin | static ○ | **[REQUIRES VISUAL CHECK]** |
| SCR-017 | `/s/[code]` | public | dynamic ƒ | ✅ not-found + expired states |
| SCR-018 | `/share` | public | static ○ | ✅ empty-hash state |
| SCR-019 | `/invite/[token]` | public → auth to join | dynamic ƒ | ✅ invalid state |
| SCR-020 | `/maintenance` | public (gated) | static ○ | — |
| SCR-021 | `not-found` (404) | public | — | ✅ mobile · desktop · dark |
| SCR-022 | `error` (500) | public | — | **[REQUIRES VISUAL CHECK]** |

Measured across all captures: **zero horizontal overflow** at either viewport, **zero controls
without an accessible name**, **zero images missing `alt`**.

---

## SCR-001 — Landing (English)

| | |
|---|---|
| **Route** | `/` · **User** anonymous (and signed-in) |
| **Purpose** | Explain the product and route the visitor into a tool |
| **Entry** | Organic search · direct · logo from every screen · `/id` language switch · retired `/en` 301 |
| **Exit** | `/single` `/travel` `/multiple` `/pricing` `/about` `/faq` `/privacy` `/terms` · Google sign-in |
| **Components** | `NewLanding` (Server) composing `ThemeToggle`, `AuthButton`, `LoginBanner`, `LocaleSync`, `JsonLd` |
| **Data** | Static dictionary copy. **Stats and testimonials are placeholder figures** |
| **Actions** | Choose a mode · sign in · switch language · toggle theme · expand FAQ |
| **API** | none on load |
| **State** | `useAuth`, `useLocale`; `LocaleSync` seeds `splitzy-locale` |
| **Validation** | n/a |
| **Loading** | `AuthButton` renders a same-height skeleton so the header does not shift |
| **Empty** | n/a |
| **Error** | none — no data fetch |
| **Success** | n/a |
| **Responsive** | **[VISUAL-VERIFIED]** No overflow at 390 px or 1440 px. Mode cards stack on mobile, grid on desktop |
| **Accessibility** | One `<h1>` ✅ · skip link is first in tab order ✅ · all controls named ✅ · focus outlines 2–3 px ✅ |
| **UX problems** | UX-004 (footer link targets 16 px) · UX-009 (placeholder social proof) · UX-011 (dark-mode primary contrast) |
| **Evidence** | [NewLanding.tsx](../../src/components/landing/NewLanding.tsx), [app/page.tsx](../../src/app/page.tsx) |

## SCR-002 — Landing (Indonesian)

Identical to SCR-001, at `/id`, wrapped in `<div lang="id-ID">`. **[VISUAL-VERIFIED]** renders fully
translated; `LocaleSync` writes `splitzy-locale = "id"`, which then follows the visitor into the tool
routes — confirmed empirically: after visiting `/id`, `/single` and `/multiple` rendered in
Indonesian for the rest of the browser context. **Evidence** [app/id/page.tsx](../../src/app/id/page.tsx)

## SCR-003 / SCR-004 — About (EN / ID)

| | |
|---|---|
| **Route** | `/about`, `/id/about` · **User** anonymous |
| **Purpose** | Brand and principles: fair, auditable, private, free at its core |
| **Components** | `AboutContent` + `ContentPageShell` |
| **API / State / Validation** | none |
| **Loading / Empty / Error** | n/a — static |
| **Responsive** | **[VISUAL-VERIFIED]** no overflow; single-column prose |
| **Accessibility** | One `<h1>` ✅ · reciprocal hreflang ✅ |
| **UX problems** | UX-004 |

## SCR-005 / SCR-006 — FAQ (EN / ID)

As above, `FaqContent`. Mirrored as `FAQPage` JSON-LD on the landing page so answers can expand in
search results. **[VISUAL-VERIFIED]** one `<h1>`, no overflow.

## SCR-007 / SCR-008 — Privacy & Terms

| | |
|---|---|
| **Route** | `/privacy` (last updated 3 August 2026), `/terms` · **User** anonymous |
| **Components** | `ContentPageShell` |
| **Responsive** | **[VISUAL-VERIFIED]** no overflow |
| **UX problems** | **UX-005 — English only, single-URL, no Indonesian counterpart**, in an Indonesian market · UX-004 |
| **Evidence** | [app/privacy/page.tsx](../../src/app/privacy/page.tsx) |

## SCR-009 — Pricing

| | |
|---|---|
| **Route** | `/pricing` · **User** anonymous or signed-in · gated by `NEXT_PUBLIC_FLAG_PRICING_PAGE` |
| **Purpose** | Free vs Pro comparison and checkout entry |
| **Entry** | Landing header · dashboard quota widget · scan paywall · `?login=required&redirect=/pricing` bounce |
| **Exit** | Xendit hosted invoice · `/?login=required` when signed out |
| **Components** | `UpgradeButton`, `SuccessCelebration`, a 5-question objection FAQ |
| **Data** | `PRO_PLAN` price, `FREE_FEATURES`, `PRO_FEATURES` |
| **API** | `POST /api/billing/checkout` (API-046) on upgrade |
| **Validation** | Server: already-Pro → 400 · not signed in → 401 → client redirects to sign-in |
| **Loading** | Button shows a spinner and "Redirecting…", disabled while in flight |
| **Empty** | n/a |
| **Error** | Inline `text-destructive` message beneath the button; network errors caught |
| **Success** | `?status=success` renders `SuccessCelebration` with a CSS-only celebration |
| **Responsive** | **[VISUAL-VERIFIED]** no overflow; plan cards stack on mobile |
| **UX problems** | **UX-011** — the "MOST POPULAR" badge measures **3.27:1** in dark mode · UX-005 (English only) · UX-010 ("Priority AI processing" is advertised but unimplemented) |
| **Evidence** | [app/pricing/page.tsx](../../src/app/pricing/page.tsx) |

## SCR-010 — Single receipt wizard ⭐ *core screen*

| | |
|---|---|
| **Route** | `/single`, `/single?step=bill`, `/single?step=summary`, `?resume=<id>`, `?lang=` |
| **User** | anonymous (3-split soft cap) and signed-in |
| **Purpose** | The product's primary loop: one bill → fair shares → shareable result |
| **Entry** | Landing CTA · mode card · dashboard · **the onboarding tour's Finish button** · history "Continue" |
| **Exit** | `/history` after save · WhatsApp · `/s/<code>` · `/` via header back |
| **Components** | `Stepper`, `ParticipantManager`, `ReceiptInput`, `ItemsTable`, `FeesInput`, `DiscountsInput`, `SummaryPanel`, `StickyActionBar`, `GuestLimitDialog` |
| **Data** | Local draft from `localStorage["splitbill-single"]`; live-computed shares |
| **Actions** | Add/remove participants · scan or add items · assign per person or per quantity · tax/service/fees/discounts · pick payer · save · share · export text |
| **API** | `POST /api/parse-receipt` · `GET /api/fx-rate` · `POST /api/receipts` · `POST /api/share` · `POST /api/activity` |
| **State** | `useHybridState`, `useSaveSplit`, `useGuestLimit`, `useNameSuggestions`, `useLocale` |
| **Validation** | **[VISUAL-VERIFIED] Proactive and specific.** Blocking messages render *above* the disabled primary action: *"Add at least one item."*, *"Every item needs a price."*, *"Pick who paid first"*. The **"View summary" button is genuinely `disabled`**, confirmed by driving it |
| **Loading** | Scan shows an "analysing" state; no full-page spinner (hydrates instantly from local state) |
| **Empty** | *"No items yet — Scan a receipt or add items manually to start splitting the bill."* ✅ |
| **Error** | Distinct copy per failure: offline (pre-flight), timeout, quota, unreadable, generic |
| **Success** | Toast "Split saved" with a **View** action to `/history` |
| **Responsive** | **[VISUAL-VERIFIED]** `StickyActionBar` pinned in the thumb zone on mobile, static from `md:`; no overflow |
| **Accessibility** | **[VISUAL-VERIFIED]** every control named — "Remove Alya", "Step 1 of 3 (current): Participant", "Change language — Bahasa Indonesia"; logical 16-stop tab order; visible focus rings. **No `<h1>` — see UX-002** |
| **UX problems** | **UX-002 (no `<h1>`)** · UX-003 (guest cap copy) · UX-006 (locale flash) |
| **Evidence** | [SingleSplitView.tsx](../../src/components/pages/SingleSplitView.tsx) |

**Notable positive [VISUAL-VERIFIED].** A privacy notice sits directly beneath the scan control:
*"Your photo is sent to Google Gemini for parsing and is not stored by Splitzy. Avoid uploading
receipts with sensitive personal data."* — localised in both languages. Disclosure at the point of
risk, not buried in a policy page.

## SCR-011 — Multiple receipts ⚠️

| | |
|---|---|
| **Route** | `/multiple` · **User** *intended* authenticated-only |
| **Purpose** | Several receipts, different payers, one settle-up |
| **Components** | `MultipleReceiptView` + the same receipt/summary primitives |
| **API** | Same as SCR-010, plus `POST/PUT /api/receipts` |
| **Validation** | Same proactive pattern; "Add at least 2 people to split the bill" |
| **Empty** | Two distinct empty states: *"Waiting for friends"* (no participants) and *"Add receipts to see the summary"* ✅ |
| **Responsive** | **[VISUAL-VERIFIED]** no overflow |
| **UX problems** | **UX-001 (Critical) — the screen renders in full to an anonymous visitor.** Confirmed by rendering: no gate, no redirect, the whole tool usable. Root cause in [FINDINGS-PRIVATE](../security/FINDINGS-PRIVATE.md) · UX-002 (no `<h1>`) |
| **Evidence** | [MultipleReceiptView.tsx](../../src/components/pages/MultipleReceiptView.tsx) |

**[VISUAL-VERIFIED]** `isAuthenticated` appears in this component only to conditionally show Save
controls (2 call sites). There is no page-level gate, so when the proxy lets a request through the
entire tool is exposed.

## SCR-012 — Travel Spend

| | |
|---|---|
| **Route** | `/travel`, `?trip=<id>`, `?view=` · **User** anonymous (local) or signed-in (cloud) |
| **Purpose** | Multi-day, multi-person, multi-currency trip ledger |
| **Entry** | Landing mode card · dashboard · invite accept → `?trip=<id>` |
| **Components** | `TravelSpendView` (2 086 lines), `IndividualBudgets`, `MembersCard`, `SettleUpCard`, `ChangeRequests` (`ReviewInbox`, `ProposalBar`, `ChangeOpList`), `Skeleton` |
| **Data** | Trips, participants, receipts, payments, members, invites, change requests, budgets |
| **API** | 14 endpoints (API-025 … API-042) plus scan and FX |
| **State** | `useTravelData` — mirror, outbox, per-trip write queue, sync status |
| **Validation** | Participant/payer/amount validated client- and server-side; FX rate required for foreign receipts |
| **Loading** | **The only `Skeleton` consumer in the app**; plus a pending-sync counter |
| **Empty** | 3 distinct empty states ✅ |
| **Error** | 36 error-handling sites; sync banner exposes `idle \| saving \| error \| conflict`; 15 toast call sites |
| **Success** | Toasts with **Undo** actions on destructive operations |
| **Responsive** | **[VISUAL-VERIFIED]** no overflow at either viewport, light or dark |
| **UX problems** | UX-007 (settle-up semantics differ silently from Single/Multiple) · UX-008 (unassigned-item cost silently shifts to the payer) · UX-012 (file size / cognitive load) |
| **Evidence** | [TravelSpendView.tsx](../../src/components/pages/TravelSpendView.tsx) |

## SCR-013 — Dashboard

| | |
|---|---|
| **Route** | `/dashboard` · **User** authenticated · `noindex` |
| **Purpose** | Signed-in home: quota, referral, quick actions |
| **Components** | `DashboardClient`, `ReferralCard`, `Spinner` |
| **Data** | Greeting with first name · AI quota progress bar or Pro badge · referral link and totals · 3 mode cards |
| **API** | `GET /api/me/quota`, `GET /api/me/referral` |
| **Loading** | `Spinner` inside the quota widget while fetching |
| **Empty** | `ReferralCard` returns `null` until data arrives — **no skeleton, so the card pops in (UX-013)** |
| **Error** | **Both fetches `.catch(() => {})` — a failure shows nothing at all (UX-014)** |
| **Signed-out** | In-page gate: "Sign in to see your dashboard" ✅ **[VISUAL-VERIFIED]** |
| **Responsive** | **[VISUAL-VERIFIED]** gate renders correctly at both viewports |
| **Authenticated view** | **[REQUIRES VISUAL CHECK]** |
| **UX problems** | UX-005 (English only) · UX-013 · UX-014 |

## SCR-014 — Receipt history

| | |
|---|---|
| **Route** | `/history` · **User** authenticated · `noindex` |
| **Components** | `ReceiptHistoryList`, `ReceiptHistoryCard` |
| **Data** | Title, date, total, participant count, item count, **days remaining**, trip name |
| **Actions** | Search (300 ms debounce) · clear search · load more · **Continue** |
| **API** | `GET /api/receipts` |
| **Loading** | `Loader2` spinner |
| **Empty** | Two variants: *"No receipts match your search"* / *"No receipts yet"* ✅ |
| **Error** | 1 error path only — **[INFERRED]** a failed fetch surfaces thinly |
| **Signed-out** | In-page sign-in gate, deliberately not a redirect ✅ **[VISUAL-VERIFIED]** |
| **UX problems** | **UX-015 — no delete affordance** (API + service method exist, nothing calls them) · **UX-016 — no export** · UX-005 |
| **Evidence** | [ReceiptHistoryList.tsx](../../src/components/history/ReceiptHistoryList.tsx) |

## SCR-015 — History detail

| | |
|---|---|
| **Route** | `/history/[id]` · **User** authenticated + involved |
| **Purpose** | Read-only view of one saved split |
| **API** | `GET /api/receipts/[id]` |
| **Loading** | `Loader2` · **Error** inline `AlertCircle` with "Receipt not found" / "Failed to load receipt" |
| **Data correctness** | Reads through `receiptsFromDetail`, not the flat columns — the fix for a Grand Total that disagreed with the editor for the same split |
| **Visual** | **[REQUIRES VISUAL CHECK]** — behind auth |
| **UX problems** | UX-015 (no delete) · UX-005 |

## SCR-016 — Admin console

| | |
|---|---|
| **Route** | `/admin` · **User** admin only · `noindex` |
| **Components** | `UserDrawer`, `ConfirmDialog`, `ActivityFeed`, `UserActivity`, `StatTile`, `PlanBadge`, `ScanBar`, `Avatar` |
| **Data** | Paginated users with plan, scan usage, ban and admin state, trip count; global counters; audit feed; daily activity |
| **Actions** | Search · filter `all/free/pro/banned` · change plan · reset quota · set custom limit · ban/unban · grant/revoke admin · view trips |
| **API** | API-049 … API-053 |
| **Loading** | 7 loading sites · **Empty** 3 sites · **Error** 26 handling sites — the most defensive screen in the app |
| **Success** | `successMsg` / `errorMsg` inline in the drawer |
| **Guards** | Confirm dialog before destructive actions; self-lockout prevented |
| **Signed-out** | `router.replace("/?login=required&redirect=/admin")` |
| **Visual** | **[REQUIRES VISUAL CHECK]** — requires an admin session |
| **UX problems** | UX-005 (English only — acceptable for internal tooling) |

## SCR-017 — Shared split (public link)

| | |
|---|---|
| **Route** | `/s/[code]` · **User** anyone, no account · `dynamic = "force-dynamic"` · `noindex` + robots-disallowed |
| **Purpose** | The product's main non-user touchpoint: what you owe and where to send it |
| **Data** | Server-rendered snapshot: participants, per-person shares, transfers, **payer bank details**, last-changed timestamp |
| **API** | none — direct Prisma read |
| **Empty / Error** | **[VISUAL-VERIFIED]** distinguishes *expired* (Clock icon) from *not found* (AlertCircle), each with a "Start a new split" CTA |
| **Responsive** | **[VISUAL-VERIFIED]** no overflow, light and dark |
| **UX problems** | **UX-002 (no `<h1>`)** · **UX-005 — English only, and this is the screen a non-user is most likely to see** · UX-011 (dark-mode CTA contrast 3.27:1) · UX-017 (bank details in a 14-day public snapshot) |
| **Evidence** | [app/s/[code]/page.tsx](../../src/app/s/[code]/page.tsx) |

## SCR-018 — Hash share view

| | |
|---|---|
| **Route** | `/share#<base64url>` · **User** anyone |
| **Purpose** | Read-only view whose payload **never reaches the server** — no DB row, works for guests, leaks nothing into request logs |
| **Loading / Error** | "Loading shared split…" → "This share link is empty." / "…invalid or corrupted." with a "Start a new split" CTA ✅ **[VISUAL-VERIFIED]** |
| **UX problems** | UX-002 (no `<h1>`) · UX-005 |

## SCR-019 — Invite landing

| | |
|---|---|
| **Route** | `/invite/[token]` · **User** anonymous → authenticated to join |
| **Data** | Trip name, who invited you, expiry |
| **API** | `GET /api/invite/[token]`, `POST /api/invite/[token]/join` |
| **States** | `loading \| invalid \| ready \| joining \| joined \| error` — a genuine six-state machine |
| **Success** | "Joined" then a 1 400 ms delay before routing **directly to that trip**, not a trip list |
| **Error** | **[VISUAL-VERIFIED]** "This invite link is invalid or has expired." |
| **UX problems** | UX-002 (no `<h1>`) · UX-005 · **UX-018 — the inviter's email is disclosed when their display name is null** |

## SCR-020 — Maintenance

`/maintenance`, `noindex`. Reached only when `MAINTENANCE_MODE=true`; redirects back to `/` when off.
Not exercised.

## SCR-021 — 404

| | |
|---|---|
| **Components** | Animated 404 with orbs, "Return Home" and "Go Back" |
| **Verified** | **[VISUAL-VERIFIED]** returns HTTP 404 ✅, renders at both viewports and in dark mode |
| **UX problems** | **UX-011 — the "Page Not Found" badge measures 2.15:1** (gold on cream, 14 px). Needs 4.5:1 |

## SCR-022 — 500 error

`app/error.tsx`. Try Again + Back to Home; raw `error.message` shown only outside production.
**[REQUIRES VISUAL CHECK]** — requires inducing a runtime error.
**UX problem** UX-019 — nothing is reported to Sentry; `ErrorBoundary.onError` is never supplied.

---

## Cross-screen measurements **[VISUAL-VERIFIED]**

| Check | Result |
|---|---|
| Horizontal overflow, 390 px | **0 screens** |
| Horizontal overflow, 1440 px | **0 screens** |
| Controls without an accessible name | **0** |
| `<img>` without `alt` | **0** |
| Screens with exactly one `<h1>` | 11 of 16 public screens — **5 have none** |
| Contrast failures (light) | 1 — the 404 badge |
| Contrast failures (dark) | 3 instances of one token pair |
| Touch targets < 44 px | footer/secondary nav links only, 15–20 px tall; **all primary actions ≥ 44 px** |
| Focus outlines | present on every stop, 2–3 px |
| Dark mode toggle | applies `class="dark"` to `<html>` ✅ |

---

## Screens the harness could not reach

| Screen | Blocker | What is unverified |
|---|---|---|
| SCR-013 dashboard (signed in) | Google OAuth | quota bar, referral card layout |
| SCR-015 history detail | auth | summary rendering with real data |
| SCR-016 admin | admin session | table density, drawer on mobile |
| SCR-022 error page | needs an induced crash | layout |
| SCR-012 travel, cloud mode | auth | members, invites, change-request review UI |
| SCR-020 maintenance | env flag | layout |

Resolving these needs a seeded test account. See
[../qa/test-strategy.md](../qa/test-strategy.md#authenticated-visual-coverage).
