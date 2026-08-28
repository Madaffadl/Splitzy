# Splitzy — Business Rules

> **94 rules**, every one traced to the code that enforces it. No rule here was invented; where a
> rule is an interpretation rather than a literal implementation, it is labelled.
>
> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**
> `FEAT-xxx` → [../product/feature-catalog.md](../product/feature-catalog.md)

| Range | Category |
|---|---|
| BR-001 – BR-018 | Splitting & allocation |
| BR-019 – BR-034 | Balances & settlement |
| BR-035 – BR-039 | Currency |
| BR-040 – BR-056 | Access & permissions |
| BR-057 – BR-064 | Guest access & AI quota |
| BR-065 – BR-071 | Billing & growth |
| BR-072 – BR-079 | Lifecycle & retention |
| BR-080 – BR-088 | Validation & integrity |
| BR-089 – BR-094 | i18n & SEO |

---

## Splitting & allocation

**BR-001 — Item share is quantity-weighted when per-person quantities exist**
Description: when an item carries `assignments[{participantId, qty}]`, each person's share is
`(qty / totalAssignedQty) × item.total`. Zero-qty assignments are excluded; a total of 0 yields no
shares.
Source: `src/lib/receipt/calculations.ts` → `calculateItemShares`
Affected: FEAT-025, FEAT-030 · Edge: all quantities zero → nobody is charged · **[IMPLEMENTED]**

**BR-002 — Item share falls back to an equal split**
Description: with no `assignments`, `item.total` is divided evenly across `assignedToIds`. An empty
list produces no shares.
Source: same · Affected: FEAT-024 · **[IMPLEMENTED]**

**BR-003 — Quantity-weighted remainder goes to the person with the most units**
Source: same · Edge: on a tie, `reduce` keeps the first encountered · **[IMPLEMENTED]**

**BR-004 — Equal-split remainder goes to the first assignee**
Description: exists because `100 / 3 = 33.33 × 3 = 99.99` would otherwise leave the payer
under-fronted by a cent.
Source: same · Edge: "first" is array order, i.e. participant creation order — stable but arbitrary
to the user · **[IMPLEMENTED]**

**BR-005 — An unassigned item still counts toward the receipt subtotal**
Description: nobody is charged for it, but it inflates `receiptSubtotal` and therefore the grand
total, so the payer absorbs the cost.
Source: `calculateReceiptSubtotal` sums all items; `calculateItemShares` returns an empty map
Affected: FEAT-023, FEAT-030 · **[IMPLEMENTED]** — a silent outcome with no UI warning

**BR-006 — Tax and service are allocated proportionally to each person's subtotal**
Source: `allocateTaxService` · Affected: FEAT-026 · **[IMPLEMENTED]**

**BR-007 — Tax/service remainder goes to the largest subtotal**
Source: same · **[IMPLEMENTED]**

**BR-008 — With a zero subtotal, tax and service split equally**
Description: proportional allocation is undefined at zero, so the amounts are divided by participant
count with the remainder to the first, *"otherwise the payer would be left with phantom credit and
the ledger would not balance."* Zero participants → no allocation.
Source: same · **[IMPLEMENTED]**

**BR-009 — An "equal" fee is divided across **all** participants**
Description: regardless of what anyone ordered — the correct semantics for delivery, platform,
packaging and surcharge fees. Remainder to the first participant.
Source: `allocateFees` · Affected: FEAT-027 · Edge: a participant who ordered nothing still pays
their slice · **[IMPLEMENTED]**

**BR-010 — A "proportional" fee mirrors tax/service allocation**
Source: same · Edge: falls back to an equal split when `receiptSubtotal === 0` · **[IMPLEMENTED]**

**BR-011 — Fees with a non-positive amount are skipped entirely**
Source: same (`if (!fee.amount || fee.amount <= 0) continue`) · **[IMPLEMENTED]**

**BR-012 — A receipt-scope discount is distributed proportionally to base totals**
Description: percentages resolve against `grandTotal`; the resulting amount is spread across
everyone in proportion to their base share. Skipped when `totalBase <= 0`.
Source: `calculateDiscountCredits` · Affected: FEAT-028 · **[IMPLEMENTED]**

