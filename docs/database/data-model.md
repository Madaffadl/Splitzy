# Splitzy — Data Model

> The conceptual layer: what the tables *mean*, why they are shaped this way, and the invariants
> that hold across them. Column-level detail is in [entities.md](./entities.md); FK topology is in
> [relationships.md](./relationships.md); diagrams are in [erd.md](./erd.md).
>
> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**

---

## 1. The central tension **[IMPLEMENTED]**

Splitzy's data model is shaped by one fact that fights normalisation:

> **The people a bill is split between are not users of the application.**

Four friends split a dinner. One has the app. The other three are names typed into a box. Any schema
that models a participant as a `users` row cannot represent that, and Splitzy's original schema did
exactly that — `item_assignments.user_id` is a foreign key to `users`.

The consequence, quoted from the schema comment on `Receipt.payloadJson`:

> *The relational columns above cannot represent a real split: `ItemAssignment` has a foreign key to
> `User`, so it can only say "an account holder consumed this", while a split is between arbitrary
> named people who mostly have no account. Importing a guest split therefore dropped every
> assignment, fee and discount on the floor.*

The resolution was to store the split as a **JSON document** in the client's own `Receipt` shape,
and to keep the relational tables only for legacy rows.

---

## 2. Two storage strategies, side by side

| | Relational (legacy) | JSON payload (current) |
|---|---|---|
| Tables | `receipts` + `receipt_items` + `item_assignments` | `receipts.payload_json`, `trip_receipts.payload` |
| Participants | `users` rows (FK) | Arbitrary named objects inside the JSON |
| Fees & discounts | **Cannot represent them** | Full fidelity |
| Multi-currency | No | `currency` + locked `fxRate` per receipt |
| Written by | `POST /api/trips/[id]/receipts` | `POST /api/receipts`, `POST /api/travel/[id]/receipts` |
| Read precedence | Fallback only | **Wins whenever present** |
| Used by the shipped UI | ❌ | ✅ |

**[IMPLEMENTED]** The read precedence is explicit in `GET /api/receipts/[id]`:

```ts
const response = payload
  ? { ...payload, ...meta, participants }   // payload wins; server metadata layered on top
  : { ...formattedReceipt, ...meta };       // legacy rows fall back to the relational columns
```

**[IMPLEMENTED]** And in [receipt-detail.ts](../../src/lib/receipt/receipt-detail.ts), which exists
because reading either shape directly was a bug both ways: reading the flat columns silently drops
fees and discounts (so `/history/<id>` showed a different Grand Total than the editor did for the
same split), while `detail.receipts ?? []` silently empties a legacy row. Every consumer goes
through `receiptsFromDetail()`, which prefers the payload and synthesises one receipt from the flat
columns when there is none.

**[INFERRED]** This is an Expand–Contract migration frozen mid-flight: the expand step (add
`payload_json`, prefer it on read) is complete; the contract step (drop `receipt_items` and
`item_assignments`) has not happened, consistent with the additive-only rule in
[ENVIRONMENT_ISOLATION.md](../ENVIRONMENT_ISOLATION.md).

---

## 3. The two identity namespaces **[IMPLEMENTED]**

| | Account namespace | Participant namespace |
|---|---|---|
| Identifier | `users.id` (uuid) | `participant.id` (arbitrary client-generated string) |
| Lives in | FK columns | `jsonb` only |
| Answers | *Who may access this?* | *Who is the bill split between?* |
| Appears as | `Trip.ownerId`, `TripMember.userId`, `Receipt.payerId`, `Receipt.createdById`, `ItemAssignment.userId`, `SharedSummary.createdById` | `Trip.participantsJson[].id`, `TripPayment.from/toParticipantId`, `payload.items[].assignedToIds`, `payload.discounts[].targetId`, `payload.payerId` |
| Integrity | Database foreign keys | **Application validation only** |

They never join. Two practical consequences:

1. **`Receipt.payerId` means two different things.** On a trip receipt it is the account that paid.
   On a saved split it is *"whose account is this saved under"* — the real payer is a participant id
   inside the payload. `POST /api/receipts` says so in a comment as it writes `payerId: user.id`.
2. **Participant integrity is enforced in code.** Every travel write builds
   `participantIds = new Set(trip.participantsJson.map(p => p.id))` and passes it into
   `validateTripReceiptPayload` / `validateTripPaymentInput` / `validateChangeOps`, which reject
   unknown ids. Change-request ops are re-validated against the **live** set at approval time.

