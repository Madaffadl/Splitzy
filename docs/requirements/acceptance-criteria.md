# Splitzy — Acceptance Criteria Register

> A consolidated, **test-oriented** view of the criteria stated narratively in
> [user-stories.md](./user-stories.md). Each row is one independently verifiable criterion with an
> ID, its type, and — critically — **whether an automated test actually covers it today**.
>
> `Verified by` names a real file. `—` means **no automated coverage exists**; the criterion is
> enforced only by the implementation and would have to be checked manually.
>
> Test inventory: **36** Vitest files + **2** Playwright specs.
>
> **Evidence convention.** The **Verified by** column is this document's evidence label: a named
> test file means the criterion is machine-verified; `—` means it is **[IMPLEMENTED]** in code but
> checked only by reading it. Every attribution below was audited against the actual
> `describe`/`it` blocks in each file, not inferred from filenames.

**Type key:** `H` happy · `A` alternative · `V` validation · `P` permission · `E` error ·
`X` edge case

---

## 1. Identity & access — AC-001 … AC-018

| AC | US | Criterion | Type | Verified by |
|---|---|---|---|---|
| AC-001 | US-001 | Given a first-ever Google sign-in, When the callback runs, Then a `User` row is created with `googleId`, email, name, avatar and `lastLoginAt` | H | — |
| AC-002 | US-001 | Given a first sign-in, Then exactly one `login` `ActivityEvent` is written | H | — |
| AC-003 | US-001 | Given a `splitzy_ref` cookie and a brand-new account, Then the referrer gains 14 days of Pro and the cookie is cleared | A | — |
| AC-004 | US-001 | Given a returning user, Then no welcome email and no referral credit are issued | X | — |
| AC-005 | US-001 | Given the `User` upsert throws, Then the session is still established and the error is logged only | E | — |
| AC-006 | US-001 | Given no `code` query param, Then redirect to `/?error=no_code` | E | — |
| AC-007 | US-001 | Given `exchangeCodeForSession` fails, Then redirect to `/?error=auth_failed` | E | — |
| AC-008 | US-002 | Given a valid session with a `User` row, Then `/api/auth/me` returns `isAdmin` and **never** the raw `role` column | H | — |
| AC-009 | US-002 | Given a bootstrap-allowlist email whose DB role is `"user"`, Then `isAdmin` is `true` | X | `admin-auth.test.ts` |
| AC-010 | US-002 | Given a valid session with no `User` row, Then `/api/auth/me` returns `404 { user: null }` | E | — |
| AC-011 | US-003 | Given sign-out, Then all seven app `localStorage` keys are removed | H | — |
| AC-012 | US-003 | Given sign-out, Then `splitzy-travel` and `splitzy-locale` are **retained** | X | — |
| AC-013 | US-003 | Given storage is blocked, Then sign-out still succeeds | E | `useLocalStorage.test.ts` (classification only) |
| AC-014 | US-003 | Given the first auth resolution after mount, Then no "Signed out" toast fires | X | — |
| AC-015 | US-004 | Given a non-401 `getUser()` error on a protected route, Then the request proceeds | E | — |
| AC-016 | US-004 | Given a redirect from the proxy, Then refreshed cookies are copied onto it | X | — |
| AC-017 | US-005 | Given an anonymous request to `/multiple`, Then `302 /?login=required&redirect=/multiple` | P | — |
| AC-018 | US-006 | Given a banned account, Then `getAuthUser` returns `null` and protected endpoints `401` | P | — |

## 2. Guest access — AC-019 … AC-024

