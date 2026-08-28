# Splitzy — User Stories

> **60 stories** covering every meaningful feature. Acceptance criteria are in Given/When/Then form
> and deliberately include the unhappy paths: validation failure, permission denial, error states
> and edge cases.
>
> A consolidated, test-oriented view of the same criteria is in
> [acceptance-criteria.md](./acceptance-criteria.md).
> Personas `P-xx` → [../product/personas.md](../product/personas.md) ·
> `FEAT-xxx` → [../product/feature-catalog.md](../product/feature-catalog.md) ·
> `BR-xxx` → [business-rules.md](./business-rules.md) ·
> `API-xxx` → [../api/endpoints.md](../api/endpoints.md)
>
> **Evidence convention.** Every story ends with an **Implementation Evidence** line naming real
> files, and every criterion is drawn from behaviour observed in those files — so each story is
> implicitly **[IMPLEMENTED]**. The four labels appear inline only where a claim goes beyond the
> code: a **Status** line marks the two unmet stories, and **[INFERRED]** / **[UNKNOWN]** are used
> where an interpretation or an unanswered question is being recorded.

| Range | Area |
|---|---|
| US-001 – US-007 | Identity & access |
| US-008 – US-011 | Onboarding, marketing & language |
| US-012 – US-024 | Core splitting |
| US-025 – US-027 | AI receipt scanning |
| US-028 – US-039 | Travel Spend |
| US-040 – US-047 | Persistence & sharing |
| US-048 – US-050 | Money & growth |
| US-051 – US-056 | Administration |
| US-057 – US-060 | Platform |

---

## Identity & access

### US-001 — Create an account
**As a** first-time visitor (P-04) **I want to** create an account with one tap **so that** my
splits survive beyond this device.

**AC**
- *Happy:* **Given** I have never signed in, **When** I complete Google consent, **Then** a `User`
  row is created, `lastLoginAt` is set, a `login` activity event is written, and I land on the page
  I came from.
- *Alternative:* **Given** I arrived via `?ref=CODE` within the last 30 days, **When** my account is
  created, **Then** the referrer receives 14 days of Pro and the cookie is cleared.
- *Alternative:* **Given** `RESEND_API_KEY` is configured, **Then** exactly one welcome email is
  sent — and never again on subsequent sign-ins.
- *Error:* **Given** the profile write fails, **Then** I am still signed in and the failure is
  logged only. **Edge:** I then hold a session with no `User` row, so every protected API call 401s
  until a later sign-in repairs it.
- *Error:* **Given** the OAuth code is missing or the exchange fails, **Then** I am redirected to
  `/?error=no_code` or `/?error=auth_failed`.

**Rules** BR-040, BR-041, BR-042, BR-071 · **Deps** FEAT-001, FEAT-068, FEAT-069, API-002
**Evidence** [api/auth/callback](../../src/app/api/auth/callback/route.ts)

### US-002 — Sign in
**As a** returning user (P-01) **I want to** sign in **so that** I can reach my history and trips.

**AC**
- *Happy:* **Given** I have an account, **When** I sign in, **Then** my profile is refreshed from
  Google, `lastLoginAt` updates, and `/api/auth/me` returns `{ id, email, name, avatarUrl,
  createdAt, isAdmin }`.
- *Alternative:* **Given** I was bounced from `/history`, **When** I sign in, **Then** I land on
  `/history`, not the homepage.
- *Permission:* **Given** my account is banned, **When** I sign in, **Then** the session succeeds
  but every protected endpoint returns `401`. **Edge:** `/api/auth/me` still returns my profile —
  an inconsistency.
- *Edge:* **Given** no `User` row exists for my session, **Then** `/api/auth/me` returns
  `404 { user: null }`.

**Rules** BR-040, BR-043 · **Deps** FEAT-001, API-003 · **Evidence** [useAuth.ts](../../src/hooks/useAuth.ts)

### US-003 — Sign out
**As a** user on a shared device **I want to** sign out completely **so that** the next person
inherits nothing.

**AC**
- *Happy:* **When** I sign out, **Then** session cookies are cleared, seven `localStorage` keys are
  removed (`splitbill-single`, `splitbill-trips`, `splitzy-history`,
  `splitzy-guest-splits-count`, `splitzy-travel-mirror`, `splitzy-travel-outbox`,
  `splitzy-travel-draft`), and a "Signed out" toast appears.
- *Alternative:* **Given** my session expires on its own, **Then** the same toast appears — but
  **not** on first load for a visitor who was simply never signed in.
- *Error:* **Given** storage is blocked, **Then** the purge is skipped silently and sign-out still
  succeeds.
- *Edge:* `splitzy-travel` (guest data) and `splitzy-locale` (a preference) are deliberately kept.
- *Gap:* the PostHog distinct id is **not** reset, so pre- and post-sign-out events share one
  anonymous identity.

**Rules** BR-043 · **Deps** FEAT-002 · **Evidence** [useAuth.ts](../../src/hooks/useAuth.ts)

### US-004 — Stay signed in
**As a** user **I want** my session to refresh silently **so that** I am not logged out mid-task.

**AC**
- *Happy:* **When** I navigate, **Then** the edge proxy refreshes the Supabase session and writes
  the new cookies onto the response.
- *Edge:* **Given** the proxy must redirect me, **Then** refreshed cookies are copied onto the
  redirect so no second redirect loop occurs.
