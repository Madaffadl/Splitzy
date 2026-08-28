# Splitzy — Database Entities

> Source of truth: [prisma/schema.prisma](../../prisma/schema.prisma) (15 models) and the hand-applied
> SQL in [prisma/sql/](../../prisma/sql/).
> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**
>
> Unless stated otherwise, every fact below is **[IMPLEMENTED]** — read directly from the schema.
> Interpretation of *business meaning* is labelled where it goes beyond what the schema states.

---

## Conventions used throughout

| Convention | Detail |
|---|---|
| Primary keys | `String @id @default(uuid()) @db.Uuid` on every model except `TripReceipt` (client-supplied id) and `TripInvite` (the token is the PK) |
| Column naming | camelCase in Prisma, `snake_case` in Postgres via `@map`; every model has `@@map` to a plural snake_case table |
| Audit fields | `createdAt` (`@default(now())`) on all 15 models; `updatedAt` (`@updatedAt`) on 6 |
| Soft delete | `deletedAt DateTime?` on `Trip` and `Receipt` only |
| Optimistic locking | `version Int @default(1)` on `Trip` and `Receipt` only |
| Money | `Float` for all amounts except `Payment.amount`, which is `Int` (whole rupiah — IDR has no minor units) |
| JSON | `Json` / `Json?` — used for participant snapshots, receipt payloads, change-request ops, and metadata |

---

## 1. `User` → `users`

**Purpose.** The application's own account record, one-to-one with a Supabase auth identity. Holds
plan, quota, referral, moderation and role state.

| Field | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `uuid` | no | `uuid()` | PK |
| `email` | `email` | `text` | no | — | **@unique** |
| `name` | `name` | `text` | yes | — | From Google `full_name`/`name` |
| `avatarUrl` | `avatar_url` | `text` | yes | — | From Google `avatar_url`/`picture` |
| `googleId` | `google_id` | `text` | yes | — | **@unique** — the Supabase auth user id; the join key for `getAuthUser` |
| `plan` | `plan` | `text` | no | `"free"` | `"free"` \| `"pro"` |
| `aiScanCount` | `ai_scan_count` | `int` | no | `0` | Scans used in the current window |
| `aiScanResetAt` | `ai_scan_reset_at` | `timestamp(3)` | yes | — | Start of the next window; set lazily on the first scan |
| `aiScanLimit` | `ai_scan_limit` | `int` | yes | — | Per-user override; `null` = plan default (15 free, ∞ pro) |
| `proExpiresAt` | `pro_expires_at` | `timestamp(3)` | yes | — | `null` = not on a timed plan (free, or admin-comped Pro that never expires) |
| `referralCode` | `referral_code` | `text` | yes | — | **@unique**; generated lazily on first `GET /api/me/referral` |
| `bannedAt` | `banned_at` | `timestamp(3)` | yes | — | Non-null ⇒ `getAuthUser` returns `null` |
| `role` | `role` | `text` | no | `"user"` | `"user"` \| `"admin"` |
| `lastLoginAt` | `last_login_at` | `timestamp(3)` | yes | — | Set by the auth callback; powers the admin "active today" view without scanning the activity log |
| `createdAt` | `created_at` | `timestamp(3)` | no | `now()` | |
| `updatedAt` | `updated_at` | `timestamp(3)` | no | `@updatedAt` | |

**Constraints:** unique on `email`, `googleId`, `referralCode`.
**Indexes:** the three unique constraints only — no additional `@@index`.

**Relations (11 outbound):** `referrals` (`Referral[]` as referrer) · `referredBy` (`Referral?` as
referee) · `ownedTrips` (`Trip[]`) · `tripMemberships` (`TripMember[]`) · `createdReceipts`
(`Receipt[]`) · `paidReceipts` (`Receipt[]`) · `itemAssignments` (`ItemAssignment[]`) ·
`sharedSummaries` (`SharedSummary[]`) · `activityEvents` (`ActivityEvent[]`) · `payments`
(`Payment[]`).

**Business meaning.** Everything monetisable and everything moderatable hangs off this row. Note
that a *participant in a split is not a `User`* — participants are name-based objects inside JSON
payloads. This distinction is the single most important thing to understand about the schema.

---

## 2. `Payment` → `payments`

**Purpose.** One row per Xendit invoice for a Pro purchase.