| AC | US | Criterion | Type | Verified by |
|---|---|---|---|---|
| AC-019 | US-006 | Given no session, Then `/single` and `/travel` render and are fully usable | H | `smoke.spec.ts` (renders) |
| AC-020 | US-006 | Given no session, Then a share link can be created with `createdById = null` | A | — |
| AC-021 | US-006 | Given no session, Then an AI scan is **not** counted against any monthly quota | X | — |
| AC-022 | US-007 | Given 3 completed guest splits, When reaching a 4th summary, Then the limit dialog appears | H | — |
| AC-023 | US-007 | Given the dialog, When "Later" is pressed, Then the split still completes | A | — |
| AC-024 | US-007 | Then the quoted limit is read from `MAX_GUEST_SPLITS`, not a literal | X | — |

## 3. Onboarding, marketing & language — AC-025 … AC-040

| AC | US | Criterion | Type | Verified by |
|---|---|---|---|---|
| AC-025 | US-008 | Given a first visit to `/`, Then the 3-step tour opens and `onboarding_started` fires | H | — |
| AC-026 | US-008 | Given the final step, When finished, Then navigate to `/single` and fire `onboarding_completed` with the step | H | — |
| AC-027 | US-008 | Given skip or Escape, Then fire `onboarding_skipped` and never show it again on this browser | A | — |
| AC-028 | US-008 | Given any route other than `/`, Then the tour does not appear | X | `smoke.spec.ts` (suppresses via storage key) |
| AC-029 | US-008 | Given `localStorage` is unavailable, Then the tour is skipped silently | E | — |
| AC-030 | US-009 | Given `/`, Then exactly one `<h1>` exists and it is the hero | H | **`smoke.spec.ts`** |
| AC-031 | US-009 | Given `/id`, Then the hero renders in Indonesian | A | **`smoke.spec.ts`** |
| AC-032 | US-009 | Given any page, Then **no** `aggregateRating` or `Review` markup is emitted | X | **`smoke.spec.ts`** |
| AC-033 | US-010 | Given `/about`, `/faq`, `/id/about`, `/id/faq`, Then each renders with one `<h1>` | H | **`smoke.spec.ts`** |
| AC-034 | US-010 | Given any indexable route, Then its canonical is self-referencing on the `www` host | H | **`smoke.spec.ts`** |
| AC-035 | US-010 | Given a bilingual route, Then hreflang is reciprocal and `x-default` points at the un-prefixed URL | H | **`smoke.spec.ts`** |
| AC-036 | US-010 | Given `/dashboard` or `/history`, Then `noindex` is present | P | **`smoke.spec.ts`** |
| AC-037 | US-011 | Given `?lang=id` on a tool route, Then the locale is applied **and persisted** | H | — |
| AC-038 | US-011 | Given a stored `id` preference, When visiting `/`, Then the preference is **not** overwritten | X | — |
| AC-039 | US-011 | Given a key present in `id.ts` but absent from `en.ts`, Then the build fails | V | TypeScript + `app-copy.test.ts` |
| AC-040 | US-011 | Given an interpolated string, Then both languages carry the same `{placeholders}` | V | **`app-copy.test.ts`** |

## 4. Splitting engine — AC-041 … AC-070

The best-covered area in the codebase.