- *Error:* **Given** `getUser()` fails with a non-401 error, **Then** the request is allowed through
  rather than false-redirecting me.

**Rules** BR-044, BR-045 · **Deps** FEAT-003 · **Evidence** [src/proxy.ts](../../src/proxy.ts)

### US-005 — Be guided to sign in when a page requires it
**As a** signed-out visitor **I want** a clear reason and a way back **so that** a locked page is
not a dead end.

**AC**
- *Happy:* **Given** I request `/multiple`, **When** I am not signed in, **Then** I am redirected to
  `/?login=required&redirect=/multiple` and a banner offers sign-in.
- *Alternative:* **Given** I open `/history`, **Then** I stay on `/history` and see an in-page
  sign-in gate rather than being bounced to the marketing landing.
- *Alternative:* **Given** I open `/history/<id>` or `/admin`, **Then** I am client-side redirected
  with the same `?login=required&redirect=` convention.
- *Edge:* the banner copy is deliberately generic, because the same banner serves the pricing
  bounce and the history bounce.

**Rules** BR-044 · **Deps** FEAT-003 · **Evidence** [LoginBanner.tsx](../../src/components/landing/LoginBanner.tsx)

### US-006 — Use Splitzy without an account
**As a** cautious visitor (P-04) **I want to** split a bill with no sign-up **so that** I can judge
it before committing.

**AC**
- *Happy:* **Given** I have no account, **When** I open `/single`, **Then** I can add participants,
  scan a receipt, assign items and see the settlement.
- *Alternative:* **Then** I can also create a public share link (`createdById` stays null).
- *Alternative:* **Then** I can use `/travel` with trips stored only in `localStorage`.
- *Permission:* **Given** I open `/multiple`, **Then** I am redirected to sign in.
- *Edge:* **Then** my AI scans are **not** counted against any monthly quota — only the 10/min IP
  limit applies.
- *Edge:* **Given** I later sign in, **Then** my local data is **not** migrated automatically;
  saving is an explicit action that keeps the local copy.

**Rules** BR-057, BR-058, BR-059 · **Deps** FEAT-004 · **Evidence** public `/single`, `/travel`

### US-007 — Understand the guest limit
**As a** repeat guest **I want** a clear, non-destructive prompt **so that** I do not lose work I
have just done.

**AC**
- *Happy:* **Given** I have completed 3 guest splits, **When** I reach the summary of a 4th,
  **Then** a dialog explains the limit and offers Google sign-in.
- *Alternative:* **When** I press "Later", **Then** the dialog closes and **the split still
  completes**.
- *Edge:* the stated number comes from `MAX_GUEST_SPLITS`, not a hardcoded literal, so copy and
  behaviour cannot drift.
- *Edge:* clearing browser storage resets the counter.

**Rules** BR-057 · **Deps** FEAT-005 · **Evidence** [GuestLimitDialog.tsx](../../src/components/auth/GuestLimitDialog.tsx)

---

## Onboarding, marketing & language

### US-008 — Learn what Splitzy does on first visit
**As a** first-time visitor **I want** a short showcase **so that** I understand the payoff before
committing effort.

**AC**
- *Happy:* **Given** I land on `/` and have never seen it, **Then** a 3-step dialog appears —
  summary payoff, AI scan, share — each with a small mock of the real UI.
- *Happy:* **When** I finish, **Then** I am taken to `/single` to start a real split, and
  `onboarding_completed` is captured with the step reached.
- *Alternative:* **When** I skip or press Escape, **Then** `onboarding_skipped` is captured and the
  tour never reappears on this browser.
- *Alternative:* **When** I press Back, **Then** I return to the previous step.
- *Edge:* the tour appears **only** on `/`, never mid-split.
- *Edge:* **Given** `localStorage` is unavailable, **Then** the tour is skipped silently.
- *Accessibility:* focus trap, Escape handling, scroll lock, and an `aria-live` step announcement.

**Rules** — · **Deps** FEAT-010 · **Evidence** [OnboardingModal.tsx](../../src/components/onboarding/OnboardingModal.tsx)

### US-009 — Evaluate Splitzy from the landing page
**As a** visitor arriving from search **I want** to see how it works **so that** I can decide to try
it.

**AC**
- *Happy:* **Then** I see a hero, a preview mock, feature blocks, a how-it-works section, mode
  cards, an FAQ accordion and a final CTA.
- *Alternative:* **Given** I arrived at `/id`, **Then** everything renders in Indonesian and the
  choice is remembered for the tool pages.
- *Edge:* the displayed statistics and testimonials are **placeholder figures**, and no rating
  markup is emitted for them.

**Rules** BR-089, BR-092 · **Deps** FEAT-011, FEAT-016 · **Evidence** [NewLanding.tsx](../../src/components/landing/NewLanding.tsx)

### US-010 — Read the FAQ and About page in my language
**AC**
- *Happy:* **Given** I open `/faq` or `/id/faq`, **Then** the content renders in that language with
  a self-referencing canonical and reciprocal hreflang.
- *Edge:* `/privacy` and `/terms` are **English-only** with no Indonesian counterpart.

**Rules** BR-090, BR-091 · **Deps** FEAT-012, FEAT-013, FEAT-014

### US-011 — Switch language
**As an** Indonesian speaker **I want to** switch language from anywhere **so that** I am not stuck
in English inside a split.

