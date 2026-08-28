# Splitzy — User Flows (screen level)

> Screen-to-screen diagrams for every major journey. Where Phase B's
> [user-journeys.md](../product/user-journeys.md) maps *steps, APIs and business rules*, this
> document maps *screens and the transitions between them* — including the dead ends.
>
> Transitions marked ✅ were exercised against a running production build during this phase.
>
> `SCR-xxx` → [screen-inventory.md](./screen-inventory.md) · `UX-xxx` → [ux-audit.md](./ux-audit.md)

---

## Flow 1 — Sign up → onboarding → first split

```mermaid
flowchart TD
    A["SCR-001 /"] -->|first visit| B["First-run tour<br/>3 steps, once per browser"]
    B -->|Skip / Escape| A
    B -->|Back| B
    B -->|Finish| C["SCR-010 /single"]
    A -->|mode card| C

    C --> D["step 1 · participants"]
    D -->|Next disabled until 2+ people| E["step 2 · ?step=bill"]
    E -->|scan or Add manual| E
    E -->|View summary disabled until<br/>items priced AND payer chosen| F["step 3 · ?step=summary"]

    F -->|4th guest split| G["GuestLimitDialog"]
    G -->|Later| F
    G -->|Sign in| H["Google consent"]
    H --> I["/api/auth/callback"]
    I -->|next=| F
    I -->|first sign-in| J["referral credit<br/>+ welcome email"]

    F --> K["Share: WhatsApp · link · copy"]
    F -->|signed in| L["Save → toast with View"]
    L --> M["SCR-014 /history"]
```

**Verified ✅** The tour ends on `/single`, not on a dismissal. `Next` is genuinely `disabled` at
step 1 with fewer than two participants, and `View summary` stays `disabled` until every item has a
price and a payer is chosen — confirmed by driving the wizard.

**Dead end ⚠** After signing in from `G`, local work is **not** migrated. The user must press Save,
and nothing at that moment tells them so (UX-020).

---

## Flow 2 — Trip: create → invite → contribute → approve

Splitzy has no "groups". The collaborative container is a **trip**.

```mermaid
flowchart TD
    A["SCR-012 /travel"] --> B["Create trip<br/>name · budget"]
    B --> C["Add participants<br/>names, not accounts"]
    C --> D["Add receipt<br/>scan or manual"]
    D -->|non-IDR| E["FX rate fetched<br/>and locked"]
    E --> D
    D --> F["Summary · budgets · settle-up"]

    B --> G["Create invite link<br/>7-day TTL"]
    G --> H["SCR-019 /invite/token"]
    H -->|invalid or expired| H2["'invalid or has expired'"]
    H -->|Join| I["Google sign-in"]
    I --> J["/travel?trip=id<br/>lands on THAT trip"]

    J --> K{"role?"}
    K -->|owner| D
    K -->|member| L["edit → local proposal buffer<br/>overlaid on their own view"]
    L --> M["Submit for review"]
    M --> N["Owner: ReviewInbox diff"]
    N -->|Approve| O["ops re-validated against<br/>the LIVE participant set"]
    O -->|fits| P["applied atomically<br/>trip.version++"]
    O -->|no longer fits| Q["400 · 'Ask the member to resubmit'<br/>nothing written"]
    N -->|Decline + note| R["author sees the reason"]
```

**Notable** A member never sees a permission error as a wall — their edit silently becomes a
proposal and is shown to them overlaid on the trip. That is a considered piece of interaction design.

**Dead end ⚠** Path `Q`: the member's work must be redone from scratch. There is no "rebase" or
partial-apply affordance.

---

## Flow 3 — Settlement

```mermaid
flowchart TD
    A["SCR-012 /travel · settle-up"] --> B["gross balances per receipt"]
    B --> C["ledger applied once, trip level"]
    C --> D["minimizeTransactions"]
    D --> E["'Budi → Alya Rp 67.383'"]

    E --> F["Record manual payment"]
    E --> G["Tick one share on a receipt"]
    E --> H["Toggle whole receipt paid"]

    F --> I["TripPayment row"]
    G -->|records only owed − already paid| I
    G -->|already covered| J["toast 'Already settled'<br/>nothing written"]
    H --> I
    I --> C

    E --> K{"member?"}
    K -->|yes| L["403 REVIEW_REQUIRED<br/>→ becomes a proposal"]
```

**The divergence that is invisible to users ⚠ (UX-007).** The identical-looking checkbox in
`/single` and `/multiple` is a **cosmetic `localStorage` flag** that does not change any number, does
not sync, and silently resets when an amount changes. Only Travel has a real ledger. Nothing in
either UI signals the difference.

---

## Flow 4 — Transaction history

```mermaid
flowchart TD
    A["SCR-013 /dashboard"] --> B["SCR-014 /history"]
    A2["header link"] --> B
    B -->|signed out| C["in-page sign-in gate<br/>NOT a redirect"]
    B --> D["list: title · total · people · days left"]
    D -->|type| E["debounced search 300ms"]
    E -->|no match| F["'No receipts match your search'"]
    D -->|none at all| G["'No receipts yet'"]
    D --> H["Load more"]
    D -->|Continue| I["SCR-010 /single?resume=id<br/>or /multiple?resume=id"]
    D -->|open card| J["SCR-015 /history/id"]

    D -.->|NO UI EXISTS| X1["Delete — API + service method<br/>present, zero callers"]
    D -.->|NO UI EXISTS| X2["Export CSV — module + unit test<br/>present, zero callers"]
```

