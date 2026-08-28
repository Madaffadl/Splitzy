# Splitzy — Test Cases

> **118 test cases** covering every critical feature, each with a happy path, a validation case and a
> negative case at minimum.
>
> **Automated?** names the file that covers it today, or `—` where nothing does. That column is the
> point of this document: it turns "we should test this" into a list of exactly what is missing.
>
> `FEAT-xxx` → [../product/feature-catalog.md](../product/feature-catalog.md) ·
> `BR-xxx` → [../requirements/business-rules.md](../requirements/business-rules.md) ·
> `VULN-xxx` → private findings
>
> **Priority** P1 must pass before any release · P2 before a major release · P3 should pass.
> **Type** F functional · V validation · N negative · P permission · R regression

---

## Scope note

The Phase C brief lists cases for sign-up with a weak password, duplicate email, locked accounts and
group creation. **None of those concepts exist in Splitzy**: authentication is Google OAuth only (no
passwords to be weak, no duplicates to collide), and there are no groups — the collaborative
container is a *trip*. Those cases are mapped to the real equivalents below rather than invented.

---

## 1. Authentication & session — TC-001 … TC-012

| TC | Feature | Scenario | Precondition | Steps | Expected | Pri | Type | Automated? |
|---|---|---|---|---|---|---|---|---|
| TC-001 | FEAT-001 | First-ever sign-in creates an account | No `User` row for this Google id | 1. Click Sign In 2. Complete Google consent | `User` created with `googleId`, email, name, avatar, `lastLoginAt`; one `login` ActivityEvent; land on the origin page | P1 | F | — |
| TC-002 | FEAT-001 | Returning sign-in updates the profile | Account exists | 1. Sign in again | Profile refreshed from Google; `lastLoginAt` updated; **no** second welcome email, **no** referral credit | P1 | F | — |
| TC-003 | FEAT-001 | Sign-in with `?next=` returns to origin | Bounced from `/history` | 1. Sign in from the banner | Land on `/history`, not `/` | P2 | F | — |
| TC-004 | FEAT-001 | OAuth callback without a code | — | 1. `GET /api/auth/callback` with no `code` | 302 to `/?error=no_code` | P2 | N | — |
| TC-005 | FEAT-001 | Code exchange fails | Invalid/expired code | 1. Call the callback | 302 to `/?error=auth_failed`; logged | P2 | N | — |
| TC-006 | FEAT-001 | Profile write fails, login still succeeds (BR-042) | DB unavailable during upsert | 1. Sign in | Session established; error logged only; user reaches `next` | P2 | N | — |
| TC-007 | FEAT-002 | Sign-out purges local data | Signed in with drafts | 1. Sign out | Cookies cleared; 7 `localStorage` keys removed; `splitzy-travel` and `splitzy-locale` **retained**; toast shown | P1 | F | — |
| TC-008 | FEAT-002 | Sign-out with storage blocked | Private mode | 1. Sign out | Sign-out succeeds; no exception surfaces | P3 | N | — |
| TC-009 | FEAT-003 | Session refresh across navigation | Signed in | 1. Navigate several pages | Session stays valid; refreshed cookies written | P1 | F | — |
| TC-010 | FEAT-003 | Refreshed cookies survive a redirect | Signed in, hitting a redirecting path | 1. Navigate | New cookies present on the redirect response; no loop | P2 | R | — |
| TC-011 | FEAT-006 | Banned user is rejected (BR-043) | `bannedAt` set | 1. Call any protected API | 401 on every endpoint | P1 | P | — |
| TC-012 | FEAT-006 | Banned user still reads `/api/auth/me` — **known gap** | `bannedAt` set | 1. `GET /api/auth/me` | Currently 200 with profile. **Should be 401** (VULN-003) | P2 | N | — |

## 2. Authorization — TC-013 … TC-028 · **the highest-priority gap**

Every case here is currently unautomated. TC-013 is the regression test for VULN-001.