---

## 4. The canonical `Receipt` document **[IMPLEMENTED]**

Defined in [src/types/index.ts](../../src/types/index.ts) and stored verbatim in
`receipts.payload_json` and `trip_receipts.payload`.

```ts
interface Receipt {
  id: string;
  title: string;
  date?: string;
  payerId: string;              // participant id
  items: ReceiptItem[];
  tax: number;
  service: number;
  discounts?: Discount[];
  fees?: ReceiptFee[];
  currency?: string;            // undefined = IDR (base)
  fxRate?: number;              // locked at creation: 1 unit of currency → IDR
}

interface ReceiptItem {
  id: string; name: string; qty: number; unitPrice: number; total: number;
  assignedToIds: string[];              // equal split across these participants
  assignments?: ItemAssignment[];       // { participantId, qty } — used when qty > 1
}

type FeeSplitMethod = "proportional" | "equal";
interface ReceiptFee { id: string; label: string; amount: number; splitMethod: FeeSplitMethod }

type DiscountScope = "receipt" | "item" | "participant";
type DiscountType  = "amount" | "percent";
interface Discount { id: string; scope: DiscountScope; type: DiscountType; value: number; label?: string; targetId?: string }

interface Participant {
  id: string; name: string;
  paymentInfo?: { bank?: string; accountNumber?: string; accountName?: string };
  budget?: number;              // Travel Spend: this person's own spend target
}
```

Two item-assignment modes coexist: `assignedToIds` (equal split) and `assignments` (per-quantity).
`calculateItemShares` prefers `assignments` when present.

**Discount scopes exist so the *benefit* lands on the right people:**
`receipt` → everyone, proportional to their base total · `item` → that item's consumers, proportional
to their item share · `participant` → a personal voucher, benefiting only its owner.

**[IMPLEMENTED]** `paymentInfo` (bank / e-wallet / account number / account holder name) is stored
inside the JSON payload and inside share snapshots. It is the most sensitive user-supplied data in
the system, and it travels into `shared_summaries.payload`, which is readable by anyone holding the
`/s/<code>` link.

---

## 5. Money semantics **[IMPLEMENTED]**

### 5.1 Base currency

IDR is the base. A foreign receipt carries `currency` plus an `fxRate` **locked at creation**, so a
later rate change never retroactively alters a settled split.
`receiptInBaseCurrency(receipt)` is the single conversion point — the comment is emphatic:

> *ANY aggregation across multiple receipts MUST run each receipt through this first — otherwise
> native amounts of different currencies get summed together.*

It scales `items[].unitPrice/total`, `tax`, `service`, `fees[].amount`, and **only amount-type**
discounts (percentages are rate-invariant), then clears `currency`/`fxRate`.

`needsFxRate(receipt)` flags a foreign receipt whose rate is missing, zero, negative or non-finite —
because such a receipt passes through unconverted and its native amounts would land in IDR totals
at 1:1 (a ฿1.000 dinner appearing as Rp 1.000). Nothing about that is recoverable from the numbers
alone, so every surface showing a converted total must check it and say so.

### 5.2 Precision

All amounts are `Float` (Postgres `double precision`), not `Decimal`. Every arithmetic step passes
through `roundTo2()`, and remainders are pushed onto a designated person so shares reconcile exactly
to the total. **[INFERRED]** For IDR — a zero-decimal currency in practice — the exposure is small,
but `Decimal` would be the conventional choice for money.

### 5.3 Rounding discipline

Rounding is never left to chance. In every allocation the remainder is assigned deliberately:

| Allocation | Remainder goes to |
|---|---|
| Item share, quantity-based | The person with the most units |
| Item share, equal split | The first assignee |
| Tax / service, proportional | The person with the largest subtotal |
| Tax / service, zero-subtotal edge case | The first participant |
| Fee, equal | The first participant |
| Fee, proportional | The person with the largest subtotal |

The comment on the equal-split branch shows why this matters: *"an indivisible total (e.g. 100 / 3 =
33.33 × 3 = 99.99) would otherwise leave the shares short of the item total, so the payer
under-fronts by a cent."*

### 5.4 Discount capping

Each person's discount credit is capped at their base share, *"so a voucher never pays cash back or
turns a share negative."* Percentages resolve against a **pre-discount** base so multiple discounts
never compound.

### 5.5 What the payer actually fronted

