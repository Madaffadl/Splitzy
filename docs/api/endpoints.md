# Splitzy — API Endpoint Reference

> All **54** endpoints across **40** route-handler files. Cross-cutting conventions (error contract,
> pagination, rate-limit table, consumers) are in [api-overview.md](./api-overview.md) and are not
> repeated per endpoint.
>
> Every entry is **[IMPLEMENTED]** — read from the handler source — unless labelled otherwise.
>
> **Applies to every state-changing endpoint below unless stated:** `assertSameOrigin` runs first and
> returns `403 FORBIDDEN` on a missing/foreign `Origin`/`Referer`; a `400 BAD_REQUEST` is returned if
> the `Host` header is absent. Every `/api/*` response carries `X-API-Version: 1`.

---

## System

### API-001 — GET `/api/health`

| | |
|---|---|
| **Purpose** | Liveness + readiness probe for uptime monitors |
| **Auth** | None |
| **Authorization** | Anyone |
| **Params** | None |
| **Runtime** | `nodejs`, `dynamic = "force-dynamic"` |
| **Response `200`** | `{ status: "ok", db: "ok", dbLatencyMs, uptimeMs, commit, region, nodeEnv, timestamp }` |
| **Response `503`** | Same shape with `status: "degraded"`, `db: "down"`, `dbLatencyMs: null` |
| **Headers** | `Cache-Control: no-store, must-revalidate` |
| **DB** | `prisma.$queryRaw\`SELECT 1\`` |
| **Logic** | `commit` = `VERCEL_GIT_COMMIT_SHA` truncated to 7 chars; `uptimeMs` measured from module load |
| **Consumers** | External monitor **[UNKNOWN]** |
| **Evidence** | `src/app/api/health/route.ts` |

---

## Authentication & identity

### API-002 — GET `/api/auth/callback`

| | |
|---|---|
| **Purpose** | Supabase OAuth code exchange, `User` upsert, first-sign-in side effects |
| **Auth** | None (this is what establishes the session) |
| **Query** | `code` (required), `next` (default `"/"`) |
| **Response** | `302` to `${origin}${next}` with session cookies. Errors: `302 /?error=no_code`, `302 /?error=auth_failed` |
| **DB** | `user.findUnique(googleId)` → `user.upsert` → `activityEvent.create` → optional `referral.create` + `user.update` |
| **Logic** | The pre-upsert `findUnique` detects a brand-new account; only then are the referral cookie (`splitzy_ref`) and the welcome email processed. A DB failure is caught and logged — login is never blocked |
| **Side effects** | `logActivity(account/login)`, `processReferral`, `sendWelcomeEmail`, clears `splitzy_ref` |
| **Consumers** | Supabase OAuth redirect |
| **Evidence** | `src/app/api/auth/callback/route.ts` |

### API-003 — GET `/api/auth/me`

| | |
|---|---|
| **Purpose** | Current user's profile for the client auth context |
| **Auth** | Session cookie via `createClient()` from `next/headers` |
| **Response `200`** | `{ user: { id, email, name, avatarUrl, createdAt, isAdmin } }` |
| **Errors** | `401 { user: null }` no session · `404 { user: null }` session valid but no `User` row. **Neither carries a `code`** |
| **DB** | `user.findUnique({ googleId })` |
| **Logic** | `role` is destructured away and never returned; only the derived `isAdmin` boolean leaves the server. **Does not apply the `bannedAt` guard** that `getAuthUser` applies |
| **Consumers** | `useAuth.fetchDbUser()` |
| **Evidence** | `src/app/api/auth/me/route.ts` |

### API-004 — GET `/api/me/quota`

| | |
|---|---|
| **Purpose** | AI scan quota for the dashboard widget and paywall |
| **Auth** | Required → `401 UNAUTHORIZED` |
| **Response `200`** | `{ plan, isPro, remaining, resetAt }` — `remaining: null` means unlimited |
| **DB** | `checkScanQuota` → `user.findUnique`, plus a `user.update` if the monthly window has lapsed |
| **Consumers** | `DashboardClient` |
| **Evidence** | `src/app/api/me/quota/route.ts` |

### API-005 — GET `/api/me/referral`