| AC | US | Criterion | Type | Verified by |
|---|---|---|---|---|
| AC-041 | US-015 | Given an item split equally between N, Then each share is `total / N` | H | **`calculations.test.ts`** |
| AC-042 | US-015 | Given `100 / 3`, Then the remainder goes to the **first** assignee and shares sum exactly to 100 | X | **`calculations.test.ts`** |
| AC-043 | US-015 | Given an item assigned to nobody, Then no one is charged but the subtotal still includes it | X | `calculations.test.ts` *(empty-map half only)* |
| AC-044 | US-016 | Given qty-weighted assignments, Then share = `(qty / totalQty) × total` | H | **`calculations.test.ts`** |
| AC-045 | US-016 | Given a qty remainder, Then it goes to the person with the most units | X | **`calculations.test.ts`** |
| AC-046 | US-016 | Given all assigned quantities are zero, Then no shares are produced | X | **`calculations-extended.test.ts`** |
| AC-047 | US-017 | Given tax and service, Then each person pays in proportion to their subtotal | H | **`calculations.test.ts`** |
| AC-048 | US-017 | Given a proportional remainder, Then it goes to the largest subtotal | X | **`calculations.test.ts`** |
| AC-049 | US-017 | Given `receiptSubtotal === 0` with tax present, Then tax splits **equally** | X | **`calculations.test.ts`** |
| AC-050 | US-018 | Given a fee with `splitMethod: "equal"`, Then it divides across **all** participants | H | **`calculations-extended.test.ts`** |
| AC-051 | US-018 | Given a fee with `splitMethod: "proportional"`, Then it follows the tax rule | A | **`calculations-extended.test.ts`** |
| AC-052 | US-018 | Given a fee amount ≤ 0, Then it is skipped entirely | V | **`calculations-extended.test.ts`** |
| AC-053 | US-019 | Given a receipt-scope discount, Then it spreads proportionally to base totals | H | **`calculations-extended.test.ts`** |
| AC-054 | US-019 | Given an item-scope discount, Then only that item's consumers are credited | H | **`calculations-extended.test.ts`** |
| AC-055 | US-019 | Given a participant-scope discount, Then only its owner is credited | H | **`calculations-extended.test.ts`** |
| AC-056 | US-019 | Given a discount exceeding a person's base share, Then their credit is capped and their total is ≥ 0 | X | **`calculations-extended.test.ts`** |
| AC-057 | US-019 | Given two percentage discounts, Then neither compounds | X | **`calculations-extended.test.ts`** |
| AC-058 | US-020 | Given a payer, Then their balance is `amountPaid − own share` | H | **`calculations.test.ts`** |
| AC-059 | US-020 | Given any receipt, Then net balances sum to zero | X | **`calculations.test.ts`** |
| AC-060 | US-021 | Given exactly matching debts, Then they are paired before greedy netting | A | **`calculations-extended.test.ts`** |
| AC-061 | US-021 | Given a balance within ±0.01, Then no transfer is produced | X | **`calculations.test.ts`** |
| AC-062 | US-021 | Given a settlement set, Then applying it clears every balance | H | **`calculations.test.ts`** |
| AC-063 | US-022 | Given a person, Then their breakdown lists each item, units taken, sharers and share | H | **`calculations-extended.test.ts`** |
| AC-064 | US-023 | Given an all-empty payment-info form, Then the object is dropped entirely | X | **`payment-info.test.ts`** |
| AC-065 | US-023 | Given partial payment info, Then it renders as a single line skipping missing fields | A | **`payment-info.test.ts`** |
| AC-066 | US-012 | Given `?step=bill`, Then the wizard opens on that step | H | **`wizard-navigation.spec.ts`** |
| AC-067 | US-012 | Given the wizard, Then exactly **one** back control exists in `main` | X | **`wizard-navigation.spec.ts`** |
| AC-068 | US-012 | Given step 2, When back is pressed, Then the URL returns to `/single` | H | **`wizard-navigation.spec.ts`** |
| AC-069 | US-014 | Given more than 200 items, Then the input is capped | V | **`input-limits.test.ts`** |
| AC-070 | US-014 | Given fee/discount counts at their ceilings, Then the form disables at exactly the server's limit | V | **`input-limits.test.ts`**, `validation-fees-discounts.test.ts` |

## 5. AI receipt scanning — AC-071 … AC-084