`amountPaid = grandTotal − totalDiscount` = the sum of everyone's effective share. A personal
voucher is the owner's own money-equivalent, so it reduces that owner's share rather than crediting
the payer.

### 5.6 The settlement ledger

`TripPayment` is the **single source of truth for what has been settled**. Gross per-receipt
balances are computed first, then payments are applied **once**, at trip level, via
`applyPaymentsToBalances` — *"so there is a single source of truth and no way to double-count a
payment."*

`source` encodes the origin: `null` = a manual settle-up; `"share:<receiptId>:<participantId>"` = a
per-receipt "mark my share paid" checkbox. `pairSettlement()` then nets the two together, which is
what stops the same debt being settled twice — a manual "A paid B 200k" *and* ticking A's receipt
shares used to double-count.

`applyPaymentsToBalances` skips any payment whose endpoints are not both tracked participants,
because a half-applied payment silently breaks conservation (balances no longer sum to zero).

---

## 6. Lifecycle and retention **[IMPLEMENTED]**

| Data | Mechanism | Window | Rationale |
|---|---|---|---|
| Trip, Receipt | Soft delete → hard delete | 30 days | Audit + accidental-delete recovery |
| Saved split (`receipts.expires_at`) | TTL, reset on every **save** | 7 days | It is a working copy, not an archive |
| Share link | TTL | 14 days | Links are short-lived by design |
| Trip invite | TTL | 7 days | Self-expiring credential |
| Activity event | Age sweep | 30 days | "Telemetry, not user data" |
| Admin audit log | **Never swept** | ∞ | Compliance trail |
| Payment, Referral, User | Never swept | ∞ | Financial + account records |

**[IMPLEMENTED]** The saved-split TTL carries a stated product judgement:

> *The durable record of a finished split is the exported text the user copies into WhatsApp — that
> carries every amount plus the payment details — so letting the working copy lapse loses nothing
> they relied on.*

with an acknowledged sharp edge: *"the clock is reset by saving, not by opening — the server has no
idea the user is mid-edit, so a resumed split that is never re-saved still lapses on the original
schedule."*

**[IMPLEMENTED]** All sweeping happens in one transaction in `POST /api/admin/cleanup`.
**[UNKNOWN]** whether that endpoint is scheduled — only `/api/cron/expire-pro` is in `vercel.json`.
If it is not, none of these retention windows are actually being applied.

---

## 7. Concurrency **[IMPLEMENTED]**

`Trip.version` and `Receipt.version` implement optimistic locking. The client echoes the version it
observed; the server writes with `UPDATE … WHERE id = ? AND version = ?` and treats
`count === 0` as `409 VERSION_CONFLICT`, returning `currentVersion` so the client can reload.

Callers that omit `expectedVersion` still get last-write-wins, for backward compatibility.

The same `updateMany`-returns-count pattern serves as an **atomic claim** in three other places:
the Xendit webhook's `status: { not: "paid" }` guard, change-request approve/decline's
`status: "pending"` guard, and the share-code collision retry on Prisma `P2002`.

Not versioned: `TripReceipt` (idempotent upsert on a client id), `TripPayment` (append-only),
`TripChangeRequest` (guarded by the status claim).

---

## 8. Invariants

Properties the system relies on. **[IMPLEMENTED]** unless noted.

| # | Invariant | Enforced by |
|---|---|---|
| 1 | Net balances across a trip sum to zero | `calculateReceiptBalances` construction + the both-endpoints guard in `applyPaymentsToBalances` |
| 2 | Per-person shares reconcile exactly to the receipt total | Deliberate remainder assignment at every allocation step |
| 3 | A discount never makes a share negative | Credit capped at the base share |
| 4 | A payer never owes their own receipt | `shareOwedOnReceipt` returns 0 when `from === receipt.payerId` |
| 5 | The same debt cannot be settled twice | `pairSettlement` nets manual and share-marker payments together |
| 6 | Every participant id referenced in a payload exists in `Trip.participantsJson` | Validators, on write and again on change-request approval |
| 7 | A soft-deleted row never appears in a list or detail read | `deletedAt: null` in every query; `getTripAccess` returns `null` |
| 8 | A share link renders the same numbers as the split it came from | `PUT /api/receipts/[id]` refreshes the linked `SharedSummary` and its `updatedAt` |
| 9 | A trip write from two devices cannot silently clobber | `version` + `409` |
| 10 | A duplicate webhook delivery grants Pro only once | Atomic status claim |
| 11 | A user can be referred at most once | `referrals.referee_id` unique |
| 12 | An admin action that cannot be audited is never applied | Update + audit share one transaction |
| 13 | Foreign amounts never enter an IDR aggregate unconverted | `receiptInBaseCurrency` at the single conversion point — **unless** `needsFxRate` is true, which callers must surface **[INFERRED]** |

