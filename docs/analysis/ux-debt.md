# Splitzy — UX Debt

> **14 items.** Where [../ux/ux-audit.md](../ux/ux-audit.md) catalogues *individual findings*, this
> document identifies the **patterns behind them** — the ones that will compound as the product
> grows.
>
> Phase C rendered the application, so most items here are measured rather than inferred. Items still
> marked **[REQUIRES VISUAL CHECK]** sit behind authentication.
>
> `UX-xxx` → [../ux/ux-audit.md](../ux/ux-audit.md) · `SCR-xxx` →
> [../ux/screen-inventory.md](../ux/screen-inventory.md)

---

## Summary

| Severity | Count | IDs |
|---|---|---|
| **High** | 5 | UXD-001, UXD-002, UXD-003, UXD-004, UXD-005 |
| **Medium** | 6 | UXD-006 – UXD-011 |
| **Low** | 3 | UXD-012, UXD-013, UXD-014 |

**[INFERRED] The organising insight.** Splitzy's UX debt is not sloppiness — the opposite. Validation
copy is specific, error states are distinct, touch targets were solved at the token layer, and a
global `prefers-reduced-motion` rule exists. The debt is **asymmetry**: the same care applied
thoroughly in one place and not at all in another. Every item below is a place where a good pattern
exists somewhere in the app and was not extended.

---

## High

### UXD-001 — One control, two incompatible meanings
**Problem** UX-007
**Pattern** The same visual control means different things depending on which mode the user is in,
with nothing distinguishing them. In Travel, ticking a settle-up writes a `TripPayment` ledger row
that **changes the balances**. In Single and Multiple, the identical checkbox writes a `localStorage`
flag that changes **nothing**, does not sync, and silently resets when an amount changes because the
storage key embeds the rounded amount.
**Affected screens** SCR-010 `/single`, SCR-011 `/multiple`, SCR-012 `/travel`
**Severity** **High**
**Why it compounds** A user learns the behaviour in one mode and is wrong in the other. Worse, the
local marker disappearing after an edit reads as data loss rather than as a deliberate
invalidation — and money is involved.
**Recommendation** Either label the local one honestly ("crossed off on this device") or give
Single/Multiple a real ledger. At minimum, explain the reset at the moment it happens. Choosing the
honest label is a copy change; choosing parity is a feature.

### UXD-002 — Semantic structure applied to marketing, not to product
**Problem** UX-002
**Pattern** The marketing tree is scrupulous about heading structure — landing, About, FAQ, legal and
pricing each have exactly one `<h1>`, and an E2E test enforces it. The **product** screens have
none. Five render with zero `<h1>`: `/single`, `/multiple`, `/share`, `/s/[code]`, `/invite/[token]`.
**Affected screens** SCR-010, SCR-011, SCR-017, SCR-018, SCR-019
**Severity** **High**
**Why it compounds** Screen-reader users lose the "what is this page" landmark on the *core* screen
and on the *main non-user touchpoint*. The pattern — semantics matter where Google looks, not where
users are — will repeat on every new product screen.
**Recommendation** Promote the existing header title to `<h1>` on each; they can be styled
identically. Then extend the existing E2E heading assertion to cover product routes, not just
indexable ones.

### UXD-003 — Contrast audited for status colours, not for the primary one
**Problem** UX-011
**Pattern** `globals.css` contains genuinely exemplary contrast work: measured ratios recorded beside
the values, a dedicated `--accent-strong` created because bright gold *"fails WCAG as text
(~2.2:1)"*, and light values deliberately shifted from `-600` to `-700` steps. **`--primary` never
received that treatment.** Dark-mode primary with white foreground measures **3.27:1** — below AA for
normal text, on **every primary button and badge in dark mode**. One further call site missed the
`accent-strong` migration and measures **2.15:1**.
**Affected screens** SCR-001, SCR-009, SCR-017, SCR-021 — and every screen with a primary button in
dark mode
**Severity** **High** — systematic, not local
**Why it compounds** The design system's own precedent says contrast is checked when a token is
introduced. Primary predates that precedent and was never revisited, so the gap is invisible to the
process that would otherwise catch it.
**Recommendation** Darken dark-mode `--primary` (≈ `78 50% 30%` reaches ~4.6:1) or lighten its
foreground; swap the 404 badge to `text-accent-strong`. Then add contrast assertions to the E2E suite
so the next token change cannot regress silently.