**AC**
- *Happy:* **When** I use the globe switcher, **Then** the preference is stored and the page
  reloads in the other language.
- *Alternative:* **Given** I am on `/` or `/id`, **Then** I am sent to the other landing URL; on a
  tool route I stay on the same path.
- *Alternative:* **Given** I follow a landing CTA, **Then** `?lang=` carries the locale so a tap
  before hydration is not lost.
- *Edge:* visiting `/` only *seeds* a preference — it never overwrites an existing Indonesian
  choice.
- *Edge:* the first paint of a tool page uses the default locale, so an Indonesian visitor sees one
  frame of English. A documented, accepted trade-off.

**Rules** BR-089 · **Deps** FEAT-077 · **Evidence** [use-locale.ts](../../src/lib/i18n/use-locale.ts), [LocaleSync.tsx](../../src/components/i18n/LocaleSync.tsx)

---

## Core splitting

### US-012 — Split a single receipt
**As a** bill payer (P-01) **I want to** split one bill fairly **so that** I get paid back the right
amounts.

**AC**
- *Happy:* **Given** participants and assigned items, **When** I reach the summary, **Then** I see
  each person's total and the minimal transfer set.
- *Happy:* **Then** the current step is in the URL (`?step=bill`), so the browser back gesture
  returns one step rather than leaving the page.
- *Alternative:* **Given** `?resume=<id>`, **Then** the saved split is rehydrated into the editor.
- *Validation:* **Given** I try to advance with no participants, **Then** I cannot proceed.
- *Error:* **Given** a resume fails, **Then** a toast explains it and I am reset to a blank
  `/single`.
- *Edge:* **Given** I have items entered, **When** I try to close the tab, **Then** the browser
  warns me.
- *Edge:* exactly **one** back control exists, and it does what the system gesture does.

**Rules** BR-001 – BR-018, BR-057 · **Deps** FEAT-019 · **API** API-045, API-010, API-008
**Evidence** [SingleSplitView.tsx](../../src/components/pages/SingleSplitView.tsx), [e2e/wizard-navigation.spec.ts](../../e2e/wizard-navigation.spec.ts)

### US-013 — Manage participants
**AC**
- *Happy:* **When** I type a name and press Enter, **Then** the participant is added and previously
  used names autocomplete, ranked by frequency and recency.
- *Alternative:* **When** I remove a participant, **Then** their assignments are stripped from every
  item.
- *Validation:* **Given** a duplicate name, **Then** I am warned.
- *Validation:* names are capped at 100 characters and participants at 100 per split.
- *Edge:* the name history is local-only and never leaves the device.

**Rules** BR-080, BR-081 · **Deps** FEAT-021, FEAT-022

### US-014 — Add items by hand
**AC**
- *Happy:* **When** I add a row with a name, quantity and price, **Then** it joins the item list and
  the summary recomputes immediately.
- *Validation:* ≤ 200 items; each amount ≤ 1 000 000 000; quantity ≤ 1000.
- *Edge:* **Given** my scan quota is exhausted, **Then** manual entry still works and costs nothing
  — and the paywall says so explicitly.

**Rules** BR-080 · **Deps** FEAT-023

### US-015 — Assign an item equally
**AC**
- *Happy:* **Given** an item of Rp 50.000 assigned to two people, **Then** each owes Rp 25.000.
- *Edge:* **Given** Rp 100 across three people, **Then** shares are 33.34 / 33.33 / 33.33 — the
  remainder goes to the **first** assignee so the total reconciles exactly.
- *Edge:* **Given** an item assigned to nobody, **Then** nobody is charged but the amount still
  counts toward the grand total, so the payer absorbs it.

**Rules** BR-002, BR-004, BR-005 · **Deps** FEAT-024

### US-016 — Assign an item by quantity
**AC**
- *Happy:* **Given** 3 skewers at Rp 60.000 with Budi taking 2 and Citra 1, **Then** Budi owes
  Rp 40.000 and Citra Rp 20.000.
- *Edge:* the remainder goes to the person with the **most** units.
- *Edge:* **Given** all quantities are zero, **Then** nobody is charged.

**Rules** BR-001, BR-003 · **Deps** FEAT-025

### US-017 — Apply tax and service charge
**AC**
- *Happy:* **Given** Rp 18.000 of tax and service on a Rp 120.000 subtotal, **Then** each person
  pays in proportion to their own subtotal.
- *Edge:* the remainder goes to the largest subtotal.
- *Edge:* **Given** a receipt with tax but no items, **Then** it is split **equally** instead, so
  the ledger still balances.

**Rules** BR-006, BR-007, BR-008 · **Deps** FEAT-026

### US-018 — Add a delivery or platform fee
**AC**
- *Happy:* **Given** a Rp 12.000 delivery fee set to "equal" across 4 people, **Then** each pays
  Rp 3.000 regardless of what they ordered.
- *Alternative:* **Given** the fee is "proportional", **Then** it follows the tax/service rule.
- *Validation:* ≤ 50 fees; a non-positive amount is ignored entirely.

**Rules** BR-009, BR-010, BR-011 · **Deps** FEAT-027

### US-019 — Apply a discount to the right people
**AC**
- *Happy (receipt scope):* **Given** a Rp 20.000 whole-bill discount, **Then** it is spread across
  everyone in proportion to their base total.