| | |
|---|---|
| **Purpose** | The caller's referral code, link and earnings |
| **Auth** | Required → `401` |
| **Response `200`** | `{ code, referralUrl, rewardDays, totalReferrals, totalDaysEarned }` |
| **DB** | Up to 5 × `user.findUnique(referralCode)` collision checks → `user.update` → `referral.aggregate` |
| **Logic** | **Lazily mints** the code on first call, retrying up to 5 times on collision. `referralUrl` = `${BRAND.siteUrl}?ref=CODE`; `rewardDays` = `REFERRAL_REWARD_DAYS` (14) |
| **Note** | After 5 collisions the loop exits with the last candidate and writes it anyway, which would throw on the unique constraint. Practically unreachable (8 chars × 32-symbol alphabet) |
| **Consumers** | `ReferralCard` |
| **Evidence** | `src/app/api/me/referral/route.ts` |

---

## Telemetry & utility

### API-006 — POST `/api/activity`

| | |
|---|---|
| **Purpose** | Client beacon recording a completed feature action |
| **Auth** | Required → `401` (a no-op for guests by design) |
| **Rate limit** | 60/min per user |
| **Body** | `{ feature: "single" \| "multiple" \| "travel", type: "split.created" \| "share.created" \| "receipt.added" }` |
| **Validation** | `parseBeacon` — a bounded allowlist, so a tampered client cannot write arbitrary strings |
| **Response** | **`202`, empty body** |
| **Errors** | `400 BAD_REQUEST "Invalid activity beacon"` |
| **DB** | `activityEvent.create` (fire-and-forget; errors swallowed) |
| **Consumers** | `logFeatureUsage()` from the three view components |
| **Evidence** | `src/app/api/activity/route.ts` |

### API-007 — GET `/api/fx-rate`

| | |
|---|---|
| **Purpose** | How many IDR one unit of a foreign currency is worth |
| **Auth** | **None** |
| **Rate limit** | **None** |
| **Query** | `from` — ISO code, uppercased/trimmed/`slice(0,10)`, must match `/^[A-Z]{2,10}$/` |
| **Response `200`** | `{ rate, currency, updatedAt }`. `from=IDR` or empty short-circuits to `{ rate: 1 }` |
| **Errors** | `400 BAD_REQUEST "Invalid currency code"` · `500 INTERNAL_ERROR "Failed to fetch exchange rate. Enter the rate manually."` |
| **External** | `GET https://open.er-api.com/v6/latest/<CODE>` — keyless free tier |
| **Caching** | Process-local `Map`, 1-hour TTL, **plus** `fetch(..., { next: { revalidate: 3600 } })` |
| **DB** | None |
| **Consumers** | `ReceiptEditor` after a non-IDR scan |
| **Evidence** | `src/app/api/fx-rate/route.ts` |

### API-008 — POST `/api/share`

| | |
|---|---|
| **Purpose** | Create a read-only snapshot of a split, returning its short code |
| **Auth** | **Optional** — guests may create links (`createdById` stays null) |
| **Rate limit** | 30/min (keyed per user, or per IP for guests) |
| **Body** | `{ v, type, title, participants[], receipts[], payments?[], receiptId? }` |
| **Validation** | `validateSharedSummaryInput` — ≤ 100 receipts, ≤ 200 items each, ≤ 500 payments, ≤ 100 participants; serialized payload ≤ 256 000 bytes |
| **Response `201`** | `{ code, expiresAt, ttlDays: 14 }` |
| **Errors** | `400 VALIDATION_FAILED` · `413 PAYLOAD_TOO_LARGE` · `500 INTERNAL_ERROR` |
| **DB** | `sharedSummary.create` (retry ≤ 5 on `P2002`), then optionally `receipt.updateMany({ id: receiptId, createdById: user.id, deletedAt: null }, { shareCode })` |
| **Logic** | The back-link write is scoped to rows the caller owns, so a forged `receiptId` cannot attach a code to someone else's split |
| **Consumers** | `SummaryPanel` |
| **Evidence** | `src/app/api/share/route.ts` |

---

## Saved splits (`/api/receipts`)

### API-009 — GET `/api/receipts`

| | |
|---|---|
| **Purpose** | List the caller's saved splits |
| **Auth** | Required → `401` |
| **Query** | `limit` (1–50, default 20) · `search` · **either** `cursor` (opaque base64url) **or** `page` |
| **Authorization** | Rows where the user is *involved*: `createdById` ∨ `payerId` ∨ has an `ItemAssignment` ∨ is a `TripMember` of the receipt's trip. Always `deletedAt: null` |
| **Response — cursor mode** | `{ data[], limit, hasMore, nextCursor }` — no `COUNT(*)` |
| **Response — offset mode** | `{ data[], total, page, limit, hasMore }` |
| **`data[]` item** | `{ id, title, date, totalAmount, participantCount, expiresAt, shareCode, type, createdAt, tripName, tripId, itemCount }` |
| **Errors** | `400 BAD_REQUEST "Invalid cursor"` (`field: "cursor"`) |
| **Logic** | `totalAmount` is derived from `payloadJson` (items + tax + service + fees), because `tax + service` alone once reported a Rp 500 000 dinner as "Rp 50 000". `itemCount` likewise counts out of the payload, since payload-backed rows create no `ReceiptItem`. Discounts are deliberately *not* netted off the headline |
| **DB** | `receipt.findMany` (+ `receipt.count` in offset mode) |
| **Consumers** | `supabaseDataService.getReceipts` → `ReceiptHistoryList` |
| **Evidence** | `src/app/api/receipts/route.ts` |