| TC | Feature | Scenario | Precondition | Steps | Expected | Pri | Type | Automated? |
|---|---|---|---|---|---|---|---|---|
| **TC-013** | FEAT-020 | **Anonymous request to `/multiple` (VULN-001)** | No session | 1. `GET /multiple` | **307 to `/?login=required&redirect=/multiple`**. *Currently returns 200 with the full tool* | **P1** | **P** | — ⚠ **fails today** |
| TC-014 | FEAT-003 | Anonymous request to `/history` | No session | 1. `GET /history` | Sign-in gate rendered, no user data | P1 | P | — |
| TC-015 | FEAT-054 | Non-creator cannot update a saved split (BR-046) | Split owned by user A | 1. As B, `PUT /api/receipts/<id>` | 403 | P1 | P | — |
| TC-016 | FEAT-057 | Non-creator cannot delete a saved split | As above | 1. As B, `DELETE /api/receipts/<id>` | 403 | P1 | P | — |
| TC-017 | FEAT-055 | Uninvolved user cannot read a split (BR-047) | Split owned by A | 1. As C, `GET /api/receipts/<id>` | 403 | P1 | P | — |
| TC-018 | FEAT-055 | Soft-deleted split reads as absent | Split deleted | 1. As the creator, `GET /api/receipts/<id>` | **404**, not 403 | P2 | N | — |
| TC-019 | FEAT-039 | Non-member cannot read a trip (BR-050) | Trip owned by A | 1. As B, `GET /api/travel/<id>` | **404**, not 403 — existence not disclosed | P1 | P | — |
| TC-020 | FEAT-048 | Member cannot write a trip directly (BR-049) | B is a member | 1. As B, `PUT /api/travel/<id>` | `403 REVIEW_REQUIRED` | P1 | P | — |
| TC-021 | FEAT-048 | Member sees only their own change requests (BR-051) | Two members with proposals | 1. As B, `GET .../change-requests` | Only B's are returned | P2 | P | — |
| TC-022 | FEAT-048 | Member cannot approve | B is a member | 1. As B, `POST .../approve` | 403 | P1 | P | — |
| TC-023 | FEAT-047 | Member cannot mint invites | B is a member | 1. As B, `POST .../invites` | 403 "Only the trip owner…" | P2 | P | — |
| TC-024 | FEAT-052 | Member cannot delete a trip | B is a member | 1. As B, `DELETE /api/travel/<id>` | 403 | P1 | P | — |
| TC-025 | FEAT-071 | Non-admin cannot reach admin APIs | Ordinary user | 1. `GET /api/admin/users` | **403** | P1 | P | — |
| TC-026 | FEAT-071 | Anonymous cannot reach admin APIs | No session | 1. `GET /api/admin/users` | 403 | P1 | P | — |
| TC-027 | FEAT-071 | Admin cannot ban themselves (BR-055) | Signed in as admin | 1. `PATCH /api/admin/users/<self>` `{ban:true}` | 403 "You can't ban your own account" | P2 | V | — |
| TC-028 | FEAT-071 | Bootstrap admin's role cannot be revoked (BR-056) | Target is in the allowlist | 1. `PATCH … {role:"user"}` | 400 "Cannot revoke a bootstrap admin" | P2 | V | `admin-auth.test.ts` (predicate only) |

## 3. Split calculation — TC-029 … TC-048 · *the best-covered area*