- *Happy (item scope):* **Then** only that item's consumers are credited, in proportion to their
  item share.
- *Happy (participant scope):* **Then** only the voucher's owner is credited.
- *Edge:* **Given** a discount larger than someone's share, **Then** their credit is capped at their
  base share and their total never goes negative.
- *Edge:* **Given** two percentage discounts, **Then** neither compounds — both resolve against the
  pre-discount base.
- *Validation:* a percentage above 100 is rejected; ≤ 100 discounts.

**Rules** BR-012 – BR-016 · **Deps** FEAT-028

### US-020 — Choose who paid
**AC**
- *Happy:* **When** I select the payer, **Then** their balance becomes `amountPaid − their own
  share` and everyone else owes their share to them.
- *Validation:* the payer must be one of the participants — otherwise settlement produces phantom
  credits.
- *Edge:* a payer never owes their own receipt.

**Rules** BR-020, BR-029, BR-082 · **Deps** FEAT-029

### US-021 — See who owes whom, in the fewest transfers
**AC**
- *Happy:* **Then** I see a list like "Budi → Alya Rp 67.383" with the minimum practical number of
  transfers.
- *Alternative:* **Given** two people owe exactly what a third is owed, **Then** exact matches are
  paired first rather than being shattered by the greedy pass.
- *Edge:* balances within ±0.01 are treated as settled and produce no transfer.
- *Edge:* net balances always sum to zero.

**Rules** BR-026, BR-027, BR-028 · **Deps** FEAT-031

### US-022 — Inspect how a share was calculated
**As a** participant who disputes a number **I want** the breakdown **so that** I can check it.

**AC**
- *Happy:* **When** I open a person's detail, **Then** I see each item they consumed, the units they
  took, how many shared it, and their share — plus their tax, service, fee and discount components.

**Rules** BR-017 · **Deps** FEAT-032 · **Evidence** `getPersonShareDetails`

### US-023 — Add my payment details
**As the** payer **I want** my bank or e-wallet shown **so that** people can transfer without asking.

**AC**
- *Happy:* **Given** I enter a bank, account number and account name, **Then** they appear in the
  summary, the copied text and the share link.
- *Alternative:* **When** I clear all three fields, **Then** the object is removed entirely.
- *Validation:* bank ≤ 60, account number ≤ 40, account name ≤ 100.
- *Edge:* these details are carried into share snapshots and are **readable by anyone holding the
  link**.

**Rules** BR-080 · **Deps** FEAT-033 · **Evidence** [payment-info.ts](../../src/lib/receipt/payment-info.ts)

### US-024 — Split several receipts with different payers
**As a** signed-in user (P-01) **I want to** track a night with multiple bills **so that** we settle
once.

**AC**
- *Happy:* **Given** one participant set and several receipts each with its own payer, **Then** I
  see an aggregated summary and one minimal transfer set.
- *Permission:* **Given** I am not signed in, **Then** `/multiple` redirects me to sign in.
- *Alternative:* **Then** I can save the whole group as one document and resume it later.
- *Edge:* `/multiple` is deliberately excluded from the sitemap because crawlers are redirected.

**Rules** BR-019 – BR-034, BR-044 · **Deps** FEAT-020 · **API** API-010, API-012

---

## AI receipt scanning

### US-025 — Scan a receipt
**As a** bill payer standing in a restaurant **I want to** photograph the receipt **so that** I do
not type twenty items.

**AC**
- *Happy:* **When** I take or upload a photo, **Then** items, quantities, prices, tax, service,
  extra fees, discounts and the currency are extracted and loaded into the editor.
- *Alternative:* **Given** a non-IDR currency is detected, **Then** an FX rate is fetched and locked
  onto the receipt.
- *Alternative:* **Given** an item-scope discount whose item name cannot be matched, **Then** it is
  downgraded to receipt scope rather than dropped.
- *Validation:* an image over ~5 MB → `413`; a non-image type → `415`.
- *Error (offline):* **Given** I have no connection, **Then** I am told so **before** any request is
  made — never "your photo is bad".
- *Error (timeout):* **Given** the model takes over 45 s, **Then** I see "Scanning took too long.
  Please try again." rather than a message implying the receipt was unreadable.
- *Error (unreadable):* **Then** I see "couldn't read any items", and **no quota is consumed**.
- *Rate limit:* more than 10 scans in a minute from one IP → `429` with `Retry-After`.
- *Edge:* the image is sent to Google and never stored by Splitzy; no user identity accompanies it.

**Rules** BR-059 – BR-064, BR-085, BR-086 · **Deps** FEAT-035, FEAT-038 · **API** API-045, API-007
**Evidence** [ReceiptInput.tsx](../../src/components/receipt/ReceiptInput.tsx), [api/parse-receipt](../../src/app/api/parse-receipt/route.ts)

### US-026 — Understand my scan limit
**AC**
- *Happy:* **Given** I am signed in and have used 15 scans this month, **When** I scan again,
  **Then** I see a panel explaining the limit.
- *Happy:* **Then** the panel tells me I can still add items by hand at no cost.
- *Alternative:* **Given** the pricing page is live, **Then** it offers an upgrade CTA; otherwise it
  reassures me that scans reset next month.