### API-010 — POST `/api/receipts`

| | |
|---|---|
| **Purpose** | Save a Single/Multiple split so it can be resumed |
| **Auth** | Required → `401` · Rate limit 60/min |
| **Body** | `{ type: "single" \| "multiple", title, participants[], receipts[] }` |
| **Validation** | `validateSavedSplit` — `draft: true` relaxes exactly two rules (unchosen payer, half-typed item names); all other bounds hold |
| **Response `201`** | `{ id, version, expiresAt, ttlDays: 7 }` |
| **DB** | `receipt.create` with `payerId: user.id`, `tax: 0`, `service: 0`, `payloadJson`, `participantsJson`, `expiresAt = now + 7d` |
| **Logic** | `payerId` here means *"whose account is this saved under"* — the real payer is a participant id inside the payload |
| **Consumers** | `useSaveSplit` → `supabaseDataService.saveSplit` |
| **Evidence** | `src/app/api/receipts/route.ts` |

### API-011 — GET `/api/receipts/[id]`

| | |
|---|---|
| **Purpose** | Full detail of one saved split or trip receipt |
| **Auth** | Required → `401` |
| **Authorization** | Two-phase. A minimal select decides access (creator ∨ payer ∨ assignee, else a `TripMember` lookup when `tripId` is set); the full nested fetch only runs afterwards |
| **Response `200`** | `{ receipt: … }` — the payload spread with server-owned metadata layered on top: `{ id, version, createdById, tripId, tripName, expiresAt, shareCode, participants }` |
| **Errors** | `404 NOT_FOUND` (missing **or soft-deleted**) · `403 FORBIDDEN` |
| **Logic** | The JSON payload wins whenever present — it is the only representation carrying per-person assignments, fees and discounts. Legacy rows fall back to the flat relational projection. Server metadata always comes from the row, never from client JSON |
| **DB** | `receipt.findUnique` ×2 (auth-first, then full include) |
| **Consumers** | `/history/[id]`, resume flow |
| **Evidence** | `src/app/api/receipts/[id]/route.ts` |

### API-012 — PUT `/api/receipts/[id]`

| | |
|---|---|
| **Purpose** | Update a saved split |
| **Auth** | Required · **creator only** · Rate limit 60/min |
| **Body** | Same as API-010, plus optional `expectedVersion` |
| **Response `200`** | `{ id, version, expiresAt, shareCode, ttlDays: 7 }` |
| **Errors** | `404` · `403` · `400 VALIDATION_FAILED` · **`409 VERSION_CONFLICT`** with `currentVersion` |
| **Concurrency** | With `expectedVersion`: `updateMany({ id, version, deletedAt: null })`; `count === 0` ⇒ 409. Without it: last-write-wins |
| **Side effect** | If the row has a `shareCode`, the linked `SharedSummary` payload **and** `expiresAt` are refreshed so a link shared in a group chat stops showing stale numbers. Best-effort — a failure here must not turn a successful save into an error |
| **Logic** | Saving resets the 7-day TTL; opening does not, because the server never learns about an edit still only in the browser |
| **Consumers** | `useSaveSplit` |
| **Evidence** | `src/app/api/receipts/[id]/route.ts` |

### API-013 — DELETE `/api/receipts/[id]`

Soft-delete (`deletedAt = now()`). Auth required, **creator only**, rate limit 30/min.
`200 { success: true }` · `404` (missing or already deleted) · `403`.
Row is retained for audit and restore; hard-deleted 30 days later by the cleanup job.

### API-014 — POST `/api/receipts/[id]/restore`

Un-delete. Auth required, **creator only**, rate limit 20/min.
`200 { id, restored: true }`, or `{ id, restored: false }` when already active (idempotent).
`404` · `403`. Bumps `version`. A dedicated endpoint rather than a `PUT` toggle *"so it's auditable
and can be permission-gated separately later"*.

---

## Legacy relational trips (`/api/trips`)

**[INFERRED]** No caller for this family exists in the shipped frontend; `/api/travel/*` superseded
it. All ten endpoints remain fully implemented and writable.

