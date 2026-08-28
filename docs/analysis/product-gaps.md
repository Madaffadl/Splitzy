# Splitzy — Product Gap Analysis

> **34 gaps**, synthesised from Phases A–C plus a cross-document consistency audit run
> programmatically over the documentation itself.
>
> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**
> Cross-references: `FEAT` → [../product/feature-catalog.md](../product/feature-catalog.md) ·
> `FR` → [../requirements/functional-requirements.md](../requirements/functional-requirements.md) ·
> `UX` → [../ux/ux-audit.md](../ux/ux-audit.md) · `VULN` → private findings

---

## Part 1 — Cross-document consistency audit (Step 1)

Run as a script over the Phase A–C documents rather than by inspection, so the results are
reproducible.

| # | Check | Result |
|---|---|---|
| C1 | Every FEAT has a US, FR or traceability reference | ✅ **pass** — 79/79 |
| C2 | Every US has acceptance criteria | ✅ **pass** — 60/60 |
| C3 | Every FR maps to at least one US | ❌ **3 fail** → GAP-001 |
| C4 | Every FR appears in the traceability matrix | ✅ **pass** — 79/79 |
| C5 | Every API appears in the traceability matrix | ❌ **3 missing** → GAP-002 |
| C6 | Every entity appears in a feature's Database field | ✅ **pass** — 15/15 |
| C7 | Every critical business rule has a test case | ❌ **1 uncovered** → GAP-003 |
| C8 | Every API has a documented consumer | ❌ **11 orphaned** → GAP-023 |
| C9 | Every implemented feature has direct test coverage | ⚠️ **partial** → GAP-004 |

Inventory as documented: **79 features · 60 stories · 79 requirements · 54 endpoints · 94 business
rules · 118 test cases · 22 screens · 33 security controls · 12 vulnerabilities.**

---

### GAP-001
**Type** Undocumented
**Description** Three functional requirements map to no user story: **FR-011** (profile editing),
**FR-012** (account deletion) and **FR-019** (maintenance mode).
**Evidence** Consistency check C3 over `functional-requirements.md` and `user-stories.md`.
**Impact** FR-011 and FR-012 are gaps *discovered during documentation*, not user-requested work —
so having no story is honest, but it means nobody has articulated what the user actually needs.
FR-019 is operator tooling with no user-facing narrative, which is defensible.
**Recommendation** Write stories for FR-011/FR-012 if they are to be built (see GAP-005, GAP-006).
Mark FR-019 explicitly as an operational requirement, exempt from the story rule.

### GAP-002
**Type** Undocumented
**Description** Three endpoints are absent from the traceability matrix: **API-001** (`/api/health`),
**API-006** (`/api/activity`) and **API-030** (`POST /api/travel/[id]/restore`).
**Evidence** Consistency check C5.
**Impact** API-001 and API-006 are infrastructure with no FR, so their absence is a documentation
omission rather than a product gap. **API-030 is a real product capability** — restoring a
soft-deleted trip — that no requirement claims and no test covers.
**Recommendation** Add API-030 to FR-043/FEAT-052's row. Note API-001 and API-006 as
infrastructure-only.

### GAP-003
**Type** Missing
**Description** **BR-088 (CSRF same-origin enforcement) has no test case.** It is the only critical
business rule with neither a test case nor a partial one.
**Evidence** Consistency check C7 against `test-cases.md`.
**Impact** CSRF protection is applied by convention at the top of every state-changing handler. A
new handler that forgets `assertSameOrigin` would be caught by nothing.
**Recommendation** Add a test case asserting a cross-origin `POST` receives 403, and include it in
the P1 regression block.

### GAP-004
**Type** Partial
**Description** Many implemented features have no test case that names them directly. The raw count
(33 of 67) overstates the problem — a feature like FEAT-019 (the Single wizard) is exercised by
twenty calculation cases that name FEAT-024 instead — but genuinely uncovered areas remain:
onboarding, guest limit, payer selection, per-person breakdown, payment info, budgets, trip members.
**Evidence** Consistency check C9.
**Impact** Behavioural regressions in these areas would ship silently.
**Recommendation** Do not chase the raw number. Add cases for the seven genuinely uncovered
features listed above.