- *Edge:* **Given** I have active Pro, **Then** there is no limit.
- *Edge:* **Given** I am a guest, **Then** no monthly quota applies at all.

**Rules** BR-059 – BR-063 · **Deps** FEAT-036, FEAT-037 · **Evidence** [ScanQuotaPaywall.tsx](../../src/components/billing/ScanQuotaPaywall.tsx)

### US-027 — See my remaining scans
**AC**
- *Happy:* **Given** I open the dashboard, **Then** I see "N of 15 left" with a progress bar.
- *Alternative:* **Given** I am Pro, **Then** I see a Pro badge and "Unlimited AI receipt scans".
- *Permission:* **Given** I am signed out, **Then** `/api/me/quota` returns `401`.

**Rules** BR-060, BR-062 · **Deps** FEAT-070 · **API** API-004

---

## Travel Spend

### US-028 — Create a trip
**AC**
- *Happy:* **Given** I am signed in, **When** I create a trip, **Then** it is stored in the cloud
  with `version = 1` and I am its owner.
- *Alternative:* **Given** I am a guest, **Then** the trip lives only in `localStorage`.
- *Validation:* name ≤ 200 characters, defaulting to "My Trip"; budget ≤ 1 trillion.

- *Alternative:* **Given** I had local guest trips and then sign in, **Then** a dialog offers to push
  them to the cloud, and the whole trip — participants and receipts — is sent in one request.

**Rules** BR-049, BR-080 · **Deps** FEAT-039, FEAT-050 · **API** API-026

### US-029 — Add a receipt to a trip, even offline
**As a** trip organiser abroad **I want** my entry to stick **so that** flaky Wi-Fi never loses a
receipt.

**AC**
- *Happy:* **When** I save a receipt, **Then** it appears immediately and is queued for sync; the UI
  reports it as saved.
- *Alternative:* **Given** I am offline, **Then** the op waits in a durable outbox that survives a
  reload and drains on reconnect.
- *Alternative:* **Given** I edit then delete the same unsynced receipt, **Then** the two ops cancel
  out and nothing is sent.
- *Error (transient):* **Given** the server returns 5xx or 429, **Then** the op stays queued and is
  retried.
- *Error (permanent):* **Given** the server returns a 4xx, **Then** the op is discarded, I am told
  "A change couldn't be saved and was discarded", and authoritative state is re-pulled.
- *Permission:* **Given** I am a member rather than the owner, **Then** the write becomes a pending
  proposal instead.
- *Edge:* **Given** local storage is full, **Then** I am warned — the mirror **is** the data between
  loads.

**Rules** BR-049, BR-081, BR-087 · **Deps** FEAT-040, FEAT-049 · **API** API-031
**Evidence** [travel-outbox.ts](../../src/lib/travel/travel-outbox.ts)

### US-030 — Track the trip against a budget
**AC**
- *Happy:* **Given** a trip budget, **Then** I see spent versus target.
- *Edge:* spend counts every receipt, including settled ones — this is total spend, not outstanding
  debt.

**Rules** — · **Deps** FEAT-041

### US-031 — Track my own spending target
**AC**
- *Happy:* **Given** I set a personal budget, **Then** I see a progress bar and an over/under label.
- *Edge:* each traveller's budget is independent of the trip-wide one.
- *Edge:* with no participants, the card explains that travellers must be added first.

**Rules** — · **Deps** FEAT-042

### US-032 — Record a receipt in a foreign currency
**AC**
- *Happy:* **Given** I select THB, **Then** a rate is fetched and locked onto the receipt, and the
  IDR equivalent is shown.
- *Alternative:* **Given** the FX service is unavailable, **Then** I am asked to enter the rate
  manually.
- *Edge:* **Given** no usable rate is locked, **Then** the receipt flows into IDR totals at 1:1 and
  must be surfaced as needing a rate.
- *Edge:* a later market move never changes an already-recorded receipt.

**Rules** BR-035 – BR-039 · **Deps** FEAT-038, FEAT-043 · **API** API-007

### US-033 — Record a settle-up payment
**AC**
- *Happy:* **When** I record "Budi paid Alya Rp 200.000", **Then** the balances reduce accordingly
  and the transfer list shrinks.
- *Alternative:* partial payments are accepted — any positive amount reduces the debt.
- *Alternative:* a foreign payment stores the native amount plus a rate and displays
  `฿1.000 ≈ Rp 480.000`.
- *Validation:* `from` and `to` must be distinct participants of this trip; amount > 0 and ≤ 1e9.
- *Permission:* a member gets `403 REVIEW_REQUIRED`.
- *Edge:* if a participant is later removed, their payments stop being applied and vanish from the
  balance sheet.
- *Gap:* payments have **no idempotency key**, so a double-tap across devices can create two rows.

**Rules** BR-023 – BR-025, BR-030 · **Deps** FEAT-044 · **API** API-034

### US-034 — Mark my share of one receipt as paid
**AC**
- *Happy:* **When** I tick a participant on a receipt, **Then** a ledger payment is created for
  **only the remaining debt** (`owed − already paid`).
- *Alternative:* **When** I untick it, **Then** the payment is deleted and the debt returns.
- *Alternative:* a whole-receipt toggle marks every owing non-payer at once.
- *Edge:* **Given** the pair debt is already covered by a manual settle-up, **Then** the checkbox
  shows as covered and ticking it writes nothing, with a toast saying so.