### API-015 — GET `/api/trips`

Auth required. Returns `{ trips: [{ id, name, receiptCount, memberCount, createdAt }] }` for trips
the user owns or is a member of, `deletedAt: null`, ordered by `updatedAt desc`. `receiptCount`
counts non-deleted receipts only. Unpaginated.

### API-016 — POST `/api/trips`

Auth required, rate limit 60/min. Body `{ name }` (`validateTripCreate`, ≤ 100 chars).
`201 { id }`. Creates the trip **and** a `TripMember` row with `role: "owner"` in one nested write.

### API-017 — GET `/api/trips/[id]`

Auth required, **member or owner** else `403`; `404` if missing or soft-deleted. Auth-first select,
then the full fetch. Returns `{ trip: { id, name, ownerId, version, owner, members[], receiptCount,
createdAt } }`. Receipts are deliberately **not** embedded — *"embedding all receipts here was
producing 50k-row payloads on large trips"*; callers use API-022.

### API-018 — PUT `/api/trips/[id]`

**Owner only.** Rate limit 60/min. Body `{ name?, expectedVersion? }`. `200 { id, version }` ·
`409 VERSION_CONFLICT` with `currentVersion` when the guarded `updateMany` matches nothing.

### API-019 — DELETE `/api/trips/[id]`

**Owner only.** Rate limit 30/min. `200 { success: true }`. Soft-deletes the trip **and manually
cascades** to its receipts in one `$transaction` — necessary because a soft delete is an `UPDATE`
and Postgres `ON DELETE CASCADE` does not fire.

### API-020 — POST `/api/trips/[id]/members`

**Owner only.** Rate limit 20/min. Body `{ email }` (`validateMemberAdd`, lowercased, RFC-shaped).
**Always returns the same `200 { ok: true, message: "If that email belongs to a Splitzy user, they
have been invited." }`** — whether the email is unregistered, already a member, or newly added, so
trip owners cannot enumerate which emails have accounts. `404` if the trip is missing, `403` if not
the owner.

### API-021 — DELETE `/api/trips/[id]/members`

**Owner only.** Rate limit 30/min. Body `{ userId }`, validated against a UUID regex.
`200 { success: true }` · `400 VALIDATION_FAILED` (bad UUID, or attempting to remove the owner) ·
`404 "Member not found in this trip"` — an explicit existence check, because `deleteMany` would
otherwise return success on a no-op.

### API-022 — GET `/api/trips/[id]/receipts`

Auth required, **membership checked before any list query** (`403` if absent). Offset pagination
(`page`, `limit` 1–50). Returns `{ data[], total, page, limit, hasMore }` with items and
`assignedToIds` per receipt. `deletedAt: null`.

### API-023 — POST `/api/trips/[id]/receipts`

Auth required, **any member**. Rate limit 60/min. Body validated by `validateReceiptCreate`:
1–200 items; each `{ name, qty ≤ 1000, unitPrice, total, assignedToUserIds[] }`; optional `date`,
`payerId`, `participantsJson`, `fees`, `discounts`. **Two cross-field rules**: `payerId` must appear
in `participantsJson`, and every `assignedToUserIds` entry must too — *"otherwise items get assigned
to 'ghost' participants"* and settlement math produces phantom credits. `201 { id }`. Writes
`Receipt` + nested `ReceiptItem` + nested `ItemAssignment`.

### API-024 — POST `/api/trips/[id]/restore`

**Owner only.** Rate limit 20/min. `200 { id, restored: true \| false }`. Restores the trip and only
those receipts whose `deletedAt` falls within **±5 s** of the trip's — receipts deleted
independently beforehand stay deleted, because the user explicitly chose that.

---

## Travel Spend (`/api/travel`)

All endpoints call `getTripAccess(id, userId)` first. It returns `null` for *both* "does not exist"
and "no access", and every caller answers **404** — so trip existence is never disclosed to a
non-member. Write endpoints then call `requireOwnerWrite(access)`, which returns
**`403 REVIEW_REQUIRED`** for members.

### API-025 — GET `/api/travel`

Auth required. Returns **every** trip the user owns or is a member of, **fully hydrated**:
`{ trips: [{ id, name, budget, version, participants[], receipts[], members[], payments[] }] }`.
`take: 200` is the only bound — a deliberate single round trip *"fine for this app's scale"*, with
an in-code note to switch to summary + lazy detail if large accounts appear.

### API-026 — POST `/api/travel`

