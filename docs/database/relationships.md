# Splitzy — Entity Relationships

> Source: [prisma/schema.prisma](../../prisma/schema.prisma).
> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**
>
> Every relationship below is **[IMPLEMENTED]** unless marked otherwise.

---

## 1. Complete relationship catalogue

| # | Parent | Child | Cardinality | FK column | `onDelete` | Prisma relation name |
|---|---|---|---|---|---|---|
| 1 | `User` | `Payment` | 1 : N | `payments.user_id` | **Cascade** | `UserPayments` |
| 2 | `User` | `Referral` (as referrer) | 1 : N | `referrals.referrer_id` | **Cascade** | `ReferralReferrer` |
| 3 | `User` | `Referral` (as referee) | **1 : 0..1** | `referrals.referee_id` **@unique** | **Cascade** | `ReferralReferee` |
| 4 | `User` | `Trip` | 1 : N | `trips.owner_id` | *(default `Restrict`)* | `TripOwner` |
| 5 | `User` | `TripMember` | 1 : N | `trip_members.user_id` | *(default `Restrict`)* | — |
| 6 | `User` | `Receipt` (as creator) | 1 : N | `receipts.created_by` | *(default `Restrict`)* | `ReceiptCreator` |
| 7 | `User` | `Receipt` (as payer) | 1 : N | `receipts.payer_id` | *(default `Restrict`)* | `ReceiptPayer` |
| 8 | `User` | `ItemAssignment` | 1 : N | `item_assignments.user_id` | *(default `Restrict`)* | — |
| 9 | `User` | `SharedSummary` | 1 : N | `shared_summaries.created_by` | **SetNull** | `SharedSummaryCreator` |
| 10 | `User` | `ActivityEvent` | 1 : N | `activity_events.user_id` | **Cascade** | `UserActivity` |
| 11 | `Trip` | `TripMember` | 1 : N | `trip_members.trip_id` | **Cascade** | — |
| 12 | `Trip` | `Receipt` | 1 : N (optional) | `receipts.trip_id` **nullable** | **Cascade** | — |
| 13 | `Trip` | `TripReceipt` | 1 : N | `trip_receipts.trip_id` | **Cascade** | — |
| 14 | `Trip` | `TripPayment` | 1 : N | `trip_payments.trip_id` | **Cascade** | — |
| 15 | `Trip` | `TripInvite` | 1 : N | `trip_invites.trip_id` | **Cascade** | — |
| 16 | `Trip` | `TripChangeRequest` | 1 : N | `trip_change_requests.trip_id` | **Cascade** | — |
| 17 | `Receipt` | `ReceiptItem` | 1 : N | `receipt_items.receipt_id` | **Cascade** | — |
| 18 | `ReceiptItem` | `ItemAssignment` | 1 : N | `item_assignments.item_id` | **Cascade** | — |

**Derived many-to-many** (via explicit join tables, not Prisma `@relation` implicit M:N):

| Association | Join table | Unique key |
|---|---|---|
| `User` ↔ `Trip` (membership) | `TripMember` | `@@unique([tripId, userId])` |
| `User` ↔ `ReceiptItem` (consumption) | `ItemAssignment` | `@@unique([itemId, userId])` |

---

## 2. Columns that look like foreign keys but are not **[IMPLEMENTED]**

This is the most important thing to understand before writing a query against this schema.

| Column | Table | Looks like | Actually is |
|---|---|---|---|
| `trip_receipts.created_by` | `TripReceipt` | FK → users | **Bare `uuid` column, no constraint, no relation** |
| `trip_payments.created_by` | `TripPayment` | FK → users | Bare column |
| `trip_invites.created_by` | `TripInvite` | FK → users | Bare column — the API resolves the creator with a separate `findUnique` |
| `trip_change_requests.author_id` | `TripChangeRequest` | FK → users | Bare column — `withAuthorNames()` resolves names in one extra query |
| `trip_change_requests.reviewed_by` | `TripChangeRequest` | FK → users | Bare column |
| `admin_audit_logs.actor_id` | `AdminAuditLog` | FK → users | **Deliberately FK-free** so the trail survives account deletion |
| `admin_audit_logs.target_user_id` | `AdminAuditLog` | FK → users | Same |
| `trip_payments.from_participant_id` / `to_participant_id` | `TripPayment` | FK → users | **Name-based participant ids from `Trip.participantsJson`** — a different namespace entirely |

**[INFERRED]** For the audit log the absence is documented and intentional. For the four
`created_by`/`author_id` columns on the Travel tables the schema gives no stated reason;
**[INFERRED]** they were likely omitted to keep the trip tables independent of `users` so a trip
survives contributor deletion — but the consequence is real: nothing prevents a `created_by`
pointing at a user id that no longer exists, and the application must always resolve names
defensively.

---

## 3. The two participant namespaces **[IMPLEMENTED]**

