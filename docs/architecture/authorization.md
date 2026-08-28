# Splitzy — Authorization

> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**
>
> Companion to [authentication.md](./authentication.md). *Authentication* answers "who are you";
> this document answers "what may you touch".

---

## 1. Where authorization lives **[IMPLEMENTED]**

**Entirely in application code.** Every check is a TypeScript guard inside a route handler or a
helper in `src/lib`. There is:

- No Supabase **Row Level Security** policy SQL anywhere in the repo — `prisma/sql/` contains only
  `CREATE TABLE` / `ALTER TABLE` / `CREATE INDEX` statements. **[UNKNOWN]** whether RLS is enabled
  in the live project; if it is, it was configured outside version control.
- No Prisma middleware / `$extends` interceptor.
- No policy engine, no CASL, no ability layer.
- Prisma connects with a full-privilege connection string (`DATABASE_URL`), so the database
  enforces nothing beyond foreign keys and unique constraints.

**[INFERRED]** Consequence: a missing guard in a single route handler is a full authorization
bypass, with no second line of defence. This is the single most load-bearing property of the
security model.

---

## 2. Principal types **[IMPLEMENTED]**

| Principal | How recognised | Capabilities |
|---|---|---|
| **Guest** | no session | `/single`, guest `/travel`, AI scan, create + view share links |
| **User** | valid session, `User` row exists, `bannedAt` null | own splits, own/joined trips, history, referrals, Pro purchase |
| **Trip owner** | `Trip.ownerId === user.id` | direct trip writes, members, invites, change-request review, delete/restore |
| **Trip member** | row in `TripMember` | read the trip; writes must go through a change request |
| **Admin** | `role === "admin"` ∨ email in `ADMIN_BOOTSTRAP_EMAILS` | `/admin` + `/api/admin/*` |
| **Banned user** | `bannedAt != null` | treated as **unauthenticated** by `getAuthUser` |
| **Machine callers** | `Authorization: Bearer <secret>` or `x-vercel-cron: 1` or `x-callback-token` | cron, cleanup, Xendit webhook |

There is no organisation, team, or tenant concept. **[IMPLEMENTED]**

---

## 3. Roles

### 3.1 Application role — `User.role` **[IMPLEMENTED]**

Values: `"user"` (default) and `"admin"`. Managed at runtime from the admin console
(`PATCH /api/admin/users/[id]` with `role`).

```ts
// src/lib/admin/admin-auth.ts
export function isAdmin(user: { email: string; role?: string | null }): boolean {
  return user.role === "admin" || isBootstrapAdmin(user.email);
}
```

**Bootstrap allowlist** — `ADMIN_BOOTSTRAP_EMAILS` (comma-separated, lowercased, trimmed) is
*always* admin regardless of the DB column. It is a deliberate lockout-recovery guard: it seeds the
first admin and lets an operator restore access by setting an env var if role data is lost. No email
is hardcoded in source; when the var is unset the set is empty and admin comes only from the column.

**[IMPLEMENTED]** A bootstrap admin's role cannot be revoked from the UI — the handler returns
`400 "Cannot revoke a bootstrap admin"`, because writing `role = "user"` would be a no-op that
misrepresents the audit trail.

**[IMPLEMENTED]** Note: [prisma/sql/add_user_role.sql](../../prisma/sql/add_user_role.sql) seeds one
specific email as admin in its final `UPDATE`. That is data, not code, but it does put a real
address in the repository.

### 3.2 Trip role — `TripMember.role` **[IMPLEMENTED]**

Values `"owner"` and `"member"`. Set to `"owner"` at trip creation and `"member"` on join. The
column is informational; the authoritative check is `Trip.ownerId === user.id`, computed in
`getTripAccess`.

---

## 4. Resource-by-resource matrix **[IMPLEMENTED]**

### 4.1 Saved split (`Receipt` with `payloadJson`)