Auth required, rate limit 60/min. Body `{ name?, budget?, participants[], receipts[] }`
(`validateTravelTripInput`; name defaults to `"My Trip"`, ≤ 200 chars; budget ≤ 1 trillion).
`201 { id, version }`. Also serves **guest→cloud sync**: the whole local trip is posted at once.
`TripReceipt.id` is taken from `receipt.id` — required, since the column has no DB default.

### API-027 — GET `/api/travel/[id]`

Auth + access. Returns the same fully-hydrated shape as one element of API-025. `404` when
`getTripAccess` returns null.

### API-028 — PUT `/api/travel/[id]`

**Owner only** (`403 REVIEW_REQUIRED` for members). Rate limit 120/min.
Body: any of `{ name?, budget?, participants?, expectedVersion? }`. `expectedVersion` defaults to
`access.version` when omitted — so this endpoint is **always** optimistically locked.
`200 { ok: true, version }` · `409 VERSION_CONFLICT "This trip is out of sync (another device/tab,
or an interrupted save). Reload and try again."`
Side effect: `broadcastTripChange(id, { kind: "trip", version })`.

### API-029 — DELETE `/api/travel/[id]`

**Owner only** (`403 FORBIDDEN`, not `REVIEW_REQUIRED`). Soft-delete only — **no cascade**;
`TripReceipt`/`TripPayment`/`TripInvite`/`TripChangeRequest` have no `deletedAt` and simply become
unreachable. `200 { ok: true }`. Broadcasts.

### API-030 — POST `/api/travel/[id]/restore`

**Owner only.** Cannot use `getTripAccess` (it filters deleted rows), so it looks the trip up
directly and checks `ownerId`. Idempotent. `200 { ok: true }` ·
`403 "Only the trip owner can restore it"` · `404`.

### API-031 — POST `/api/travel/[id]/receipts`

**Owner only.** Rate limit 120/min. Body: the receipt, either bare or under a `receipt` key.
Validated by `validateTripReceiptPayload` against the trip's **live** participant id set.
`201 { id }`. Uses **`upsert` on the client-supplied `receipt.id`**, which makes the endpoint
idempotent and is what allows the offline outbox to replay an op safely any number of times.
`400 BAD_REQUEST "receipt.id is required"` · `500 "Failed to save receipt — please try again"`.
Broadcasts `kind: "receipt"`.

### API-032 — PUT `/api/travel/[id]/receipts/[rid]`

**Owner only.** Replaces the payload via `updateMany({ id: rid, tripId: id })` — the trip scope is
in the `WHERE`, so a valid `rid` from another trip matches nothing and returns `404`.
`200 { ok: true }`. Broadcasts.

### API-033 — DELETE `/api/travel/[id]/receipts/[rid]`

**Owner only.** `deleteMany({ id: rid, tripId: id })`; `count === 0` ⇒ `404`. **Hard delete** — there
is no soft delete for trip receipts. `200 { ok: true }`. Broadcasts.

### API-034 — POST `/api/travel/[id]/payments`

**Owner only.** Rate limit 120/min. Body `{ from, to, amount, currency?, fxRate?, note?, source? }`.
`validateTripPaymentInput` requires `from`/`to` to be **distinct participants of this trip**,
`amount` positive and ≤ 1 billion, `note` ≤ 200 chars, `source` ≤ 200 chars, `currency` ≤ 10 chars
uppercased (`"IDR"` is normalised away), and `fxRate` positive **only when a currency is set**.
`201` with the created payment. Broadcasts `kind: "payment"`.
`source` encodes origin: absent = manual settle-up; `"share:<receiptId>:<participantId>"` = a
per-receipt "mark my share paid" checkbox.

### API-035 — DELETE `/api/travel/[id]/payments/[pid]`

**Owner only.** `deleteMany({ id: pid, tripId: id })`; `count === 0` ⇒ `404`. `200 { ok: true }`.
Broadcasts.

### API-036 — GET `/api/travel/[id]/invites`

**Owner only** (`403 "Only the trip owner can view invites"`). Lists non-expired invites:
`{ invites: [{ token, expiresAt, createdAt }] }`. **Not rate-limited.**

### API-037 — POST `/api/travel/[id]/invites`

**Owner only.** Rate limit 30/min. Mints `crypto.randomBytes(16).toString("base64url")` with a
**7-day** TTL. `201 { token, expiresAt }`.

### API-038 — DELETE `/api/travel/[id]/invites/[token]`

**Owner only.** `deleteMany({ token, tripId: id })`; `count === 0` ⇒ `404`. `200 { ok: true }`.
**Not rate-limited.**

### API-039 — GET `/api/travel/[id]/change-requests`