| Field | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `uuid` | no | `uuid()` | PK |
| `userId` | `user_id` | `uuid` | no | — | FK → `users.id`, **onDelete: Cascade** |
| `externalId` | `external_id` | `text` | no | — | **@unique** — our idempotency key, sent to Xendit as `external_id` (`pro_<userId>_<epoch>`) |
| `xenditId` | `xendit_id` | `text` | yes | — | **@unique** — Xendit's invoice id |
| `amount` | `amount` | `int` | no | — | Whole rupiah, e.g. `29000` |
| `currency` | `currency` | `text` | no | `"IDR"` | |
| `status` | `status` | `text` | no | `"pending"` | `pending` \| `paid` \| `expired` \| `failed` |
| `plan` | `plan` | `text` | no | `"pro"` | |
| `periodDays` | `period_days` | `int` | no | `30` | Entitlement granted per payment |
| `invoiceUrl` | `invoice_url` | `text` | yes | — | Hosted Xendit checkout URL |
| `paidAt` | `paid_at` | `timestamp(3)` | yes | — | Set by the webhook |
| `createdAt` / `updatedAt` | | `timestamp(3)` | no | `now()` / `@updatedAt` | |

**Indexes:** `@@index([userId, createdAt DESC])`.

**Business meaning.** The row is created **before** the Xendit call so the webhook always has
something to reconcile against, even if the API response is lost. `externalId` uniqueness plus the
atomic status claim make duplicate webhook deliveries a no-op.

---

## 3. `Referral` → `referrals`

**Purpose.** One row per successful referral; a new user can only be referred once.

| Field | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `uuid` | no | `uuid()` | PK |
| `referrerId` | `referrer_id` | `uuid` | no | — | FK → `users.id`, **Cascade** |
| `refereeId` | `referee_id` | `uuid` | no | — | FK → `users.id`, **Cascade**, **@unique** |
| `createdAt` | `created_at` | `timestamp(3)` | no | `now()` | |
| `rewardedAt` | `rewarded_at` | `timestamp(3)` | yes | — | Set when the reward is granted |
| `rewardDays` | `reward_days` | `int` | no | `14` | Matches `REFERRAL_REWARD_DAYS` |

**Indexes:** `@@index([referrerId])`.

**Business meaning.** The unique constraint on `refereeId` *is* the idempotency mechanism —
`processReferral` catches the constraint violation and returns silently.
**[IMPLEMENTED]** Note the SQL migration declares `created_at`/`rewarded_at` as `TIMESTAMPTZ` while
Prisma models them as `DateTime` (which it maps to `timestamp(3)` elsewhere) — a minor schema-drift
inconsistency between `prisma/sql/2026-08-add-referrals.sql` and the rest of the schema.

---

## 4. `Trip` → `trips`

**Purpose.** A collaborative container. Serves **both** the legacy relational path (`receipts`) and
the current Travel Spend path (`tripReceipts` + `participantsJson`).

| Field | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `uuid` | no | `uuid()` | PK |
| `name` | `name` | `text` | no | — | Capped at 200 chars in the API |
| `ownerId` | `owner_id` | `uuid` | no | — | FK → `users.id`, **no cascade declared** (restrict) |
| `version` | `version` | `int` | no | `1` | Optimistic lock |
| `deletedAt` | `deleted_at` | `timestamp(3)` | yes | — | Soft delete |
| `createdAt` / `updatedAt` | | `timestamp(3)` | no | `now()` / `@updatedAt` | |
| `budget` | `budget` | `double` | yes | — | Optional trip spend target |
| `participantsJson` | `participants_json` | `jsonb` | yes | — | **Name-based participant snapshot** — the split targets, distinct from `members` |

**Indexes:** `@@index([ownerId, updatedAt DESC])` (list + pagination), `@@index([deletedAt])`.

**Relations:** `owner` · `members` (`TripMember[]`) · `receipts` (`Receipt[]`, legacy) ·
`tripReceipts` (`TripReceipt[]`, current) · `tripPayments` · `invites` · `changeRequests`.

**Business meaning.** Two distinct populations coexist on one row and must not be confused:

- **`participantsJson`** — the *people the bill is split between*, name-based, mostly without
  accounts.
- **`members`** — the *accounts allowed to view/edit the trip*.