---

## Part 2 — Missing requirements

Capabilities the product's own stated purpose implies, but which do not exist.

### GAP-005
**Type** Missing · **Related** FR-011
**Description** No profile management. Name, email and avatar are overwritten from Google on every
sign-in; there is no UI to edit any of them.
**Evidence** No profile route, no `PATCH /api/me`.
**Impact** A user whose Google display name is wrong or absent cannot correct it — and that name
appears on invite pages, where a null name causes the **inviter's email address** to be disclosed
instead (GAP-022, VULN-004).
**Recommendation** A minimal editable display name would close both this and the disclosure path.

### GAP-006
**Type** Missing · **Related** FR-012
**Description** **Account deletion is not merely unbuilt — it is currently impossible.** Five
`User` relations use Prisma's default `Restrict`, so the database refuses to delete a user who owns
a trip, created a receipt, paid a receipt, is a trip member, or has an item assignment.
**Evidence** `prisma/schema.prisma`; [../database/relationships.md](../database/relationships.md) §4.1.
**Impact** A data-subject erasure request could not be honoured through the application. Given the
product stores emails, bank details and spending history, this is a compliance exposure rather than
a feature gap.
**Recommendation** Decide the intended semantics first — anonymise-in-place or cascade-delete — then
change the FK behaviour. This needs a schema migration and is not a UI task.

### GAP-007
**Type** Missing
**Description** No push notifications, no payment reminders, no email beyond the one-time welcome.
**Evidence** No `Notification`/`PushManager`/VAPID anywhere; `email.ts` has one message.
**Impact** The product computes who owes whom and then relies entirely on the user manually chasing
people in WhatsApp. The single highest-value missing loop for a bill-splitting product.
**Recommendation** **[TECHNICAL-ONLY]** Flagged as a gap because the product's core value — getting
paid back — currently ends at "here is a number". Whether to close it is a business decision.

### GAP-008
**Type** Missing
**Description** No participant-side view. A participant is a name inside someone else's JSON payload;
they cannot sign in and see everything they are part of.
**Evidence** The two-namespace data model — [../database/data-model.md](../database/data-model.md) §3.
**Impact** Only the payer gets an account-level view. Everyone else sees a read-only link or nothing.
**Recommendation** Would require reconciling the participant and account namespaces — a substantial
data-model change, not an incremental feature.

### GAP-009
**Type** Missing
**Description** No persistent groups and no recurring expenses. Splitzy has episodic *trips*.
**Evidence** No such entity; `Trip` is the only container.
**Impact** The flatmates / regular-dinner use case is unserved. This is the clearest functional
divergence from competitors.
**Recommendation** **[TECHNICAL-ONLY]** Note as a deliberate scope boundary unless the business says
otherwise.

### GAP-010
**Type** Missing · **Related** FEAT-034
**Description** No percentage or custom-amount split. Splitzy splits by **consumption** only.
**Evidence** `Discount` supports a `percent` type, but there is no "split this bill 60/40" mode.
**Impact** A bill that cannot be itemised — a taxi, a rented villa — cannot be split at all.
**Recommendation** **[INFERRED]** likely a deliberate model choice, but it leaves a common real-world
case unserved. Worth confirming.

---

## Part 3 — Partially implemented

### GAP-011
**Type** Partial · **Related** FR-063, UX-015
**Description** **Delete a saved split**: `DELETE /api/receipts/[id]`, `POST …/restore` and
`supabaseDataService.deleteReceipt()` are all implemented, creator-gated and rate-limited — with
**zero callers**. `ReceiptHistoryCard` offers only "Continue".
**Evidence** `git grep` for callers returns only the service definition.
**Impact** A user cannot remove a saved split and must wait seven days for the TTL. The complete
server implementation makes this an omission, not a decision.
**Recommendation** Add a delete action with an undo toast. The restore endpoint is already
idempotent. Roughly a day's work against a finished API.

