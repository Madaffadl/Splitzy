# Splitzy — UX Audit

> **23 findings.** This audit is **not** code-inspection only: a production build was served and
> every public screen rendered in Chromium at 390×844 and 1440×900, light and dark, with automated
> measurement of overflow, touch-target size, accessible names, heading structure and **computed
> colour contrast**. The wizard was driven end to end with real input.
>
> Findings carrying **[VISUAL-VERIFIED]** were measured in a browser. Findings still marked
> **[REQUIRES VISUAL CHECK]** sit behind authentication, which the harness could not reach.
>
> **Severity** — Critical: blocks core task completion or breaks a stated guarantee · High:
> significant confusion, friction or exclusion · Medium: degrades the experience · Low: polish.

---

## Summary

| Severity | Count | IDs |
|---|---|---|
| **Critical** | 1 | UX-001 |
| **High** | 6 | UX-002, UX-005, UX-007, UX-011, UX-015, UX-019 |
| **Medium** | 11 | UX-003, UX-008, UX-009, UX-010, UX-014, UX-016, UX-017, UX-018, UX-020, UX-021, UX-022 |
| **Low** | 5 | UX-004, UX-006, UX-012, UX-013, UX-023 |

**What the rendering pass changed.** Four findings could not have come from reading code:
UX-001 (the bypass reproduces), UX-011 (contrast measured, not estimated), and the two *negative*
results below, which retired suspicions a code review would have raised.

### Confirmed healthy — measured, not assumed

| Check | Result |
|---|---|
| Horizontal overflow at 390 px and 1440 px | **zero** across 38 captures |
| Interactive controls without an accessible name | **zero** |
| `<img>` missing `alt` | **zero** |
| Focus outlines | present on every tab stop, 2–3 px |
| Tab order on `/single` | 16 logical stops, skip link first, no traps |
| Primary action touch targets | **all ≥ 44 px** |
| Dark-mode toggle | applies `class="dark"`, no unthemed regions found |
| Form validation | proactive, specific, and genuinely disables the primary action |

---

## Critical

### UX-001 — `/multiple` renders in full to unauthenticated visitors
**Problem** The route is declared auth-protected, and is not. An anonymous request returns HTTP 200
with the complete Multiple-receipts tool: participants, receipts, fees, discounts, summary.

**Evidence** [VISUAL-VERIFIED] `curl` and a headless browser both received 200 at `/multiple` with
no session; the screenshot shows the full working tool.
Root cause: [src/proxy.ts](../../src/proxy.ts) lets a request through when
`authError.status !== 401`, but `supabase.auth.getUser()` with **no session** throws
`AuthSessionMissingError`, whose status is **400**
(`@supabase/auth-js/.../errors.js:102`). Every anonymous request takes the "transient error" branch.
[MultipleReceiptView.tsx](../../src/components/pages/MultipleReceiptView.tsx) references
`isAuthenticated` at only two places, both to hide Save buttons — there is no page-level gate.

**Impact** No third-party data is exposed (the tool is local-first and Save is hidden). But: the
stated access control does not hold; the guest split cap is bypassed entirely; and the sitemap
excludes `/multiple` on the belief that crawlers are redirected, when in fact Googlebot receives a
full 200.

**Severity** Critical — a stated security guarantee does not hold, verified in a browser.

**Recommendation** Narrow the fail-open test to genuinely transient conditions (a network/5xx
failure), treating `AuthSessionMissingError` as unauthenticated; **and** add a page-level gate to
`MultipleReceiptView` mirroring `/history`, so the route degrades safely regardless. Then revisit
the sitemap decision on its real merits.

**Requires visual check** No — already verified.

---

## High

### UX-002 — Five screens have no `<h1>`
**Problem** `/single`, `/multiple`, `/share`, `/s/[code]` and `/invite/[token]` render with **zero**
`<h1>` elements.

**Evidence** [VISUAL-VERIFIED] Measured across mobile, desktop and dark captures. By contrast, the
landing, about, FAQ, legal and pricing pages each have exactly one.

**Impact** Screen-reader users lose the primary landmark for "what is this page"; heading navigation
(a common AT shortcut) starts at `h2` or lower. For `/single` — the product's core screen — and
`/s/[code]` — the main non-user touchpoint — this is the worst place for it. It also weakens the SEO
of two indexable routes.

**Severity** High — accessibility exclusion on the most-used screens.

**Recommendation** Promote the existing screen title to `<h1>` on each (`/single` already renders
"Single Receipt" in the header; `/s/[code]` renders "Shared split"). No visual change is required —
these can be styled identically.

**Requires visual check** No.

