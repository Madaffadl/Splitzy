# Splitzy — Product Backlog

> **Supersedes the Phase B placeholder.** That file held 73 raw candidates grouped A–I; every one has
> been formalised, de-duplicated and prioritised into the items below. The mapping is in §6.
>
> This is the **stakeholder-facing view**: what to do, why, and what it buys. Full technical detail
> for every item — problem, current behaviour, acceptance criteria, dependencies — is in
> [../analysis/improvement-backlog.md](../analysis/improvement-backlog.md).
>
> **[TECHNICAL-ONLY]** Priority reflects technical risk and code evidence. It does **not** incorporate
> business priorities, user research, revenue targets or market context. Several rankings here are
> ones a business stakeholder should overturn — those are flagged.

---

## 1. Where the product stands

One item has already been resolved during this exercise. Of the remaining **64**:

| Priority | Count | What it is |
|---|---|---|
| **Critical** | 4 | One live dependency advisory, and three things that make the *next* defect expensive |
| **High** | 19 | Measurement, accessibility, localisation, and finishing built-but-unwired work |
| **Medium** | 24 | Consistency, hardening, performance |
| **Low** | 17 | Polish, plus four substantial product bets ranked low **only** on technical evidence |

**42 of the 64 are small** — under a day each. Only five are Large, and every one of those is either
a compliance obligation or a deliberate product bet. This backlog is mostly *finishing*, not
*building*.

---

## 2. Already done

| PBI | Item | Outcome |
|---|---|---|
| **PBI-000** | `/multiple` was open to anonymous visitors | ✅ **Fixed and verified.** The proxy guard admitted any non-401 auth error, and a session-less request produces a 400. Guard narrowed, page-level gate added, confirmed in a browser |

---

## 3. Critical — do these first

| PBI | Item | Effort | Why it is critical |
|---|---|---|---|
| **PBI-001** | Upgrade Next.js past the proxy-bypass advisory | S | PBI-000 closed one path to that failure. This is the **second, independent path**, still open. One command |
| **PBI-002** | Authorization regression tests | M | **No test anywhere asserts an authorization rule.** This is the debt that already cost something — PBI-000 was found by rendering the app, not by a test |
| **PBI-003** | Enable Row Level Security | M | Application code is currently the **only** authorization layer. This turns "one missed guard = breach" into "one missed guard = blocked query" |
| **PBI-004** | Confirm the retention job actually runs | S | **[UNKNOWN]** whether it is scheduled. If not, expired share links **containing bank details** persist indefinitely, and four stated retention policies are unenforced |

**[INFERRED]** Three of the four are small. PBI-004 is a five-minute dashboard check that resolves
four business rules — the cheapest risk reduction available.

---

## 4. High — the next tier

Grouped by what they buy.

### Make the product measurable

| PBI | Item | Effort |
|---|---|---|
| PBI-005 | Fire `split_completed`; wire `identify()` | S |
| PBI-006 | Report handled errors to Sentry; upload source maps | S |

**Why together:** the product currently cannot answer *what fraction of visitors finish a split*, and
cannot see any failure that was caught rather than thrown. Every later prioritisation decision is
guesswork until both are fixed. Two small changes.

### Finish what is already built

| PBI | Item | Effort |
|---|---|---|
| PBI-009 | Wire up delete for saved splits | S |
| PBI-019 | Retire the legacy trips API and its two orphaned entities | M |
| PBI-020 | Implement or remove "Priority AI processing" | S |
| PBI-022 | Update the README (it says Next 15 and omits half the product) | S |

### Accessibility

| PBI | Item | Effort |
|---|---|---|
| PBI-007 | Fix dark-mode primary contrast (measured 3.27:1) | S |
| PBI-008 | Add an `<h1>` to five product screens | S |

**Why:** both are systematic rather than local. The contrast failure affects **every** primary button
in dark mode; the missing headings affect the core screen and the main non-user touchpoint.

### Speak the market's language

| PBI | Item | Effort |
|---|---|---|
| PBI-010 | Localise `/s/[code]` and `/share` | M |
| PBI-017 | Localise `/privacy` and `/terms` | M |

**Why:** the share page is what a **non-user** sees, arriving from an Indonesian WhatsApp message and
being asked to transfer money. It is the product's viral surface, in the wrong language.

### Protect the pipeline

| PBI | Item | Effort |
|---|---|---|
| PBI-011 | `npm audit` in CI | S |
| PBI-012 | Make CI a deploy gate | S |
| PBI-015 | One E2E test that completes a split | S |
| PBI-016 | Route-handler tests for billing | M |
| PBI-018 | A CSRF test case | S |

**Why:** CI currently does not block deployment, so every other quality investment is advisory.
PBI-016 must be green **before** revenue is switched on.