### GAP-012
**Type** Partial · **Related** FR-065a, UX-016
**Description** **CSV export**: `csv-export.ts` is 110 lines with RFC-4180 quoting, a UTF-8 BOM, an
items table, a per-person breakdown and a dated filename — plus its **own unit-test file**. No
component imports it.
**Impact** The one artefact aimed at the expense-claim user is unreachable, so that persona is
unserved despite the work being done.
**Recommendation** Wire an Export action into the summary panel, or delete the module. Leaving
tested, unreachable code is the only bad option.

### GAP-013
**Type** Partial · **Related** UX-005
**Description** Ten surfaces are hardcoded English: `/privacy`, `/terms`, `/pricing`, `/dashboard`,
`/history`, `/history/[id]`, `/s/[code]`, `/share`, `/invite/[token]`, `/admin`, plus 404/500,
server-side API error text and the welcome email.
**Impact** Two are acute. `/s/[code]` is the screen a **non-user** is most likely to see, arriving
from an Indonesian WhatsApp message and asking the reader to transfer money. `/privacy` and `/terms`
are legal documents shown to an Indonesian audience in English.
**Recommendation** The dictionary infrastructure exists and is type-checked. This is translation
work, not engineering. Share page first.

### GAP-014
**Type** Partial · **Related** FR-074, VULN-008
**Description** The retention cleanup job exists but is **not in `vercel.json`**, and `CLEANUP_TOKEN`
is absent from `.env.example`.
**Impact** **[UNKNOWN]** whether it runs. If it does not, BR-072 through BR-077 are stated policies
nothing enforces: expired share links containing bank details, lapsed saved splits, expired invites
and 30-day-old activity events all accumulate indefinitely.
**Recommendation** Verify in the Vercel dashboard. This is a five-minute check that resolves four
business rules.

### GAP-015
**Type** Partial · **Related** BR-059, VULN-006
**Description** The AI scan quota is enforced only for authenticated users. Anonymous scanning is
bounded solely by 10/minute/IP, on a per-instance in-memory limiter.
**Impact** Every scan is a billable Gemini call. There is no attribution, no ceiling and no alerting;
cost would surface on an invoice.
**Recommendation** Add a per-IP daily cap. If unmetered guest scanning is a deliberate acquisition
subsidy, bound it explicitly rather than implicitly.

### GAP-016
**Type** Partial
**Description** Distributed rate limiting is implemented behind `FLAG_DISTRIBUTED_RATE_LIMIT`, but
only **2 of ~30** rate-limited endpoints call the async, Upstash-capable path.
**Impact** Enabling the flag today changes almost nothing. The limiter remains per-instance, so the
effective limit multiplies by the instance count.
**Recommendation** Migrate the remaining endpoints before flipping the flag, or the flag misleads.

### GAP-017
**Type** Partial
**Description** Pro checkout and the payment webhook are complete, tested by hand, and disabled by
`FLAG_XENDIT_CHECKOUT`.
**Impact** The product has no revenue. **[UNKNOWN]** whether this is a launch decision pending or an
abandoned effort.
**Recommendation** Before flipping: TC-113 (duplicate-webhook idempotency) must be automated. It is
the one revenue-correctness case with no coverage.

---

## Part 4 — Inconsistent behaviour

### GAP-018
**Type** Inconsistent · **Related** UX-007, BR-033
**Description** **"Mark as paid" means two different things.** In Travel it writes a `TripPayment`
ledger row that changes the balances. In Single and Multiple it writes a `localStorage` flag that
changes nothing, does not sync, and silently resets when an amount changes.
**Evidence** `usePaidSettlements.ts` vs `settle-up.ts`.
**Impact** The same control, the same visual language, two incompatible meanings — and the local
marker vanishing after an edit reads as data loss.
**Recommendation** Label the local one honestly, or give Single/Multiple a real ledger.

