# Splitzy — Backend Architecture

> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**

---

## 1. Shape of the backend **[IMPLEMENTED]**

The backend is **App Router route handlers only**. There are:

- **40** files matching `src/app/api/**/route.ts`, exposing **54** endpoints (~3 980 lines total).
- **0** Server Actions. No `"use server"` directive exists anywhere in the repo.
- **1** edge proxy: [src/proxy.ts](../../src/proxy.ts), which explicitly excludes `/api` from its
  matcher — so every API route authenticates itself.
- **1** Server Component that reads the database directly: `/s/[code]`.

Verified: `grep -r '"use server"' src` returns nothing; `config.matcher` in `proxy.ts` is
`"/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg).*)"`.

---

## 2. Route inventory by area **[IMPLEMENTED]**

| Area | Base path | Handlers | Purpose |
|---|---|---|---|
| Health | `/api/health` | GET | Liveness + readiness |
| Auth | `/api/auth/*` | GET callback, GET me | OAuth code exchange, current user |
| Me | `/api/me/*` | GET quota, GET referral | Self-service reads |
| Telemetry | `/api/activity` | POST | Client usage beacon |
| FX | `/api/fx-rate` | GET | IDR conversion rate |
| Share | `/api/share` | POST | Create a read-only snapshot link |
| Saved splits | `/api/receipts*` | GET, POST, GET/PUT/DELETE `[id]`, POST restore | Single/Multiple save + history |
| Legacy trips | `/api/trips*` | GET, POST, GET/PUT/DELETE `[id]`, members, receipts, restore | Relational trip model |
| Travel Spend | `/api/travel*` | 18 handlers | JSON-payload trip model, invites, payments, change requests |
| Invites | `/api/invite/[token]*` | GET, POST join | Public invite landing + join |
| AI | `/api/parse-receipt` | POST | Gemini vision extraction |
| Billing | `/api/billing/checkout`, `/api/webhooks/xendit` | POST, POST | Pro purchase |
| Cron | `/api/cron/expire-pro` | GET | Daily Pro downgrade |
| Admin | `/api/admin/*` | users, users/[id], users/[id]/trips, activity, audit, cleanup | Operator console API |

Full per-endpoint documentation: [../api/endpoints.md](../api/endpoints.md).