| AC | US | Criterion | Type | Verified by |
|---|---|---|---|---|
| AC-071 | US-025 | Given a receipt photo, Then items, tax, service, fees, discounts and currency are returned | H | — |
| AC-072 | US-025 | Given a fenced or narrative model response, Then the first balanced JSON object is extracted | X | — |
| AC-073 | US-025 | Given an IDR price string `700.000,00`, Then it parses to `700000` | X | **`parser.test.ts`**, `parser-comprehensive.test.ts` |
| AC-074 | US-025 | Given more than 200 items in the model output, Then the list is truncated to 200 | V | — |
| AC-075 | US-025 | Given a percent discount above 100, Then it is rejected | V | — |
| AC-076 | US-025 | Given an item-scope discount whose item cannot be matched, Then it is downgraded to receipt scope, **not** dropped | X | — |
| AC-077 | US-025 | Given a base64 image over 7 000 000 chars, Then `413 PAYLOAD_TOO_LARGE` | V | — |
| AC-078 | US-025 | Given a non-image MIME type, Then `415 UNSUPPORTED_MEDIA_TYPE` | V | — |
| AC-079 | US-025 | Given `navigator.onLine === false`, Then no request is made and an offline message shows | E | — |
| AC-080 | US-025 | Given the model exceeds 45 s, Then `504 UPSTREAM_TIMEOUT` and a retry-oriented message | E | **`abort-error.test.ts`** (classification) |
| AC-081 | US-025 | Given an 11th scan in one minute from one IP, Then `429` with `Retry-After` | V | **`rate-limit.test.ts`** |
| AC-082 | US-026 | Given a free user at 15 scans, Then `429 QUOTA_EXCEEDED` with `remaining` and `resetAt` | P | — |
| AC-083 | US-026 | Given an unparsable model response, Then quota is **not** incremented | X | — |
| AC-084 | US-026 | Given active Pro, Then no scan limit applies | X | **`entitlements.test.ts`** |

## 6. Currency — AC-085 … AC-090

| AC | US | Criterion | Type | Verified by |
|---|---|---|---|---|
| AC-085 | US-032 | Given a foreign receipt with a locked rate, Then all amounts convert to IDR before aggregation | H | **`calculations.test.ts`**, **`travel-spend.qa.test.ts`** |
| AC-086 | US-032 | Given a percentage discount, Then it does **not** scale with FX | X | — |
| AC-087 | US-032 | Given a foreign receipt with a missing/zero/negative rate, Then `needsFxRate` is true | E | **`fx-rate-guard.test.ts`** |
| AC-088 | US-032 | Given a foreign settle-up payment, Then display and balance maths use the same conversion | X | **`currency-display.test.ts`** |
| AC-089 | US-032 | Given an FX lookup failure, Then the user is told to enter the rate manually | E | — |
| AC-090 | US-032 | Given a rate locked at creation, Then a later rate change does not alter the receipt | X | — |

## 7. Settlement ledger — AC-091 … AC-100

| AC | US | Criterion | Type | Verified by |
|---|---|---|---|---|
| AC-091 | US-033 | Given a payment `from → to`, Then the debtor's balance rises and the creditor's falls by the IDR amount | H | **`settle-up.test.ts`** |
| AC-092 | US-033 | Given a payment referencing a non-participant, Then it is skipped entirely and Σ balances stays 0 | X | **`travel-spend.qa.test.ts`** |
| AC-093 | US-033 | Given `from === to` or a non-positive amount, Then the payment is ignored | V | **`travel-spend.qa.test.ts`** |
| AC-094 | US-033 | Given `from` or `to` is not a trip participant, Then the API returns `400 VALIDATION_FAILED` | V | **`travel-cloud.test.ts`** |
| AC-095 | US-034 | Given a partial manual payment then a share tick, Then only the **remaining** debt is recorded | X | **`settle-up.test.ts`** |
| AC-096 | US-034 | Given the pair debt is already covered, Then the checkbox renders as covered and writes nothing | X | **`settle-up.test.ts`** |
| AC-097 | US-034 | Given a share marker exists, When unticked, Then the payment is deleted and the debt returns | A | **`settle-up.test.ts`** |
| AC-098 | US-034 | Given a payer, Then they never owe their own receipt | X | **`settle-up.test.ts`** |
| AC-099 | US-021 | Given `pairSettlement`, Then manual and share-marker payments net together without double-settling | X | **`settle-up.test.ts`** |
| AC-100 | US-033 | Given a foreign payment, Then `amount × fxRate` is used in the ledger | X | **`currency-display.test.ts`** |

