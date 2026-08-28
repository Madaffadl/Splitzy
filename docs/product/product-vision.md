# Splitzy — Product Vision

> Derived from observable application behaviour, copy, and code commentary — not from generic
> bill-splitting assumptions.
> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**

---

## 1. The problem, stated precisely

Generic framing — *"splitting bills is hard"* — is not what this codebase is solving. The specific
problems are visible in the specific things the code goes out of its way to handle.

### Problem 1 — Itemised splitting is arithmetic nobody wants to do **[IMPLEMENTED]**

An Indonesian restaurant bill carries **PB1/PPN tax** and a **service charge**, both applied on top
of a subtotal. Splitting "evenly" over-charges whoever ordered the cheap thing. Splitting fairly
means allocating tax and service *proportionally to each person's consumption* — which is a
per-person percentage calculation nobody does at a table.

Evidence: `allocateTaxService` allocates proportionally to subtotal, with a zero-subtotal fallback
and a deliberate remainder assignment. The AI prompt lists `PB1`, `PPN`, `Pajak`, `Tax`, `VAT`, `GST`
as tax labels and `Service`, `SC`, `Service Charge` separately.

### Problem 2 — Delivery-app receipts break naive splitting **[IMPLEMENTED]**

Indonesia's dominant food-ordering pattern (GoFood, GrabFood) produces receipts with **delivery
fees, platform fees, packaging fees, small-order fees, rain surcharges, driver tips** — none of which
are tax or service, and most of which should be split *equally* rather than proportionally, because
they are not tied to what anyone ordered.

Evidence: a whole `ReceiptFee` type with a per-fee `splitMethod` (`"equal"` | `"proportional"`);
the AI prompt enumerates these fee types by name in both English and Indonesian
(`Ongkos Kirim`, `Biaya Layanan`, `Platform Fee`) and instructs the model which split method to
choose for each.

### Problem 3 — Discounts land on the wrong person **[IMPLEMENTED]**

A `Diskon Member` or `Promo GOFOOD` benefits the whole table; a personal voucher benefits one
person; an item-level promo benefits whoever ate that item. Treating all three the same is unfair in
a way people notice.

Evidence: `DiscountScope` = `"receipt" | "item" | "participant"`, each with a different distribution
rule, and a cap so a voucher can never turn a share negative or pay cash back.

### Problem 4 — "Who owes who" degenerates into a web of transfers **[IMPLEMENTED]**

With five people and four receipts and different payers each time, the naive result is up to twenty
transfers. Netting them down is a graph problem.

Evidence: `minimizeTransactions` — exact-match elimination followed by a greedy largest-debtor /
largest-creditor pass. Marketing copy makes it the headline: *"see exactly who owes whom in the
fewest transfers"*, and a testimonial claims *"6 people, 3 currencies… everything became just two
transfers."*

### Problem 5 — The settle-up gets double-counted **[IMPLEMENTED]**

Once people start paying each other back, tracking it in a chat thread breaks. Someone marks a
receipt paid *and* records a manual transfer for the same debt.

Evidence: a single `TripPayment` ledger with a `source` field encoding origin, and `pairSettlement`
netting manual payments against per-receipt markers — with an in-code note that this *"is what stops
the same debt being settled twice."*

### Problem 6 — Group travel spans currencies **[IMPLEMENTED]**

A Bali-to-Bangkok trip mixes IDR, THB and SGD. Summing native amounts silently produces nonsense.

Evidence: 14 supported currencies, an FX rate **locked onto each receipt at creation** so a later
rate move cannot retroactively change a settled split, a single `receiptInBaseCurrency` conversion
point, and a `needsFxRate` flag for the case where a foreign receipt has no usable rate — because
otherwise a ฿1.000 dinner enters the IDR total as Rp 1.000.

### Problem 7 — The moment of truth is a WhatsApp message **[INFERRED]**

The result has to leave the app. Splitzy's own documentation calls the exported text *"the durable
record of a finished split"* — which is why saved splits are allowed to expire after 7 days.