The schema contains **two completely separate notions of "a person"**, and they never join.

```
┌─────────────────────────────┐        ┌──────────────────────────────────┐
│  ACCOUNT NAMESPACE          │        │  PARTICIPANT NAMESPACE           │
│  users.id (uuid)            │        │  participant.id (arbitrary text) │
│                             │        │                                  │
│  · Trip.ownerId             │        │  · Trip.participantsJson[].id    │
│  · TripMember.userId        │   ✗    │  · Receipt.participantsJson[].id │
│  · Receipt.payerId          │  never │  · TripPayment.fromParticipantId │
│  · Receipt.createdById      │  joins │  · TripPayment.toParticipantId   │
│  · ItemAssignment.userId    │        │  · payload.items[].assignedToIds │
│  · SharedSummary.createdById│        │  · payload.discounts[].targetId  │
│                             │        │  · Receipt.payloadJson.payerId   │
│  "who may access this"      │        │  "who the bill is split between" │
└─────────────────────────────┘        └──────────────────────────────────┘
```

Consequences:

1. **You cannot SQL-join a split to the people in it.** Participant ids live inside `jsonb`.
2. **Referential integrity for participants is enforced only in application code** — every travel
   write passes `participantIds` (a `Set` built from `Trip.participantsJson`) into
   `validateTripReceiptPayload` / `validateTripPaymentInput`, which reject unknown ids.
3. **`Receipt.payerId` is misleading on a saved split.** `POST /api/receipts` sets it to
   `user.id` with the comment: *"the person who actually fronted the bill is a participant id inside
   the payload — this column is a User FK and can only ever mean 'whose account is this saved
   under'."*
4. **A removed participant can orphan a payment.** `applyPaymentsToBalances` guards this explicitly:
   a payment is applied only when **both** endpoints are still tracked participants, otherwise it
   would be half-applied and conservation would silently break.

---

## 4. Cascade behaviour

### 4.1 Hard delete cascades **[IMPLEMENTED]**

```
DELETE users            → payments ⨯ Cascade
                        → referrals (both sides) ⨯ Cascade
                        → activity_events ⨯ Cascade
                        → shared_summaries.created_by ← SET NULL (link survives)
                        → trips / trip_members / receipts / item_assignments ← RESTRICT (blocks)

DELETE trips            → trip_members ⨯
                        → trip_receipts ⨯
                        → trip_payments ⨯
                        → trip_invites ⨯
                        → trip_change_requests ⨯
                        → receipts ⨯ → receipt_items ⨯ → item_assignments ⨯

DELETE receipts         → receipt_items ⨯ → item_assignments ⨯
```