| Action | Rule | Code |
|---|---|---|
| List (`GET /api/receipts`) | Rows where the user is **involved**: `createdById` ∨ `payerId` ∨ has an `ItemAssignment` ∨ is a member of the receipt's trip. `deletedAt: null` always | `baseWhere` in `receipts/route.ts` |
| Read (`GET /api/receipts/[id]`) | Same "involved" test, then a `TripMember` lookup as a fallback if the receipt belongs to a trip | auth-first select |
| Create | Any authenticated user | — |
| Update / Delete / Restore | **`createdById === user.id` only** — payer and assignees cannot write | `forbidden()` |

Soft-deleted rows return **404, not 403** — they no longer exist for the caller.

### 4.2 Legacy trip (`/api/trips/*`)

| Action | Rule |
|---|---|
| List | `ownerId === user.id` ∨ `members.some(userId)` , `deletedAt: null` |
| Read detail | owner ∨ member → else 403 |
| Update (name) | **owner only** |
| Delete / Restore | **owner only** |
| Add member | **owner only** |
| Remove member | **owner only**; the owner cannot be removed (`400`) |
| List/create receipts in trip | **any member** (`TripMember` lookup) |

### 4.3 Travel trip (`/api/travel/*`) — the approval model

`getTripAccess(tripId, userId)` returns `{ id, ownerId, version, role }` or `null`.
`null` covers *both* "does not exist" and "no access", and every caller answers **404** — so trip
existence is not disclosed to non-members. `requireOwnerWrite(access)` returns
`403 REVIEW_REQUIRED` for members.