## 8. Travel sync & collaboration — AC-101 … AC-116

| AC | US | Criterion | Type | Verified by |
|---|---|---|---|---|
| AC-101 | US-029 | Given a receipt write, Then it applies to the mirror immediately and queues in the outbox | H | **`travel-outbox.test.ts`** |
| AC-102 | US-029 | Given an `add` then an `update` for the same receipt, Then they coalesce into one `add` | X | **`travel-outbox.test.ts`** |
| AC-103 | US-029 | Given an `add` then a `delete` for the same receipt, Then both cancel out | X | **`travel-outbox.test.ts`** |
| AC-104 | US-029 | Given a 5xx or 429 response, Then the op stays queued for retry | E | **`travel-sync.test.ts`** |
| AC-105 | US-029 | Given a 4xx response, Then the op is discarded and authoritative state is re-pulled | E | **`travel-sync.test.ts`** |
| AC-106 | US-029 | Given `403 REVIEW_REQUIRED`, Then the op migrates into the proposal buffer rather than being dropped | X | **`travel-sync.test.ts`** |
| AC-107 | US-029 | Given a 409, Then sync status becomes `conflict`, which outranks `saving` | E | **`travel-sync.test.ts`** |
| AC-108 | US-029 | Given a mirror payload with a different `uid`, Then it is ignored | X | **`useTravelData.test.ts`** |
| AC-109 | US-039 | Given a restore request, Then `POST /api/travel/:id/restore` is called | H | **`useTravelData.test.ts`** |
| AC-110 | US-037 | Given a batch with `participants.set` followed by a receipt referencing a new participant, Then validation passes | X | **`travel-cloud.test.ts`**, `change-ops.test.ts` |
| AC-111 | US-037 | Given more than 200 ops, Then the batch is rejected | V | **`change-ops.test.ts`** |
| AC-112 | US-037 | Given pending ops, Then `applyOpsToTrip` overlays them on the member's own view | H | **`change-ops.test.ts`** |
| AC-113 | US-038 | Given an op that no longer fits the live participant set, Then approval returns `400` and **nothing is written** | E | **`travel-cloud.test.ts`** (validator) |
| AC-114 | US-038 | Given a second concurrent approval, Then it returns "already reviewed" | X | — |
| AC-115 | US-029 | Given a trip receipt payload, Then it round-trips losslessly through validation | X | **`trip-receipt-payload.test.ts`** |
| AC-116 | US-029 | Given the `realtime` flag is off, Then `broadcastTripChange` is a no-op | X | **`realtime.test.ts`** |

## 9. Persistence & sharing — AC-117 … AC-130

| AC | US | Criterion | Type | Verified by |
|---|---|---|---|---|
| AC-117 | US-040 | Given a save, Then `expiresAt` is set to now + 7 days | H | **`saved-splits.test.ts`** |
| AC-118 | US-040 | Given a re-save, Then the TTL resets and the same row is updated | A | **`saved-splits.test.ts`** |
| AC-119 | US-040 | Given a draft with no payer, Then the save succeeds | V | **`saved-splits.test.ts`** |
| AC-120 | US-040 | Given a stale `expectedVersion`, Then `409 VERSION_CONFLICT` with `currentVersion` | E | — |
| AC-121 | US-040 | Given a non-creator, Then update/delete/restore return `403` | P | — |
| AC-122 | US-042 | Given a legacy row with no payload, Then the flat columns synthesise one receipt | X | **`receipt-detail.test.ts`** |
| AC-123 | US-042 | Given a payload-backed row, Then fees and discounts are preserved in the detail view | X | **`receipt-detail.test.ts`** |
| AC-124 | US-043 | Given a share payload over 256 KB, Then `413` with a clear message | V | — *(the hash-share size cap is covered by `share.test.ts`)* |
| AC-125 | US-043 | Given a code collision, Then generation retries up to 5 times | E | — |
| AC-126 | US-043 | Given a re-save of a split with a `shareCode`, Then that snapshot is refreshed in place | A | — |
| AC-127 | US-043 | Given an expired link, Then a distinct "expired" state renders, not a 404 | E | — |
| AC-128 | US-043 | Given an invalid share payload, Then validation rejects it before persisting | V | **`shared-summary.test.ts`** |
| AC-129 | US-044 | Given a hash share link, Then it round-trips encode → decode losslessly | H | **`share.test.ts`** |
| AC-130 | US-044 | Given a corrupted or oversized hash payload, Then decode returns null and an error state shows | E | **`share.test.ts`** |