**BR-013 — An item-scope discount goes to that item's consumers**
Description: distributed in proportion to each consumer's share of the item. Skipped if the item is
missing or `item.total <= 0`.
Source: same · **[IMPLEMENTED]**

**BR-014 — A participant-scope discount credits only its owner**
Description: a personal voucher. Skipped when `targetId` is missing or is not a tracked participant.
Source: same · **[IMPLEMENTED]**

**BR-015 — Percentages resolve against a pre-discount base**
Description: so multiple discounts never compound.
Source: same · Affected: FEAT-028 · **[IMPLEMENTED]**

**BR-016 — A person's total discount credit is capped at their base share**
Description: `min(credit, base)` — *"a voucher never pays cash back or turns a share negative."*
Source: same · Edge: excess value is silently discarded, with no user-facing notice ·
**[IMPLEMENTED]**

**BR-017 — Per-person total formula**
`total = subtotal + taxAllocation + serviceAllocation + feesAllocation − discount`
Source: `calculatePersonTotals` · Affected: FEAT-030 · **[IMPLEMENTED]**

**BR-018 — Every monetary step is rounded to two decimals**
Description: `roundTo2` is applied after each operation, and every allocation names an explicit
remainder recipient so shares reconcile exactly.
Source: `src/lib/utils.ts`, used throughout `calculations.ts`
Edge: amounts are IEEE-754 `Float`, not `Decimal` · **[IMPLEMENTED]**

---

## Balances & settlement

**BR-019 — `amountPaid` is the post-discount cash actually handed over**
`amountPaid = grandTotal − totalDiscount` = the sum of everyone's effective share.
Source: `getReceiptSummary` · **[IMPLEMENTED]**

**BR-020 — The payer's balance is `amountPaid − their own share`**
Source: `calculateReceiptBalances` · Affected: FEAT-029, FEAT-031 · **[IMPLEMENTED]**

**BR-021 — A non-payer's balance is the negative of their share**
Source: same · **[IMPLEMENTED]**

**BR-022 — Per-receipt balances are gross**
Description: settle-ups are never applied at receipt level, *"so there is a single source of truth
and no way to double-count a payment."*
Source: same · **[IMPLEMENTED]**

**BR-023 — The payment ledger is applied exactly once, at trip level**
Source: `computeTripTotals` → `applyPaymentsToBalances` · Affected: FEAT-044 · **[IMPLEMENTED]**

**BR-024 — A payment is applied only when both endpoints are tracked participants**
Description: otherwise it would be half-applied, *"silently breaking conservation so the net
balances no longer sum to zero."*
Source: `applyPaymentsToBalances` · Edge: a removed participant's payments vanish from the balance
sheet with no warning · **[IMPLEMENTED]**

**BR-025 — Self-payments and non-positive payments are ignored**
Source: same (`p.from === p.to`, `!(idrAmount > 0)`) · **[IMPLEMENTED]**

**BR-026 — A balance within ±0.01 is treated as settled**
Source: `minimizeTransactions`, `SETTLE_EPS` in `settle-up.ts` · **[IMPLEMENTED]**

**BR-027 — Exact-matching debts are paired before any greedy netting**
Description: prevents a clean 1-to-1 debt being shattered into two transfers by the greedy pass.
Source: `minimizeTransactions` phase 1 · Affected: FEAT-031 · **[IMPLEMENTED]**

**BR-028 — Remaining balances are netted largest-debtor to largest-creditor**
Source: phase 2 · **[INFERRED]** a heuristic — not provably minimal (optimal debt simplification is
NP-hard) — but optimal or near-optimal at realistic group sizes

**BR-029 — A payer never owes their own receipt**
Source: `shareOwedOnReceipt` returns 0 when `from === receipt.payerId` · **[IMPLEMENTED]**

**BR-030 — The same debt cannot be settled twice**
Description: `pairSettlement` computes `owed` across every receipt this payer fronted and `paid`
across **all** ledger entries `from → to`, manual and share-marker alike. *"This single check is
what stops the same debt being settled twice."*
Source: `src/lib/travel/settle-up.ts` · Affected: FEAT-044, FEAT-045 · **[IMPLEMENTED]**