- *Edge:* the amount is converted to IDR first, so a foreign receipt is not over- or under-settled.

**Rules** BR-030, BR-031, BR-032 · **Deps** FEAT-045

### US-035 — Invite someone to a trip
**AC**
- *Happy:* **Given** I am the owner, **When** I create an invite, **Then** I get a link valid for
  7 days that I can copy or revoke.
- *Permission:* a member gets `403 "Only the trip owner can create invites"`.
- *Edge:* expired invites are hard-deleted by the cleanup job.

**Rules** BR-052, BR-053 · **Deps** FEAT-047 · **API** API-036 – API-038

### US-036 — Join a trip from an invite
**AC**
- *Happy:* **When** I open the link, **Then** I see the trip name and who invited me, without
  signing in.
- *Happy:* **When** I sign in and join, **Then** I become a member and land directly on **that
  trip**, not a trip list.
- *Alternative:* joining twice is a no-op; the owner sees "already a member".
- *Error:* an expired, revoked or deleted-trip token shows "This invite link is invalid or has
  expired."
- *Edge:* the inviter's **email** is disclosed when their display name is null.

**Rules** BR-052 · **Deps** FEAT-047 · **API** API-043, API-044

### US-037 — Propose a change as a trip member
**As a** member (P-03) **I want to** contribute a receipt **so that** the organiser does not have to
enter it for me.

**AC**
- *Happy:* **When** I add a receipt, **Then** it is buffered locally and shown to me overlaid on the
  trip.
- *Happy:* **When** I submit, **Then** a change request is created with my ops and an optional note,
  and the owner is notified.
- *Validation:* ops are validated in order against a working participant set — so I can add a
  participant and reference them later in the same batch. Maximum 200 ops; note ≤ 500 characters.
- *Permission:* I can see **only my own** change requests.
- *Alternative:* **Given** the owner declines, **Then** I see their reason and can revise.

**Rules** BR-049, BR-051, BR-081 · **Deps** FEAT-048 · **API** API-040

### US-038 — Review a change request as trip owner
**AC**
- *Happy:* **Then** I see a human-readable diff of the proposed operations with amounts.
- *Happy:* **When** I approve, **Then** every op is applied atomically, the trip version increments,
  and all members are notified.
- *Alternative:* **When** I decline with a note, **Then** the author sees the reason.
- *Error:* **Given** the trip has moved on and an op no longer fits, **Then** approval fails with
  "Can't apply — the trip changed and this request no longer fits… Ask the member to resubmit", and
  **nothing is written**.
- *Edge:* **Given** two reviewers act at once, **Then** the second gets "This change request was
  already reviewed."
- *Edge:* approval is last-write-wins — `baseVersion` is recorded but not enforced.

**Rules** BR-049, BR-081, BR-087 · **Deps** FEAT-048 · **API** API-041, API-042

### US-039 — Delete and restore a trip
**AC**
- *Happy:* **Given** I am the owner, **When** I delete a trip, **Then** it disappears from my list
  and can be restored.
- *Permission:* a member gets `403 "Only the trip owner can restore it"`.
- *Edge:* restoring is idempotent.
- *Edge:* the travel delete performs **no cascade** — receipts, payments and invites remain in the
  database, unreachable, until the 30-day hard delete.

**Rules** BR-074, BR-075 · **Deps** FEAT-052 · **API** API-029, API-030

---

## Persistence & sharing

### US-040 — Save a split and resume it later
**AC**
- *Happy:* **When** I press Save, **Then** the whole split is stored server-side and I am told I can
  pick it up for 7 days, with a "View" action to `/history`.
- *Alternative:* **When** I press Save again, **Then** the same row is updated, not duplicated.
- *Alternative:* **Given** `?resume=<id>`, **Then** the editor rehydrates the split.
- *Validation:* a draft with an unchosen payer or half-typed item names still saves — every other
  bound holds.
- *Error (conflict):* **Given** the split was saved from another device, **Then** I see "Saved
  somewhere else" and am told to reload rather than silently overwriting.
- *Permission:* only the creator may update; the payer and assignees cannot.
- *Edge:* the 7-day clock resets on **save**, not on open.

**Rules** BR-046, BR-072, BR-083, BR-087 · **Deps** FEAT-054 · **API** API-010, API-011, API-012

### US-041 — Find a past split
**AC**
- *Happy:* **Then** I see my saved splits newest-first with title, date, total, participant count
  and days remaining.
- *Alternative:* **When** I type in the search box, **Then** results filter by receipt or trip name
  after a 300 ms debounce.
- *Alternative:* **When** I press "Continue", **Then** the correct editor opens with the split
  loaded.
- *Empty:* **Given** no results, **Then** I see "No receipts match your search" or "No receipts
  yet".
- *Permission:* **Given** I am signed out, **Then** an in-page sign-in gate appears.

**Rules** BR-047 · **Deps** FEAT-055 · **API** API-009

### US-042 — View a saved split in detail
**AC**
- *Happy:* **Then** I see the full read-only summary with each person's share.
- *Edge:* the view reads the authoritative payload, not the flat columns — reading the flat
  projection silently dropped fees and discounts and produced a Grand Total that disagreed with the
  editor for the same split.
- *Error:* a missing or soft-deleted split returns `404`.
- *Permission:* someone not involved gets `403`.