### UX-005 — The share page and legal pages are English-only
**Problem** Ten surfaces have no dictionary usage and are hardcoded English: `/privacy`, `/terms`,
`/pricing`, `/dashboard`, `/history`, `/history/[id]`, `/s/[code]`, `/share`, `/invite/[token]`,
`/admin`, plus the 404/500 pages, server-side API error messages surfaced in toasts, and the welcome
email.

**Evidence** [IMPLEMENTED] No `useDictionary`/`getDictionary` import in any of those files.

**Impact** Two are acute. `/s/[code]` is the screen a **non-user** is most likely to see — it arrives
via a WhatsApp message that was almost certainly written in Indonesian, and it asks the reader to
transfer money. `/privacy` and `/terms` are legal documents presented to an Indonesian audience in a
language they may not read.

**Severity** High.

**Recommendation** Prioritise `/s/[code]` and `/share` (viral surface), then the legal pages. The
dictionary infrastructure already exists and is type-checked, so this is translation work rather
than engineering.

**Requires visual check** No.

### UX-007 — "Mark as paid" means two different things, with no signal
**Problem** In Travel, ticking a settle-up writes a `TripPayment` ledger row that **changes the
balances**. In Single and Multiple, the identical-looking checkbox writes a `localStorage` flag that
changes **nothing**, does not sync, and silently resets when an amount changes.

**Evidence** [IMPLEMENTED] [usePaidSettlements.ts](../../src/hooks/usePaidSettlements.ts) —
*"Local-only by design… does not need to be authoritative"*; `settlementKey` embeds the rounded
amount, so an edit invalidates the marker. Compare
[settle-up.ts](../../src/lib/travel/settle-up.ts).

**Impact** A user who learns the behaviour in one mode will be wrong in the other. Worse, the
Single/Multiple marker disappears after an edit with no explanation, which reads as data loss.

**Severity** High — the same control, the same visual language, two incompatible meanings.

**Recommendation** Either label the local one honestly ("crossed off on this device") or give
Single/Multiple a real ledger. At minimum, explain the reset when it happens.

**Requires visual check** No.

### UX-011 — Measured contrast failures, one at token level
**Problem** Three text/background pairs fall below WCAG AA.

**Evidence** [VISUAL-VERIFIED] Computed from rendered pages:

| Where | Foreground on background | Measured | Required |
|---|---|---|---|
| 404 badge "Page Not Found", 14 px | `rgb(218,166,11)` on `rgb(252,251,248)` | **2.15:1** | 4.5:1 |
| Dark mode — "See pricing" CTA, 16 px | white on `rgb(122,153,51)` | **3.27:1** | 4.5:1 |
| Dark mode — "MOST POPULAR" badge, 11 px | white on `rgb(122,153,51)` | **3.27:1** | 4.5:1 |
| Dark mode — "Go to Splitzy" on `/s/<code>`, 14 px | white on `rgb(122,153,51)` | **3.27:1** | 4.5:1 |

The first is a call site using `text-accent` as text — exactly what `--accent-strong` was introduced
to prevent, with a documented comment saying bright accent *"fails WCAG as text (~2.2:1)"*. The
measurement lands at 2.15:1, confirming the comment and identifying a site that was missed.

The other three are **one token pair**: dark-mode `--primary: 78 50% 40%` with
`--primary-foreground: white`. That affects **every primary button and badge in dark mode**, not
three isolated components.

**Impact** Low-vision users cannot reliably read primary CTAs in dark mode. `globals.css` documents
careful contrast work for `success`/`warning`/`info`/`accent-strong` — `primary` was not given the
same treatment.

**Severity** High — systematic, affects the primary action colour.

**Recommendation** Darken dark-mode `--primary` (roughly `78 50% 30%` reaches ≈4.6:1 against white)
or lighten `--primary-foreground`; then swap the 404 badge to `text-accent-strong`. Add contrast
assertions to the E2E suite so token changes cannot regress silently.

**Requires visual check** No — already measured.

### UX-015 — There is no way to delete a saved split
**Problem** `ReceiptHistoryCard` offers only "Continue". No delete, no archive, no undo.

**Evidence** [IMPLEMENTED] `DELETE /api/receipts/[id]`, `POST …/restore`, and
`supabaseDataService.deleteReceipt()` all exist, are creator-gated and rate-limited — and have
**zero callers**.

**Impact** A split created by mistake, or one containing a name the user would rather not keep, sits
on the server for seven days with no way to remove it. The complete server implementation makes this
an omission rather than a decision.

**Severity** High — a basic data-control expectation, with the backend already built.

**Recommendation** Add a delete action with an undo toast (the restore endpoint is already
idempotent). Roughly a day's work against an API that is finished.

**Requires visual check** No.

### UX-019 — No error reaches the operator
**Problem** Every handled failure — payment, sync, email, referral, outbox discard, section crash —
is `console`-only.