**[IMPLEMENTED]** `ownerId` declares no `onDelete`, so Prisma's default (`Restrict`) applies:
deleting a user who owns trips is refused at the database level.

---

## 5. `TripReceipt` → `trip_receipts`

**Purpose.** One Travel Spend receipt, stored as a JSON payload in the client's `Receipt` shape.

| Field | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `text` | no | **none** | PK — **client-generated**, equals `receipt.id` |
| `tripId` | `trip_id` | `uuid` | no | — | FK → `trips.id`, **Cascade** |
| `payload` | `payload` | `jsonb` | no | — | The whole `Receipt`: items, per-person assignments, fees, discounts, currency, fxRate |
| `sortOrder` | `sort_order` | `int` | no | `0` | |
| `createdById` | `created_by` | `uuid` | yes | — | **No FK relation declared** — a bare column |
| `createdAt` / `updatedAt` | | `timestamp(3)` | no | `now()` / `@updatedAt` | |

**Indexes:** `@@index([tripId])`.

**Business meaning.** The schema comment states the reason for JSON over relational: *"the split
model doesn't fight the User-FK assumptions of the legacy normalized Receipt table. One row per
receipt keeps concurrent adds independent and makes realtime granular later."*

**[IMPLEMENTED]** Because `id` has **no database default**, the client must supply it. This is
deliberate — it makes `POST /api/travel/[id]/receipts` an idempotent `upsert`, which is what lets
the offline outbox replay an op any number of times safely.

**[IMPLEMENTED]** `id` is globally unique, not scoped to `tripId`. The upsert matches on `id` alone
before the `tripId` is applied, so a collision across trips is theoretically possible; in practice
ids are client-generated randoms.

---

## 6. `TripPayment` → `trip_payments`

**Purpose.** The settle-up ledger. Append-only record of "participant A handed money to
participant B".

| Field | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `uuid` | no | `uuid()` | PK |
| `tripId` | `trip_id` | `uuid` | no | — | FK → `trips.id`, **Cascade** |
| `fromParticipantId` | `from_participant_id` | `text` | no | — | **Name-based participant id — not a User FK** |
| `toParticipantId` | `to_participant_id` | `text` | no | — | Same |
| `amount` | `amount` | `double` | no | — | Native amount in `currency` |
| `currency` | `currency` | `text` | yes | — | `null` ⇒ IDR |
| `fxRate` | `fx_rate` | `double` | yes | — | 1 unit of `currency` = `fxRate` IDR |
| `note` | `note` | `text` | yes | — | |
| `source` | `source` | `text` | yes | — | `null` = manual settle-up; `"share:<receiptId>:<participantId>"` = a per-receipt "mark my share paid" checkbox |
| `createdById` | `created_by` | `uuid` | yes | — | No FK relation |
| `createdAt` | `created_at` | `timestamp(3)` | no | `now()` | |

**Indexes:** `@@index([tripId])`.

**Business meaning.** This table is the **single source of truth for what has been settled**. The
`source` encoding is what lets the UI render a receipt-level checkbox while keeping one ledger:
without it, a manual "A paid B 200k" plus ticking A's receipt shares double-counted the same debt.

---

## 7. `TripInvite` → `trip_invites`

**Purpose.** A shareable link token that grants membership of a trip.

| Field | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `token` | `token` | `text` | no | — | **PK** — 16 random bytes, base64url |
| `tripId` | `trip_id` | `uuid` | no | — | FK → `trips.id`, **Cascade** |
| `role` | `role` | `text` | no | `"member"` | Role granted on join |
| `createdById` | `created_by` | `uuid` | yes | — | No FK relation |
| `expiresAt` | `expires_at` | `timestamp(3)` | no | — | 7 days from creation |
| `createdAt` | `created_at` | `timestamp(3)` | no | `now()` | |

**Indexes:** `@@index([tripId])`.

**Business meaning.** The token *is* the credential — `GET /api/invite/[token]` is unauthenticated.
Expired rows are hard-deleted by the cleanup job the moment they lapse, independent of the
soft-delete retention window.

---

## 8. `TripMember` → `trip_members`

**Purpose.** Join table: which accounts may access which trips.