| TC | Feature | Scenario | Steps | Expected | Pri | Type | Automated? |
|---|---|---|---|---|---|---|---|
| TC-029 | FEAT-024 | Equal split, 2 people | Item Rp 50 000 → 2 | Rp 25 000 each | P1 | F | ✅ `calculations.test.ts` |
| TC-030 | FEAT-024 | Indivisible equal split (BR-004) | Rp 100 → 3 | 33.34 / 33.33 / 33.33; sums **exactly** to 100 | P1 | V | ✅ same |
| TC-031 | FEAT-024 | Item assigned to nobody (BR-005) | 1 item, no assignees | Nobody charged; subtotal still includes it; payer absorbs | P2 | N | ✅ `calculations-extended` |
| TC-032 | FEAT-025 | Quantity-weighted split | 3 skewers Rp 60 000; B takes 2, C takes 1 | B 40 000, C 20 000 | P1 | F | ✅ `calculations-extended` |
| TC-033 | FEAT-025 | Qty remainder to the most units (BR-003) | 4 units / 3 people | Remainder to the 2-unit holder | P2 | V | ✅ same |
| TC-034 | FEAT-025 | All quantities zero | assignments all `qty:0` | Empty share map; no charge | P2 | N | ✅ same |
| TC-035 | FEAT-026 | Tax proportional to subtotal | Rp 18 000 over a Rp 120 000 subtotal | Allocated by each person's share | P1 | F | ✅ `calculations.test.ts` |
| TC-036 | FEAT-026 | Tax remainder to largest subtotal (BR-007) | Indivisible tax | Largest subtotal absorbs it | P2 | V | ✅ same |
| TC-037 | FEAT-026 | Zero subtotal with tax (BR-008) | Tax, no items | Split **equally**, ledger balances | P2 | N | ✅ same |
| TC-038 | FEAT-027 | Equal fee across all participants | Rp 12 000 delivery, 4 people | Rp 3 000 each **regardless of order** | P1 | F | ✅ `calculations-extended` |
| TC-039 | FEAT-027 | Proportional fee | Same fee, `proportional` | Follows the tax rule | P2 | F | ✅ same |
| TC-040 | FEAT-027 | Non-positive fee ignored (BR-011) | Fee amount 0 or −5 | Skipped entirely | P2 | N | ✅ same |
| TC-041 | FEAT-028 | Receipt-scope discount | Rp 20 000 whole-bill | Spread proportionally to base totals | P1 | F | ✅ same |
| TC-042 | FEAT-028 | Item-scope discount | On one item | Only that item's consumers credited | P1 | F | ✅ same |
| TC-043 | FEAT-028 | Participant voucher | Personal | Only its owner credited | P1 | F | ✅ same |
| TC-044 | FEAT-028 | Discount exceeding a share (BR-016) | Voucher > base | Capped; total never negative | P1 | V | ✅ same |
| TC-045 | FEAT-028 | Two percentage discounts (BR-015) | 10 % + 10 % | Do **not** compound | P2 | V | ✅ same |
| TC-046 | FEAT-031 | Minimal transfers | 4-person asymmetric debt | Minimum practical transfer set | P1 | F | ✅ `calculations-extended` |
| TC-047 | FEAT-031 | Exact-match pairing (BR-027) | B owes exactly what A is owed | One transfer of exactly that amount | P2 | F | ✅ same |
| TC-048 | FEAT-030 | Conservation | Any receipt | Net balances sum to zero | P1 | R | ✅ `travel-spend.qa` |

## 4. Currency — TC-049 … TC-054

| TC | Feature | Scenario | Expected | Pri | Type | Automated? |
|---|---|---|---|---|---|---|
| TC-049 | FEAT-043 | Foreign receipt with a locked rate | Converted to IDR before aggregation | P1 | F | ✅ `calculations.test.ts` |
| TC-050 | FEAT-043 | Mixed-currency trip | Aggregates in IDR without mixing units | P1 | F | ✅ `travel-spend.qa` |
| TC-051 | FEAT-038 | Foreign receipt, **no** rate (BR-039) | Passes at 1:1; `needsFxRate` true | P1 | N | ✅ `fx-rate-guard` |
| TC-052 | FEAT-043 | Foreign settle-up payment | Converted before reducing balances | P1 | F | ✅ `currency-display` |
| TC-053 | FEAT-038 | FX service unavailable | User asked to enter the rate manually | P2 | N | — |
| TC-054 | FEAT-038 | Rate locked at creation (BR-036) | Later rate change does not alter the receipt | P2 | R | — |

## 5. AI receipt scan — TC-055 … TC-066