**BR-031 — Marking a share paid records only the remaining debt**
Description: `remaining = owed − alreadyPaid`; the payment is `min(share, remaining)`. Recording the
full share on top of a partial manual payment *"would over-settle and flip the payer negative."*
Zero or negative remaining → a toast, and nothing is written.
Source: `TravelSpendView.togglePaidShare` · Affected: FEAT-045 · **[IMPLEMENTED]**

**BR-032 — A share renders as covered if the whole pair debt is settled by any means**
Description: reconciles the receipt checkboxes with the ledger so a manual settle-up is reflected on
every surface.
Source: `coveredShareParticipants` · **[IMPLEMENTED]**

**BR-033 — In Single and Multiple, "mark as paid" is cosmetic and local only**
Description: stored in `localStorage["splitzy-paid:<scope>"]`, never synced, and it does **not**
change the maths. Self-described as *"a UX affordance… does not need to be authoritative."*
Source: `src/hooks/usePaidSettlements.ts` · Affected: FEAT-019, FEAT-020 · **[IMPLEMENTED]**

**BR-034 — A local paid-marker is invalidated when the amount changes**
Description: `settlementKey = from>to:round(amount×100)`, so editing the split makes the transfer
reappear unticked.
Source: same · **[INFERRED]** arguably correct — the debt is no longer the same debt

---

## Currency

**BR-035 — IDR is the base and settlement currency**
Source: `TRAVEL_CURRENCIES[0]`, `paymentInBaseCurrency`, `PRO_PLAN.currency` · **[IMPLEMENTED]**

**BR-036 — The FX rate is locked onto the receipt at creation**
Description: so a later market move can never retroactively change a settled split.
Source: `Receipt.fxRate`, set once from `/api/fx-rate` · Affected: FEAT-038, FEAT-043 ·
**[IMPLEMENTED]**

**BR-037 — Every cross-receipt aggregation must convert first**
Description: `receiptInBaseCurrency` is the single conversion point. *"ANY aggregation across
multiple receipts MUST run each receipt through this first."*
Source: `calculations.ts` · **[IMPLEMENTED]**

**BR-038 — Only amount-type discounts scale with FX**
Description: percentages are rate-invariant.
Source: `receiptInBaseCurrency` · **[IMPLEMENTED]**

**BR-039 — A foreign receipt with no usable rate passes through unconverted, and must be flagged**
Description: `needsFxRate` is true when the rate is missing, zero, negative or non-finite. Such a
receipt enters IDR totals at 1:1 — *"a ฿1.000 dinner lands in the trip total as Rp 1.000"* — so any
surface showing a converted total has to check and say so.
Source: `needsFxRate` · Edge: correctness depends on every display surface remembering to check ·
**[IMPLEMENTED]**

---

## Access & permissions

**BR-040 — Google OAuth is the only authentication method**
Description: no email/password, no magic link, no other provider, therefore no password reset.
Source: `src/hooks/useAuth.ts` · Affected: FEAT-001, FEAT-007, FEAT-008 · **[IMPLEMENTED]**

**BR-041 — The first successful sign-in creates the account**
Description: registration is not a separate flow. A pre-`upsert` `findUnique(googleId)` detects a
brand-new account and gates the two first-run effects.
Source: `api/auth/callback` · **[IMPLEMENTED]**

**BR-042 — A profile-write failure must not block login**
Description: the Supabase session is already valid, so the upsert error is logged only.
Source: same · Edge: leaves a session with no `User` row, and every protected API call then 401s
until a later sign-in repairs it · **[IMPLEMENTED]**

**BR-043 — A banned account is treated as unauthenticated**
Description: `getAuthUser` returns `null` when `bannedAt != null`.
Source: `src/lib/api-auth.ts` · Edge: existing cookies are **not** revoked (read-time enforcement
only), and `/api/auth/me` does not apply the guard · **[IMPLEMENTED]**

**BR-044 — `/multiple` and `/history` require authentication**
Source: `protectedPaths` in `src/proxy.ts` (prefix match, so `/history/<id>` is covered) ·
**[IMPLEMENTED]**

**BR-045 — A transient auth error must not redirect a signed-in user**
Description: only a genuine 401 triggers the bounce; any other `getUser()` error lets the request
through.
Source: same · **[IMPLEMENTED]**