Auth + access (owner **or** member). Query `status` (default `"pending"`; `"all"` removes the
filter). **An owner sees every request; a member sees only their own** — enforced by conditionally
adding `authorId: user.id` to the `where`. `take: 100`, newest first.
Response `{ changeRequests: [{ id, authorId, authorName, status, baseVersion, ops[], note,
reviewNote, createdAt, reviewedAt }] }`. `authorName` is resolved with one extra `user.findMany`,
since the model has no FK relation.

### API-040 — POST `/api/travel/[id]/change-requests`

Auth + access — **any member** (this is the intended member write path). Rate limit 60/min.
Body `{ ops[], note?, baseVersion? }`. `validateChangeOps` validates ops **in order** against a
working participant set that starts from the trip's current participants and is replaced by any
`participants.set` op — so a member can add a participant and reference them later in the same
batch. `MAX_CHANGE_OPS = 200`; `note` ≤ 500 chars; `baseVersion` defaults to `access.version`.
`201` with the created DTO. Broadcasts `kind: "changeRequest"` so the owner's client shows the
pending review.

### API-041 — POST `/api/travel/[id]/change-requests/[crid]/approve`

**Owner only.** Rate limit 60/min. No body.

1. `404` if the request does not belong to this trip; `400 "This change request was already
   reviewed."` if `status !== "pending"`.
2. Ops are re-validated against the trip's **live** participant set — approval is last-write-wins,
   validated against the trip as it looks *now*, not at submit time.
3. `buildChangeOpsWrites` constructs every Prisma operation **before** any DB call, so an invalid op
   throws first and nothing is written. The 400 is rewritten to *"Can't apply — the trip changed and
   this request no longer fits (…). Ask the member to resubmit."*
4. One **array-form** `$transaction` applies the writes, increments `Trip.version`, and claims the
   request with `updateMany({ id, status: "pending" })`. A `count === 0` claim means a concurrent
   reviewer won; the writes were idempotent upserts, so the second caller gets the 400.

`200 { ok: true, status: "approved", version }` · `500 "Failed to apply the change request."`
Broadcasts to all members including the author.

Array form is used rather than an interactive transaction because the PgBouncer pooler
intermittently reports an error even when the statements committed — which surfaced as a spurious
500 on approve while the changes had actually been applied.

### API-042 — POST `/api/travel/[id]/change-requests/[crid]/decline`

**Owner only.** Rate limit 60/min. Body `{ reviewNote? }` (≤ 500 chars). Atomic claim on
`status: "pending"`; `count === 0` ⇒ `400 "This change request was already reviewed."`
`200 { ok: true, status: "declined" }`. Broadcasts so the author's client shows the decision.

---

## Invites (public)

### API-043 — GET `/api/invite/[token]`

**Public and unauthenticated — the token *is* the secret.** Returns
`{ tripId, tripName, invitedBy, expiresAt }`. Rejects expired invites and soft-deleted trips with
`404 "This invite link is invalid or has expired."` `invitedBy` falls back
`creator.name ?? creator.email ?? "Someone"` — **so a leaked link can disclose the inviter's email
address**. Not rate-limited.

### API-044 — POST `/api/invite/[token]/join`

Auth required → `401`. CSRF-checked. Token validity is the only authorization.
`200 { tripId, alreadyMember: false }`, or `{ alreadyMember: true }` when the caller is the owner.
Uses `tripMember.upsert` on the composite key, so joining twice is a no-op. Not rate-limited.

---

## AI

### API-045 — POST `/api/parse-receipt`

| | |
|---|---|
| **Purpose** | Extract items, tax, service, fees, discounts and currency from a receipt photo |
| **Auth** | **Optional.** The monthly quota is enforced only for authenticated users |
| **Rate limit** | 10/min — `enforceRateLimitAsync` (Upstash-capable) |
| **Runtime** | `maxDuration = 60`; the Gemini call aborts at 45 s |
| **Body** | `{ image: "data:image/…;base64,…" }` |
| **Validation** | ≤ 7 000 000 base64 chars (~5 MB) · MIME must match `jpeg\|jpg\|png\|webp\|heic\|heif` |
| **Response `200`** | `{ currency, items[], tax, service, fees[], discounts[] }` |
| **Soft failures (`200`)** | Unparsable model output → `{ …, items: [], error: "Failed to parse response" }`; non-array items → `{ …, items: [] }`. Neither consumes quota |
| **Errors** | `429 QUOTA_EXCEEDED` (`{ remaining: 0, resetAt }`) · `400 BAD_REQUEST` (`field: "image"`) · `413` · `415` · `504 UPSTREAM_TIMEOUT "Scanning took too long. Please try again."` · `500 INTERNAL_ERROR` |
| **External** | `gemini-2.5-flash` via `@google/generative-ai` |
| **DB** | `checkScanQuota` (+ a reset `user.update` if the window lapsed), then `incrementScanCount` — best effort |
| **Output caps** | 200 items · 20 fees · 20 discounts · qty ≤ 1000 · percent discounts > 100 rejected |
| **Consumers** | `ReceiptInput` |
| **Details** | [../architecture/ai-integration.md](../architecture/ai-integration.md) |