### GAP-019
**Type** Inconsistent
**Description** Two success shapes: `{ ok: true }` on travel routes, `{ success: true }` on
receipts and trips routes.
**Impact** Cosmetic today; a real cost for any future consumer, and it signals two generations of
handler that were never reconciled.
**Recommendation** Pick one and note it in `API_VERSIONING.md` as additive.

### GAP-020
**Type** Inconsistent · **Related** UX-022
**Description** Four loading treatments coexist: `Skeleton` (one consumer, Travel only),
`Spinner`/`Loader2`, `Suspense fallback={null}`, and nothing at all. **No `loading.tsx` exists
anywhere.**
**Impact** Slow navigations show no feedback; the app feels different between areas.
**Recommendation** Skeletons for lists, spinners for actions, `loading.tsx` for dynamic routes.

### GAP-021
**Type** Inconsistent
**Description** Design-system sourcing is split. `Badge.success` uses a raw `emerald-700` while
`success-outline` uses the `--success` token. Two type scales coexist (semantic tokens and default
`text-*`). 104 raw palette classes remain against 1 158 token usages, ~65 without a `dark:` pair.
**Impact** Latent dark-mode inconsistency; no visibly broken region was found when rendered.
**Recommendation** Finish the token migration; the tokens already carry documented contrast ratios.

### GAP-022
**Type** Inconsistent · **Related** VULN-003
**Description** Ban enforcement is inconsistent. `getAuthUser` returns `null` for a banned user, so
protected endpoints 401 — but `/api/auth/me` queries Prisma directly and returns the profile
regardless. Existing sessions are never revoked.
**Impact** Small disclosure (own profile only), but it demonstrates that a handler authenticating by
a different path silently skips the ban.
**Recommendation** Apply the guard in `/api/auth/me`; consider admin sign-out on ban.

---

## Part 5 — Orphaned functionality

### GAP-023
**Type** Orphaned
**Description** **11 of 54 endpoints have no consumer** — the entire legacy `/api/trips/*` family
(API-015…API-024) plus API-054 (cleanup). Adding the two unreachable receipt endpoints
(API-013, API-014) brings it to **13 of 54 (24 %)**.
**Evidence** Consistency check C8; `git grep` for callers.
**Impact** The legacy family is fully implemented, authorized and **writable**. It is live attack
surface serving no user.
**Recommendation** Retire it, or document why it must stay.

### GAP-024
**Type** Orphaned
**Description** `supabaseDataService` exposes 7 methods; **5 are never called** — `deleteReceipt`,
`getReceipts`, `getTrips`, `getTrip`, `createTrip`. `ReceiptHistoryList` bypasses the service and
calls `/api/receipts` with a raw `fetch`.
**Impact** The abstraction it represents is not actually used, so it misleads a reader about how data
flows.
**Recommendation** Either route all data access through it or delete the unused methods.

### GAP-025
**Type** Orphaned · **Related** UX-023
**Description** The `EmptyState` design-system primitive has **zero consumers**. Every empty state in
the app is hand-rolled.
**Impact** They are all present and well-written, but each is bespoke — the exact drift the primitive
was built to prevent.
**Recommendation** Adopt or delete.

### GAP-026
**Type** Orphaned
**Description** **`lucide-react` is a dependency with zero imports.** `components/ui/icons.tsx` is a
shim that maps Phosphor icons onto lucide's API names, including a `LucideIcon` type alias that
resolves to Phosphor's `Icon`.
**Impact** Dead dependency weight and a permanently confusing name.
**Recommendation** Remove the package; rename the alias; add an ESLint restriction so nothing imports
either icon library outside the shim.

### GAP-027
**Type** Orphaned
**Description** Analytics constants declared and never fired: `EVENTS.splitCompleted`,
`EVENTS.modeSelected`, `EVENTS.pricingViewed`. `identify()` and `resetAnalytics()` are exported and
never called. The `share.created` beacon type is allowlisted server-side and never sent.
**Impact** **`split_completed` is the core conversion event.** The product cannot answer whether
anyone finishes a split — which is the question the analytics were added for.
**Recommendation** Fire `split_completed` first; it is a one-line change with the highest
information value in the backlog.