**Rules** BR-046, BR-047 · **Deps** FEAT-056 · **API** API-011

### US-043 — Share a read-only link
**AC**
- *Happy:* **When** I create a share link, **Then** I get a short URL that anyone can open with no
  account, valid 14 days.
- *Alternative:* **Given** I later re-save the split, **Then** **the same link updates** rather than
  a second one being minted, and the page shows when the numbers last changed.
- *Alternative:* guests can create links too.
- *Validation:* a split too large to serialise (> 256 KB) is refused with a clear message.
- *Error:* an expired link renders a distinct "expired" state, not a generic 404.
- *Rate limit:* 30 link creations per minute.
- *Edge:* the snapshot includes participants' bank details.

**Rules** BR-058, BR-073, BR-079 · **Deps** FEAT-059 · **API** API-008

### US-044 — Send the summary to WhatsApp
**AC**
- *Happy:* **When** I tap the WhatsApp button, **Then** WhatsApp opens with a formatted summary —
  per-person amounts, the transfer list and payment details.
- *Alternative:* **When** I tap Copy, **Then** the same text goes to the clipboard.
- *Alternative:* **Given** the browser supports it, **Then** the native share sheet is used, falling
  back to the clipboard if cancelled.

**Rules** — · **Deps** FEAT-061, FEAT-062

### US-045 — Open a shared split as a non-user
**As a** share-link recipient (P-05) **I want to** see what I owe **so that** I can transfer the
right amount.

**AC**
- *Happy:* **Then** the page renders server-side, read-only, with each person's share and the
  payer's account details — no account, no install.
- *Error:* an expired link says so distinctly; an unknown code shows "not found".
- *Edge:* the page states when the numbers last changed.
- *Gap:* the page is **English-only**, and is `noindex` + robots-disallowed.

**Rules** BR-073, BR-093 · **Deps** FEAT-059

### US-046 — Delete a saved split — **UNMET**
**As a** user **I want to** delete a saved split **so that** a mistaken or private split is not left
sitting on the server for a week.

**AC (specified, not met)**
- *Happy:* **When** I delete a split from history, **Then** it disappears from my list and is
  soft-deleted.
- *Permission:* only the creator may delete.
- *Alternative:* an undo affordance restores it.

**Status** **Missing UI.** `DELETE /api/receipts/[id]`, `POST …/restore` and
`supabaseDataService.deleteReceipt()` are all implemented and creator-gated, but **nothing calls
them**. `ReceiptHistoryCard` offers only "Continue". A user must wait 7 days for the TTL.
**Rules** BR-046, BR-072, BR-074 · **Deps** FEAT-057, FEAT-058 · **API** API-013, API-014

### US-047 — Export a split — **UNMET**
**As a** user expensing a dinner **I want to** download a CSV **so that** I can attach it to a
reimbursement claim.

**AC (specified, not met)**
- *Happy:* **When** I export, **Then** a CSV downloads containing the items table, the per-person
  breakdown and bill totals, opening correctly in Excel and Sheets.

**Status** **Missing UI.** [csv-export.ts](../../src/lib/receipt/csv-export.ts) implements all of
this — RFC-4180 quoting, a UTF-8 BOM, a slugged dated filename — and has its own unit-test file, but
**no component imports it**.
**Deps** FEAT-063

---

## Money & growth

### US-048 — Upgrade to Pro
**AC**
- *Happy:* **Given** checkout is live, **When** I press Upgrade, **Then** a pending payment is
  recorded and I am redirected to a hosted Xendit invoice.
- *Happy:* **When** payment completes, **Then** the webhook grants me 30 days of Pro and
  `/pricing?status=success` shows a celebration.
- *Alternative:* **Given** I am already Pro, **Then** a second purchase is refused; buying near
  expiry stacks the remaining time.
- *Permission:* **Given** I am signed out, **Then** I am sent through Google sign-in and back to
  `/pricing`.
- *Error:* **Given** the flag is off, **Then** the endpoint returns `404` and the button reads
  "Coming soon".
- *Error:* **Given** Xendit fails, **Then** the payment row is marked failed and I see "Could not
  start checkout."
- *Edge:* a duplicate webhook delivery grants Pro only once.
- *Edge:* the advertised "Priority AI processing" has **no implementation**.

**Rules** BR-065 – BR-070 · **Deps** FEAT-064, FEAT-065, FEAT-066 · **API** API-046, API-047

### US-049 — See my Pro status
**AC**
- *Happy:* **Then** the dashboard shows a Pro badge and unlimited scans.
- *Edge:* an expired Pro period is treated as free at read time, and a nightly job tidies the `plan`
  column.
- *Edge:* an admin-comped Pro with a null expiry never lapses.

**Rules** BR-066, BR-067 · **Deps** FEAT-064, FEAT-067 · **API** API-004, API-048

### US-050 — Refer a friend
**AC**
- *Happy:* **Then** the dashboard shows my referral link, total referrals and days earned, with a
  copy button.
- *Happy:* **Given** a friend signs up through it, **Then** I receive 14 days of Pro.
- *Edge:* my code is minted lazily on first view, from an unambiguous alphabet (no I/O/1/0).
- *Edge:* self-referral is rejected; each person can be referred only once.
- *Edge:* attribution lasts 30 days and applies only on a **first** sign-in.

**Rules** BR-071 · **Deps** FEAT-068 · **API** API-005

