# Splitzy — Test Strategy

> What is tested today, what is not, and where the gap between the two matters most.
> Coverage numbers below were derived by auditing the actual `describe`/`it` blocks in every test
> file — not inferred from filenames.
>
> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[UNKNOWN]**

---

## 1. The headline

| | |
|---|---|
| Unit test files | **36** (Vitest) |
| E2E spec files | **2** (Playwright) |
| Acceptance criteria with automated coverage | **105 / 162 (65 %)** |
| Route handlers with any test | **0 of 40** |
| Authorization rules with any test | **0** |

**[INFERRED] The one-sentence summary: coverage is inverted against risk.** The money engine — pure,
deterministic, and the least likely thing to break silently — is tested to 100 %. The permission
model, payment reconciliation and quota enforcement — where a defect costs money or leaks data — have
no automated coverage at all.

This is not hypothetical. **VULN-001** (an anonymous visitor reaching a protected route) shipped, and
a single authorization test would have caught it.

---

## 2. Unit tests — Vitest

### Configuration **[IMPLEMENTED]**

```ts
// vitest.config.ts
environment: "node",
globals: true,
setupFiles: ["src/test-setup/happy-dom-fix.ts"],
exclude: [...configDefaults.exclude, "e2e/**"],
alias: { "@": "./src" }
```

Two details worth noting:

- **`environment: "node"`, not `jsdom`.** Consistent with what is actually tested: pure modules, not
  components.
- **`happy-dom-fix.ts` exists for a real incompatibility** — Node 26 defines `localStorage` as a
  getter-only accessor on `globalThis`, which Vitest's `populateGlobal()` skips. The shim re-installs
  happy-dom's `Storage` via `Object.defineProperty` after environment init. Without it the storage
  hooks are untestable.
- **`e2e/**` is excluded** so Vitest never tries to run Playwright specs.

### What is covered, by area **[IMPLEMENTED]**

| Area | Files | Assessment |
|---|---|---|
| **Money & splitting** | `calculations.test.ts`, `calculations-extended.test.ts`, `travel-spend.qa.test.ts` | **Exhaustive.** Item shares (equal and qty-weighted), remainder assignment, tax/service allocation including the zero-subtotal branch, all three discount scopes, the discount cap, fee split methods, minimisation including exact-match elimination, settlement traces, multi-currency aggregation, conservation of money, and large-value overflow |
| **Settlement ledger** | `settle-up.test.ts`, `travel-spend.qa.test.ts` | **Exhaustive**, including a named regression suite for the partial-payment double-count bug — with both a NEGATIVE test documenting the old behaviour and a POSITIVE test proving the fix |
| **Validation** | `validation.test.ts`, `validation-fees-discounts.test.ts`, `shared-summary.test.ts`, `saved-splits.test.ts`, `travel-cloud.test.ts`, `trip-receipt-payload.test.ts`, `input-limits.test.ts` | **Strong.** Includes drift-guard tests proving validators preserve every field, and a test asserting the UI caps equal the server caps |
| **Travel sync** | `travel-outbox.test.ts`, `travel-sync.test.ts`, `useTravelData.test.ts`, `change-ops.test.ts` | **Strong.** Op coalescing, replay idempotency, 409 conflict surfacing, optimistic rollback, offline durability |
| **Currency** | `currency-display.test.ts`, `fx-rate-guard.test.ts` | **Strong.** Includes a test that display and ledger use the same conversion — the bug that reported a $100 settle-up as "Rp 100" |
| **Entitlements** | `entitlements.test.ts` | Adequate — 7 cases covering expiry, null-expiry and stacking |
| **Infrastructure** | `rate-limit.test.ts`, `rate-limit-redis.test.ts`, `flags.test.ts`, `abort-error.test.ts`, `realtime.test.ts` | Adequate |
| **i18n** | `app-copy.test.ts` | Good — placeholder parity, mode-name consistency, and an "actually translated, not pasted" assertion |
| **Assets** | `manifest-icons.test.ts` | **Excellent** — reads real PNG IHDR bytes and parses `sw.js` for its precache list |
| **Admin** | `admin-auth.test.ts`, `admin-audit.test.ts` | Predicate-level only — the `isAdmin` function, not the endpoints that call it |
| **Components** | `button.test.ts` | Essentially none — one file |

### What is *not* covered **[IMPLEMENTED]**

