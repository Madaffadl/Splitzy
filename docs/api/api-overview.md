# Splitzy — API Overview

> Contract-level view of the HTTP surface. Per-endpoint detail is in [endpoints.md](./endpoints.md).
> Versioning strategy is in [../API_VERSIONING.md](../API_VERSIONING.md) and is **not** restated here.
>
> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**

---

## 1. Shape **[IMPLEMENTED]**

| Property | Value |
|---|---|
| Style | REST-ish, resource-oriented, JSON in / JSON out |
| Implementation | Next.js App Router route handlers — **40 files, 54 endpoints** |
| Server Actions | **None.** No `"use server"` anywhere in the repo |
| GraphQL / tRPC / OpenAPI spec | None |
| Base path | `/api` (no version prefix — see §9) |
| Runtime | Node.js. Many handlers declare `export const runtime = "nodejs"` explicitly, because Prisma cannot open Postgres connections from Edge |
| Proxy coverage | **None** — `src/proxy.ts` excludes `/api` from its matcher, so every handler authenticates itself |
| Consumers | Splitzy's own Next.js frontend, Vercel Cron, and Xendit's webhook. No public/third-party clients |

---

## 2. Endpoint inventory

54 endpoints across 14 resource families. `Auth` column: **—** public · **opt** optional ·
**✔** required · **owner/member/admin** role-gated · **machine** secret-authenticated.

| ID | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| API-001 | GET | `/api/health` | — | Liveness + readiness |
| API-002 | GET | `/api/auth/callback` | — | OAuth code exchange, user upsert |
| API-003 | GET | `/api/auth/me` | ✔ | Current user profile + `isAdmin` |
| API-004 | GET | `/api/me/quota` | ✔ | AI scan quota |
| API-005 | GET | `/api/me/referral` | ✔ | Referral code + stats (lazily mints the code) |
| API-006 | POST | `/api/activity` | ✔ | Client usage beacon |
| API-007 | GET | `/api/fx-rate` | — | IDR conversion rate |
| API-008 | POST | `/api/share` | opt | Create a read-only snapshot link |
| API-009 | GET | `/api/receipts` | ✔ | List saved splits (cursor or offset) |
| API-010 | POST | `/api/receipts` | ✔ | Save a split |
| API-011 | GET | `/api/receipts/[id]` | ✔ involved | Split detail |
| API-012 | PUT | `/api/receipts/[id]` | ✔ creator | Update a saved split |
| API-013 | DELETE | `/api/receipts/[id]` | ✔ creator | Soft-delete |
| API-014 | POST | `/api/receipts/[id]/restore` | ✔ creator | Un-delete |
| API-015 | GET | `/api/trips` | ✔ | List legacy trips |
| API-016 | POST | `/api/trips` | ✔ | Create a legacy trip |
| API-017 | GET | `/api/trips/[id]` | ✔ member | Trip metadata + members |
| API-018 | PUT | `/api/trips/[id]` | owner | Rename |
| API-019 | DELETE | `/api/trips/[id]` | owner | Soft-delete + cascade |
| API-020 | POST | `/api/trips/[id]/members` | owner | Add a member by email |
| API-021 | DELETE | `/api/trips/[id]/members` | owner | Remove a member |
| API-022 | GET | `/api/trips/[id]/receipts` | ✔ member | Paginated trip receipts |
| API-023 | POST | `/api/trips/[id]/receipts` | ✔ member | Add a relational receipt |
| API-024 | POST | `/api/trips/[id]/restore` | owner | Un-delete + cascade |
| API-025 | GET | `/api/travel` | ✔ | All trips, fully hydrated |
| API-026 | POST | `/api/travel` | ✔ | Create a trip (also guest→cloud sync) |
| API-027 | GET | `/api/travel/[id]` | ✔ member | Full trip |
| API-028 | PUT | `/api/travel/[id]` | owner | Name / budget / participants |
| API-029 | DELETE | `/api/travel/[id]` | owner | Soft-delete |
| API-030 | POST | `/api/travel/[id]/restore` | owner | Un-delete |
| API-031 | POST | `/api/travel/[id]/receipts` | owner | Add/upsert a receipt |
| API-032 | PUT | `/api/travel/[id]/receipts/[rid]` | owner | Replace a receipt |
| API-033 | DELETE | `/api/travel/[id]/receipts/[rid]` | owner | Remove a receipt |
| API-034 | POST | `/api/travel/[id]/payments` | owner | Record a settle-up |
| API-035 | DELETE | `/api/travel/[id]/payments/[pid]` | owner | Remove a settle-up |
| API-036 | GET | `/api/travel/[id]/invites` | owner | List active invites |
| API-037 | POST | `/api/travel/[id]/invites` | owner | Mint an invite token |
| API-038 | DELETE | `/api/travel/[id]/invites/[token]` | owner | Revoke |
| API-039 | GET | `/api/travel/[id]/change-requests` | ✔ member | Owner sees all, member sees own |
| API-040 | POST | `/api/travel/[id]/change-requests` | ✔ member | Submit a batch for review |
| API-041 | POST | `/api/travel/[id]/change-requests/[crid]/approve` | owner | Apply the batch |
| API-042 | POST | `/api/travel/[id]/change-requests/[crid]/decline` | owner | Reject |
| API-043 | GET | `/api/invite/[token]` | — | Invite landing info |
| API-044 | POST | `/api/invite/[token]/join` | ✔ | Join a trip |
| API-045 | POST | `/api/parse-receipt` | opt | AI receipt extraction |
| API-046 | POST | `/api/billing/checkout` | ✔ | Start a Xendit invoice |
| API-047 | POST | `/api/webhooks/xendit` | machine | Invoice status callback |
| API-048 | GET | `/api/cron/expire-pro` | machine | Daily Pro downgrade |
| API-049 | GET | `/api/admin/users` | admin | Paginated user list + global stats |
| API-050 | PATCH | `/api/admin/users/[id]` | admin | Plan / quota / ban / role |
| API-051 | GET | `/api/admin/users/[id]/trips` | admin | A user's owned trips |
| API-052 | GET | `/api/admin/activity` | admin | Activity feed + aggregates |
| API-053 | GET | `/api/admin/audit` | admin | Recent admin actions |
| API-054 | POST · GET | `/api/admin/cleanup` | machine | Retention sweep |