**[IMPLEMENTED]** Deleting a `User` who owns a trip, created a receipt, paid a receipt, is a trip
member, or has an item assignment is **refused by the database** (Prisma's default `Restrict`). No
application code performs user deletion, so this has never been exercised.
**[INFERRED]** An account-deletion feature — likely required for a privacy request — would need an
explicit multi-step teardown; the schema does not support it today.

### 4.2 Soft delete does **not** cascade **[IMPLEMENTED]**

Only `Trip` and `Receipt` carry `deletedAt`. Because a soft delete is an `UPDATE`, Postgres
`ON DELETE CASCADE` never fires — the application must cascade manually:

```ts
// DELETE /api/trips/[id] — one transaction so both disappear atomically
await prisma.$transaction([
  prisma.receipt.updateMany({ where: { tripId: id, deletedAt: null }, data: { deletedAt: now } }),
  prisma.trip.update({ where: { id }, data: { deletedAt: now } }),
]);
```

**Restore uses a 5-second correlation window.** `POST /api/trips/[id]/restore` only un-deletes
receipts whose `deletedAt` falls within ±5 s of the trip's, so receipts the user had deliberately
deleted *before* deleting the trip stay deleted:

```ts
const minCascadeDelete = new Date(tripDeletedAt.getTime() - 5_000);
const maxCascadeDelete = new Date(tripDeletedAt.getTime() + 5_000);
prisma.receipt.updateMany({
  where: { tripId: id, deletedAt: { gte: minCascadeDelete, lte: maxCascadeDelete } },
  data: { deletedAt: null, version: { increment: 1 } },
});
```

**[INFERRED]** This is a heuristic, not a guarantee: the correlation is timestamp proximity rather
than a recorded cascade id. A receipt deleted by coincidence within the same 5 seconds would be
restored along with the trip.

**[IMPLEMENTED]** `DELETE /api/travel/[id]` performs **no cascade at all** — it only sets
`Trip.deletedAt`. `TripReceipt`, `TripPayment`, `TripInvite` and `TripChangeRequest` have no
`deletedAt` column, so they remain visible in the database and only disappear once the trip is
hard-deleted 30 days later. Reads are safe because every travel query goes through `getTripAccess`,
which filters `deletedAt`.

### 4.3 Filtering discipline **[IMPLEMENTED]**

Every list and detail query filters `deletedAt: null`. Sampled verification:

| Query | Filter |
|---|---|
| `GET /api/receipts` | `{ deletedAt: null }` inside `baseWhere.AND` |
| `GET /api/trips` | `{ deletedAt: null }` inside `AND` |
| `GET /api/travel` | `deletedAt: null` |
| `getTripAccess` | `if (!trip \|\| trip.deletedAt) return null` |
| `_count` of receipts | `receipts: { where: { deletedAt: null } }` — otherwise the count overstates |
| Admin trip list | `{ ownerId: id, deletedAt: null }` — *"must match the drawer's trip list"* |

---

## 5. Referential integrity summary

| Layer | Enforced | Not enforced |
|---|---|---|
| **Database** | All 18 declared FKs; 6 unique constraints; 2 composite uniques | Anything inside `jsonb`; the 8 relation-less `uuid` columns |
| **Application** | Participant ids validated against `Trip.participantsJson` on every travel write; ops re-validated at approval; `assignedToIds` / `discount.targetId` checked against the participant/item sets | Historical rows written before a validator existed |
| **Not enforced anywhere** | — | `Receipt.shareCode` → `SharedSummary.code` (a plain string, no FK); `TripPayment.source` → `receiptId` (an encoded string) |

**[IMPLEMENTED]** `Receipt.shareCode` is a dangling reference by design: the `SharedSummary` it names
expires after 14 days while the receipt may live longer, so the code can point at a row that no
longer exists. `PUT /api/receipts/[id]` handles this gracefully — `sharedSummary.updateMany` matching
zero rows is a no-op.

---

## 6. Query patterns the indexes serve **[IMPLEMENTED]**

| Pattern | Index |
|---|---|
| "My saved splits, newest first" | `receipts(created_by, created_at DESC)` |
| "Receipts in this trip" | `receipts(trip_id)` |
| "Sweep lapsed saved splits" | `receipts(expires_at)` |
| "Hide deleted rows" | `receipts(deleted_at)`, `trips(deleted_at)` |
| "My trips, most recently updated" | `trips(owner_id, updated_at DESC)` |
| "All members of trip X" / "all trips user Y is in" | `trip_members(trip_id)`, `trip_members(user_id)` |
| "Pending change requests for this trip" | `trip_change_requests(trip_id, status)` |
| "Expire shared links" / "expire invites" | `shared_summaries(expires_at)`, *(none on `trip_invites.expires_at`)* |
| "Activity feed for a date range" | `activity_events(created_at DESC)` |
| "One user's activity" | `activity_events(user_id, created_at DESC)` |
| "Recent admin actions" | `admin_audit_logs(created_at DESC)` |
| "This user's payment history" | `payments(user_id, created_at DESC)` |

### Missing indexes worth noting

| Query | Current index | Note |
|---|---|---|
| Admin user list: `ORDER BY created_at DESC, id DESC` with `email`/`name` `contains` search | **none on `users.created_at`** | Full scan + sort on every admin page load. Small table today | **[IMPLEMENTED]** |
| Cleanup sweep of expired invites: `WHERE expires_at < now()` | **none on `trip_invites.expires_at`** | Full scan; the table is tiny | **[IMPLEMENTED]** |
| Receipt search: `title contains … mode: insensitive` | none | Sequential scan with `ILIKE '%…%'` — unindexable without trigram/GIN | **[IMPLEMENTED]** |
| Cleanup sweep of old activity: `WHERE created_at < cutoff` | `activity_events(created_at DESC)` | Covered | — |

---

## 7. Relationship-level observations

| # | Observation | Label |
|---|---|---|
| 1 | `Trip` is overloaded: it backs *two* receipt models (`receipts` relational, `tripReceipts` JSON) simultaneously | **[IMPLEMENTED]** |
| 2 | `Receipt` is overloaded: a trip receipt *and* a standalone saved split, distinguished by `tripId` being null and `payloadJson` being present | **[IMPLEMENTED]** |
| 3 | `Receipt.payerId` means different things in the two roles — bill-payer vs saved-by | **[IMPLEMENTED]** |
| 4 | Cascading a user deletion is impossible today (RESTRICT on five relations) | **[INFERRED]** |
| 5 | Travel soft-delete leaves children live in the DB for 30 days | **[IMPLEMENTED]** |
| 6 | Trip-restore cascade is timestamp-heuristic rather than a recorded operation | **[INFERRED]** |
| 7 | No FK guarantees a `TripPayment` references a real participant — only application validation does | **[IMPLEMENTED]** |
| 8 | `TripReceipt.id` is globally unique rather than scoped to `tripId` | **[IMPLEMENTED]** |

---

*See also: [entities.md](./entities.md) · [erd.md](./erd.md) · [data-model.md](./data-model.md)*