### UXD-004 — Localisation stops at the marketing boundary
**Problem** UX-005
**Pattern** The i18n infrastructure is strong: two type-checked dictionaries where a missing key is a
build error, placeholder-parity tests, and a test asserting Indonesian strings were actually
translated rather than pasted. It is applied to the marketing tree and the split editors — and to
nothing else. Ten surfaces are hardcoded English, including the 404/500 pages, server-side API error
text surfaced in toasts, and the welcome email.
**Affected screens** SCR-007, SCR-008, SCR-009, SCR-013, SCR-014, SCR-015, SCR-016, SCR-017,
SCR-018, SCR-019, SCR-021, SCR-022
**Severity** **High**
**Why it compounds** Two are acute. `/s/[code]` is what a **non-user** sees, arriving from an
Indonesian WhatsApp message and being asked to transfer money — it is simultaneously the product's
main viral surface and its least localised. `/privacy` and `/terms` are legal documents shown in a
language the audience may not read.
**Recommendation** Share page first, then legal. The machinery exists; this is translation work.

### UXD-005 — Capabilities finished in code with no way in
**Problem** UX-015, UX-016
**Pattern** Work reaches "the hard part is done" and stops one step short of the entry point.
**Delete a saved split**: API, restore endpoint and a typed service method, all creator-gated —
**zero callers**. **CSV export**: 110 lines with RFC-4180 quoting, a UTF-8 BOM and its own unit-test
file — **zero callers**. `EmptyState`: a full primitive with **zero consumers**.
**Affected screens** SCR-014 `/history`, SCR-010/011/012 (export), everywhere (EmptyState)
**Severity** **High**
**Why it compounds** These are the only two true dead ends in the product's information architecture
— every other screen is reachable from `/`. A user cannot remove a saved split at all and must wait
seven days for the TTL. And the pattern itself is the debt: the next capability will likely stop at
the same place.
**Recommendation** Wire both, or delete both. Tested unreachable code is the worst of the three
options because it looks like coverage.

---

## Medium

### UXD-006 — Failures that render nothing
**Problem** UX-014
**Pattern** The app's error handling is generally excellent — offline, timeout, quota and conflict
each get distinct, specific copy. But the dashboard's two fetches end in `.catch(() => {})`, and
`ReferralCard` returns `null` until data arrives. On failure the quota widget spins forever and the
referral card never appears: no message, no retry.
**Affected screens** SCR-013 `/dashboard`
**Severity** Medium · **[REQUIRES VISUAL CHECK]** — the authenticated view was not reachable
**Why it compounds** It is the one screen where the app's own error-state standard was not applied,
on the first page a signed-in user sees.
**Recommendation** Render an error state with retry, matching the rest of the app.

### UXD-007 — Four loading languages
**Problem** UX-022
**Pattern** `Skeleton` (one consumer, Travel only), `Spinner`/`Loader2`, `Suspense fallback={null}`,
and nothing at all. There are **no `loading.tsx` files anywhere**, so route transitions show no
streamed feedback.
**Affected screens** all
**Severity** Medium
**Why it compounds** A shared `Spinner`/`LoadingState` primitive already exists and is barely used;
each new screen picks its own treatment.
**Recommendation** Standardise — skeletons for lists, spinners for actions — and add `loading.tsx`
for the dynamic routes.

### UXD-008 — Empty states good, but each one bespoke
**Problem** UX-023
**Pattern** Every reachable list surface *has* an empty state, and they are well written — "No
receipts match your search" versus "No receipts yet" is a real distinction most products miss. But
the `EmptyState` primitive built for exactly this has **zero consumers**; all of them are hand-rolled.
**Affected screens** SCR-010, SCR-011, SCR-012, SCR-014
**Severity** Medium
**Why it compounds** Quality currently depends on each author's care rather than on a shared
component. Coverage is complete today and will drift.
**Recommendation** Adopt the primitive, or delete it and accept the pattern is bespoke by choice.

### UXD-009 — Sign-in silently abandons work in progress
**Problem** UX-020
**Pattern** Signing in mid-flow migrates nothing and prompts nothing. The old migration dialog was
removed for a good reason — *"it deleted the local copy after writing a payload the editor could not
reopen"* — but no replacement affordance was added.
**Affected screens** SCR-010, SCR-011, SCR-012
**Severity** Medium
**Why it compounds** The most likely moment to sign in is the guest-limit dialog, which fires
*during* a split. A user reasonably expects their work to follow them.
**Recommendation** After sign-in with an unsaved local split, offer a single "Save this split to your
account" prompt.

### UXD-010 — Cost that moves silently
**Problem** UX-008
**Pattern** An item assigned to nobody still counts toward the grand total, so the payer absorbs it —
with no indication. The engine is otherwise obsessive about making money traceable (a per-person,
per-item breakdown exists purely for transparency), which makes this omission conspicuous.
**Affected screens** SCR-010, SCR-011, SCR-012
**Severity** Medium
**Why it compounds** The numbers still look internally consistent, which is the hardest class of
error for a user to notice — and it contradicts the product's stated principle that every rupiah is
traceable.
**Recommendation** Flag unassigned items in the summary with the amount the payer is absorbing.