| Field | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `uuid` | no | `uuid()` | PK |
| `tripId` | `trip_id` | `uuid` | no | — | FK → `trips.id`, **Cascade** |
| `userId` | `user_id` | `uuid` | no | — | FK → `users.id`, **no cascade** (restrict) |
| `role` | `role` | `text` | no | `"member"` | `"owner"` \| `"member"` |
| `joinedAt` | `joined_at` | `timestamp(3)` | no | `now()` | |

**Constraints:** `@@unique([tripId, userId])` — the composite key used by every `upsert`/lookup.
**Indexes:** `@@index([tripId])`, `@@index([userId])`.

**Business meaning.** Membership, not participation. The `role` column is informational; ownership
is authoritative via `Trip.ownerId`.

---

## 9. `TripChangeRequest` → `trip_change_requests`

**Purpose.** A member's proposed batch of edits awaiting owner review — a PR-style workflow.

| Field | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `uuid` | no | `uuid()` | PK |
| `tripId` | `trip_id` | `uuid` | no | — | FK → `trips.id`, **Cascade** |
| `authorId` | `author_id` | `uuid` | no | — | **No FK relation** — names are resolved with a separate query |
| `status` | `status` | `text` | no | `"pending"` | `pending` → `approved` \| `declined`; `superseded` reserved |
| `baseVersion` | `base_version` | `int` | no | — | The `Trip.version` the proposal was built against |
| `ops` | `ops` | `jsonb` | no | — | Serialized `ChangeOp[]` |
| `note` | `note` | `text` | yes | — | Author's message, ≤ 500 chars |
| `reviewNote` | `review_note` | `text` | yes | — | Owner's decline reason, ≤ 500 chars |
| `reviewedById` | `reviewed_by` | `uuid` | yes | — | No FK relation |
| `createdAt` | `created_at` | `timestamp(3)` | no | `now()` | |
| `reviewedAt` | `reviewed_at` | `timestamp(3)` | yes | — | |

**Indexes:** `@@index([tripId, status])` — the owner-inbox query.

**Business meaning.** Approval is **last-write-wins**: `baseVersion` is recorded but not enforced.
A mismatch is surfaced to the reviewer as a warning, and the ops are re-validated against the trip's
*current* participant set at approval time.

**[IMPLEMENTED]** `ops` is validated by `validateChangeOps` on submit (≤ `MAX_CHANGE_OPS` = 200) and
again by `buildChangeOpsWrites` on approve.

---

## 10. `Receipt` → `receipts`

**Purpose.** Dual-role. Historically a normalized trip receipt; now also the storage for a **saved
Single/Multiple split** via `payloadJson`.

| Field | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `uuid` | no | `uuid()` | PK |
| `tripId` | `trip_id` | `uuid` | yes | — | FK → `trips.id`, **Cascade**. `null` for a standalone saved split |
| `title` | `title` | `text` | no | — | |
| `payerId` | `payer_id` | `uuid` | no | — | FK → `users.id`. For a saved split this is *"whose account is this saved under"*, **not** who fronted the bill |
| `tax` | `tax` | `double` | no | `0` | Legacy column; saved splits write `0` and store the real value in the payload |
| `service` | `service` | `double` | no | `0` | Same |
| `date` | `date` | `timestamp(3)` | yes | — | |
| `participantsJson` | `participants_json` | `jsonb` | yes | — | Name-based participant snapshot |
| `payloadJson` | `payload_json` | `jsonb` | yes | — | **The authoritative document** — the complete client split (items + per-person assignments, fees, discounts, currency, locked fxRate). `null` on legacy rows |
| `expiresAt` | `expires_at` | `timestamp(3)` | yes | — | Saved-split TTL, reset on every save. `null` = never expires (trip receipts) |
| `shareCode` | `share_code` | `text` | yes | — | The `SharedSummary.code` minted for this split, if any |
| `createdById` | `created_by` | `uuid` | no | — | FK → `users.id`. **The only column that grants write access** |
| `version` | `version` | `int` | no | `1` | Optimistic lock |
| `deletedAt` | `deleted_at` | `timestamp(3)` | yes | — | Soft delete |
| `createdAt` / `updatedAt` | | `timestamp(3)` | no | `now()` / `@updatedAt` | |

**Indexes:** `@@index([createdById, createdAt DESC])`, `@@index([tripId])`, `@@index([payerId])`,
`@@index([deletedAt])`, `@@index([expiresAt])`.