## 10. Money, growth & admin — AC-131 … AC-145

| AC | US | Criterion | Type | Verified by |
|---|---|---|---|---|
| AC-131 | US-048 | Given `FLAG_XENDIT_CHECKOUT` off, Then checkout returns `404` | P | **`flags.test.ts`** (flag reader) |
| AC-132 | US-048 | Given checkout, Then a `pending` `Payment` row is written **before** the provider call | H | — |
| AC-133 | US-048 | Given an already-Pro user, Then checkout returns `400` | V | **`entitlements.test.ts`** |
| AC-134 | US-048 | Given a duplicate `PAID` webhook, Then Pro is granted only once | X | — |
| AC-135 | US-048 | Given an unknown `external_id`, Then the webhook acknowledges `200` | E | — |
| AC-136 | US-049 | Given `plan = "pro"` and `proExpiresAt` in the past, Then the user is treated as free | X | **`entitlements.test.ts`** |
| AC-137 | US-049 | Given `plan = "pro"` and `proExpiresAt = null`, Then Pro never lapses | X | **`entitlements.test.ts`** |
| AC-138 | US-049 | Given a purchase while still Pro, Then the new expiry stacks from the current one | X | **`entitlements.test.ts`** |
| AC-139 | US-050 | Given a self-referral, Then no reward is granted | V | — |
| AC-140 | US-050 | Given a second referral of the same referee, Then it is a silent no-op | X | — |
| AC-141 | US-051 | Given a non-admin, Then every `/api/admin/*` route returns `403` | P | **`admin-auth.test.ts`** (predicate) |
| AC-142 | US-052 | Given an admin change, Then the update and its audit row commit in one transaction | X | — |
| AC-143 | US-052 | Given `aiScanLimit` outside 0–10 000, Then `400` | V | — |
| AC-144 | US-054 | Given an attempt to revoke a bootstrap admin, Then `400` | V | **`admin-auth.test.ts`** |
| AC-145 | US-056 | Given an audit entry, Then it renders a stable human-readable summary | H | **`admin-audit.test.ts`** |

## 11. Platform — AC-146 … AC-155

| AC | US | Criterion | Type | Verified by |
|---|---|---|---|---|
| AC-146 | US-057 | Given the manifest, Then every declared icon exists and its **real** pixel dimensions match `sizes` | H | **`manifest-icons.test.ts`** |
| AC-147 | US-057 | Given the manifest, Then every icon is square and under 300 KB | V | **`manifest-icons.test.ts`** |
| AC-148 | US-057 | Given the manifest, Then a dedicated `maskable` icon exists that is not shared with `purpose: "any"` | X | **`manifest-icons.test.ts`** |
| AC-149 | US-057 | Given `sw.js`, Then every precached static asset exists on disk | X | **`manifest-icons.test.ts`** |
| AC-150 | US-058 | Given a `GET` navigation offline, Then the cached shell is served | A | — |
| AC-151 | US-058 | Given an `/api/*` request, Then the service worker passes it through uncached | X | — |
| AC-152 | US-060 | Given a section throws, Then only that panel shows the error boundary fallback | H | — |
| AC-153 | US-060 | Given production, Then the raw error message is **not** shown | X | — |
| AC-154 | — | Given a `localStorage` write failure, Then it is classified as `quota` or `unavailable` and surfaced | E | **`useLocalStorage.test.ts`** |
| AC-155 | — | Given the sitemap, Then every listed URL returns `200` and `/multiple` is absent | X | **`smoke.spec.ts`** |