---

## Billing

### API-046 — POST `/api/billing/checkout`

| | |
|---|---|
| **Flag** | `FLAG_XENDIT_CHECKOUT` — **`404 NOT_FOUND` when off**, before any other check |
| **Auth** | Required → `401`. Rate limit 10/min (async) |
| **Guards** | Already-Pro (`isProActive`) → `400 "You already have an active Pro plan."` · Keys missing → `500 "Payments are not configured"` |
| **Response `200`** | `{ invoiceUrl }` |
| **DB** | `payment.create` (status `pending`) **before** the Xendit call → `payment.update` with `xenditId` + `invoiceUrl`; on failure `payment.update({ status: "failed" })` |
| **Logic** | The row is written first *"so the webhook always has a row to reconcile against, even if the response is lost."* `externalId = pro_<userId>_<epoch>` is the idempotency key |
| **Consumers** | `UpgradeButton` |
| **Evidence** | `src/app/api/billing/checkout/route.ts` |

### API-047 — POST `/api/webhooks/xendit`

| | |
|---|---|
| **Flag** | `FLAG_XENDIT_CHECKOUT` **and** `XENDIT_WEBHOOK_TOKEN` — else `404` |
| **Auth** | `x-callback-token` header, compared with `===`. **No CSRF check** — correctly, since Xendit is not same-origin |
| **Body** | `{ external_id, status, id? }` |
| **Errors** | `401 UNAUTHORIZED "Invalid callback token"` · `400 "Missing external_id or status"` |
| **Unknown invoice** | **`200 { received: true }`** so Xendit stops retrying something that can never reconcile |
| **`PAID`/`SETTLED`** | Atomic claim `updateMany({ externalId, status: { not: "paid" } })`. `count === 0` ⇒ `200 { received: true, alreadyProcessed: true }`. Otherwise set `plan: "pro"` and `proExpiresAt = extendProExpiry(current, periodDays)` |
| **`EXPIRED`** | Flip a still-`pending` row to `expired` |
| **Concurrency** | Sequential single-statement writes, no interactive transaction (PgBouncer-safe) |
| **Evidence** | `src/app/api/webhooks/xendit/route.ts` |

---

## Machine endpoints

### API-048 — GET `/api/cron/expire-pro`

| | |
|---|---|
| **Purpose** | Daily downgrade of users whose one-time Pro period has lapsed |
| **Auth** | `Authorization: Bearer ${CRON_SECRET}`, exact string comparison |
| **Errors** | `503 { error: "CRON_SECRET not configured" }` — refuses to run when the secret is unset, so it can never be triggered anonymously · `401 { error: "Unauthorized" }`. **Neither carries a `code`** |
| **Response `200`** | `{ downgraded, ranAt }` |
| **DB** | `user.updateMany({ plan: "pro", proExpiresAt: { lt: now } }, { plan: "free" })` |
| **Logic** | `{ lt: now }` excludes `NULL`, so admin-comped Pro (null expiry) is never touched. Read-time `isProActive` already treats expired Pro as free, so this is a data-tidiness job, not a correctness one — it keeps admin counts honest |
| **Schedule** | `vercel.json` — `0 3 * * *` |
| **Evidence** | `src/app/api/cron/expire-pro/route.ts` |

### API-054 — POST · GET `/api/admin/cleanup`

| | |
|---|---|
| **Purpose** | Hard-delete rows past their retention window |
| **Auth** | `Authorization: Bearer ${CLEANUP_TOKEN}` **or** the header `x-vercel-cron: 1` |
| **Errors** | `503 { error: "Cleanup endpoint is not configured. Set CLEANUP_TOKEN." }` when the token is unset *and* the caller is not Vercel Cron · `401 { error: "Unauthorized" }`. **Neither carries a `code`** |
| **Response `200`** | `{ cutoff, retentionDays: 30, receiptsDeleted, lapsedSplitsDeleted, tripsDeleted, expiredSharesDeleted, activityEventsDeleted, expiredInvitesDeleted }` |
| **DB** | One `$transaction` of six `deleteMany`s, ordered receipts → trips so FK cascades to `receipt_items` and `item_assignments` fire cleanly |
| **Sweeps** | Receipts/trips soft-deleted > 30 days ago · saved splits past `expiresAt` · shared summaries past `expiresAt` · activity events older than 30 days · trip invites past `expiresAt` |
| **Notes** | `export const GET = POST` — **a GET performs destructive hard deletes.** `CLEANUP_TOKEN` is absent from `.env.example`, and the route is **not** in `vercel.json` |
| **Evidence** | `src/app/api/admin/cleanup/route.ts` |