**Relations:** `trip` · `payer` · `createdBy` · `items` (`ReceiptItem[]`).

**Business meaning — why `payloadJson` exists.** Quoted from the schema:

> *The relational columns above cannot represent a real split: `ItemAssignment` has a foreign key to
> `User`, so it can only say "an account holder consumed this", while a split is between arbitrary
> named people who mostly have no account. Importing a guest split therefore dropped every
> assignment, fee and discount on the floor.*

**[IMPLEMENTED]** `shareCode` was moved onto the row because the client used to hold it in component
state, so a remount silently minted a rival link showing different numbers.

**[IMPLEMENTED]** Saved splits are explicitly *not* an archive: they lapse
`SAVED_SPLIT_TTL_DAYS = 7` after the **last save** and are hard-deleted. The durable record of a
finished split is the exported text the user pastes into WhatsApp.

---

## 11. `ReceiptItem` → `receipt_items`

**Purpose.** One line item of a *relational* receipt. Legacy — saved splits and Travel receipts
create none.

| Field | Column | Type | Null | Default |
|---|---|---|---|---|
| `id` | `id` | `uuid` | no | `uuid()` |
| `receiptId` | `receipt_id` | `uuid` | no | — (FK → `receipts.id`, **Cascade**) |
| `name` | `name` | `text` | no | — |
| `qty` | `qty` | `int` | no | `1` |
| `unitPrice` | `unit_price` | `double` | no | — |
| `total` | `total` | `double` | no | — |
| `sortOrder` | `sort_order` | `int` | no | `0` |

**Indexes:** `@@index([receiptId])`.
**Relations:** `receipt` · `assignments` (`ItemAssignment[]`).

**[IMPLEMENTED]** Consequence for reporting: `_count.items` reads `0` for every payload-backed row,
which is why `GET /api/receipts` counts items out of the payload instead.

---

## 12. `ItemAssignment` → `item_assignments`

**Purpose.** Which **account holder** consumed a relational line item.

| Field | Column | Type | Null | Default |
|---|---|---|---|---|
| `id` | `id` | `uuid` | no | `uuid()` |
| `itemId` | `item_id` | `uuid` | no | — (FK → `receipt_items.id`, **Cascade**) |
| `userId` | `user_id` | `uuid` | no | — (FK → `users.id`, **no cascade**) |

**Constraints:** `@@unique([itemId, userId])`.
**Indexes:** `@@index([itemId])`, `@@index([userId])`.

**Business meaning.** This table is the reason the relational model cannot express a real split: the
FK to `users` means a participant must have an account. It is retained for legacy rows and is used
in the "am I involved in this receipt" access check.

---

## 13. `SharedSummary` → `shared_summaries`

**Purpose.** An immutable-by-default, point-in-time snapshot of a split, published at `/s/<code>`.

| Field | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `uuid` | no | `uuid()` | PK |
| `code` | `code` | `text` | no | — | **@unique** — the public short code (8 chars, 58-symbol alphabet) |
| `payload` | `payload` | `jsonb` | no | — | `{ v, type, title, participants, receipts }`, validated before write |
| `createdById` | `created_by` | `uuid` | yes | — | FK → `users.id`, **onDelete: SetNull** — deleting a user must not break live links. `null` for guest-created links |
| `expiresAt` | `expires_at` | `timestamp(3)` | no | — | `SHARE_TTL_DAYS = 14` |
| `createdAt` | `created_at` | `timestamp(3)` | no | `now()` | |
| `updatedAt` | `updated_at` | `timestamp(3)` | no | `now()`, `@updatedAt` | |

**Indexes:** unique on `code`; `@@index([expiresAt])` for the cleanup sweep.

**Business meaning.** For a guest trip this is *the only server-side copy of the data* — trip data
otherwise lives only in the creator's browser. Snapshots used to be immutable; they are now
refreshed when the underlying split is re-saved, so a link shared in a group chat stops showing
stale numbers. `updatedAt` exists because *"an amount that can move silently after everyone agreed
on it is worse than a stale one"* — the viewer is shown when the content last changed.

---

## 14. `AdminAuditLog` → `admin_audit_logs`

**Purpose.** Append-only trail of privileged admin mutations.

