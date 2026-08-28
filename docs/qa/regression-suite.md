# Splitzy — Regression Suite

> The minimum set of checks that must pass before a release, grouped by how much a failure would
> cost. Every entry references a `TC-xxx` from [test-cases.md](./test-cases.md).
>
> **Runnable today** distinguishes what the current suites actually execute from what still requires
> a human or does not exist yet. That distinction is the point: a regression suite that quietly
> depends on untested cases is not a gate.

---

## How to read this

| Column | Meaning |
|---|---|
| **Runnable** | ✅ automated now · ⚙️ automatable, not written · 👤 manual only |
| **Cost of a miss** | What ships broken if this regresses |

---

## P1 — must pass before **any** release

Nine areas. A failure here means not shipping.

### P1.1 — Authorization *(the weakest link)*

| TC | Check | Runnable | Cost of a miss |
|---|---|---|---|
| **TC-013** | Anonymous `GET /multiple` → 307, not 200 | ⚙️ | **Currently failing.** A protected route is open |
| TC-014 | Anonymous `/history` shows a gate, no data | ⚙️ | Data exposure |
| TC-015 | Non-creator cannot update a saved split | ⚙️ | Data tampering |
| TC-017 | Uninvolved user cannot read a split | ⚙️ | **Data leak** |
| TC-019 | Non-member gets 404 on a trip, not 403 | ⚙️ | Enumeration |
| TC-020 | Member write → `403 REVIEW_REQUIRED` | ⚙️ | The whole collaboration model |
| TC-022 | Member cannot approve their own change request | ⚙️ | Approval workflow defeated |
| TC-025 | Non-admin → 403 on admin APIs | ⚙️ | **Full admin exposure** |
| TC-011 | Banned user → 401 everywhere | ⚙️ | Moderation defeated |

**None of these run today.** This block is the single highest-value addition to CI.

### P1.2 — Money correctness

| TC | Check | Runnable |
|---|---|---|
| TC-029, TC-030 | Equal split; indivisible split reconciles exactly | ✅ |
| TC-032 | Quantity-weighted split | ✅ |
| TC-035, TC-037 | Tax proportional; zero-subtotal splits equally | ✅ |
| TC-038 | Equal fee across all participants | ✅ |
| TC-041 – TC-044 | All three discount scopes; credit capped | ✅ |
| TC-046 | Minimal transfer set | ✅ |
| TC-048 | **Balances sum to zero** | ✅ |

Fully automated. This block is why the engine can be changed with confidence.

### P1.3 — Settlement

| TC | Check | Runnable |
|---|---|---|
| TC-096, TC-097 | Full and partial settle-up | ✅ |
| TC-098 | **Share tick after a partial payment records only the remainder** | ✅ |
| TC-101 | Payment with a removed participant is skipped; Σ = 0 | ✅ |

TC-098 guards a bug that already shipped once. Keep it.

### P1.4 — Currency

| TC | Check | Runnable |
|---|---|---|
| TC-049, TC-050 | Foreign receipt converts; mixed-currency trip aggregates in IDR | ✅ |
| TC-051 | Missing FX rate flagged by `needsFxRate` | ✅ |
| TC-052 | Foreign settle-up converts before reducing balances | ✅ |

### P1.5 — Core journey *(end to end)*

| TC | Check | Runnable | Note |
|---|---|---|---|
| TC-055 | A valid receipt photo produces items | 👤 | Needs a fixture image and a Gemini key |
| — | **Complete a split: participants → items → assign → summary** | ⚙️ | **No E2E covers the core journey.** Phase C proved the wizard is scriptable |
| TC-072, TC-073 | Save creates once, re-save updates | ⚙️ | |
| TC-076 | Stale version → 409, not a silent overwrite | ⚙️ | Silent data loss |
| TC-104, TC-105 | Share link created; **re-save updates the same link** | ⚙️ | Group sees stale numbers |

### P1.6 — Sync durability

| TC | Check | Runnable |
|---|---|---|
| TC-084, TC-085 | Receipt syncs online; stays durable offline | ✅ |
| TC-087 | 5xx/429 requeue rather than discard | ✅ |
| TC-090 | Concurrent edit surfaces as `conflict` | ✅ |
| TC-094 | A stale change request is refused with nothing written | ⚙️ partial |

### P1.7 — Revenue

| TC | Check | Runnable | Cost of a miss |
|---|---|---|---|
| TC-110 | Flag off → 404, button reads "Coming soon" | ⚙️ | Charging before launch |
| TC-111 | Pending payment written **before** the provider call | ⚙️ | Unreconcilable payment |
| **TC-113** | **Duplicate webhook grants Pro once** | ⚙️ | **Double-granting entitlement** |
| TC-114 | Bad callback token → 401 | ⚙️ | Forged entitlement |

Only relevant while `FLAG_XENDIT_CHECKOUT` is off — but it must be green **before** it is turned on.

### P1.8 — Auth basics

| TC | Check | Runnable |
|---|---|---|
| TC-001, TC-002 | First sign-in creates an account; repeat does not re-trigger side effects | ⚙️ |
| TC-007 | Sign-out purges the seven local keys | ⚙️ |
| TC-009 | Session survives navigation | ⚙️ |

### P1.9 — Discoverability *(SEO contract)*