## 12. Cross-cutting infrastructure — AC-156 … AC-162

| AC | US | Criterion | Type | Verified by |
|---|---|---|---|---|
| AC-156 | US-005 | Given the apex host, Then a `301` to `https://www.splitzy.my.id` | H | **`smoke.spec.ts`** |
| AC-157 | US-011 | Given `/en`, `/en/about`, `/en/faq`, Then each `301`s to the un-prefixed path | A | **`smoke.spec.ts`** |
| AC-158 | — | Given `robots.txt`, Then it names the sitemap URL | H | **`smoke.spec.ts`** |
| AC-159 | — | Given any page, Then `Organization`, `WebSite` and `SoftwareApplication` JSON-LD are present | H | **`smoke.spec.ts`** |
| AC-160 | — | Given the rate limiter, Then a sliding window admits `limit` requests and rejects the next | V | **`rate-limit.test.ts`** |
| AC-161 | — | Given Upstash is unreachable, Then the limiter fails **open** to the in-memory path | E | **`rate-limit-redis.test.ts`** |
| AC-162 | — | Given a flag env var of `1`/`true`/`on`/`yes`, Then it reads as enabled; anything else is disabled | V | `flags.test.ts` *(defaults-OFF + env-name mapping only)* |

---

## Coverage analysis

| Area | ACs | Automated | Coverage |
|---|---|---|---|
| Splitting engine | 30 | 30 | **100 %** |
| Settlement ledger | 10 | 10 | **100 %** |
| Cross-cutting infrastructure | 7 | 7 | **100 %** |
| Travel sync & collaboration | 16 | 15 | 94 % |
| Onboarding / marketing / i18n | 16 | 10 | 63 % |
| Persistence & sharing | 14 | 9 | 64 % |
| Platform | 10 | 6 | 60 % |
| Currency | 6 | 3 | 50 % |
| Money, growth & admin | 15 | 8 | 53 % |
| AI scanning | 14 | 4 | 29 % |
| Guest access | 6 | 1 | 17 % |
| Identity & access | 18 | 2 | **11 %** |
| **Total** | **162** | **105** | **65 %** |

> Counts recomputed directly from the tables above, after auditing every `Verified by` claim against
> the actual `describe`/`it` blocks in each test file. Several attributions were corrected in both
> directions during that audit.

### What this tells you **[INFERRED]**

1. **The money math is exhaustively tested and the auth layer is barely tested.** Splitting and
   settlement are at 100 %; identity and access are at 11 %. The riskiest untested area is
   authorization — *no test anywhere asserts that a non-owner receives 403 or 404*, which is exactly
   the guarantee the whole permission model rests on.
2. **Every route-handler behaviour is untested.** All 36 Vitest files test pure modules; there are no
   API integration tests. Handler-level rules — CSRF, quota enforcement, optimistic locking, the
   admin audit transaction, webhook idempotency — are verified only by reading the code.
3. **E2E covers SEO thoroughly and product flows barely.** `smoke.spec.ts` is largely an SEO
   regression suite (written after a canonical bug effectively de-indexed the site); no E2E test
   completes an actual split.
4. **The highest-value additions**, in order: authorization tests (AC-017, AC-018, AC-121, AC-141),
   optimistic-locking tests (AC-120), quota-enforcement tests (AC-082, AC-083), webhook idempotency
   (AC-134), and the admin audit transaction (AC-142).

### Criteria with no implementation to test

| AC | Story | Note |
|---|---|---|
| — | US-046 | Deleting a saved split has no UI, so no criterion can be exercised end-to-end |
| — | US-047 | CSV export has a unit test (`csv-export.test.ts`) but **no reachable UI**, so the module is verified while the feature does not exist |
