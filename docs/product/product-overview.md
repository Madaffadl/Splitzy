# Splitzy — Product Overview

> Phase B, Step 1. Reverse-engineered from the running codebase, not from a brief.
> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**
>
> Technical grounding: [../architecture/system-overview.md](../architecture/system-overview.md) ·
> [../database/entities.md](../database/entities.md) · [../api/endpoints.md](../api/endpoints.md)

---

## 1. One-paragraph summary **[IMPLEMENTED]**

Splitzy is a free, bilingual (English / Bahasa Indonesia) web app — installable as a PWA — that
splits shared bills fairly. You photograph a receipt, an AI vision model extracts every line item,
tax, service charge, delivery fee and discount, you tap who had what, and Splitzy computes each
person's exact share and the **minimum set of transfers** needed to settle up. It works without an
account, without a network connection once loaded, and produces a shareable summary that can be
pasted straight into a WhatsApp group.

---

## 2. The three products inside one app **[IMPLEMENTED]**

Splitzy is not one workflow. It is three, and they differ in more than scope — they have different
persistence models, different collaboration models, and different guarantees.

| | **Single** | **Multiple** | **Travel Spend** |
|---|---|---|---|
| Route | `/single` | `/multiple` | `/travel` |
| Use case | One dinner, one bill | Several receipts, several payers, one settle-up | A multi-day trip |
| Account required | ❌ (3 free splits, then a prompt) | ✅ — proxy-gated | ❌ for local use |
| Storage | `localStorage` | `localStorage` | Local for guests; **cloud + offline outbox** when signed in |
| Server involvement | Only on Save / Share / Scan | Same | Every mutation |
| Collaboration | None | None | Members, invite links, approval workflow |
| Multi-currency | ❌ | ❌ | ✅ with a locked FX rate |
| Settle-up | Cosmetic checkbox (`localStorage`) | Cosmetic checkbox | **Real ledger** (`TripPayment` rows) that changes the maths |
| Budgets | ❌ | ❌ | ✅ trip-level and per-person |
| Lifespan of a saved copy | 7 days from last save | 7 days | Indefinite |

**[INFERRED]** The progression is deliberate: Single is the zero-friction hook, Multiple is the
power-user tool that justifies an account, and Travel Spend is the retention product where the data
lives long enough to matter.

---

## 3. What makes the data model unusual **[IMPLEMENTED]**

The single most important product fact, and the one that shapes everything else:

> **The people a bill is split between are not users of the application.**

Four friends split a dinner; one has the app, the other three are names typed into a box. Splitzy
therefore maintains two entirely separate identity namespaces that never join:

- **Participants** — arbitrary named people, stored inside JSON payloads. This is *who the bill is
  split between*.
- **Accounts** (`users` rows) — *who may access the data*.

This is why the original relational schema (`item_assignments.user_id → users.id`) had to be
superseded by a JSON payload, and why the product can be fully useful to someone who never signs in.

---

## 4. The value chain, end to end **[IMPLEMENTED]**

```
Photograph a receipt
   ↓  Gemini 2.5 Flash extracts items, tax, service, fees, discounts, currency
Tap who had what
   ↓  per-quantity or equal assignment
Splitzy allocates
   ↓  tax + service proportional to subtotal
   ↓  fees equal or proportional, per fee
   ↓  discounts credited by scope, capped so no share goes negative
   ↓  every remainder deliberately assigned so shares reconcile exactly
Splitzy nets the debts
   ↓  exact-match elimination, then greedy → the fewest transfers
Share the result
   ↓  WhatsApp text · read-only link · read-only hash link
```

Each stage removes a specific argument that happens at the table: *"what did I actually order"*,
*"why am I paying for your tax"*, *"who owes who now"*.

---

## 5. Current state **[IMPLEMENTED]**

| Dimension | State |
|---|---|
| Live at | `https://www.splitzy.my.id` (apex 301s to `www`) |
| Market | Indonesia — IDR base currency, Rupiah pricing, Indonesian receipt vocabulary in the AI prompt |
| Languages | English (default, un-prefixed URLs) · Bahasa Indonesia (`/id`) |
| Monetisation | Free core forever. **Pro** = Rp 29.000 for 30 days of unlimited AI scans — a **one-time purchase, never auto-renewing** |
| Free AI quota | 15 scans/month for signed-in users; **unmetered for guests** |
| Growth loop | Referral — 14 days of Pro per friend who signs up via your link |
| Platform | Next.js 16 on Vercel, Supabase Postgres, installable PWA |
| Team size | **[INFERRED]** solo or very small — one commit author, hand-applied SQL migrations, deferred staging environment |

---

## 6. Product maturity by area **[INFERRED]**