**Evidence** [IMPLEMENTED] Zero `Sentry.captureException` calls in application code.
`ErrorBoundary` exposes an `onError` prop written explicitly *"for shipping to error monitoring"* and
**no caller ever supplies it**. No source-map upload is configured.

**Impact** A user hitting UX-001, a failed Xendit checkout, or a discarded receipt produces no
signal. The operator learns about breakage only when someone reports it — which is exactly how the
PWA icon defect went undetected for months.

**Severity** High — it is the reason other defects stay undiscovered.

**Recommendation** Supply `onError` at every `ErrorBoundary`; add `captureException` to the swallowed
catches in `useTravelData`, the billing routes and the email path; enable `withSentryConfig` for
source maps.

**Requires visual check** No.

---

## Medium

### UX-003 — The guest counter is shown before it means anything
**Problem** "3 of 3 free splits left" appears on the bill step before the user has completed
anything.
**Evidence** [VISUAL-VERIFIED] visible at `/single?step=bill` on a first visit.
**Impact** Introduces a scarcity frame during the first task, on a product whose main promise is
"free, no sign-up needed".
**Severity** Medium. **Recommendation** Show it from the second split onward.
**Visual check** No.

### UX-008 — An unassigned item silently shifts cost to the payer
**Problem** An item assigned to nobody still counts toward the grand total, so the payer absorbs it
with no warning.
**Evidence** [IMPLEMENTED] BR-005; `calculateItemShares` returns an empty map while
`calculateReceiptSubtotal` still sums the item.
**Impact** The payer under-recovers, and the numbers still look internally consistent — the hardest
class of error to notice.
**Severity** Medium. **Recommendation** Flag unassigned items in the summary with the amount the
payer is absorbing.
**Visual check** No.

### UX-009 — Fabricated social proof
**Problem** Landing statistics, three named testimonials and a 5-star rating are placeholders.
**Evidence** [IMPLEMENTED] Acknowledged in `structured-data.ts`; an E2E test prevents them being
marked up as `aggregateRating` precisely because they are fabricated.
**Impact** A trust liability whose most credible-looking element is the invented one. The team
understood the risk well enough to prevent the search-policy violation, but the claims remain
on-page.
**Severity** Medium. **Recommendation** Replace with real figures or remove.
**Visual check** No.

### UX-010 — "Priority AI processing" is advertised and does not exist
**Problem** Listed in `PRO_FEATURES` on the pricing page.
**Evidence** [IMPLEMENTED] Pro and free share the same model, rate limit and queue.
**Impact** A paid-tier claim the product does not deliver.
**Severity** Medium. **Recommendation** Implement it or remove the line.
**Visual check** No.

### UX-014 — Dashboard failures render nothing at all
**Problem** Both dashboard fetches end in `.catch(() => {})`. On failure the quota widget shows a
spinner forever and the referral card never appears.
**Evidence** [IMPLEMENTED] [DashboardClient.tsx](../../src/components/dashboard/DashboardClient.tsx),
[ReferralCard.tsx](../../src/components/referral/ReferralCard.tsx) (`if (!data) return null`).
**Impact** The signed-in home page degrades to a blank area with no explanation or retry.
**Severity** Medium. **Recommendation** Render an error state with a retry, consistent with the rest
of the app.
**Visual check** [REQUIRES VISUAL CHECK] — authenticated view not reachable by the harness.

### UX-016 — Export is built and unreachable
**Problem** No UI reaches `csv-export.ts`.
**Evidence** [IMPLEMENTED] 110 lines, RFC-4180 quoting, UTF-8 BOM, dated filename, its own unit-test
file, zero callers.
**Severity** Medium. **Recommendation** Add an Export action to the summary panel, or delete the
module.
**Visual check** No.

### UX-017 — Bank details travel into a public 14-day snapshot
**Problem** `paymentInfo` (bank, account number, holder name) is copied into `SharedSummary.payload`
and rendered at `/s/<code>` to anyone with the link.
**Evidence** [IMPLEMENTED] `shared-summary.ts` carries `paymentInfo` through; `createdById` uses
`onDelete: SetNull`, so the snapshot outlives the account.
**Impact** Necessary for the product to work — the recipient needs somewhere to send money — but the
user is never told the link is unguessable-but-public, nor how long it lives.
**Severity** Medium. **Recommendation** State the link's public nature and TTL at the moment of
creation, as the scan flow does for the Gemini upload.
**Visual check** No.

### UX-018 — An invite link can disclose the inviter's email
**Problem** `invitedBy` falls back to `creator.email` when the display name is null.
**Evidence** [IMPLEMENTED] `api/invite/[token]` — `creator?.name ?? creator?.email ?? "Someone"`.
**Impact** A forwarded or leaked invite exposes an email address on an unauthenticated page.
**Severity** Medium. **Recommendation** Fall back to "Someone" rather than the email.
**Visual check** No.