| TC | Feature | Scenario | Precondition | Expected | Pri | Type | Automated? |
|---|---|---|---|---|---|---|---|
| TC-055 | FEAT-035 | Valid receipt photo | Key configured | Items, qty, prices, tax, service, fees, discounts, currency extracted | P1 | F | — |
| TC-056 | FEAT-035 | Unreadable image | — | 200 with empty items; "couldn't read any items"; **no quota consumed** | P1 | N | — |
| TC-057 | FEAT-035 | Model returns fenced/narrative JSON | — | First balanced object extracted correctly | P2 | R | — |
| TC-058 | FEAT-035 | Offline before upload | Network off | Specific offline message; **no request made** | P1 | N | — |
| TC-059 | FEAT-035 | Gemini times out (>45 s) | — | `504 UPSTREAM_TIMEOUT`; "took too long", **not** "unreadable" | P1 | N | `abort-error.test.ts` (classification only) |
| TC-060 | FEAT-035 | Oversized image | > 7 000 000 base64 chars | 413 | P2 | V | — |
| TC-061 | FEAT-035 | Wrong media type | PDF | 415 | P2 | V | — |
| TC-062 | FEAT-035 | Rate limit | 11 scans in a minute | 429 + `Retry-After` | P2 | N | `rate-limit.test.ts` (limiter only) |
| TC-063 | FEAT-035 | IDR price parsing | `700.000,00` | Parses to `700000` | P1 | V | ✅ `parser.test.ts` |
| TC-064 | FEAT-035 | Model returns >200 items | — | Truncated to 200 | P3 | V | — |
| TC-065 | FEAT-035 | Percent discount > 100 | — | Rejected | P2 | V | — |
| TC-066 | FEAT-035 | Item discount with an unmatchable name | — | **Downgraded to receipt scope**, not dropped | P2 | N | — |

## 6. AI quota — TC-067 … TC-071

| TC | Feature | Scenario | Precondition | Expected | Pri | Type | Automated? |
|---|---|---|---|---|---|---|---|
| TC-067 | FEAT-036 | Free user within quota | 3 of 15 used | Scan proceeds; counter increments | P1 | F | — |
| TC-068 | FEAT-036 | Free user at quota | 15 used | `429 QUOTA_EXCEEDED` with `remaining` and `resetAt`; paywall shown | P1 | N | — |
| TC-069 | FEAT-036 | Active Pro | `plan=pro`, future expiry | No limit | P1 | F | `entitlements.test.ts` (predicate) |
| TC-070 | FEAT-036 | **Anonymous user scans (VULN-006)** | No session | *Currently unmetered.* Should hit a per-IP daily cap | P2 | N | — ⚠ **gap** |
| TC-071 | FEAT-036 | Window reset | `aiScanResetAt` in the past | Counter resets to 0 during the check | P2 | R | — |

## 7. Save, resume & history — TC-072 … TC-081

| TC | Feature | Scenario | Expected | Pri | Type | Automated? |
|---|---|---|---|---|---|---|
| TC-072 | FEAT-054 | Save a split | 201 with id, version, `expiresAt` = now + 7 d; toast with a **View** action | P1 | F | `saved-splits.test.ts` (expiry only) |
| TC-073 | FEAT-054 | Re-save | Same row updated, not duplicated; TTL reset | P1 | F | ✅ `saved-splits.test.ts` |
| TC-074 | FEAT-054 | Draft with no payer (BR-083) | Accepted | P2 | V | ✅ same |
| TC-075 | FEAT-054 | Draft with a ghost participant | **Rejected** even in draft mode | P2 | V | ✅ same |
| TC-076 | FEAT-054 | Stale `expectedVersion` (BR-087) | `409 VERSION_CONFLICT` + `currentVersion`; "Saved somewhere else" | P1 | N | — |
| TC-077 | FEAT-055 | Search history | Debounced 300 ms; filters on receipt and trip name | P2 | F | — |
| TC-078 | FEAT-055 | Search with no match | "No receipts match your search" | P3 | N | — |
| TC-079 | FEAT-055 | Empty history | "No receipts yet" | P3 | N | — |
| TC-080 | FEAT-054 | Resume | Editor rehydrates with fees and discounts intact | P1 | R | ✅ `saved-splits.test.ts` |
| TC-081 | FEAT-056 | Legacy row with no payload | Flat columns synthesise one receipt | P2 | R | ✅ `receipt-detail.test.ts` |

## 8. Travel Spend & sync — TC-082 … TC-095