| Field | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `uuid` | no | `uuid()` | PK |
| `actorId` | `actor_id` | `uuid` | no | — | The admin. **No FK** |
| `actorEmail` | `actor_email` | `text` | no | — | Durable snapshot |
| `action` | `action` | `text` | no | — | `plan.change` \| `quota.reset` \| `quota.limit` \| `user.ban` \| `user.unban` \| `role.grant` \| `role.revoke` |
| `targetUserId` | `target_user_id` | `uuid` | yes | — | **No FK** |
| `targetEmail` | `target_email` | `text` | yes | — | Durable snapshot |
| `metadata` | `metadata` | `jsonb` | yes | — | `{ from, to }` before/after |
| `createdAt` | `created_at` | `timestamp(3)` | no | `now()` | |

**Indexes:** `@@index([createdAt DESC])`, `@@index([targetUserId])`.

**Business meaning.** **Deliberately FK-free** so the trail survives account deletion; emails are
denormalized snapshots taken at write time. Application code only ever inserts and reads — never
updates or deletes. **Never swept by the cleanup job**, unlike `ActivityEvent`.

---

## 15. `ActivityEvent` → `activity_events`

**Purpose.** Append-only user activity log powering the admin "who was active today" view.

| Field | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `uuid` | no | `uuid()` | PK |
| `userId` | `user_id` | `uuid` | no | — | FK → `users.id`, **Cascade** |
| `userEmail` | `user_email` | `text` | no | — | Durable snapshot, so the feed reads without a join |
| `feature` | `feature` | `text` | no | — | `single` \| `multiple` \| `travel` \| `account` |
| `type` | `type` | `text` | no | — | `login` \| `split.created` \| `share.created` \| `receipt.added` |
| `metadata` | `metadata` | `jsonb` | yes | — | |
| `createdAt` | `created_at` | `timestamp(3)` | no | `now()` | |

**Indexes:** `@@index([createdAt DESC])`, `@@index([userId, createdAt DESC])`.

**Business meaning.** Single and Multiple are local-only and leave no server trace, so those events
arrive via a client beacon (`POST /api/activity`); `login` and travel activity are written
server-side. **Hard-deleted after 30 days** by the cleanup job — "telemetry, not user data".

---

## Summary table

| # | Model | Table | PK | Soft delete | Version | Audit fields | Swept |
|---|---|---|---|---|---|---|---|
| 1 | `User` | `users` | uuid | ❌ (`bannedAt` ≠ delete) | ❌ | created, updated | ❌ |
| 2 | `Payment` | `payments` | uuid | ❌ | ❌ | created, updated | ❌ |
| 3 | `Referral` | `referrals` | uuid | ❌ | ❌ | created | ❌ |
| 4 | `Trip` | `trips` | uuid | ✅ | ✅ | created, updated | ✅ 30 d after delete |
| 5 | `TripReceipt` | `trip_receipts` | **client text** | ❌ | ❌ | created, updated | via cascade |
| 6 | `TripPayment` | `trip_payments` | uuid | ❌ | ❌ | created | via cascade |
| 7 | `TripInvite` | `trip_invites` | **token** | ❌ | ❌ | created | ✅ on expiry |
| 8 | `TripMember` | `trip_members` | uuid | ❌ | ❌ | joinedAt | via cascade |
| 9 | `TripChangeRequest` | `trip_change_requests` | uuid | ❌ | ❌ | created, reviewed | via cascade |
| 10 | `Receipt` | `receipts` | uuid | ✅ | ✅ | created, updated | ✅ 30 d after delete **+** on `expiresAt` |
| 11 | `ReceiptItem` | `receipt_items` | uuid | ❌ | ❌ | ❌ | via cascade |
| 12 | `ItemAssignment` | `item_assignments` | uuid | ❌ | ❌ | ❌ | via cascade |
| 13 | `SharedSummary` | `shared_summaries` | uuid | ❌ | ❌ | created, updated | ✅ on expiry |
| 14 | `AdminAuditLog` | `admin_audit_logs` | uuid | ❌ | ❌ | created | ❌ **never** |
| 15 | `ActivityEvent` | `activity_events` | uuid | ❌ | ❌ | created | ✅ 30 d by age |

---

*See also: [relationships.md](./relationships.md) · [erd.md](./erd.md) ·
[data-model.md](./data-model.md)*