### Bound the costs and the confusion

| PBI | Item | Effort |
|---|---|---|
| PBI-013 | Cap anonymous AI scanning | S |
| PBI-014 | Resolve the settle-up semantic divergence | M |
| PBI-021 | Replace placeholder statistics and testimonials | S |
| PBI-023 | Make account deletion possible | L |

**Why PBI-023 is here despite being Large:** it is not unbuilt, it is *impossible* — five foreign
keys make the database refuse. Given the product stores emails, bank details and spending history,
that is a compliance exposure rather than a missing feature.

---

## 5. Medium and Low

24 Medium items cover consistency (loading states, empty states, response shapes), hardening
(rate-limit the FX endpoint, constant-time secrets, remove `GET = POST` on a destructive route) and
performance (paginate the travel endpoint, atomic quota, client cache).

17 Low items are mostly polish — footer touch targets, an unused dependency, a skeleton to stop
layout shift.

Full detail: [../analysis/improvement-backlog.md](../analysis/improvement-backlog.md).

### Four items ranked Low that a business owner should probably re-rank

**[TECHNICAL-ONLY]** These are ranked Low because *no code evidence demands them*. That is a narrow
criterion, and for these four it is probably the wrong one.

| PBI | Item | Why the technical ranking may be wrong |
|---|---|---|
| **PBI-061** | Payment reminders / notifications | The product computes who owes whom and then stops. Getting the user actually paid back is the value proposition, and it currently ends at "here is a number in WhatsApp" |
| PBI-062 | Participant-side view | Only the payer gets an account-level view; everyone else sees a read-only link. This caps how far the product can spread within a group |
| PBI-063 | Persistent groups / recurring expenses | The flatmates use case is entirely unserved. The clearest functional divergence from competitors |
| PBI-064 | Percentage / custom-amount splitting | A taxi or a rented villa cannot be split at all, because Splitzy splits by consumption only |

---

## 6. Mapping from the Phase B placeholder

Every one of the 73 raw candidates is accounted for.

| Phase B group | Items | Now |
|---|---|---|
| A — Unreachable functionality | 6 | PBI-009, 019, 024, 027, 048 · GAP-011, 012, 023, 024, 025 |
| B — Measurement | 9 | PBI-005, 006 |
| C — Test coverage | 8 | PBI-002, 015, 016, 018, 045, 047, 058 |
| D — Security & data | 10 | PBI-003, 030, 031, 032, 033, 034, 041, 051, 053 |
| E — Correctness & reliability | 8 | PBI-004, 029, 037, 052 |
| F — Localisation | 6 | PBI-010, 017 |
| G — Flagged product decisions | 6 | §7 open decisions · PBI-013, 020, 021 |
| H — Absent capabilities | 9 | PBI-023, 035, 061, 062, 063, 064 |
| I — Engineering health | 11 | PBI-022, 036, 038, 039, 040, 042, 044, 046, 054, 055, 057, 059, 060 |

Two candidates were **dropped** as duplicates on synthesis (the Phase B list counted the CSV export
and the delete affordance in two groups each).

---

## 7. Open product decisions

Not backlog items — questions with no technically correct answer. Three are recorded in code comments
by the original author, which is a good sign about how they were left.

| # | Question | Recorded in | Reopened by |
|---|---|---|---|
| 1 | Should `/multiple` be publicly viewable read-only for its keyword value? | `sitemap.ts` | PBI-000 — the premise the exclusion rested on was false, and is now true again |
| 2 | Should trip members ever write directly, or is approval permanent? | `trip-access.ts` | — |
| 3 | Revisit a custom PWA install prompt once telemetry exists? | `PwaInstallTelemetry.tsx` | PBI-005 provides the telemetry |
| 4 | Is Pro intended to launch, and on what trigger? | GAP-017 | PBI-016 is the precondition |
| 5 | Is unmetered guest AI scanning a deliberate acquisition subsidy? | GAP-015 | PBI-013 |

---

## 8. Four facts that would change this backlog

**[UNKNOWN]** items whose answers move real priorities:

| Question | If yes | If no |
|---|---|---|
| Is RLS already enabled? | PBI-003 drops from Critical to a verification task | PBI-003 stays Critical |
| Is the cleanup job scheduled? | PBI-004 closes immediately | PBI-004 becomes an active data-retention exposure |
| Are the PostHog and Sentry keys set? | PBI-005 and PBI-006 deliver value immediately | Both are prerequisites, not improvements |
| Is `FLAG_XENDIT_CHECKOUT` on? | PBI-016 becomes urgent — untested revenue code is live | PBI-016 stays a precondition |

Each is a dashboard lookup. Together they are the highest-leverage thirty minutes available before
executing any of this.