### UX-020 — Signing in mid-flow silently abandons local work
**Problem** Nothing is migrated on sign-in, and nothing prompts the user to Save.
**Evidence** [IMPLEMENTED] The old migration dialog was deliberately removed because it *"deleted the
local copy after writing a payload the editor could not reopen"* — a correct fix that left no
replacement affordance.
**Impact** A user who signs in from the guest-limit dialog reasonably expects their split to follow
them.
**Severity** Medium. **Recommendation** After sign-in with an unsaved local split, offer a single
"Save this split to your account" prompt.
**Visual check** No.

### UX-021 — Token migration is ~92 % complete
**Problem** 104 raw Tailwind palette classes remain alongside 1 158 semantic token usages; only 39 of
the 104 carry a `dark:` pair, so ~65 have no dark-mode counterpart.
**Evidence** [IMPLEMENTED] Measured across all `.tsx`; most common are `bg-emerald-500` (15),
`border-emerald-500` (6), `text-green-600` (4).
**Impact** Each unpaired class is a potential dark-mode inconsistency. The rendering pass found no
visibly broken region, so this is latent rather than active.
**Severity** Medium (latent). **Recommendation** Finish the migration to `success`/`warning`/`info`;
the tokens already exist with documented contrast ratios.
**Visual check** Partially done — no active breakage found.

### UX-022 — Loading affordances are inconsistent
**Problem** Four different treatments: `Skeleton` (one consumer, Travel only), `Spinner`/`Loader2`,
`Suspense fallback={null}`, and nothing at all. There are **no `loading.tsx` files anywhere**, so
route transitions show no streamed feedback.
**Evidence** [IMPLEMENTED] `git ls-files 'src/app/**/loading.tsx'` returns nothing; `Skeleton` has one
consumer.
**Impact** Slow navigations look unresponsive; the app feels inconsistent between areas.
**Severity** Medium. **Recommendation** Add `loading.tsx` for the dynamic routes and standardise on
skeletons for lists, spinners for actions.
**Visual check** No.

---

## Low

### UX-004 — Footer and secondary links are below the minimum target size
Measured 15–20 px tall (e.g. "Privacy Policy" 99×19, "FAQ" 23×16, "Terms" 35×15) — under the 24 px
WCAG 2.5.8 (AA) minimum. **All primary actions are ≥ 44 px**, so the design-system work held; this is
the footer only. [VISUAL-VERIFIED] **Recommendation** Add vertical padding to footer links.

### UX-006 — One frame of English on tool pages
An Indonesian visitor sees the default locale for one frame before the stored preference applies.
[IMPLEMENTED] and explicitly accepted in `use-locale.ts` — removing it would make the routes dynamic.
**Recommendation** Leave as is; documented trade-off.

### UX-012 — `TravelSpendView` is 2 086 lines
Not a user-facing defect, but it is where UX inconsistencies will accumulate.
**Recommendation** Decompose by card.

### UX-013 — The referral card pops in
`ReferralCard` returns `null` until its fetch resolves, so it appears abruptly and shifts the layout.
**Recommendation** Reserve the space with a skeleton.

### UX-023 — `EmptyState` exists and is never used
A design-system primitive with zero consumers; every empty state is hand-rolled. They are all
*present* and well-written, but each is bespoke.
**Recommendation** Adopt it, or delete it.

---

## What the audit did **not** find

Worth recording, because a code-only review would likely have flagged these as suspicions:

1. **No responsive breakage.** Zero horizontal overflow across 38 captures.
2. **No unnamed controls.** Every button and link has an accessible name, including generated ones
   like "Remove Alya" and "Step 1 of 3 (current): Participant".
3. **No missing `alt`.**
4. **No keyboard traps** and no invisible focus — every stop had a 2–3 px outline.
5. **No unthemed dark-mode regions.**
6. **No weak validation.** The primary action is genuinely `disabled` and the blocking reason is
   named specifically ("Every item needs a price.", "Pick who paid first").
7. **No missing empty states** on any list surface that was reachable.

---

## Priority order

| # | Finding | Why first |
|---|---|---|
| 1 | UX-001 | A stated access control does not hold, and it invalidates a separate SEO decision |
| 2 | UX-011 | Systematic, measured, affects every primary CTA in dark mode |
| 3 | UX-019 | It is the reason other defects go undetected |
| 4 | UX-002 | Cheap to fix, removes an accessibility exclusion from the two most-seen screens |
| 5 | UX-015 | The backend is finished; only the button is missing |
| 6 | UX-005 | The viral surface and the legal surface are both in the wrong language |
| 7 | UX-007 | The same control meaning two things will eventually cost someone money |