### GAP-028
**Type** Orphaned · **Related** UX-019
**Description** `ErrorBoundary` exposes an `onError` prop written explicitly *"for shipping to error
monitoring"*. No caller supplies it. There are zero `captureException` calls anywhere, and no Sentry
source-map upload.
**Impact** Every handled failure — payment, sync, email, referral, discarded outbox op, section
crash — is `console`-only and invisible in production.
**Recommendation** This is why other defects stay undiscovered. Wire it.

### GAP-029
**Type** Orphaned
**Description** `ReceiptItem` and `ItemAssignment` are written **only** by API-023, which has no
caller. They are the Contract half of an unfinished Expand–Contract migration.
**Evidence** [../database/data-model.md](../database/data-model.md) §2.
**Impact** Two of fifteen entities are maintained for a path nothing uses, and their FK to `users` is
the reason the JSON payload model exists.
**Recommendation** Drop them once the legacy trips API is retired (GAP-023).

---

## Part 6 — Undocumented / unclear

### GAP-030
**Type** Undocumented
**Description** *"Priority AI processing"* is advertised in `PRO_FEATURES` on the pricing page and
**has no implementation** — Pro and free share the same model, rate limit and queue.
**Impact** A paid-tier claim the product does not deliver.
**Recommendation** Implement it or remove the line. This is the only outright false paid claim found.

### GAP-031
**Type** Undocumented
**Description** Landing statistics, three named testimonials and a 5-star rating are **placeholder
figures**.
**Evidence** Acknowledged in `structured-data.ts`; an E2E test prevents them being marked up as
`aggregateRating` precisely because they are fabricated.
**Impact** A trust liability whose most credible-looking element is the invented one. The team
understood the risk well enough to prevent the search-policy violation, but the claims remain
on-page.
**Recommendation** Replace with real figures or remove.

### GAP-032
**Type** Undocumented · **[UNKNOWN]**
**Description** Whether Supabase Row Level Security is enabled on any table. No policy SQL exists in
`prisma/sql/`.
**Impact** Determines whether application code is the *only* authorization layer. VULN-001 proved
that a single missed guard is a complete bypass — RLS is what would contain the next one.
**Recommendation** One query resolves it; see [../security/security-audit.md](../security/security-audit.md) SEC-016.

### GAP-033
**Type** Undocumented · **[UNKNOWN]**
**Description** Whether the retention cleanup job is scheduled anywhere. See GAP-014.

### GAP-034
**Type** Undocumented · **[UNKNOWN]**
**Description** Production values of the four feature flags, and whether the PostHog and Sentry keys
are set.
**Impact** Determines whether Pro is dark, whether realtime collaboration is live, and whether any
observability exists at all. Three maturity assessments depend on it.
**Recommendation** Read from the Vercel dashboard.

---

## Summary

| Type | Count | IDs |
|---|---|---|
| Consistency | 4 | GAP-001 – GAP-004 |
| Missing | 6 | GAP-005 – GAP-010 |
| Partial | 7 | GAP-011 – GAP-017 |
| Inconsistent | 5 | GAP-018 – GAP-022 |
| Orphaned | 7 | GAP-023 – GAP-029 |
| Undocumented | 5 | GAP-030 – GAP-034 |
| **Total** | **34** | |

### The pattern **[INFERRED]**

Splitzy's gaps are overwhelmingly **completion gaps, not capability gaps**. Seven of the 34 describe
work that is *finished in code and unreachable* (GAP-011, 012, 023, 024, 025, 027, 028), and another
seven describe work that is implemented but only partly wired (GAP-013 – GAP-017).

Very few gaps are "this was never built". Most are "this was built and then not connected". That is
a materially better position than the reverse — the expensive part is done — but it means the highest
return is in finishing rather than starting.

The exceptions worth naming are genuinely absent and genuinely consequential: **account deletion**
(GAP-006, currently blocked by the schema), **no reminder loop** (GAP-007, the product stops one step
short of getting the user paid), and **no database-level authorization** (GAP-032, which is what
would have contained VULN-001).