**[IMPLEMENTED]** Two trip models coexist. `/api/trips/*` is the **legacy relational** path
(`Receipt` + `ReceiptItem` + `ItemAssignment`, FK'd to `users`). `/api/travel/*` is the **current**
path (`TripReceipt.payload` JSON, name-based participants). The Travel Spend UI uses only
`/api/travel/*`. The legacy path is still wired and reachable.
**[INFERRED]** `/api/trips/*` is effectively dead weight for the shipped UI, retained for
compatibility with rows written before the payload model.

---

## 3. The handler pipeline **[IMPLEMENTED]**

Every state-changing handler follows the same ordered convention. It is a convention, not a
framework — there is no wrapper/decorator, each handler calls the steps explicitly.

```
1. flag gate            isServerEnabled("xenditCheckout")        → 404 if dark
2. CSRF                 assertSameOrigin(request)                → 403
3. authentication       getAuthUser(request)                     → 401
4. rate limit           enforceRateLimit(request, scope, {...})   → 429
5. resource load        prisma.<model>.findUnique(minimal cols)   → 404
6. authorization        ownership / membership / role check       → 403
7. body validation      validate*(body) throwing ValidationError  → 400
8. optimistic lock      updateMany({ where: { id, version } })    → 409
9. write                prisma …
10. side effects        broadcastTripChange, logActivity, audit
11. response            NextResponse.json(...) | apiError(...)
```

A representative example, `PUT /api/receipts/[id]`
([source](../../src/app/api/receipts/[id]/route.ts)):

```ts
const csrf = assertSameOrigin(request);           if (csrf) return csrf;
const user = await getAuthUser(request);          if (!user) return unauthorized();
const limited = enforceRateLimit(request, "receipts:update", { userId: user.id });
                                                  if (limited) return limited;
const existing = await prisma.receipt.findUnique({ where: { id },
                   select: { createdById: true, deletedAt: true, version: true } });
if (!existing || existing.deletedAt) return notFound();
if (existing.createdById !== user.id) return forbidden();
input = validateSavedSplit(body);                 // throws ValidationError
// … optimistic-lock updateMany, then best-effort share-link refresh
```

**[IMPLEMENTED] Auth-first fetching.** Detail endpoints deliberately load only the columns needed
for the access decision *before* pulling the full nested payload, so an unauthorized request costs
almost no DB work or JSON serialisation. `GET /api/receipts/[id]` and `GET /api/trips/[id]` both
carry that comment and do two queries for exactly this reason.

---

## 4. Authentication in handlers **[IMPLEMENTED]**

[src/lib/api-auth.ts](../../src/lib/api-auth.ts) exposes:

| Export | Behaviour |
|---|---|
| `getAuthUser(request)` | Rebuilds a Supabase server client from the raw `Cookie` header, calls `supabase.auth.getUser()`, then resolves the Prisma `User` by `googleId`. Returns `null` for anonymous **and for banned users** (`bannedAt != null`), so a ban 401s every protected route |
| `unauthorized()` / `forbidden(msg?)` / `notFound(msg?)` | Standard 401/403/404 `apiError` responses |
| `assertSameOrigin(request)` | CSRF guard — see below |

`resolveAuth` is wrapped in React's `cache()`, keyed on the cookie header string, so multiple
`getAuthUser()` calls inside one request share a single Supabase + Prisma round trip.

### CSRF **[IMPLEMENTED]**

`assertSameOrigin` builds an allowlist of `https://<Host>`, `http://<Host>` (local dev) and
`NEXT_PUBLIC_APP_URL` if set, then requires `Origin` or `Referer` to match. It returns:

- `400 BAD_REQUEST` — missing `Host`
- `403 FORBIDDEN` — missing, unparsable, or non-matching `Origin`/`Referer`

It pairs with the `SameSite=Lax` cookies `@supabase/ssr` sets. **It is called on every
state-changing handler except the two that must not have it:**

| Exception | Why |
|---|---|
| `POST /api/webhooks/xendit` | Called by Xendit's servers; authenticated by `x-callback-token` instead |
| `GET /api/cron/expire-pro`, `POST /api/admin/cleanup` | Machine callers; authenticated by `Authorization: Bearer` / `x-vercel-cron` |

**[IMPLEMENTED]** `PATCH /api/admin/users/[id]` *does* call `assertSameOrigin`.
**[IMPLEMENTED]** `POST /api/invite/[token]/join` calls it too, despite the token being the secret.

---

## 5. Validation **[IMPLEMENTED]**

Hand-written runtime validators, no schema library. All throw `ValidationError(field, message)`;
`validationErrorResponse(err)` converts that to `{ error, code: "VALIDATION_FAILED", field }` with
status 400.

| Module | Validates |
|---|---|
| [validation.ts](../../src/lib/validation.ts) | `validateTripCreate`, `validateTripPatch`, `validateReceiptCreate`, `validateReceiptPatch`, `validateMemberAdd`, `validateParticipantsJson`, `validatePaymentInfo`, `validateFees`, `validateDiscounts` |
| [receipt/shared-summary.ts](../../src/lib/receipt/shared-summary.ts) | `validateSharedSummaryInput`, `validateSharedReceipts`, `validateSharedPayments`, `parseSharedSummaryPayload` |
| [receipt/saved-splits.ts](../../src/lib/receipt/saved-splits.ts) | `validateSavedSplit` (with a `draft: true` relaxation) |
| [travel/travel-cloud.ts](../../src/lib/travel/travel-cloud.ts) | `validateTravelTripInput`, `validateTripReceiptPayload`, `validateTripPaymentInput`, `validateChangeOps`, `validateBudget` |
| [activity.ts](../../src/lib/activity.ts) | `parseBeacon` — bounded allowlist of `feature` × `type` |

Bounds enforced server-side (a sample): title ≤ 200, name ≤ 100, id ≤ 100, 200 items/receipt,
100 participants, 100 receipts/payload, 500 payments, 50 fees, 100 discounts, amount ≤ 1e9,
FX rate ≤ 1 000 000, share payload ≤ 256 000 bytes, change ops ≤ 200, base64 image ≤ 7 000 000 chars.

**[IMPLEMENTED]** Validator output types are *aliases of the canonical client types*
(`ValidatedParticipant = Participant`, `SharedReceipt = Receipt`) with a drift-guard test asserting
validation preserves every field — so client and server can never disagree about the shape.

**[IMPLEMENTED]** The `draft: true` mode in `validateSavedSplit` relaxes exactly two rules (unchosen
payer, half-typed item names) because refusing to save work-in-progress would defeat the feature.
Every other bound still holds.

---

## 6. Authorization **[IMPLEMENTED]**

Four distinct models. Full treatment in [authorization.md](./authorization.md).

| Model | Rule | Helper |
|---|---|---|
| Saved split | creator-only for write; "involved" (creator ∨ payer ∨ assignee ∨ trip member) for read | inline |
| Legacy trip | owner-only for trip write/members; membership for receipts | inline |
| Travel trip | `getTripAccess` → `owner` \| `member` \| no access; `requireOwnerWrite` returns `403 REVIEW_REQUIRED` for members | [trip-access.ts](../../src/lib/travel/trip-access.ts) |
| Admin | `isAdmin(user)` = DB `role === "admin"` ∨ bootstrap email allowlist | [admin-auth.ts](../../src/lib/admin/admin-auth.ts) |

**[IMPLEMENTED]** The Travel model is a **PR-style approval workflow**: members cannot write the
canonical trip at all. Their edits are captured as a `ChangeOp[]` batch in `TripChangeRequest` and
replayed only when the owner approves.

---

## 7. Concurrency control **[IMPLEMENTED]**

### Optimistic locking

`Trip.version` and `Receipt.version` are integers bumped on every write. When the caller sends
`expectedVersion`, the handler uses an **atomic conditional update**:

```ts
const result = await prisma.trip.updateMany({
  where: { id, version: expectedVersion, deletedAt: null },
  data: { ...data, version: { increment: 1 } },
});
if (result.count === 0) return apiError("VERSION_CONFLICT", "…", { currentVersion });
```

This closes the read-then-write race window. Callers that omit `expectedVersion` still get
last-write-wins, for backward compatibility.

### Atomic claims

The same `updateMany`-returns-count trick guards single-fire operations:

- **Xendit webhook** — `updateMany({ where: { externalId, status: { not: "paid" } } })`; `count === 0`
  means a duplicate delivery, answered `200 { alreadyProcessed: true }`.
- **Change-request approve/decline** — `updateMany({ where: { id, status: "pending" } })`; a
  concurrent second reviewer becomes a no-op.
- **Share-code collision** — retry loop of 5 on Prisma `P2002`.

### Transactions

Array form only (`prisma.$transaction([...])`), never the interactive callback form. The reason is
documented in [apply-change-ops.ts](../../src/lib/travel/apply-change-ops.ts): `DATABASE_URL` points
at Supabase's PgBouncer in transaction mode, and interactive transactions over it intermittently
report an error even when the statements committed — which surfaced as a spurious 500 on approve
while the changes had actually been applied.

Transactional operations: trip soft-delete cascade, trip restore cascade, admin
`user.update` + `adminAuditLog.createMany`, change-request approve, admin cleanup sweep, admin
global counters.

---

## 8. Error handling conventions **[IMPLEMENTED]**

`ErrorCode` → HTTP status, from [api-response.ts](../../src/lib/api-response.ts):

| Code | Status | Used for |
|---|---|---|
| `UNAUTHORIZED` | 401 | no session / banned |
| `FORBIDDEN` | 403 | not owner / not admin / CSRF |
| `REVIEW_REQUIRED` | 403 | Travel member attempting a direct write |
| `NOT_FOUND` | 404 | missing, soft-deleted, or a dark feature flag |
| `VALIDATION_FAILED` | 400 | validator rejection (carries `field`) |
| `BAD_REQUEST` | 400 | malformed body, unusable state |
| `VERSION_CONFLICT` | 409 | optimistic-lock mismatch (carries `currentVersion`) |
| `RATE_LIMITED` | 429 | limiter (carries `Retry-After` header) |
| `QUOTA_EXCEEDED` | 429 | monthly AI scan cap (carries `remaining`, `resetAt`) |
| `PAYLOAD_TOO_LARGE` | 413 | image > ~5 MB, share payload > 256 KB |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | non-image MIME |
| `UPSTREAM_TIMEOUT` | 504 | Gemini exceeded 45 s |
| `INTERNAL_ERROR` | 500 | anything else |

**[IMPLEMENTED]** `UPSTREAM_TIMEOUT` exists as a distinct code because lumping a timeout into
`INTERNAL_ERROR` told the user their receipt was unreadable, sending them off re-cropping a photo
that was fine. `isAbortError()` matches structurally (`name` or a `/abort|timeout|timed out/i`
message) rather than with `instanceof` on a vendor class, so it survives an SDK renaming its error
type.

**[IMPLEMENTED]** Best-effort side effects never fail the primary write. Every one of
`logActivity`, `broadcastTripChange`, `sendWelcomeEmail`, `processReferral`,
`incrementScanCount`, and the share-link refresh in `PUT /api/receipts/[id]` is wrapped in
`try/catch` or `.catch()` and only logs.

---

## 9. Information-disclosure hardening **[IMPLEMENTED]**

| Endpoint | Measure |
|---|---|
| `POST /api/trips/[id]/members` | Returns the **same generic success** whether the email is unregistered, already a member, or newly added — so trip owners cannot enumerate which emails have Splitzy accounts |
| `GET /api/auth/me` | Strips the raw `role` column and returns only a derived `isAdmin` boolean |
| `GET /api/receipts/[id]` | Soft-deleted rows are 404, not 403 — they "no longer exist" for the caller |
| `POST /api/billing/checkout`, `POST /api/webhooks/xendit` | Return `404 NOT_FOUND` when the flag is off, so a dark feature is indistinguishable from a nonexistent route |
| `/api/share` | Rate-limited even though guests may call it, because it writes a row from an unauthenticated surface |

---

## 10. Business-logic organisation **[IMPLEMENTED]**

Route handlers stay thin: parse → guard → delegate → serialise. Domain rules live in `src/lib`:

| Concern | Module | Notable rule |
|---|---|---|
| Pro entitlement | `billing/entitlements.ts` | `plan === "pro"` **and** (`proExpiresAt` null ⇒ forever, else in the future). `extendProExpiry` stacks from the later of now / current expiry, so buying while still Pro does not waste time |
| AI quota | `scan-quota.ts` | `FREE_SCAN_LIMIT = 15`/month; per-user `aiScanLimit` override; window resets to midnight UTC on the 1st of next month, set lazily on the first scan of a window |
| Trip access | `travel/trip-access.ts` | owner ⇒ direct write; member ⇒ `REVIEW_REQUIRED` |
| Change requests | `travel/apply-change-ops.ts` | Validates **all** ops against the *live* participant set before any DB call, threading a mid-batch `participants.set` through, so an invalid op yields a clean 400 with nothing written |
| Referrals | `referral.ts` | `REFERRAL_REWARD_DAYS = 14`; idempotent via the unique constraint on `referee_id` |
| Activity | `activity-server.ts` | Fire-and-forget insert, all errors swallowed |
| Admin audit | route + `admin/admin-audit.ts` | Update and audit write share one transaction — an action that cannot be recorded is never applied |
| Money | `receipt/calculations.ts`, `travel/settle-up.ts` | Pure, client-side; the server never computes a split |

**[INFERRED]** The server is deliberately **not** the arithmetic authority. It validates and stores
payloads; every share, balance and settlement figure is computed by the same pure module in the
browser (and re-used by the server-rendered `/s/[code]` page). That is why the test suite is so
heavily weighted toward `lib/receipt` and `lib/travel`.

---

## 11. Response headers and caching **[IMPLEMENTED]**

- `X-API-Version: 1` on every `/api/*` response (from `next.config.mjs`).
- `Cache-Control: no-store, must-revalidate` on `/api/health`.
- `Retry-After` (seconds) on every 429.
- No other explicit cache headers — route handlers are dynamic by default.
- `/api/fx-rate` layers two caches: a process-local `Map` with a 1-hour TTL, plus
  `fetch(..., { next: { revalidate: 3600 } })` on the upstream call.

---

## 12. Backend risks and observations

| # | Observation | Label |
|---|---|---|
| 1 | Only `parse-receipt` and `billing/checkout` use `enforceRateLimitAsync`; all other endpoints use the per-instance in-memory limiter even when `FLAG_DISTRIBUTED_RATE_LIMIT` is on | **[IMPLEMENTED]** |
| 2 | `checkScanQuota` then `incrementScanCount` is read-then-write, not atomic — concurrent scans can exceed the monthly cap by a small margin | **[IMPLEMENTED]** |
| 3 | `GET /api/travel` returns every trip fully hydrated (capped at 200 trips) in one response; fine at current scale, noted in-code as needing summary+lazy loading if large accounts appear | **[IMPLEMENTED]** |
| 4 | `verifyWebhookToken` uses `===`, not a constant-time comparison, despite the comment calling it "constant-time-ish" | **[IMPLEMENTED]** |
| 5 | `POST /api/admin/cleanup` accepts `x-vercel-cron: 1` alone when `CLEANUP_TOKEN` is unset; the header is only trustworthy because Vercel strips inbound copies | **[INFERRED]** |
| 6 | `GET = POST` on the cleanup route means a GET performs destructive hard deletes | **[IMPLEMENTED]** |
| 7 | `/api/trips/*` (legacy relational) is unused by the shipped UI but remains fully writable | **[INFERRED]** |