---

## 9. Schema evolution **[IMPLEMENTED]**

No `prisma/migrations/`. Migrations are hand-written SQL in [prisma/sql/](../../prisma/sql/),
applied through the Supabase SQL editor — every file header says `prisma db push` is blocked by the
sandbox.

| File | Change |
|---|---|
| `add_shared_summaries.sql` | `shared_summaries` table |
| `add_admin_audit_logs.sql` | `admin_audit_logs` table |
| `add_user_role.sql` | `users.role` + seed the first admin |
| `add_payment_currency_fxrate.sql` | `trip_payments.currency`, `.fx_rate` |
| `2026-07-add-activity-log.sql` | `users.last_login_at` + `activity_events` |
| `2026-07-add-trip-change-requests.sql` | `trip_change_requests` |
| `2026-08-add-pro-billing.sql` | `users.pro_expires_at` + `payments` |
| `2026-08-add-receipt-payload.sql` | `receipts.payload_json` |
| `2026-08-add-referrals.sql` | `users.referral_code` + `referrals` |
| `2026-08-add-saved-splits.sql` | `receipts.expires_at`, `.share_code`, `shared_summaries.updated_at` |

Every one is **additive** (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`) and safe to
apply before the code deploy, matching the Expand–Contract rule. Several headers state the ordering
requirement explicitly — e.g. the Pro-billing migration must run *before* the Sprint 2 code, because
`lib/scan-quota` starts selecting `users.pro_expires_at`.

### Risks of this approach

| # | Risk | Label |
|---|---|---|
| 1 | No migration history table — production drift from `schema.prisma` is only detectable by inspection | **[IMPLEMENTED]** |
| 2 | Manual application means a migration can be forgotten in one environment | **[IMPLEMENTED]** |
| 3 | Type inconsistency already visible: `referrals` uses `TIMESTAMPTZ` while every other table uses `timestamp(3)` | **[IMPLEMENTED]** |
| 4 | `add_user_role.sql` seeds a real personal email address into a committed file | **[IMPLEMENTED]** |
| 5 | No down-migrations | **[IMPLEMENTED]** |

---

## 10. Sensitive data map

| Data | Where | Exposure |
|---|---|---|
| Email | `users.email`, `activity_events.user_email`, `admin_audit_logs.actor_email`/`target_email`, sent to Xendit and Resend | Admin console; the inviter's email leaks via `GET /api/invite/[token]` when their `name` is null |
| Google avatar URL | `users.avatar_url` | Rendered client-side |
| **Bank / e-wallet details** | `paymentInfo` inside `receipts.payload_json`, `trip_receipts.payload`, `shared_summaries.payload` | **Readable by anyone with a `/s/<code>` link** |
| Participant names | All JSON payloads | Same |
| Spending history | `receipts`, `trip_receipts`, `trip_payments` | Owner + members + admin |
| Receipt images | **Not stored anywhere** — sent to Gemini and discarded | Google, transiently |
| Payment records | `payments` (amount, status, Xendit ids) | Admin |

**[IMPLEMENTED]** `SharedSummary.createdById` uses `onDelete: SetNull` specifically so deleting a
user does not break live links — which also means a share snapshot containing a person's bank
details **outlives their account** until its 14-day TTL expires.

---

## 11. Open questions

| # | Question | Label |
|---|---|---|
| 1 | Is the cleanup job scheduled? If not, no retention policy is being applied | **[UNKNOWN]** |
| 2 | Is Row Level Security enabled on any table? | **[UNKNOWN]** |
| 3 | When will the Contract step run (dropping `receipt_items` / `item_assignments`)? Both remain writable via the legacy trips API | **[UNKNOWN]** |
| 4 | How is account deletion meant to work, given `RESTRICT` on five `User` relations? | **[UNKNOWN]** |
| 5 | Should money move from `Float` to `Decimal`? | **[UNKNOWN]** — a deliberate-looking choice with no stated rationale |
| 6 | Should `paymentInfo` be excluded from share snapshots, or the share TTL shortened? | **[UNKNOWN]** — no evidence of a decision |
