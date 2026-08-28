# Splitzy — Value Proposition

> Every claimed advantage is traced to an implementation. Where the product *markets* something it
> does not implement, that is called out.
> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**

---

## 1. The core statement **[INFERRED]**

> **Photograph the receipt. Tap who had what. Get the fewest transfers that settle it — free, in
> under a minute, without an account.**

Four claims, each defensible from code:

| Claim | Backed by |
|---|---|
| *Photograph the receipt* | Gemini 2.5 Flash vision extraction of items, tax, service, fees, discounts **and** currency |
| *Tap who had what* | Per-item equal or **per-quantity** assignment |
| *Fewest transfers* | `minimizeTransactions` — exact-match elimination, then greedy netting |
| *Free, no account* | `/single` and `/travel` are public; guests get 3 free splits and **unmetered** AI scans |

---

## 2. Against each alternative

### 2.1 vs. doing the maths manually (phone calculator)

| Dimension | Manual | Splitzy | Evidence |
|---|---|---|---|
| Entering items | Type each line | Photograph it | `api/parse-receipt` |
| Tax + service allocation | Guessed, or split evenly | Proportional to each person's subtotal, with the remainder deliberately assigned | `allocateTaxService` |
| Delivery / platform fees | Usually forgotten or split evenly by accident | Per-fee `splitMethod`; equal by default for delivery-type fees | `allocateFees`, `ReceiptFee` |
| Discounts | Applied to the wrong person | Three scopes — receipt / item / participant — each distributed differently, capped so no share goes negative | `calculateDiscountCredits` |
| Shared dishes | "Let's just say half" | Per-quantity weighting (2 of 3 skewers) | `calculateItemShares` with `assignments[]` |
| Rounding | Someone eats the odd cents | Every remainder assigned to a named recipient so shares reconcile **exactly** to the total | `roundTo2` + remainder rules |
| Netting debts | Everyone pays everyone | Minimised transfer set | `minimizeTransactions` |

**Honest limit:** for two people splitting evenly, a calculator is faster. Splitzy's advantage grows
with the number of people, items, fees and receipts.

### 2.2 vs. a WhatsApp group thread

| Dimension | WhatsApp | Splitzy | Evidence |
|---|---|---|---|
| Where the answer lives | Scrolled away in 200 messages | A stable read-only page | `/s/<code>` |
| Recalculating after a correction | Retype the whole message | Edit and re-share; **the existing link updates in place** | `PUT /api/receipts/[id]` refreshes the linked `SharedSummary` |
| Stale numbers | Nobody knows which message is current | The share page shows when the numbers last changed | `SharedSummary.updatedAt` |
| Payment details | Pasted separately, often wrong | `paymentInfo` per participant, rendered into the summary and the export text | `payment-info.ts` |
| Getting it *into* WhatsApp | — | One-tap `wa.me` deep link with the formatted summary | `SummaryPanel` |

**[IMPLEMENTED]** Splitzy does not compete with WhatsApp — it feeds it. The exported text is
described in the codebase as *"the durable record of a finished split"*, which is why saved copies
are allowed to expire after 7 days.

### 2.3 vs. a spreadsheet

| Dimension | Spreadsheet | Splitzy |
|---|---|---|
| Setup | Build the formulas each time | None |
| Data entry | Manual | AI scan |
| On a phone | Painful | Mobile-first, 44 px touch targets, thumb-zone action bars |
| Correctness | Whatever you typed | Tested engine — 36 unit test files, most on money math |
| Netting | Manual, or a hand-built matrix | Automatic |
| Sharing | Send a file, or a screenshot | A link that renders read-only for anyone |
| Auditability | Yes, if you built it well | Built in — per-person breakdown down to each item |

**Where the spreadsheet still wins:** arbitrary custom logic, long-term records, and export. Splitzy
has **no working export** — `csv-export.ts` is complete and unit-tested but **has zero UI callers**,
so no user can reach it.

### 2.4 vs. other expense apps (Splitwise, Tricount, Settle Up)

Only differentiators with code behind them are listed.

| Differentiator | Splitzy | Evidence |
|---|---|---|
| **No account required** | Full split, share link included, as a guest | public `/single`, `/travel`; `createdById` nullable on `SharedSummary` |
| **Itemised AI scan as the primary path** | Items, qty, tax, service, **fees**, **discounts**, currency in one call | `api/parse-receipt` prompt |
| **Indonesian receipt fluency** | `PB1`, `PPN`, `Pajak`, `Ongkos Kirim`, `Biaya Layanan`, `Diskon Member`, `Promo GOFOOD` recognised natively; IDR thousand-separator parsing (`700.000,00` → 700000) | prompt rules 5–9, `parseIndonesianPrice` |
| **Delivery-fee modelling** | A first-class `ReceiptFee` type with per-fee split method | `allocateFees` |
| **Three discount scopes** | Whole-bill / item / personal voucher | `DiscountScope` |
| **Per-quantity assignment** | "Budi had 2 of the 3 skewers" | `ItemAssignment { participantId, qty }` |
| **Offline durability** | Travel receipts survive a reload and a dead connection via a durable outbox | `travel-outbox.ts` |
| **FX locked at entry** | A later rate move cannot retroactively change a settled split | `Receipt.fxRate` + `receiptInBaseCurrency` |
| **Approval workflow for contributors** | Members propose; owners approve — a PR-style model | `TripChangeRequest` |
| **One-time pricing** | Rp 29.000 for 30 days, never auto-renews | `PRO_PLAN`, pricing FAQ |
| **Bilingual with proper hreflang** | Reciprocal annotations, E2E-asserted | `lib/i18n/config.ts`, `e2e/smoke.spec.ts` |