Evidence: a `wa.me` deep link, copy-to-clipboard summary text that includes each person's bank /
e-wallet details, `navigator.share` with a clipboard fallback, and a server-rendered read-only link.

---

## 2. Vision statement

**[INFERRED]** No vision statement exists in the repository. This is a synthesis of the brand
tagline, the About page, the landing copy, and the consistent behaviour of the code:

> **Make splitting a shared bill so fast and so obviously fair that nobody argues about it —
> for anyone with a phone, whether or not they have an account.**

Supporting commitments, each traceable to implementation:

| Commitment | Evidence |
|---|---|
| **Fair** — allocate by what each person actually consumed, tax and fees included | `calculations.ts`, per-fee `splitMethod`, three discount scopes |
| **Auditable** — every rupiah traceable to a line item | `getPersonShareDetails` → `ItemBreakdown[]`; About page: *"Perhitungan bisa diaudit"* |
| **Private** — guest data stays on the device | Local-first Single/Multiple; About page: *"Pakai sebagai guest dan datamu tetap di perangkatmu"* |
| **Free at its core** | `FREE_FEATURES` includes both split modes, Travel, and 15 scans/month; pricing FAQ: *"splitting… is free forever"* |
| **Fast** — usable in seconds, no sign-up | Landing: *"Free, no sign-up needed"*; guest access to `/single` and `/travel` |

---

## 3. Strategic context

### 3.1 Market **[IMPLEMENTED]**

Indonesia. Not incidentally — structurally:

- IDR is the base currency and the settlement currency for every trip.
- Pricing is Rp 29.000, formatted with `Intl.NumberFormat("id-ID")` regardless of UI language.
- The AI prompt's Indonesian vocabulary is first-class, not a translation.
- Testimonials are placed in Jakarta, Bandung, Surabaya.
- The backup cron is scheduled at 18:00 UTC = 01:00 WIB.

### 3.2 The contested-brand constraint **[IMPLEMENTED]**

"Splitzy" is used by several unrelated products — two iOS apps, two Play Store apps, a Facebook
page, a UK LinkedIn company. This is stated explicitly in `lib/seo/structured-data.ts` and
`lib/brand.ts`, and it has driven real engineering:

- A stable `Organization` + `WebSite` + `SoftwareApplication` JSON-LD graph with fixed `@id`s,
  emitted on **every** route.
- A deliberate refusal to emit `aggregateRating` or `review` markup, because the landing page's
  stars and counts are still placeholders and marking up fabricated reviews violates Google's spam
  policies.
- E2E tests that fail the build if the entity graph disappears or if ratings markup ever appears.
- An empty `BRAND_PROFILES` array with a comment explaining that a wrong or squatted profile is
  *worse* than none, because it actively confuses entity resolution.

**[INFERRED]** The strategic read is that Google Indonesia is the one arena where the name is
winnable, and organic brand search is the primary acquisition channel.

### 3.3 The default-language trade-off **[IMPLEMENTED]**

`src/lib/i18n/config.ts` records an owner decision dated **2026-08-21**: English became the default
locale and took the un-prefixed URLs; Indonesian moved to `/id`. The file states the cost plainly —
serving Indonesian from the root was the strongest geo-linguistic signal available, and English at
the root weakens it. The hreflang pair and the `/id` tree are what keep it competitive.

**[UNKNOWN]** The reasoning behind the flip (international ambition? a specific SEO experiment?) is
not recorded — only that it was an owner decision and what it costs.

---

## 4. Business model **[IMPLEMENTED]**

```
Free forever                          Pro — Rp 29.000 / 30 days, one-time
├─ Split single & multiple receipts   ├─ Everything in Free
├─ Travel Spend trips                 ├─ Unlimited AI receipt scans
├─ 15 AI receipt scans per month      ├─ "Priority AI processing"
└─ History synced across devices      └─ "Support the project 💚"
```

Three deliberate choices:

1. **The paywall sits on the only variable cost.** Gemini calls cost money per scan; everything else
   is free because it costs nothing marginal. `FREE_SCAN_LIMIT = 15`.