---

## 3. Request pipeline **[IMPLEMENTED]**

A convention, not a framework — each handler calls the steps explicitly. See
[../architecture/backend.md](../architecture/backend.md#3-the-handler-pipeline).

```
flag gate → assertSameOrigin → getAuthUser → enforceRateLimit
  → load minimal row → authorize → validate body → optimistic-lock write
  → best-effort side effects → respond
```

---

## 4. Error contract **[IMPLEMENTED]**

Every error response shares one shape, produced by `apiError()` in
[src/lib/api-response.ts](../../src/lib/api-response.ts):

```jsonc
{
  "error": "Human-readable message",   // may change; do not branch on it
  "code":  "VERSION_CONFLICT",         // stable machine identifier — branch on this
  "currentVersion": 7                  // optional context, merged in per-case
}
```

| `code` | HTTP | Extra context | Meaning |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | — | No session, or the account is banned |
| `FORBIDDEN` | 403 | — | Not owner / not admin / cross-origin blocked |
| `REVIEW_REQUIRED` | 403 | — | A Travel **member** attempted a direct write |
| `NOT_FOUND` | 404 | — | Missing, soft-deleted, or a dark feature flag |
| `VALIDATION_FAILED` | 400 | `field` | Validator rejection |
| `BAD_REQUEST` | 400 | `field?` | Malformed body or unusable state |
| `VERSION_CONFLICT` | 409 | `currentVersion` | Optimistic-lock mismatch |
| `RATE_LIMITED` | 429 | *(`Retry-After` header)* | Limiter |
| `QUOTA_EXCEEDED` | 429 | `remaining`, `resetAt` | Monthly AI scan cap |
| `PAYLOAD_TOO_LARGE` | 413 | — | Image > ~5 MB, share payload > 256 KB |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | — | Non-image MIME |
| `UPSTREAM_TIMEOUT` | 504 | — | Gemini exceeded 45 s — **transient, retry** |
| `INTERNAL_ERROR` | 500 | — | Anything else |

**[IMPLEMENTED]** Both `RATE_LIMITED` and `QUOTA_EXCEEDED` map to 429 — which is exactly why the
`code` field exists: the status alone cannot tell "slow down" from "you're out of scans this month".

**[IMPLEMENTED]** Not every response uses `apiError`. Four handlers return bare
`NextResponse.json({ error: … })` without a `code`:
`/api/auth/me` (401/404, `{ user: null }`), `/api/cron/expire-pro` (401/503),
`/api/admin/cleanup` (401/503), and `/api/trips/[id]/members` (a deliberately generic success).

---

## 5. Success conventions

| Situation | Convention | Examples |
|---|---|---|
| Resource created | `201` + `{ id }` or the created object | API-010, 016, 023, 026, 031, 034, 037, 040 |
| Share link created | `201` + `{ code, expiresAt, ttlDays }` | API-008 |
| Mutation acknowledged | `200` + `{ ok: true }` or `{ success: true }` | API-013, 019, 028, 029, 032 |
| Idempotent no-op | `200` + a boolean saying so | `{ restored: false }`, `{ alreadyMember: true }`, `{ alreadyProcessed: true }` |
| Telemetry accepted | **`202`** with an empty body | API-006 |
| List, offset mode | `{ data[], total, page, limit, hasMore }` | API-009, 022 |
| List, cursor mode | `{ data[], limit, hasMore, nextCursor }` — no `COUNT(*)` | API-009 |
| List, unpaginated | `{ <resource>: [...] }` | API-015, 025, 036, 039, 053 |
| Version echoed | `{ version }` on every write to a versioned row | API-010, 012, 018, 028 |

**[IMPLEMENTED]** `{ ok: true }` (travel routes) and `{ success: true }` (receipts/trips routes) are
two spellings of the same thing — an inconsistency between the two generations of handler.

---

## 6. Pagination **[IMPLEMENTED]**

Three styles coexist:

1. **Keyset / cursor** — `GET /api/receipts?cursor=<opaque>`. The cursor is
   base64url(`<ISO createdAt>|<id>`); the query uses a tuple inequality
   `(createdAt < c.createdAt) OR (createdAt = c.createdAt AND id < c.id)` and fetches `limit + 1`
   to detect `hasMore` without a second query. `O(log n)` regardless of depth.
2. **Offset** — `?page=&limit=` on `/api/receipts` (legacy mode) and `/api/trips/[id]/receipts`.
   Runs a `COUNT(*)` alongside.
3. **Prisma `cursor` + `skip: 1`** — `/api/admin/users`, ordered by `(createdAt DESC, id DESC)`.

Limits are clamped: `Math.min(50, Math.max(1, parseInt(limit) || 20))`; admin allows up to 100.

**[IMPLEMENTED]** Not paginated at all: `GET /api/travel` (capped at 200 trips, each fully hydrated),
`GET /api/trips`, `GET /api/travel/[id]/invites`, `GET /api/travel/[id]/change-requests` (`take: 100`),
`GET /api/admin/audit` (`take: 50`), `GET /api/admin/activity` (`take: 500` events, but with exact
DB-side aggregates so the summary is never truncated).

---

## 7. Rate limiting **[IMPLEMENTED]**

Key: `"<scope>:u:<userId>"` when authenticated, else `"<scope>:ip:<x-forwarded-for>"`. Default
60 requests / 60 s. Exceeding it returns `429 RATE_LIMITED` with a `Retry-After` header in seconds.

| Scope | Limit / min | Endpoint |
|---|---|---|
| `parse-receipt` | 10 | API-045 *(async — Upstash-capable)* |
| `billing:checkout` | 10 | API-046 *(async — Upstash-capable)* |
| `members:add` | 20 | API-020 |
| `receipts:restore`, `trips:restore` | 20 | API-014, 024 |
| `share:create` | 30 | API-008 |
| `receipts:delete`, `trips:delete`, `members:remove` | 30 | API-013, 019, 021 |
| `travel:invite` | 30 | API-037 |
| `admin:mutate` | 40 | API-050 |
| `activity` | 60 | API-006 |
| `travel:changereq` | 60 | API-040, 041, 042 |
| `receipts:create/update`, `trips:create/update`, `trip-receipts:create`, `travel:create` | 60 (default) | various |
| `travel:trip`, `travel:receipt`, `travel:payment` | 120 | API-028–035 |
| `admin:users`, `admin:trips`, `admin:activity`, `admin:audit` | 120 | API-049, 051, 052, 053 |

**Not rate-limited:** API-001 health, API-002 auth callback, API-003 me, API-004 quota,
API-005 referral, API-007 **fx-rate**, API-009/011 receipt reads, API-015/017/022 trip reads,
API-025/027 travel reads, API-036 invites list, API-039 change-request list, API-043 invite info,
API-044 join, API-047 webhook, API-048 cron, API-054 cleanup.

**[IMPLEMENTED]** Only two endpoints use `enforceRateLimitAsync`, so `FLAG_DISTRIBUTED_RATE_LIMIT`
currently affects those two alone; every other limit remains per-instance in-memory.

---

## 8. Cross-cutting behaviours

| Behaviour | Detail |
|---|---|
| **CSRF** | `assertSameOrigin` on every state-changing handler except the three machine-authenticated ones |
| **`X-API-Version: 1`** | Added to every `/api/*` response by `next.config.mjs` |
| **Caching** | None, except `Cache-Control: no-store` on `/api/health`. `/api/fx-rate` caches *upstream* results in-process for 1 hour |
| **CORS** | No CORS headers are set anywhere — the API is same-origin only by omission |
| **Content type** | `application/json` in and out. No multipart; the receipt image arrives as a base64 data URL in a JSON body |
| **Idempotency** | Per-endpoint: client-supplied ids + `upsert` (travel receipts), unique `external_id` (payments), unique `refereeId` (referrals), `upsert` on the composite key (join), atomic status claims (webhook, change-request review) |
| **Webhooks received** | Exactly one: `POST /api/webhooks/xendit` |
| **Webhooks sent** | None |

---

## 9. Versioning **[IMPLEMENTED]**

The current unversioned surface *is* v1. `X-API-Version: 1` is advertised on every response; the
literal in `next.config.mjs` duplicates `API_VERSION` in
[src/lib/api-version.ts](../../src/lib/api-version.ts) and the two must be bumped together, because
the config is `.mjs` and loads before any TypeScript transform.

Full rules — additive changes stay on v1, breaking changes get an `/api/v2` namespace, and the error
shape is part of the contract — are in [../API_VERSIONING.md](../API_VERSIONING.md).

---

## 10. Consumers **[IMPLEMENTED]**

| Consumer | Endpoints |
|---|---|
| `useAuth` | API-003 |
| `supabaseDataService` | API-009, 010, 011, 012 |
| `ReceiptHistoryList` / `ReceiptHistoryCard` | API-009, 013, 014 |
| `/history/[id]` | API-011 |
| `useTravelData` | API-025, 026, 027, 028, 029, 031, 032, 033, 034, 035, 039, 040, 041, 042 |
| `TravelSpendView` | API-036, 037, 038, plus everything `useTravelData` calls |
| `ReceiptInput` | API-045 |
| `ReceiptEditor` | API-007 |
| `SummaryPanel` | API-008 |
| `DashboardClient` | API-004, 005 |
| `UpgradeButton` | API-046 |
| `/invite/[token]` | API-043, 044 |
| `/admin` | API-049, 050, 051, 052, 053 |
| Client beacon (`logFeatureUsage`) | API-006 |
| Vercel Cron | API-048 |
| Xendit | API-047 |
| Uptime monitor **[UNKNOWN]** | API-001 |
| **No caller found** | API-015, 016, 017, 018, 019, 020, 021, 022, 023, 024 — the legacy `/api/trips/*` family, and API-054 cleanup |

**[INFERRED]** Ten of the 54 endpoints — the entire legacy relational trips API — have no caller in
the shipped frontend. They remain fully implemented and writable.

---

## 11. What the API does not have **[IMPLEMENTED]**

No OpenAPI/Swagger spec · no generated client · no API keys or machine-to-machine auth for external
callers · no CORS · no ETag/conditional requests · no `PATCH` anywhere except the admin user route
(everything else uses full `PUT`) · no bulk endpoints · no search beyond `?search=` on receipts ·
no file upload endpoint · no WebSocket (realtime uses Supabase Broadcast directly from the client).

---

## 12. Observations

| # | Observation | Label |
|---|---|---|
| 1 | Two parallel trip APIs (`/api/trips/*` relational, `/api/travel/*` payload); only the latter is used | **[INFERRED]** |
| 2 | `{ ok: true }` vs `{ success: true }` inconsistency between handler generations | **[IMPLEMENTED]** |
| 3 | `/api/fx-rate` is public, keyless and unrate-limited | **[IMPLEMENTED]** |
| 4 | `GET = POST` on `/api/admin/cleanup` — a GET performs destructive hard deletes | **[IMPLEMENTED]** |
| 5 | `GET /api/travel` returns everything hydrated in one response; the 200-trip cap is the only bound | **[IMPLEMENTED]** |
| 6 | Four handlers return errors without a `code`, breaking the otherwise-uniform contract | **[IMPLEMENTED]** |
| 7 | No OpenAPI spec, so the contract is only knowable by reading the handlers — which is what [endpoints.md](./endpoints.md) exists to fix | **[IMPLEMENTED]** |