| TC | Feature | Scenario | Expected | Pri | Type | Automated? |
|---|---|---|---|---|---|---|
| TC-082 | FEAT-039 | Create a trip | Cloud trip, `version` 1, creator is owner | P1 | F | ✅ `useTravelData.test.ts` |
| TC-083 | FEAT-039 | Create rejected by the server | Ghost trip removed; error flagged | P2 | N | ✅ same |
| TC-084 | FEAT-040 | Add a receipt online | Applied locally, synced, outbox drained | P1 | F | ✅ same |
| TC-085 | FEAT-049 | Add a receipt **offline** | Stays durable and pending; no network call | P1 | N | ✅ same |
| TC-086 | FEAT-049 | Add then delete an unsynced receipt | Both ops cancel; nothing sent | P2 | R | ✅ `travel-outbox.test.ts` |
| TC-087 | FEAT-049 | Server returns 5xx/429 | Op stays queued for retry | P1 | N | ✅ `travel-sync.test.ts` |
| TC-088 | FEAT-049 | Server returns 4xx | Op discarded; message shown; state re-pulled | P2 | N | ✅ same |
| TC-089 | FEAT-049 | `403 REVIEW_REQUIRED` mid-flight | Op migrates into the proposal buffer, not dropped | P2 | R | ✅ same |
| TC-090 | FEAT-039 | Concurrent trip edit | 409 → sync status `conflict`, outranking `saving` | P1 | N | ✅ same |
| TC-091 | FEAT-049 | Mirror belongs to another account | Ignored | P2 | P | ✅ `useTravelData.test.ts` |
| TC-092 | FEAT-048 | Batch adds a participant then references them | Validation passes | P2 | V | ✅ `change-ops.test.ts` |
| TC-093 | FEAT-048 | Batch over 200 ops | Rejected | P3 | V | ✅ same |
| TC-094 | FEAT-048 | Approve an op that no longer fits | 400 "Ask the member to resubmit"; **nothing written** | P1 | N | `travel-cloud.test.ts` (validator only) |
| TC-095 | FEAT-048 | Two reviewers approve at once | Second gets "already reviewed" | P2 | N | — |

## 9. Settlement — TC-096 … TC-103

| TC | Feature | Scenario | Expected | Pri | Type | Automated? |
|---|---|---|---|---|---|---|
| TC-096 | FEAT-044 | Record a full settle-up | Debt cleared; transfer disappears | P1 | F | ✅ `settle-up.test.ts` |
| TC-097 | FEAT-044 | Partial payment | Remaining debt reported correctly | P1 | F | ✅ same |
| TC-098 | FEAT-045 | Tick a share after a partial manual payment (BR-031) | Records **only** the remainder; payer never flips negative | P1 | R | ✅ `travel-spend.qa` |
| TC-099 | FEAT-045 | Tick an already-covered share | Toast; **nothing written** | P2 | N | ✅ same |
| TC-100 | FEAT-045 | Untick a share | Payment deleted; debt returns | P2 | F | ✅ `settle-up.test.ts` |
| TC-101 | FEAT-044 | Payment referencing a removed participant (BR-024) | Skipped; balances still sum to zero | P1 | N | ✅ `travel-spend.qa` |
| TC-102 | FEAT-044 | `from === to`, or non-positive amount | Rejected with 400 | P2 | V | ✅ `travel-cloud.test.ts` |
| TC-103 | FEAT-044 | **Duplicate manual payment (VULN-011)** | *Currently creates two rows.* Should be idempotent | P2 | N | — ⚠ **gap** |

## 10. Sharing — TC-104 … TC-109