**BR-046 — Only the creator may write a saved split**
Description: `createdById` is the sole column granting update, delete or restore. Payer and
assignees cannot write.
Source: `api/receipts/[id]` · Affected: FEAT-054, FEAT-057 · **[IMPLEMENTED]**

**BR-047 — A saved split is readable by anyone involved**
Description: creator ∨ payer ∨ item assignee ∨ member of the receipt's trip.
Source: `baseWhere` in `api/receipts`, and the auth-first select in `api/receipts/[id]` ·
**[IMPLEMENTED]**

**BR-048 — Legacy trip mutations are owner-only; receipts are member-writable**
Source: `api/trips/*` · **[IMPLEMENTED]** — though no shipped UI calls this family

**BR-049 — Travel trips are owner-write; members must go through review**
Description: `requireOwnerWrite` returns `403 REVIEW_REQUIRED`. Members' edits become
`TripChangeRequest` batches applied only on owner approval.
Source: `src/lib/travel/trip-access.ts` · Affected: FEAT-048 · **[IMPLEMENTED]**

**BR-050 — Trip existence is never disclosed to a non-member**
Description: `getTripAccess` returns `null` for both "does not exist" and "no access", and every
caller answers **404**.
Source: same · **[IMPLEMENTED]**

**BR-051 — An owner sees all change requests; a member sees only their own**
Source: `api/travel/[id]/change-requests` conditionally adds `authorId: user.id` ·
**[IMPLEMENTED]**

**BR-052 — An invite token is the credential**
Description: `GET /api/invite/[token]` is public and unauthenticated — *"the token IS the secret."*
Source: `api/invite/[token]` · Edge: `invitedBy` falls back to the inviter's **email**, so a leaked
link discloses an address · **[IMPLEMENTED]**

**BR-053 — Invites expire after 7 days and are revocable**
Description: 128-bit `base64url` token; expired rows are hard-deleted by the cleanup job the moment
they lapse.
Source: `INVITE_TTL_MS`, `api/admin/cleanup` · **[IMPLEMENTED]**

**BR-054 — Admin = DB role OR bootstrap email**
Description: `ADMIN_BOOTSTRAP_EMAILS` is always admin regardless of the column — a deliberate
lockout-recovery guard. No email is hardcoded in source.
Source: `src/lib/admin/admin-auth.ts` · **[IMPLEMENTED]**

**BR-055 — An admin cannot lock themselves out**
Description: may change their own plan and quota, but cannot ban themselves (`403`) or revoke their
own admin role (`403`).
Source: `api/admin/users/[id]` · **[IMPLEMENTED]**

**BR-056 — A bootstrap admin's role cannot be revoked**
Description: `400 "Cannot revoke a bootstrap admin"` — writing `role = "user"` would be a no-op that
misrepresents the audit trail.
Source: same · **[IMPLEMENTED]**

---

## Guest access & AI quota

**BR-057 — Guests get 3 free splits, then a dismissible prompt**
Description: `MAX_GUEST_SPLITS = 3`, counted in `localStorage` at the point of reaching the summary.
The dialog offers sign-in and a "Later" button; **the split still completes either way**.
Source: `useGuestLimit`, `GuestLimitDialog` · Affected: FEAT-005 · Edge: clearing storage resets the
counter · **[IMPLEMENTED]**

**BR-058 — Guests may create share links**
Description: `createdById` stays null, because trip mode works without an account.
Source: `api/share` · **[IMPLEMENTED]**

**BR-059 — The AI scan quota is enforced only for authenticated users**
Description: guests are bounded solely by the 10/min IP rate limit.
Source: `api/parse-receipt` (`if (authUser) { … checkScanQuota … }`) · **[IMPLEMENTED]** — an
uncapped cost exposure

**BR-060 — The free scan limit is 15 per month, overridable per user**
Description: `effectiveLimit = user.aiScanLimit ?? FREE_SCAN_LIMIT`. An admin may set 0–10 000 or
`null`.
Source: `src/lib/scan-quota.ts`, `api/admin/users/[id]` · **[IMPLEMENTED]**