---

## Administration

### US-051 — Find and inspect a user
**AC**
- *Happy:* **Then** I see a paginated user list with plan, scan usage, ban state, admin state and
  trip count.
- *Alternative:* search by name or email, and filter by `all | free | pro | banned`.
- *Alternative:* the headline counters stay **global**, ignoring the current filter, so they remain
  honest.
- *Permission:* a non-admin — signed in or not — receives `403`.

**Rules** BR-054 · **Deps** FEAT-071 · **API** API-049, API-051

### US-052 — Adjust a user's plan or quota
**AC**
- *Happy:* **When** I change a plan, reset a quota, or set a custom scan limit, **Then** it takes
  effect immediately and the row updates in place.
- *Validation:* a custom limit must be an integer 0–10 000 or null.
- *Validation:* an empty patch returns "Nothing to update".
- *Edge:* the change and its audit entry are written **in one transaction** — an action that cannot
  be recorded is never applied.

**Rules** BR-055, BR-060 · **Deps** FEAT-071, FEAT-072 · **API** API-050

### US-053 — Ban and unban a user
**AC**
- *Happy:* **When** I ban an account, **Then** every protected endpoint returns `401` for them.
- *Permission:* I cannot ban my own account.
- *Edge:* existing session cookies are **not** revoked — enforcement is read-time only.

**Rules** BR-043, BR-055 · **Deps** FEAT-006, FEAT-071

### US-054 — Grant or revoke admin access
**AC**
- *Happy:* **When** I grant admin, **Then** that user can reach `/admin` and a `role.grant` audit
  entry is written.
- *Permission:* I cannot revoke my own admin role.
- *Validation:* a bootstrap admin's role cannot be revoked at all.
- *Edge:* the bootstrap allowlist exists so an operator can always recover access via an env var.

**Rules** BR-054, BR-055, BR-056 · **Deps** FEAT-071

### US-055 — See who was active today
**AC**
- *Happy:* **Then** I see active users, logins and per-feature usage for the selected day, plus a
  capped event feed.
- *Edge:* the summary counters are computed database-side and are **never truncated**, even when the
  feed is.
- *Edge:* "today" follows **my** local clock, not the server's.
- *Validation:* an inverted range returns "`from` must be before `to`".

**Rules** BR-077, BR-084 · **Deps** FEAT-073 · **API** API-052

### US-056 — Audit what admins changed
**AC**
- *Happy:* **Then** I see the 50 most recent privileged actions with actor, action, target and a
  before/after summary.
- *Edge:* the trail survives account deletion and is **never swept**.

**Rules** BR-078 · **Deps** FEAT-072 · **API** API-053

---

## Platform

### US-057 — Install Splitzy as an app
**AC**
- *Happy:* **Given** Chrome judges the site installable, **Then** its own install affordance appears
  and installing produces a standalone app with the correct icon and splash.
- *Alternative:* on iOS I add it from the Share sheet and it launches full-screen as "Splitzy".
- *Edge:* Splitzy deliberately does **not** call `preventDefault()` on `beforeinstallprompt`, so the
  browser's native UI is left intact; there is **no in-app install button**.
- *Edge:* three telemetry events exist as a health check, after a manifest defect once broke Android
  installs silently.

**Rules** — · **Deps** FEAT-075 · **Evidence** [pwa.md](../architecture/pwa.md)

### US-058 — Keep working offline
**AC**
- *Happy:* **Given** the app is loaded, **When** I lose connectivity, **Then** `/single` and
  `/multiple` continue to work entirely from local state.
- *Happy:* **Then** Travel receipt writes queue durably and sync on reconnect.
- *Alternative:* a cached navigation falls back to the cached shell.
- *Error:* a scan attempted offline is refused **before** the request with a specific message.
- *Error:* saving a Single/Multiple split offline simply fails — there is no outbox for that path.
- *Edge:* there is no dedicated offline page; navigation falls back to the cached `/`.

**Rules** — · **Deps** FEAT-049, FEAT-075

### US-059 — Use dark mode
**AC**
- *Happy:* **When** I toggle the theme, **Then** the whole app switches and the choice persists.
- *Edge:* the default is light, and the theme class is applied before hydration.

**Rules** — · **Deps** FEAT-076

### US-060 — Recover from an error
**AC**
- *Happy:* **Given** a section throws, **Then** only that panel shows an error with a "Try again"
  button — the rest of the page keeps working.
- *Alternative:* **Given** a whole route throws, **Then** a friendly 500 page offers Try Again and
  Back to Home.
- *Alternative:* an unknown URL shows a 404 page with Return Home and Go Back.
- *Edge:* the raw error message is shown only outside production.
- *Gap:* no caught error is reported to Sentry — `ErrorBoundary.onError` exists and is never
  supplied, so section failures are invisible in production.

**Rules** — · **Deps** FEAT-078, FEAT-079

---

## Coverage summary

| Metric | Value |
|---|---|
| Stories | 60 |
| Fully met by the implementation | 57 |
| **Unmet — specified here, no UI exists** | US-046 (delete a saved split), US-047 (CSV export) |
| **Met but flagged off in production** | US-048 (upgrade to Pro) |
| Stories describing an accepted trade-off rather than a gap | US-011 (locale flash), US-033 (no payment idempotency), US-053 (no session revocation on ban) |