### UXD-011 — Disclosure applied at one risk point, not the other
**Problem** UX-017
**Pattern** The scan flow discloses its data handling **at the moment of risk**, localised in both
languages: *"Your photo is sent to Google Gemini for parsing and is not stored by Splitzy."* That is
better than most products manage. The share flow does the opposite: creating a link copies the
participant's **bank name, account number and account holder name** into a snapshot readable by
anyone holding the URL for 14 days — and the user is told none of it.
**Affected screens** SCR-010, SCR-011, SCR-012 (creation), SCR-017 (exposure)
**Severity** Medium
**Why it compounds** The precedent for doing this well already exists in the same codebase, ten lines
away in the same editor.
**Recommendation** Mirror the scan disclosure at link creation: state that the link is public,
contains payment details, and expires in 14 days. Consider a toggle to exclude `paymentInfo`.

---

## Low

### UXD-012 — Target sizes solved for actions, not for navigation
**Problem** UX-004
**Pattern** The `Button` CVA bakes a 44 px minimum into every size variant, with a comment explaining
that 47 call sites had previously each bolted on their own patch. It worked — **every primary action
measured ≥ 44 px**. Footer and secondary nav links were not part of that migration and measure
15–20 px tall, under the 24 px WCAG 2.5.8 (AA) minimum.
**Affected screens** all (shared footer)
**Severity** Low
**Recommendation** Add vertical padding to footer links. One change, every screen.

### UXD-013 — Token migration at 92 %
**Problem** UX-021
**Pattern** 1 158 semantic token usages against 104 raw Tailwind palette classes, of which only 39
carry a `dark:` pair — so ~65 have no dark-mode counterpart. Most cluster on `bg-emerald-500` (15)
and `border-emerald-500` (6). `Badge.success` uses a raw `emerald-700` while `success-outline` uses
the token.
**Affected screens** scattered
**Severity** Low — latent; the rendering pass found no visibly broken dark region
**Recommendation** Finish the migration to `success`/`warning`/`info`, which already carry documented
contrast ratios.

### UXD-014 — Content pops in
**Problem** UX-013
**Pattern** `ReferralCard` returns `null` until its fetch resolves, so it appears abruptly and shifts
the layout below it. Elsewhere the app is careful about this — `AuthButton` renders a same-height
skeleton specifically so the header does not shift.
**Affected screens** SCR-013 `/dashboard`
**Severity** Low
**Recommendation** Reserve the space with a skeleton, as `AuthButton` already does.

---

## Traceability to Phase C

| UXD | Source UX findings | Severity |
|---|---|---|
| UXD-001 | UX-007 | High |
| UXD-002 | UX-002 | High |
| UXD-003 | UX-011 | High |
| UXD-004 | UX-005 | High |
| UXD-005 | UX-015, UX-016, UX-023 | High |
| UXD-006 | UX-014 | Medium |
| UXD-007 | UX-022 | Medium |
| UXD-008 | UX-023 | Medium |
| UXD-009 | UX-020 | Medium |
| UXD-010 | UX-008 | Medium |
| UXD-011 | UX-017 | Medium |
| UXD-012 | UX-004 | Low |
| UXD-013 | UX-021 | Low |
| UXD-014 | UX-013 | Low |

**Not carried forward as debt:** UX-001 (fixed), UX-003, UX-009, UX-010, UX-012, UX-018, UX-019.
UX-001 was resolved during Phase C. UX-009 and UX-010 are content decisions, not UX patterns, and
appear in [product-gaps.md](./product-gaps.md) as GAP-031 and GAP-030. UX-019 is an observability
gap and appears in [technical-debt.md](./technical-debt.md) as GAP-028 / TD-011's neighbourhood.
UX-018 is a privacy finding tracked as VULN-004.

---

## The pattern worth naming **[INFERRED]**

Nine of these fourteen items share one shape: **a good pattern exists in the codebase and was not
extended.**

- Heading semantics — enforced on marketing routes, absent on product routes (UXD-002)
- Contrast auditing — done for four tokens, not for primary (UXD-003)
- Localisation — complete for marketing and editors, absent for ten other surfaces (UXD-004)
- Error states — specific everywhere except the dashboard (UXD-006)
- Loading affordances — a shared primitive exists, four treatments in use (UXD-007)
- Empty states — a primitive exists, every instance hand-rolled (UXD-008)
- Touch targets — solved at the token layer for buttons, not for links (UXD-012)
- Design tokens — 92 % migrated (UXD-013)
- Layout stability — solved in `AuthButton`, not in `ReferralCard` (UXD-014)

**[INFERRED]** This is a good problem to have. It means the *standard* is already established and
written down — the remaining work is application, not invention. It also suggests the highest-value
intervention is not a redesign but a **coverage sweep**: take each existing standard and find every
place it was not applied.