| Gap | Consequence |
|---|---|
| **Every route handler** | CSRF, quota enforcement, optimistic locking, the admin audit transaction, webhook idempotency and all authorization are verified only by reading the code |
| **Every authorization rule** | No test asserts a non-owner gets 403/404. See §5 |
| **React components** | 1 of ~56 has a test |
| **Hooks** | 2 of 10 (`useLocalStorage`, `useTravelData`) |
| **The AI parse pipeline** | `parseIndonesianPrice` is tested; `extractJsonObject` and the sanitisation ladder are not |
| **Coverage reporting** | No `--coverage` flag, no threshold, no CI gate |

**[INFERRED]** The pattern is consistent: **anything pure is tested; anything that touches I/O is
not.** That is a reasonable place to start and a poor place to stop, because the untested half is
where the security and money live.

---

## 3. E2E tests — Playwright

### Configuration **[IMPLEMENTED]**

```ts
testDir: "./e2e",  fullyParallel: true,
forbidOnly: !!process.env.CI,  retries: CI ? 1 : 0,  workers: CI ? 1 : undefined,
webServer: { command: "npm run start -- -p 3100", reuseExistingServer: !process.env.CI },
projects: [{ name: "chromium", use: devices["Desktop Chrome"] }]
```

Runs against a **production build**, not the dev server — correct, since the SEO assertions depend
on real metadata output. Chromium only.

**[IMPLEMENTED]** `reuseExistingServer: !process.env.CI` is a footgun locally: a stale server from a
previous build will be reused, and the tests then pass against yesterday's code. In CI it always
builds fresh.

### What is covered **[IMPLEMENTED]**

`e2e/smoke.spec.ts` — **13 tests, and it is largely an SEO regression suite.** It exists because of
a real incident: one `alternates.canonical: "/"` in the root layout made every page declare itself a
duplicate of the homepage, effectively de-indexing the site. *"It built, linted and rendered
perfectly — only the emitted metadata was wrong."*

| Test | Guards |
|---|---|
| English landing renders hero + mode cards | build/routing regression |
| Indonesian landing renders at `/id` | locale routing |
| Brand entity pages render in both languages | route existence |
| `/single` loads | build regression |
| Legal pages render | route existence |
| Pricing honours its flag (200 or 404, never 500) | flag contract |
| **Self-referencing canonical on 10 indexable routes** | the incident above |
| **Indexable pages are not noindexed** | metadata regression |
| **Private pages are noindexed** | data exposure in search |
| **Reciprocal hreflang + `x-default`** | i18n SEO |
| **Retired `/en` URLs 301** | preserved Search Console signal |
| **Entity JSON-LD present; no rating markup** | contested brand + spam-policy compliance |
| **Apex host 301s to www** | duplicate content |
| **robots.txt and sitemap consistent; every `<loc>` returns 200** | crawl errors |

`e2e/wizard-navigation.spec.ts` — 2 tests pinning the `/single` back-navigation contract: exactly one
back control, and the step lives in the URL.

### What E2E does *not* cover **[IMPLEMENTED]**

- **No test completes a split.** The core user journey — add participants, add items, assign, see the
  settlement — has no end-to-end coverage.
- No authenticated flow at all (no test account exists).
- No AI scan.
- No PWA/service-worker behaviour.
- No mobile viewport except in the wizard spec.
- No visual regression.
- No accessibility assertions.

**[INFERRED]** The E2E suite protects **discoverability** thoroughly and **functionality** barely.
That is a defensible priority for a product whose acquisition depends on winning a contested brand
name — but it means a regression in the splitting flow would ship.

---

## 4. Mock strategy **[IMPLEMENTED]**

| Approach | Where |
|---|---|
| **No mocking at all** | The money engine — pure functions with literal inputs. The right choice |
| `vi.fn()` fetch stubs | `useTravelData.test.ts`, `rate-limit-redis.test.ts`, `realtime.test.ts` |
| Env manipulation | `flags.test.ts`, `admin-auth.test.ts` |
| Real filesystem reads | `manifest-icons.test.ts` — deliberately unmocked, since the whole point is checking bytes on disk |
| **No Prisma mocking** | …because nothing that touches Prisma is tested |
| **No MSW / no fixture server** | — |

**[INFERRED]** The absence of a Prisma test strategy is the single blocker to closing the biggest
gap. Options, cheapest first: (a) extract authorization predicates into pure functions and unit-test
them; (b) `vi.mock("@/lib/prisma")` with in-memory stubs; (c) a real Postgres via Testcontainers.
Option (a) alone would cover most of §5.

---

## 5. The gap that matters most

**No test anywhere asserts an authorization rule.** From the traceability matrix, these 12 rules are
untested — every one is an authorization, money or integrity rule:

| BR | Rule | Risk if wrong |
|---|---|---|
| BR-043 | Banned users treated as unauthenticated | Auth bypass |
| BR-044 | `/multiple`, `/history` require auth | **Auth bypass — this one already failed** |
| BR-046 | Only the creator may write a saved split | Data tampering |
| BR-047 | Saved splits readable only by involved parties | Data leak |
| BR-049 | Members cannot write a trip directly | Data tampering |
| BR-050 | Trip existence not disclosed to non-members | Enumeration |
| BR-051 | Members see only their own change requests | Info disclosure |
| BR-055 | Admin self-lockout guards | Operational lockout |
| BR-059 | Quota enforced for authenticated users | Cost |
| BR-068, BR-069 | Payment written before provider call; webhook idempotency | **Revenue correctness** |
| BR-087 | Optimistic locking → 409 | Silent data loss |
| BR-088 | CSRF same-origin | CSRF |

**BR-044 is the proof.** It was documented, believed, and false — and no test would have said so.

---

## 6. Authenticated visual coverage

Phase C rendered every public screen. Six surfaces could not be reached because they need a session:
the signed-in dashboard, history detail, admin, the 500 page, cloud-mode Travel, and maintenance.

**[INFERRED]** Unblocking this needs one thing: **a seeded test account**. Options:

| Option | Effort | Note |
|---|---|---|
| Playwright `storageState` from a one-off manual sign-in | Low | Fragile — tokens expire |
| A Supabase test user + programmatic session injection | Medium | Best fit; the anon key can mint a session for a known test user |
| A test-only auth bypass behind a server flag | Low | **Not recommended** — adds an auth bypass to fix an auth-test gap |

Recommendation: the middle option, scoped to a staging project so no production data is touched.

---

## 7. CI

| Job | Steps | Gate? |
|---|---|---|
| `verify` | `npm ci` → lint → `tsc --noEmit` → `vitest run` → `next build` | Quality gate on push to `main` and every PR |
| `e2e` | Chromium install → build → `playwright test` | Runs only if `verify` passes |

Both use placeholder env values — the build only inlines `NEXT_PUBLIC_*` and runs `prisma generate`
offline, so no live service is contacted.

**Missing from CI** **[IMPLEMENTED]**

- No coverage reporting or threshold.
- **No dependency scanning** — `npm audit` currently reports 9 high advisories that CI does not see.
- No accessibility testing.
- No visual regression.
- **CI is not a deploy gate.** Vercel deploys from `main` independently, so a red CI run does not
  block production.

---

## 8. Recommendations, ranked

| # | Recommendation | Effort | Why |
|---|---|---|---|
| 1 | **Authorization tests** for the 12 rules in §5 | Medium | The highest-value hour in the whole backlog. Start by extracting predicates into pure functions — `getTripAccess`, the "involved" test — and unit-test those |
| 2 | **A regression test for VULN-001** | Low | An anonymous `GET /multiple` must not return 200 |
| 3 | **`npm audit --audit-level=high` in CI** | Trivial | Nine high advisories are currently invisible |
| 4 | **One E2E test that completes a split** | Low | The core journey has no coverage; the wizard is scriptable, as Phase C demonstrated |
| 5 | **Contrast assertions in E2E** | Low | UX-011 was found by measurement; a test stops it regressing |
| 6 | **A seeded test account** | Medium | Unblocks six screens and every authenticated flow |
| 7 | Route-handler tests for billing and quota | Medium | Revenue correctness is currently unverified |
| 8 | Coverage reporting with a floor on `src/lib` | Low | Prevents silent erosion |
| 9 | Axe/pa11y in CI | Low | Good a11y exists with nothing preventing regression |
| 10 | Fix `reuseExistingServer` locally, or document it | Trivial | Stale-build false passes |

---

## 9. Test pyramid — actual vs advisable

```
                 ACTUAL                                 ADVISABLE

        ▲  E2E: 15 tests                         ▲  E2E: ~20
        │  (13 SEO, 2 navigation)                │  (SEO + 3 core journeys)
        │                                        │
        │  Integration: 0                        │  Integration: ~30
        │  ▓ nothing                             │  ▓ handlers: authz, quota,
        │                                        │    locking, webhook
        │                                        │
     ───┴─ Unit: 36 files, pure modules       ───┴─ Unit: 36 + authz predicates
```

**[INFERRED]** The missing middle is the whole finding. Splitzy has a solid unit base and a
purposeful E2E layer, with **nothing in between** — and the integration layer is exactly where
authorization, payments and concurrency live.