| Endpoint | Owner | Member | Non-member |
|---|---|---|---|
| `GET /api/travel` (list) | own + joined trips | own + joined trips | — |
| `GET /api/travel/[id]` | ✅ | ✅ | 404 |
| `PUT /api/travel/[id]` | ✅ | `403 REVIEW_REQUIRED` | 404 |
| `DELETE /api/travel/[id]` | ✅ | 403 | 404 |
| `POST /api/travel/[id]/restore` | ✅ | 403 | 404 |
| `POST/PUT/DELETE …/receipts…` | ✅ | `403 REVIEW_REQUIRED` | 404 |
| `POST/DELETE …/payments…` | ✅ | `403 REVIEW_REQUIRED` | 404 |
| `GET/POST …/invites`, `DELETE …/invites/[token]` | ✅ | 403 "Only the trip owner…" | 404 |
| `GET …/change-requests` | **all** requests for the trip | **only their own** (`authorId: user.id` filter) | 404 |
| `POST …/change-requests` | ✅ (owners can, though they'd normally write directly) | ✅ — the intended path | 404 |
| `…/change-requests/[crid]/approve` \| `/decline` | ✅ | 403 | 404 |

**[IMPLEMENTED]** The change-request flow is the authorization design, not a convenience:
`buildChangeOpsWrites` re-validates every op against the **live** participant set at approval time,
threading a mid-batch `participants.set` through, so a stale proposal cannot smuggle a reference to
a participant the owner has since deleted.

### 4.4 Invites

| Endpoint | Rule |
|---|---|
| `GET /api/invite/[token]` | **Public, unauthenticated.** *"the token IS the secret"*. Returns trip name + inviter name. Rejects expired invites and soft-deleted trips |
| `POST /api/invite/[token]/join` | Authenticated; token validity is the only authorization. Idempotent via `tripMember.upsert`. Owner joining is a no-op |

Tokens: `crypto.randomBytes(16).toString("base64url")` (128 bits), 7-day TTL, revocable by the
owner, and hard-deleted by the cleanup job the moment they expire. **[IMPLEMENTED]**

### 4.5 Share links

| Endpoint | Rule |
|---|---|
| `POST /api/share` | **Auth optional** — guests may create links (`createdById` null), because trip mode works without an account. Rate-limited 30/min |
| `/s/[code]` | Public read. Unguessable 8-char code from a 58-symbol alphabet; 14-day TTL; expired links render a distinct "expired" state |
| `/share#<payload>` | Fully client-side; the payload never reaches the server |

**[IMPLEMENTED]** One authorization subtlety inside `POST /api/share`: the optional `receiptId`
back-link is written with
`receipt.updateMany({ where: { id: receiptId, createdById: user.id, deletedAt: null } })` — scoped
to rows the caller owns, so a forged id cannot attach a share code to someone else's split.

### 4.6 Admin

Every `/api/admin/*` handler begins with:

```ts
const user = await getAuthUser(request);
if (!user || !isAdmin(user)) return forbidden();
```

Note it returns **403, not 401**, for anonymous callers too. **[IMPLEMENTED]**

`PATCH /api/admin/users/[id]` self-protection rules:

- An admin **may** change their own plan and quota (harmless).
- An admin **may not** ban themselves — `403 "You can't ban your own account"`.
- An admin **may not** revoke their own admin role — `403 "You can't revoke your own admin role"`.
- A bootstrap admin's role cannot be revoked by anyone — `400`.

Every mutation is written to `AdminAuditLog` **in the same transaction** as the update, so an action
that cannot be recorded is never applied.

### 4.7 Machine endpoints

| Endpoint | Authentication | Fail-closed behaviour |
|---|---|---|
| `GET /api/cron/expire-pro` | `Authorization: Bearer ${CRON_SECRET}`, exact string compare | `503` when `CRON_SECRET` is unset; `401` on mismatch |
| `POST/GET /api/admin/cleanup` | `Authorization: Bearer ${CLEANUP_TOKEN}` **or** `x-vercel-cron: 1` | `503` when the token is unset *and* the header is absent; `401` on mismatch |
| `POST /api/webhooks/xendit` | `x-callback-token === XENDIT_WEBHOOK_TOKEN` | `404` when the flag or token is unconfigured; `401` on mismatch |

---

## 5. Feature-flag gating as authorization **[IMPLEMENTED]**

Two endpoints and one page treat "flag off" as "does not exist":

- `POST /api/billing/checkout` → `404 NOT_FOUND` when `FLAG_XENDIT_CHECKOUT` is off, *before* any
  other check. The comment is explicit: *"the endpoint doesn't exist for users until we deliberately
  turn revenue on."*
- `POST /api/webhooks/xendit` → same.
- `/pricing` → `notFound()` when `NEXT_PUBLIC_FLAG_PRICING_PAGE` is off, and
  [sitemap.ts](../../src/app/sitemap.ts) asks the same question so it never advertises a 404.

**[IMPLEMENTED]** Public flags are visible to the browser by construction; `flags.ts` states the
rule — *"never gate a secret with one, only gate UI. Secrets always stay server-side regardless of
flags."* The two revenue endpoints are gated with **server** flags precisely for that reason.

---

## 6. IDOR analysis

Documented as patterns; nothing was exploited or probed.

### 6.1 Patterns that are safe **[IMPLEMENTED]**

| Pattern | Where | Why it holds |
|---|---|---|
| Scoped `updateMany`/`deleteMany` — the owner predicate is in the `WHERE`, so a wrong id affects 0 rows | `tripReceipt.updateMany({ id: rid, tripId: id })`, `tripPayment.deleteMany({ id: pid, tripId: id })`, `tripInvite.deleteMany({ token, tripId: id })`, `receipt.updateMany({ id, createdById: user.id })` | The check and the write are one statement — no TOCTOU window |
| Load-then-check with a minimal select, then act | receipts, trips, admin | Standard, and correct in every handler reviewed |
| `getTripAccess` before every travel operation | all 18 travel handlers | Uniformly applied |
| 404-not-403 for non-members | `getTripAccess` returning `null` | No existence oracle |
| Nested ids validated against the parent | `[rid]`/`[pid]`/`[crid]` always paired with `tripId` in the `WHERE` | A valid id from another trip does not match |

### 6.2 Patterns worth flagging

| # | Pattern | Assessment | Label |
|---|---|---|---|
| 1 | `GET /api/invite/[token]` is unauthenticated and leaks the trip name plus the inviter's display name (falling back to their **email**) to anyone holding the link | By design — the token is the secret — but a leaked link discloses an email address | **[IMPLEMENTED]** |
| 2 | `POST /api/travel/[id]/change-requests` is open to any member, and ops are only fully validated at approval time. A member can queue arbitrary proposals | Mitigated: nothing is applied without owner approval, and `MAX_CHANGE_OPS = 200` bounds the batch | **[IMPLEMENTED]** |
| 3 | `PUT /api/receipts/[id]` refreshes the linked `SharedSummary` by `shareCode` **without** re-checking who owns that summary | Not exploitable today: `shareCode` is only ever written by `POST /api/share` under a `createdById`-scoped `updateMany`, so a receipt can only carry a code it legitimately minted | **[INFERRED]** |
| 4 | `DELETE /api/trips/[id]/members` validates the target `userId` shape with a UUID regex but performs no membership-existence check before the ownership check — the existence check follows, returning 404 | Correct as written | **[IMPLEMENTED]** |
| 5 | Legacy `/api/trips/*` remains fully writable although the shipped UI never calls it | Guarded identically to the travel routes; the exposure is surface area, not a hole | **[INFERRED]** |
| 6 | `/api/auth/me` returns the profile of a **banned** user, unlike every other endpoint | Inconsistency; no data beyond the caller's own profile is exposed | **[IMPLEMENTED]** |

### 6.3 Structural risks

| # | Risk | Label |
|---|---|---|
| 1 | **No database-level authorization.** Every guard is application code; there is no RLS backstop | **[UNKNOWN]** whether RLS exists in the project; **[IMPLEMENTED]** that none is in the repo |
| 2 | **No automated authorization tests.** 30 unit test files cover money math, validation and entitlements; none assert that a non-owner receives 403/404 | **[IMPLEMENTED]** |
| 3 | **Guard-by-convention.** A new route handler is only secure if its author remembers all seven pipeline steps — there is no wrapper enforcing them | **[IMPLEMENTED]** |
| 4 | Banning does not revoke existing sessions; it is enforced at read time by `getAuthUser` | **[IMPLEMENTED]** |
| 5 | `SUPABASE_SERVICE_ROLE_KEY` is used for realtime broadcast. It is server-only and never sent to the client, but it is a full-bypass key held in the same environment as the app | **[IMPLEMENTED]** |

---

## 7. Recommendations

Ordered by value-to-effort. Nothing here has been applied — this is a documentation pass.

1. **Add authorization regression tests.** The highest-value gap: a handful of tests asserting
   403/404 for non-owner, non-member, and non-admin callers on each resource family would lock in
   behaviour that is currently only guaranteed by review.
2. **Enable RLS on Supabase as defence in depth**, at minimum on `receipts`, `trips`,
   `trip_receipts`, `trip_payments` and `shared_summaries` — and commit the policy SQL to
   `prisma/sql/` so it is version-controlled like everything else.
3. **Extract the pipeline into a wrapper** (`withAuth(handler, { csrf, rateLimit, requireAdmin })`)
   so a new route cannot silently omit a step.
4. **Apply the ban guard to `/api/auth/me`** for consistency.
5. **Decide on the guest AI-scan path** — either accept the cost explicitly or add an IP/day cap
   beyond the current 10/minute.
6. **Use a constant-time comparison** for `XENDIT_WEBHOOK_TOKEN` and `CRON_SECRET`.
7. **Move the seeded admin email** out of `prisma/sql/add_user_role.sql` and rely on
   `ADMIN_BOOTSTRAP_EMAILS`.