| TC | Feature | Scenario | Expected | Pri | Type | Automated? |
|---|---|---|---|---|---|---|
| TC-104 | FEAT-059 | Create a share link | 201 with code and 14-day expiry; renders at `/s/<code>` | P1 | F | — |
| TC-105 | FEAT-059 | Re-save a shared split (BR-079) | **Same link updated**, no rival created; `updatedAt` moves | P1 | R | — |
| TC-106 | FEAT-059 | Expired link | Distinct "expired" state, not a 404 | P2 | N | ✅ **visual-verified** |
| TC-107 | FEAT-059 | Payload over 256 KB | 413 with a clear message | P2 | V | ✅ `shared-summary.test.ts` |
| TC-108 | FEAT-060 | Hash link round-trip | Encode → decode lossless, incl. non-ASCII names | P2 | F | ✅ `share.test.ts` |
| TC-109 | FEAT-060 | Corrupted hash payload | Decode returns null; error state shown | P2 | N | ✅ same |

## 11. Billing — TC-110 … TC-114

| TC | Feature | Scenario | Expected | Pri | Type | Automated? |
|---|---|---|---|---|---|---|
| TC-110 | FEAT-065 | Checkout with the flag off | 404; button reads "Coming soon" | P1 | P | `flags.test.ts` (reader only) |
| TC-111 | FEAT-065 | Checkout starts | Pending `Payment` written **before** the provider call; redirect to the invoice | P1 | F | — |
| TC-112 | FEAT-065 | Already-Pro user | 400 "You already have an active Pro plan" | P2 | V | `entitlements.test.ts` |
| TC-113 | FEAT-066 | **Duplicate PAID webhook (BR-069)** | Pro granted **once**; second answers `alreadyProcessed` | P1 | R | — ⚠ **revenue-critical, untested** |
| TC-114 | FEAT-066 | Webhook with a bad token | 401 | P1 | P | — |

## 12. PWA — TC-115 … TC-117

| TC | Feature | Scenario | Expected | Pri | Type | Automated? |
|---|---|---|---|---|---|---|
| TC-115 | FEAT-075 | Manifest icons match reality | Declared `sizes` equal real IHDR dimensions; square; < 300 KB | P1 | R | ✅ `manifest-icons.test.ts` |
| TC-116 | FEAT-075 | Precache list is real | Every static asset in `APP_SHELL` exists on disk | P1 | R | ✅ same |
| TC-117 | FEAT-075 | **Service worker controls the page** | Second visit: `navigator.serviceWorker.controller !== null`; an offline navigation still renders | P2 | F | — (scriptable — see test-strategy §6) |

## 13. i18n & SEO — TC-118

| TC | Feature | Scenario | Expected | Pri | Type | Automated? |
|---|---|---|---|---|---|---|
| TC-118 | FEAT-016 | SEO contract | Self-referencing canonicals; reciprocal hreflang; private pages noindexed; no rating markup; every sitemap `<loc>` returns 200; apex 301s | P1 | R | ✅ `e2e/smoke.spec.ts` |

---

## Coverage summary

| Group | Cases | Automated | Gap |
|---|---|---|---|
| Authentication & session | 12 | 0 | **12** |
| **Authorization** | 16 | 0 (1 partial) | **16** |
| Split calculation | 20 | 20 | 0 |
| Currency | 6 | 4 | 2 |
| AI scan | 12 | 1 (2 partial) | **11** |
| AI quota | 5 | 0 (1 partial) | **5** |
| Save / resume / history | 10 | 5 | 5 |
| Travel & sync | 14 | 12 (1 partial) | 2 |
| Settlement | 8 | 7 | 1 |
| Sharing | 6 | 4 | 2 |
| Billing | 5 | 0 (2 partial) | **5** |
| PWA | 3 | 2 | 1 |
| i18n & SEO | 1 | 1 | 0 |
| **Total** | **118** | **56** | **62** |

### Cases that fail or are unmet today

| TC | Status |
|---|---|
| **TC-013** | **Fails.** `/multiple` returns 200 to anonymous requests (VULN-001) |
| TC-012 | Fails by design gap — `/api/auth/me` does not apply the ban guard (VULN-003) |
| TC-070 | Unmet — anonymous AI scanning is unmetered (VULN-006) |
| TC-103 | Unmet — settle-up payments have no idempotency key (VULN-011) |

### Where to start

The 16 authorization cases (TC-013 … TC-028) are the highest value in this document: they are all
P1, all currently unautomated, and one of them already fails in production code. **TC-013 is a
five-line test that would have caught a shipped defect.**