| TC | Check | Runnable |
|---|---|---|
| TC-118 | Canonicals · hreflang · noindex · no rating markup · sitemap 200s · apex 301 | ✅ |

Fully automated, and it exists because a metadata-only regression once de-indexed the site. It
passes today and must keep passing.

---

## P2 — must pass before a **major** release

| TC | Check | Runnable |
|---|---|---|
| TC-003 | `?next=` returns the user to their origin | ⚙️ |
| TC-012 | Banned user handling on `/api/auth/me` *(currently a known gap)* | ⚙️ |
| TC-016, TC-018, TC-021, TC-023, TC-024 | Remaining authorization cases | ⚙️ |
| TC-027, TC-028 | Admin self-lockout guards | ⚙️ partial |
| TC-031, TC-033, TC-034, TC-036, TC-039, TC-040, TC-045, TC-047 | Calculation edge cases | ✅ |
| TC-053, TC-054 | FX failure handling; rate locked at creation | ⚙️ |
| TC-056 – TC-062 | Scan failure modes: unreadable, offline, timeout, oversized, wrong type, rate-limited | ⚙️ |
| TC-065, TC-066 | AI output sanitisation; discount downgrade rather than drop | ⚙️ |
| TC-067, TC-068, TC-071 | Quota within, at, and after reset | ⚙️ |
| TC-074, TC-075 | Draft relaxations hold; ghost participants still rejected | ✅ |
| TC-077 – TC-081 | Search, empty states, resume, legacy rows | partial ✅ |
| TC-086, TC-088, TC-089, TC-091 – TC-093 | Outbox coalescing, permanent-failure handling, proposal migration | ✅ |
| TC-095 | Concurrent approval | ⚙️ |
| TC-099, TC-100, TC-102 | Already-covered share, untick, payment validation | ✅ |
| TC-106 – TC-109 | Expired link, oversized payload, hash round-trip, corrupted payload | partial ✅ |
| TC-112 | Already-Pro refused | ⚙️ partial |
| TC-115, TC-116 | Manifest icons and precache list match disk | ✅ |
| TC-117 | Service worker controls the page on a second visit | ⚙️ |

---

## P3 — should pass

| TC | Check | Runnable |
|---|---|---|
| TC-004 – TC-006 | OAuth error paths | ⚙️ |
| TC-008 | Sign-out with storage blocked | 👤 |
| TC-010 | Cookie propagation across redirects | ⚙️ |
| TC-063, TC-064 | IDR price parsing; item-count truncation | partial ✅ |
| TC-070 | Anonymous scan metering *(unmet — VULN-006)* | ⚙️ |
| TC-078, TC-079 | Empty-state copy | ⚙️ |
| TC-103 | Duplicate settle-up idempotency *(unmet — VULN-011)* | ⚙️ |

---

## Manual pre-release checklist

Six things no current harness can reach. Roughly 30 minutes on two devices.

| # | Check | Why manual |
|---|---|---|
| 1 | Install on a real Android device; confirm the icon, splash and standalone launch | WebAPK build server is outside our control |
| 2 | Add to Home Screen on iOS; confirm full-screen launch and the 180 px icon | No events fire on iOS |
| 3 | Sign in and walk the dashboard, history, history detail and admin | No seeded test account exists |
| 4 | Complete a real AI scan with a photographed Indonesian receipt | Needs a real image and a live key |
| 5 | Open a share link on a second device with no account | Verifies the actual viral surface |
| 6 | Toggle dark mode and check the primary CTA contrast | **UX-011 — currently 3.27:1, below AA** |

---

## Release gate

```
┌─ Automated (CI) ─────────────────────────────────────────────┐
│  npm run lint                                                 │
│  npx tsc --noEmit                                             │
│  npm run test:run          36 files                           │
│  npm run build             /single /multiple /travel must be ○│
│  npm run test:e2e          15 tests                           │
│  ▸ MISSING: npm audit --audit-level=high                      │
│  ▸ MISSING: authorization suite (P1.1)                        │
└───────────────────────────────────────────────────────────────┘
┌─ Manual ─────────────────────────────────────────────────────┐
│  The six checks above, before a major release                 │
└───────────────────────────────────────────────────────────────┘
```

**[IMPLEMENTED]** The static-rendering check is a real gate, not a formality: `/single`,
`/multiple` and `/travel` must stay `○` in the build output. A change that makes any of them `ƒ`
(reading cookies or headers server-side, for instance) is a regression even though everything still
works.

**[IMPLEMENTED]** CI is **not** a deploy gate — Vercel deploys from `main` independently, so a red
run does not block production.

---

## Honest assessment of this suite

| | |
|---|---|
| P1 checks that run today | **19 of 40** |
| P1 checks that are automatable but unwritten | **21** |
| P1 checks currently **failing** | **1** — TC-013 |

**[INFERRED]** The suite is strong where the code is pure and absent where it touches I/O. Writing
the nine P1.1 authorization cases would take a single focused session, would move P1 coverage from
48 % to 70 %, and would have caught the one defect this documentation pass found by accident.

**Recommended order**

1. TC-013 — the failing case, as a regression test.
2. The remaining eight P1.1 authorization cases.
3. `npm audit --audit-level=high` in CI.
4. One E2E that completes a split (P1.5).
5. TC-113 webhook idempotency, **before** revenue is switched on.