**BR-061 — The quota window resets at 00:00 UTC on the 1st of the month**
Description: `aiScanResetAt` is set lazily on the first scan of a window; a lapsed window is reset
during the check.
Source: `checkScanQuota`, `incrementScanCount` · **[IMPLEMENTED]**

**BR-062 — Active Pro means unlimited scans**
Source: `checkScanQuota` short-circuits on `isProActive` · **[IMPLEMENTED]**

**BR-063 — A failed or unusable scan does not consume quota**
Description: both soft-failure paths return before `incrementScanCount`.
Source: `api/parse-receipt` · **[IMPLEMENTED]**
Edge: check and increment are **not atomic**, so concurrent scans can exceed the cap slightly.

**BR-064 — Every mutating endpoint is rate-limited**
Description: per-scope sliding window keyed per user when authenticated, else per IP; the two keys
are deliberately not AND-ed. Limits range 10–120/min. Exceeding returns `429` with `Retry-After`.
Source: `src/lib/rate-limit.ts` · Edge: in-memory and per-instance unless
`FLAG_DISTRIBUTED_RATE_LIMIT` is on — and only two endpoints use the distributed-capable path ·
**[IMPLEMENTED]**

---

## Billing & growth

**BR-065 — Pro is a one-time 30-day purchase that never auto-renews**
Description: Rp 29.000 → `PRO_PLAN.periodDays = 30`. Stated four ways in the pricing FAQ.
Source: `src/lib/billing/plans.ts` · **[IMPLEMENTED]**

**BR-066 — Pro is active when the plan is "pro" AND it has not lapsed**
Description: `proExpiresAt` null ⇒ active forever (admin-comped); in the past ⇒ treated as free.
Source: `isProActive` · **[IMPLEMENTED]**

**BR-067 — A new purchase extends from the later of now or the current expiry**
Description: so buying while still Pro stacks the remaining time instead of throwing it away.
Source: `extendProExpiry` · **[IMPLEMENTED]**

**BR-068 — The payment row is written before the payment provider is called**
Description: *"so the webhook always has a row to reconcile against, even if the response is lost."*
`externalId = pro_<userId>_<epoch>` is the idempotency key.
Source: `api/billing/checkout` · **[IMPLEMENTED]**

**BR-069 — A duplicate webhook delivery grants Pro only once**
Description: an atomic `updateMany({ externalId, status: { not: "paid" } })` claim; `count === 0`
answers `200 { alreadyProcessed: true }`. An unknown `external_id` is acknowledged `200` so the
provider stops retrying.
Source: `api/webhooks/xendit` · **[IMPLEMENTED]**

**BR-070 — An already-Pro user cannot start a second checkout**
Source: `api/billing/checkout` → `400 "You already have an active Pro plan."` · **[IMPLEMENTED]**

**BR-071 — A referral grants 14 days of Pro, once per referee, on first sign-in only**
Description: `?ref=CODE` → a 30-day `SameSite=Lax` cookie → credited only when the account is brand
new. Self-referral rejected; the unique constraint on `referee_id` makes double-claims a silent
no-op.
Source: `src/lib/referral.ts`, `api/auth/callback` · Edge: the capture regex `^[A-Z0-9]{6,10}$` is
broader than the 8-character generator, so a malformed code is simply never stored ·
**[IMPLEMENTED]**

---

## Lifecycle & retention

**BR-072 — A saved split lapses 7 days after its last save**
Description: the clock is reset by **saving**, not by opening — *"the server has no idea the user is
mid-edit, so a resumed split that is never re-saved still lapses on the original schedule."* Lapsed
rows are hard-deleted.
Source: `src/lib/receipt/saved-splits.ts` · Affected: FEAT-054 · **[IMPLEMENTED]**

**BR-073 — A share link lives 14 days**
Source: `SHARE_TTL_DAYS` · **[IMPLEMENTED]**

**BR-074 — Trips and receipts are soft-deleted, then hard-deleted after 30 days**
Description: every list and detail query filters `deletedAt: null`; a soft-deleted row answers
**404**, not 403.
Source: `api/admin/cleanup` (`RETENTION_DAYS = 30`) · **[IMPLEMENTED]**