**Verified ✅** The signed-out gate renders in place rather than bouncing to the marketing landing —
a deliberate and good choice.

**Two dead ends ⚠** The dotted paths are the clearest UX gaps in the product: both capabilities are
finished in code and have no entry point (UX-015, UX-016).

---

## Flow 5 — AI receipt scan

```mermaid
flowchart TD
    A["SCR-010/011/012 · scan card"] --> B{"navigator.onLine?"}
    B -->|offline| C["specific offline message<br/>NO request is made"]
    B -->|online| D["FileReader → canvas resize<br/>1920px · JPEG q0.85"]
    D --> E["POST /api/parse-receipt"]

    E --> F{"outcome"}
    F -->|429 quota| G["ScanQuotaPaywall<br/>'you can still add items by hand'"]
    F -->|429 rate| H["Too many requests"]
    F -->|504 timeout| I["'Scanning took too long'<br/>NOT 'unreadable'"]
    F -->|200, 0 items| J["'couldn't read any items'<br/>no quota consumed"]
    F -->|200, items| K["items populate the editor"]

    K -->|non-IDR| L["GET /api/fx-rate → lock rate"]
    L --> M["assign items to people"]
    K --> M
    G --> N["Add manual — costs nothing"]
    N --> M
```

**Verified ✅** A localised privacy notice sits directly beneath the scan control: *"Your photo is
sent to Google Gemini for parsing and is not stored by Splitzy. Avoid uploading receipts with
sensitive personal data."* Disclosure at the point of risk.

**Design strength.** Four failure modes, four distinct messages, each traceable to an observed user
behaviour. The paywall names the free alternative rather than just stating the rule.

---

## Flow 6 — Anonymous calculator

```mermaid
flowchart TD
    A["search → SCR-001 /"] --> B{"mode"}
    B -->|Single| C["SCR-010 /single ✅ works"]
    B -->|Travel| D["SCR-012 /travel ✅ local only"]
    B -->|Multiple| E["SCR-011 /multiple"]

    E --> E1["bounce to sign-in ✅ after the fix"]
    E --> E2["full tool rendered at audit time ⚠ UX-001 — fixed"]

    C --> F["complete a split"]
    F --> G["share link · WhatsApp · copy"]
    G --> H["SCR-017 /s/code — a NEW visitor"]
    F --> I["counter++"]
    I -->|4th| J["GuestLimitDialog · dismissible"]
    J -->|Later| F
```

**Verified** `E2` was the observed behaviour at audit time: `/multiple` returned 200 and rendered
the complete tool to an anonymous request. **Fixed** — it now 307s to `/?login=required`, and the
screen additionally gates itself.

---

## Flow 7 — PWA install

```mermaid
flowchart TD
    A["browse the site"] --> B["SW registers on load<br/>production only"]
    B --> C{"Chrome installability"}
    C -->|met| D["beforeinstallprompt fires"]
    D --> E["OBSERVED PASSIVELY<br/>no preventDefault, no custom CTA"]
    E --> F["browser's own install UI"]
    F --> G["appinstalled → telemetry"]
    C -->|iOS| H["Share sheet → Add to Home Screen<br/>no events fire"]
    G --> I["standalone launch"]
    H --> I
    I --> J["pwa_launched_standalone"]
```

**Design decision, not an omission.** Calling `preventDefault()` would suppress Chrome's own UI and
make Splitzy responsible for surfacing an install affordance — *"if that UI is ever missing or buggy
we would remove installs rather than add them."*

---

## Flow 8 — Error recovery

```mermaid
flowchart TD
    A["failure"] --> B{"kind"}
    B -->|section throws| C["ErrorBoundary panel<br/>+ Try again"]
    B -->|route throws| D["SCR-022 500 page"]
    B -->|unknown URL| E["SCR-021 404 ✅"]
    B -->|session expired| F["'Signed out' toast"]
    B -->|save conflict| G["'Saved somewhere else' → reload"]
    B -->|storage full| H["quota vs unavailable toast"]
    B -->|trip write offline| I["queued in outbox → drains"]
    B -->|trip write rejected 4xx| J["'discarded' + re-pull ⚠ content lost"]
    B -->|link expired| K["distinct 'expired' state ✅"]

    C --> L["user continues"]
    D --> L
    E --> L
    I --> L
    J -.->|no recovery affordance| M["work lost"]

    C -.->|onError never supplied| N["Sentry never told"]
    D -.-> N
```

**Verified ✅** The 404 returns a real HTTP 404 and renders at both viewports and in dark mode. The
share and invite screens distinguish *expired* from *not found*.

**Two weaknesses ⚠** Path `M` loses the receipt content with one generic message. Path `N` means
none of this is visible to the operator (UX-019).

---

## Cross-flow observations

| # | Observation | Label |
|---|---|---|
| 1 | Validation is **proactive and blocking** — the primary action stays disabled and names the specific missing thing | **[VISUAL-VERIFIED]** strength |
| 2 | Every failure path leaves the user somewhere they can act from; only the discarded outbox op is a true dead end | **[IMPLEMENTED]** |
| 3 | The two hard dead ends in the whole product are *delete* and *export* — both finished in code | **[IMPLEMENTED]** |
| 4 | Flow 6 does not behave as designed: `/multiple` is open | **[VISUAL-VERIFIED]** |
| 5 | Every flow that ends in sharing ends on an English-only screen | **[IMPLEMENTED]** |
| 6 | Sign-in mid-flow silently abandons local work unless the user knows to Save | **[IMPLEMENTED]** |