Read from what is finished, what is flagged off, and what is written but unreachable.

| Area | Maturity | Evidence |
|---|---|---|
| Splitting engine | **Mature** — 36 unit test files weighted heavily toward money math; every rounding remainder deliberately assigned | `lib/receipt/calculations.ts`, `lib/travel/settle-up.ts` |
| AI scan | **Mature** — bounded, sanitised, timeout-aware, with product-grade error copy | `api/parse-receipt` |
| Travel Spend | **Mature but heavy** — durable outbox, optimistic locking, approval workflow. Also the largest and least-factored code (`TravelSpendView` 2 086 lines) | `useTravelData`, `TravelSpendView` |
| SEO / brand | **Mature** — entity JSON-LD, hreflang, canonical hygiene, E2E regression tests for all of it | `lib/seo/`, `e2e/smoke.spec.ts` |
| Monetisation | **Built, dark** — checkout and webhook complete but behind `FLAG_XENDIT_CHECKOUT` | `api/billing/checkout` |
| Analytics | **Wired, incomplete** — `split_completed` (the core conversion event) is declared but never fired; `identify()` never called | `lib/analytics.ts` |
| Error monitoring | **Installed, effectively dark** — no DSN in `.env.example`, no source-map upload, zero `captureException` calls | `sentry.*.config.ts` |
| History / saved splits | **Partial** — search and resume work; **there is no delete affordance in the UI** despite the API and service method existing | `ReceiptHistoryCard.tsx` |
| CSV export | **Unreachable** — a complete, unit-tested module with **zero UI callers** | `lib/receipt/csv-export.ts` |
| Legacy relational trips API | **Orphaned** — 10 endpoints, no caller in the shipped frontend | `api/trips/*` |

---

## 7. Product principles observable in the code **[INFERRED]**

These are not written down anywhere as principles; they are inferred from repeated, consistent
decisions across the codebase.

1. **Usable before it is owned.** No account required to get value. Authentication buys sync and
   history, never basic function.
2. **The maths must be auditable.** Every allocation exposes its components; a per-person breakdown
   view exists purely for transparency. *"Setiap rupiah bisa dilacak"* — every rupiah is traceable.
3. **Never silently lose the user's work.** A failed `localStorage` write is surfaced, not swallowed.
   The Travel outbox survives reloads and offline periods. A rejected sync op re-pulls authoritative
   state rather than leaving a phantom.
4. **Say what actually happened.** Timeout, offline, quota and validation failures each get their own
   message, because a generic "failed" sends users off re-photographing a perfectly good receipt.
5. **Ship dark, then flip.** Every unlaunched feature is behind an env flag that defaults OFF, and
   every third-party integration is inert until its key exists.
6. **One definition per rule.** Limits, event names, audit slugs, plan prices and mode names each
   live in exactly one module, with tests asserting they cannot drift.

---

## 8. What Splitzy deliberately is not **[IMPLEMENTED]**

Stated so their absence is not read as an oversight:

- **Not a payment app.** It never moves money. It tells you what to transfer; you use your own bank
  or e-wallet. Participant `paymentInfo` is a display field only.
- **Not a social network.** No profiles, no feed, no friend graph. Participants are names.
- **Not an accounting tool.** No categories, no budgeting beyond a trip target, no reports, no
  reconciliation with bank statements.
- **Not subscription software.** Pro is a one-time 30-day purchase that never auto-renews — stated
  explicitly in the pricing FAQ.
- **Not an archive.** Saved Single/Multiple splits lapse after 7 days by design; the durable record
  is the text the user pastes into their chat app.

---

## 9. Document map for Phase B

| Question | Document |
|---|---|
| What problem, for whom, and why us? | [product-vision.md](./product-vision.md) · [personas.md](./personas.md) · [value-proposition.md](./value-proposition.md) |
| Everything the product does | [feature-catalog.md](./feature-catalog.md) — 79 features |
| How a user actually moves through it | [user-journeys.md](./user-journeys.md) — 8 journeys |
| The rules the software enforces | [../requirements/business-rules.md](../requirements/business-rules.md) — 94 rules |
| What must be true, in requirement form | [../requirements/functional-requirements.md](../requirements/functional-requirements.md) · [non-functional](../requirements/non-functional-requirements.md) |
| Testable behaviour | [../requirements/user-stories.md](../requirements/user-stories.md) · [acceptance-criteria.md](../requirements/acceptance-criteria.md) |
| Coverage and orphans | [../requirements/traceability-matrix.md](../requirements/traceability-matrix.md) |
| What next | [roadmap.md](./roadmap.md) · [product-backlog.md](./product-backlog.md) *(placeholders — Phase D)* |