**BR-075 — Deleting a legacy trip cascades to its receipts, manually and transactionally**
Description: Postgres `ON DELETE CASCADE` does not fire on an `UPDATE`, so the cascade is explicit.
Source: `api/trips/[id]` DELETE · Edge: the **travel** delete performs no cascade at all — children
simply become unreachable · **[IMPLEMENTED]**

**BR-076 — Trip restore only un-deletes receipts removed in the same operation**
Description: a ±5-second correlation window around the trip's `deletedAt`. Receipts deleted
independently beforehand stay deleted.
Source: `api/trips/[id]/restore` · **[INFERRED]** a timestamp heuristic, not a recorded cascade id

**BR-077 — Activity events are swept after 30 days**
Description: treated as telemetry, not user data.
Source: `api/admin/cleanup` · **[IMPLEMENTED]**

**BR-078 — The admin audit trail is never swept and never updated**
Description: append-only, FK-free so it survives account deletion, with denormalised email
snapshots.
Source: `AdminAuditLog` model · **[IMPLEMENTED]**

**BR-079 — Re-saving a split refreshes its existing share link rather than minting a rival**
Description: the payload and `expiresAt` are updated in place, and `updatedAt` tells the viewer when
the numbers last moved. Best-effort — a failure must not turn a successful save into an error.
Source: `api/receipts/[id]` PUT · **[IMPLEMENTED]**

---

## Validation & integrity

**BR-080 — Input ceilings are shared between the form and the server**
Title ≤ 200 · name ≤ 100 · id ≤ 100 · 200 items/receipt · 100 participants · 100 receipts/payload ·
500 payments · **50 fees** · **100 discounts** · amount ≤ 1e9 · trip budget ≤ 1e12 · FX rate ≤ 1e6 ·
share payload ≤ 256 000 bytes · change ops ≤ 200 · note ≤ 500 · payment note ≤ 200 · qty ≤ 1000.
Description: *"One definition means the form can disable itself at exactly the point the server
would start rejecting."*
Source: `src/lib/limits.ts`, `validation.ts`, `shared-summary.ts`, `travel-cloud.ts` ·
**[IMPLEMENTED]**

**BR-081 — Every participant id referenced in a payload must exist**
Description: assignments, discount targets, payment endpoints and payer are all validated against
the trip's live participant set. Change-request ops are re-validated **at approval time**, threading
a mid-batch `participants.set` through.
Source: `validateSharedReceipts`, `validateTripPaymentInput`, `buildChangeOpsWrites` ·
Edge: enforced only in application code — no database constraint exists, because participants live
in JSON · **[IMPLEMENTED]**

**BR-082 — The payer must be one of the participants**
Description: *"receipts where the payer isn't in the participant list produce phantom credits in
settlement math."*
Source: `validateReceiptCreate` cross-field rule · **[IMPLEMENTED]**

**BR-083 — Draft saves relax exactly two rules**
Description: an unchosen payer and half-typed item names are permitted, *"because refusing to save
work in progress defeats the point of the feature."* Every other bound still holds.
Source: `validateSavedSplit({ draft: true })` · **[IMPLEMENTED]**

**BR-084 — Client telemetry beacons are restricted to an allowlist**
Description: `feature ∈ {single, multiple, travel}` × `type ∈ {split.created, share.created,
receipt.added}` — *"so a tampered client can't write arbitrary strings into the log."* `login` is
excluded and only ever written server-side.
Source: `src/lib/activity.ts` → `parseBeacon` · **[IMPLEMENTED]**

**BR-085 — Uploaded receipt images are bounded by size and type**
Description: base64 ≤ 7 000 000 characters (~5 MB) → `413`; MIME must match
`jpeg|jpg|png|webp|heic|heif` → `415`. The client additionally resizes to ≤ 1920 px at JPEG q0.85.
Source: `api/parse-receipt` · **[IMPLEMENTED]**

**BR-086 — AI output is treated as untrusted input**
Description: bounded (200 items, 20 fees, 20 discounts), type-checked, coerced
(`splitMethod`→`equal`, `type`→`amount`, `scope`→`receipt`), absolute-valued, and rejected where
impossible (a percent discount > 100). An unmatched item-scope discount is **downgraded to receipt
scope, never dropped**.
Source: `api/parse-receipt`, `ReceiptInput` · **[IMPLEMENTED]**