2. **No auto-renewal.** The pricing FAQ says so four different ways: *"No lock-in, no surprise
   charges."* Implemented as a one-time invoice that extends `proExpiresAt` by 30 days.
3. **Running out is not a dead end.** The paywall explicitly says *"You can still add this
   receipt's items by hand — no scan needed"* and, when checkout is dark, *"Your free scans reset
   at the start of next month."*

**[IMPLEMENTED]** Referrals are the second growth lever: 14 days of Pro per referred sign-up, with a
30-day attribution cookie.

**[IMPLEMENTED]** *"Priority AI processing"* is a marketing claim with **no implementation** — Pro
and free users hit the same model, the same rate limit, and the same queue.

---

## 5. Success measures

### What the product tries to measure **[IMPLEMENTED]**

`EVENTS` in `lib/analytics.ts` names the intended funnel: **landing → scan → split → upgrade**,
plus a PWA install funnel.

### What it actually measures **[IMPLEMENTED]**

| Funnel stage | Instrumented? |
|---|---|
| Landing view | ✅ `$pageview` (pathname only) |
| Mode selected | ❌ `mode_selected` declared, never fired |
| Scan started / completed | ✅ |
| Quota hit | ✅ |
| **Split completed** | ❌ **`split_completed` declared, never fired** |
| WhatsApp share | ✅ |
| Upgrade clicked / succeeded | ✅ |
| Onboarding started / completed / skipped | ✅ |
| PWA prompt available / installed / standalone launch | ✅ |

**[INFERRED]** The product cannot currently answer its own central question — *what fraction of
visitors finish a split?* — because the completion event was never wired. Every other funnel stage
exists. This is the single highest-value instrumentation gap.

### Secondary measurement **[IMPLEMENTED]**

`ActivityEvent` gives the operator a daily "who was active, in which mode" view, independent of
PostHog and stored in the app's own database. `pwa_install_prompt_available` → `pwa_app_installed`
exists specifically as a **health check**, after a manifest icon defect silently broke Android
installs for an unknown period.

---

## 6. Vision-level risks **[INFERRED]**

| # | Risk | Grounded in |
|---|---|---|
| 1 | **The brand name may be unwinnable.** Heavy SEO investment against several established homonyms | `structured-data.ts`, `brand.ts` |
| 2 | **Guest-first cannibalises the account funnel.** Full value without signing in, and guests bypass the AI quota entirely | `api/parse-receipt` quota block is auth-gated |
| 3 | **Unmetered guest AI is an uncapped cost.** Only 10 scans/min/IP bounds it | same |
| 4 | **Conversion is unmeasurable.** No `split_completed`, no `identify()` | `lib/analytics.ts` |
| 5 | **Revenue is not switched on.** Checkout is complete but flagged off | `FLAG_XENDIT_CHECKOUT` |
| 6 | **Social proof is fabricated.** Landing stats and testimonials are placeholders — a known, deliberate state, protected from becoming a spam-policy violation only by the refusal to mark it up | `structured-data.ts`, E2E assertion |
| 7 | **Single point of failure.** Supabase free tier is auth *and* database, with no managed backups | [../DISASTER_RECOVERY.md](../DISASTER_RECOVERY.md) |

---

## 7. Open questions for the product owner

| # | Question | Label |
|---|---|---|
| 1 | Is Pro intended to launch, and on what trigger? Checkout has been complete and dark for some time | **[UNKNOWN]** |
| 2 | Is unmetered guest scanning an accepted acquisition cost or an oversight? | **[UNKNOWN]** |
| 3 | What is the target for the landing page's placeholder stats and testimonials — replace with real data, or remove? | **[UNKNOWN]** |
| 4 | Was flipping the default locale to English an international-expansion decision? | **[UNKNOWN]** |
| 5 | Is *"Priority AI processing"* a promise to implement, or copy to remove? | **[UNKNOWN]** |
| 6 | Should Single/Multiple eventually gain the cloud/collaboration model Travel already has, or stay deliberately local? | **[UNKNOWN]** |