---

## Admin

Every handler below starts with `if (!user || !isAdmin(user)) return forbidden();` — **403, not 401**,
even for anonymous callers. `isAdmin` = DB `role === "admin"` ∨ email in `ADMIN_BOOTSTRAP_EMAILS`.

### API-049 — GET `/api/admin/users`

Rate limit 120/min. Query `q` (case-insensitive contains on email/name) · `plan`
(`all` \| `free` \| `pro` \| `banned`) · `cursor` · `limit` (default 25, max 100).
Response `{ users[], nextCursor, stats: { total, pro, banned, scans } }`. Each user carries
`{ id, email, name, avatarUrl, plan, aiScanCount, aiScanResetAt, aiScanLimit, bannedAt, role,
isAdmin, bootstrapAdmin, tripCount, createdAt }`.
`stats` is computed in a 4-statement `$transaction` and is **always global**, ignoring the current
filter, *"so the dashboard counters stay honest no matter which page or filter is in view."*
`tripCount` counts `deletedAt: null` only, to match the drawer.

### API-050 — PATCH `/api/admin/users/[id]`

CSRF-checked. Rate limit 40/min. Body accepts any combination of
`{ plan: "free"|"pro", resetQuota: true, aiScanLimit: number|null, ban: boolean, role: "admin"|"user" }`.

Self-protection: an admin **may** change their own plan and quota, but
`403 "You can't ban your own account"` and `403 "You can't revoke your own admin role"`.
A bootstrap admin's role cannot be revoked by anyone — `400 "Cannot revoke a bootstrap admin"`,
because writing `role = "user"` would be a no-op that misrepresents the audit trail.
`aiScanLimit` must be an integer `0 ≤ n ≤ 10000` or `null` — else `400`.
Empty patch ⇒ `400 "Nothing to update"`. Missing target ⇒ `404`.

`200 { ok: true, user: {…list shape…} }` so the client can update in place without a refetch.
**The `user.update` and `adminAuditLog.createMany` run in one `$transaction`** — an action that
cannot be recorded is never applied.

### API-051 — GET `/api/admin/users/[id]/trips`

Rate limit 120/min. Returns the target's 20 most recently updated **active** trips:
`{ trips: [{ id, name, budget, receiptCount, createdAt, updatedAt }] }`.

### API-052 — GET `/api/admin/activity`

Rate limit 120/min. Query `from`/`to` ISO timestamps; defaults to the last 24 h.
`400 "\`from\` must be before \`to\`"` if inverted.
Returns `{ from, to, truncated: false, summary: { activeUsers, logins, byFeature: { single,
multiple, travel } }, events[] }` — 500 events max, but the summary comes from a raw
`COUNT(DISTINCT user_id) FILTER (WHERE …)` query, so **the aggregates are exact regardless of window
size** and are never truncated. The window is sent by the client as `[from, to)` in the **admin's
local time**, so "today" matches the operator's wall clock rather than a server-guessed timezone.

### API-053 — GET `/api/admin/audit`

Rate limit 120/min. Newest 50 entries:
`{ logs: [{ id, actorEmail, action, targetEmail, metadata, createdAt }] }`.
An operational feed, not an export.

---

## Appendix A — endpoints with no rate limit

API-001, 002, 003, 004, 005, 007, 009, 011, 015, 017, 022, 025, 027, 036, 038, 039, 043, 044, 047,
048, 054.

Most are reads or machine-authenticated. The notable ones are **API-007 `/api/fx-rate`** (public,
keyless, unauthenticated) and **API-044 join** (authenticated but unlimited).

## Appendix B — endpoints with no CSRF check

- API-047 webhook, API-048 cron, API-054 cleanup — machine callers, authenticated by a secret.
  Correct by design.
- Every `GET` — CSRF does not apply.

All other state-changing endpoints call `assertSameOrigin`.

## Appendix C — endpoints returning errors without a `code`

API-003 (`{ user: null }`), API-048, API-054, and the deliberately generic success of API-020.
Everything else uses `apiError()`.