**BR-087 — Concurrent writes are guarded by an optimistic version**
Description: `UPDATE … WHERE id = ? AND version = ?`; zero rows affected → `409 VERSION_CONFLICT`
carrying `currentVersion`. Travel trips always send a version (defaulting to the observed one);
receipts fall back to last-write-wins when the caller omits it.
Source: `api/receipts/[id]`, `api/trips/[id]`, `api/travel/[id]` · **[IMPLEMENTED]**

**BR-088 — State-changing requests must be same-origin**
Description: `Origin`/`Referer` must match the request `Host` (or `NEXT_PUBLIC_APP_URL`), pairing
with `SameSite=Lax` cookies. Missing `Host` → `400`; mismatch → `403`.
Exceptions, correctly: the Xendit webhook, the cron route, and the cleanup route, which authenticate
with a shared secret instead.
Source: `assertSameOrigin` in `src/lib/api-auth.ts` · **[IMPLEMENTED]**

---

## i18n & SEO

**BR-089 — The default locale owns the un-prefixed URLs**
Description: `DEFAULT_LOCALE = "en"` serves `/`; `PREFIXED_LOCALE = "id"` serves `/id`. Every link,
canonical, hreflang, sitemap entry, `<html lang>`, manifest and OG locale derives from this constant.
Retired `/en/*` URLs `301` to the un-prefixed tree.
Source: `src/lib/i18n/config.ts`, `src/proxy.ts` · **[IMPLEMENTED]**

**BR-090 — hreflang is emitted only for routes that exist in both languages**
Description: Google ignores non-reciprocal annotations, so only `/`, `/about` and `/faq` carry them.
The tool routes are single-URL and get localized metadata but no hreflang.
Source: `BILINGUAL_ROUTES`, `singleUrlPageMetadata` · E2E-asserted · **[IMPLEMENTED]**

**BR-091 — Every indexable page declares a self-referencing canonical**
Description: there is deliberately **no** site-wide canonical in the root layout — one there once
made every page declare itself a duplicate of the homepage.
Source: `src/lib/seo/metadata.ts`, `app/layout.tsx` · E2E-asserted · **[IMPLEMENTED]**

**BR-092 — No rating or review markup may ever be emitted**
Description: the landing page's stars and counts are placeholders, and marking up fabricated reviews
violates Google's spam policies and risks a manual action.
Source: `src/lib/seo/structured-data.ts`; enforced by an assertion in `e2e/smoke.spec.ts` ·
**[IMPLEMENTED]**

**BR-093 — Private surfaces are noindexed, not robots-disallowed**
Description: `/dashboard`, `/history`, `/admin`, `/maintenance` carry a `noindex` tag rather than a
`robots.txt` disallow, because a disallow would stop Google *reading* the directive, and a
disallowed URL can still be indexed URL-only if something links to it. `/api/`, `/s/`, `/share` and
`/invite/` are disallowed outright, being data rather than content.
Source: `app/robots.ts` and the three metadata-only layouts · **[IMPLEMENTED]**

**BR-094 — The sitemap may only list URLs that return 200**
Description: `/multiple` is excluded because the proxy 307s unauthenticated crawlers, and `/pricing`
is included only when its flag is on. An E2E test fetches every `<loc>` and asserts a 200.
Source: `app/sitemap.ts`, `e2e/smoke.spec.ts` · **[IMPLEMENTED]**

---

## Rules the product does *not* have **[IMPLEMENTED]**

Named so their absence is not mistaken for an omission in this catalogue:

| Expected rule | Reality |
|---|---|
| Password strength / email verification | No passwords, no email/password auth |
| Percentage or custom-amount splitting | Splitzy splits by consumption only |
| Group membership approval | There are no groups; trips use invite links |
| Partial settlement restrictions | Any positive amount is accepted |
| Currency conversion at settlement time | The rate is locked at receipt creation instead |
| Expense categories or budgets beyond a trip target | Not modelled |
| Account deletion | No UI, and five `Restrict` foreign keys make it impossible at the DB level |
| Data-export rights | CSV export exists in code but is unreachable |