### Where competitors are ahead **[INFERRED]**

Stated plainly, because a value proposition that only lists strengths is not useful:

| Gap | Detail |
|---|---|
| **No persistent groups** | Splitzy has episodic *trips*, not standing groups. There is no "flatmates" that accumulates over years |
| **No recurring expenses** | Not modelled at all |
| **No participant-side view** | A participant is a name in someone else's payload; they cannot log in and see everything they are part of |
| **No push notifications** | No `Notification`/`PushManager`/VAPID anywhere — nobody is reminded to pay |
| **No export** | CSV module exists but is unreachable |
| **No payment integration for settling** | Xendit is used to buy Pro, never to move money between participants |
| **Settle-up is only real in Travel** | In Single/Multiple, "mark as paid" is a cosmetic `localStorage` flag that does not affect the maths |
| **Single-device by default** | Single/Multiple stay on one device unless explicitly saved, and lapse after 7 days |

---

## 3. Value by persona **[INFERRED]**

| Persona | The one thing they get |
|---|---|
| **P-01 Bill Payer** | A defensible number, in under a minute, pasteable into WhatsApp with his bank details attached |
| **P-02 Trip Organiser** | A week of multi-currency spend that never gets lost, netted into two transfers at the end |
| **P-03 Trip Member** | A way to contribute a receipt without being able to break the shared ledger |
| **P-04 Anonymous Visitor** | Immediate value with nothing to sign up for and nothing leaving her device |
| **P-05 Share Recipient** | Her exact amount and where to send it, with no app to install |
| **P-06 Admin** | Cost control and abuse levers over the only variable-cost feature |

---

## 4. Proof points the product makes — audited

| Claim (where it appears) | Status |
|---|---|
| *"Free, no sign-up needed"* — landing | ✅ **[IMPLEMENTED]** |
| *"Setiap rupiah bisa dilacak"* (every rupiah traceable) — About | ✅ **[IMPLEMENTED]** — `getPersonShareDetails` returns a per-item breakdown |
| *"Datamu tetap di perangkatmu"* (your data stays on your device) — About | ✅ **[IMPLEMENTED]** for guest Single/Multiple/Travel. ⚠️ Not true once you press Save, create a share link, **or scan a receipt** (the image goes to Google) |
| *"15 AI receipt scans per month"* — pricing | ✅ **[IMPLEMENTED]** for signed-in users. Guests are unmetered |
| *"Pro is a one-time payment… never auto-renews"* — pricing FAQ | ✅ **[IMPLEMENTED]** |
| *"Priority AI processing"* — `PRO_FEATURES` | ❌ **not implemented** — Pro and free share the same model, rate limit and queue |
| *"Receipt history synced across devices"* — `FREE_FEATURES` | ⚠️ **partial** — only for *explicitly saved* splits, which then expire after 7 days |
| Landing stats (bills split, transfers saved, average rating) | ❌ **placeholder figures** |
| Testimonials (Rani P., Arif H., Sinta W.) | ❌ **fabricated placeholders** |
| 5-star rating display | ❌ placeholder — and deliberately **never** marked up as `aggregateRating`, because marking up fabricated reviews violates Google's spam policies. An E2E test enforces this |

**[IMPLEMENTED]** The last row is worth dwelling on: the team knowingly shipped placeholder social
proof and then built a test to stop it becoming a search-policy violation. That is a considered
position, not an accident — but the claims are still on the page.

---

## 5. Positioning statement **[INFERRED]**

> **For** groups in Indonesia who split restaurant, delivery and travel bills,
> **who** need each person's exact share including tax, service charge, delivery fees and discounts,
> **Splitzy is** a free, installable web app
> **that** reads the receipt with AI and returns the fewest transfers that settle the group,
> **unlike** general expense-splitting apps that require an account and split evenly by default,
> **because** it models Indonesian receipts natively, works without signing in, and shows every
> rupiah of the calculation.

---

## 6. Risks to the value proposition **[INFERRED]**

| # | Risk |
|---|---|
| 1 | **The strongest differentiator is the cheapest to copy.** AI receipt scanning is a prompt and an API key; the durable moat is closer to the Indonesian fee/discount/tax modelling and the offline sync layer |
| 2 | **The guest path may be too generous.** Unmetered AI scans for anonymous users is real money spent on people the product cannot measure, retain, or convert |
| 3 | **Placeholder social proof is a trust liability**, and its most credible-looking element (a star rating) is precisely the fabricated part |
| 4 | **The main viral surface is English-only.** `/s/<code>` is what a non-user sees, in a market that speaks Indonesian |
| 5 | **Two claims are currently unsupported**: "Priority AI processing" and, in its plain reading, "history synced across devices" |
| 6 | **Conversion is unmeasurable.** `split_completed` is declared and never fired, so no claim about the funnel can be validated |
