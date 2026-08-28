# Splitzy — Functional Requirements

> **79 requirements** derived from observed application behaviour. Each states what the system must
> do, what it supports, how it is currently implemented, and whether that implementation is complete.
>
> Status: **Implemented** (reachable and working) · **Partial** (works but incomplete, or reachable
> in only one direction) · **Missing** (expected or half-built, but no user can use it) ·
> **Dark** (complete but disabled by a feature flag).
>
> `US-xxx` → [user-stories.md](./user-stories.md) · `FEAT-xxx` →
> [../product/feature-catalog.md](../product/feature-catalog.md) · `BR-xxx` →
> [business-rules.md](./business-rules.md) · `API-xxx` → [../api/endpoints.md](../api/endpoints.md)
>
> **Evidence convention.** The **Status** and **Evidence** columns carry the labelling for every
> row: *Implemented* = **[IMPLEMENTED]**, and the file path in the final column is the evidence.
> **[UNKNOWN]** appears inline where a status genuinely depends on information not in the repo
> (FR-074, the cleanup schedule).

| Range | Area |
|---|---|
| FR-001 – FR-012 | Identity & access |
| FR-013 – FR-019 | Onboarding & marketing |
| FR-020 – FR-036 | Splitting engine |
| FR-037 – FR-042 | AI receipt scanning |
| FR-043 – FR-056 | Travel Spend |
| FR-057 – FR-065 | Persistence & sharing |
| FR-066 – FR-070 | Money & growth |
| FR-071 – FR-074 | Administration |
| FR-075 – FR-078 | Platform |

---

## Identity & access

| FR | Requirement | Supports | Implementation | Status | Evidence |
|---|---|---|---|---|---|
| **FR-001** | The system shall authenticate users via Google OAuth and no other method | US-001, US-002 / FEAT-001 | `supabase.auth.signInWithOAuth({ provider: "google" })`; the callback exchanges the code and writes session cookies | Implemented | `hooks/useAuth.ts`, `api/auth/callback` |
| **FR-002** | The system shall create an application `User` record on first successful sign-in, linked to the Supabase identity by `googleId` | US-001 / FEAT-001 | `prisma.user.upsert({ where: { googleId } })` with a prior `findUnique` to detect a new account | Implemented | `api/auth/callback` |
| **FR-003** | A failure to write the profile shall not prevent sign-in | US-001 / BR-042 | The upsert block is wrapped in `try/catch` that logs only | Implemented | same |
| **FR-004** | The system shall refresh the session on every matched navigation and propagate refreshed cookies across redirects | US-004 / FEAT-003 | `@supabase/ssr` `createServerClient` in the edge proxy | Implemented | `src/proxy.ts` |
| **FR-005** | The system shall require authentication for `/multiple` and `/history*` | US-005 / BR-044 | `protectedPaths` prefix match → `302 /?login=required&redirect=<path>` | Implemented | `src/proxy.ts` |
| **FR-006** | A transient authentication error shall not redirect an otherwise-valid user | US-004 / BR-045 | Only `authError.status === 401` triggers the bounce | Implemented | `src/proxy.ts` |
| **FR-007** | The system shall clear all application-owned local data on sign-out | US-003 / FEAT-002 | Seven `localStorage.removeItem` calls inside `try/catch` | Implemented | `hooks/useAuth.ts` |
| **FR-008** | The system shall treat a banned account as unauthenticated on every protected endpoint | US-053 / BR-043 | `getAuthUser` returns `null` when `bannedAt != null` | **Partial** — `/api/auth/me` does not apply the guard, and existing cookies are not revoked | `lib/api-auth.ts` |
| **FR-009** | The system shall permit unauthenticated users to complete a split, scan a receipt and create a share link | US-006 / FEAT-004 | `/single` and `/travel` are public; `SharedSummary.createdById` is nullable; the quota block is auth-gated | Implemented | `api/share`, `api/parse-receipt` |
| **FR-010** | The system shall prompt an unauthenticated user to sign in after 3 completed splits, without blocking the split | US-007 / BR-057 | `MAX_GUEST_SPLITS`, a dismissible dialog with a "Later" action | Implemented | `hooks/useGuestLimit.ts` |
| **FR-011** | The system shall allow a user to edit their profile | — | **No implementation.** Name, email and avatar are overwritten from Google on every sign-in | **Missing** | — |
| **FR-012** | The system shall allow a user to delete their account and data | — | **No implementation.** Five `User` relations use Prisma's default `Restrict`, so deletion is refused at the database level | **Missing** | `prisma/schema.prisma` |

## Onboarding & marketing

| FR | Requirement | Supports | Implementation | Status | Evidence |
|---|---|---|---|---|---|
| **FR-013** | The system shall show a first-run product tour once per browser, only on the landing route | US-008 / FEAT-010 | Radix `Dialog`, 3 steps, gated on `localStorage["splitzy-onboarding-seen"]` and `pathname === "/"` | Implemented | `OnboardingModal.tsx` |
| **FR-014** | The tour shall convert into a first use rather than merely dismissing | US-008 | The final action is `router.push("/single")` | Implemented | same |
| **FR-015** | The system shall present a marketing landing page in both supported languages | US-009 / FEAT-011 | Separate Server Components at `/` and `/id`, composing client islands | Implemented | `NewLanding.tsx` |
| **FR-016** | The system shall publish About and FAQ pages in both languages | US-010 / FEAT-012, FEAT-013 | `/about`, `/id/about`, `/faq`, `/id/faq` | Implemented | — |
| **FR-017** | The system shall publish a privacy policy and terms of service | US-010 / FEAT-014 | `/privacy`, `/terms` via `ContentPageShell` | **Partial** — English only, in an Indonesian market | `app/privacy`, `app/terms` |
| **FR-018** | The system shall present pricing and plan comparison when the pricing flag is enabled | US-048 / FEAT-015 | `notFound()` when `NEXT_PUBLIC_FLAG_PRICING_PAGE` is off; the sitemap asks the same question | Implemented | `app/pricing/page.tsx` |
| **FR-019** | The system shall serve a maintenance page and divert all traffic to it when maintenance mode is on | — / FEAT-018 | `MAINTENANCE_MODE === "true"` in the proxy, bidirectional | Implemented | `src/proxy.ts` |

## Splitting engine

| FR | Requirement | Supports | Implementation | Status | Evidence |
|---|---|---|---|---|---|
| **FR-020** | The system shall let a user define an arbitrary set of named participants, independent of user accounts | US-013 / FEAT-021 | `Participant[]` in a JSON payload; ≤ 100, name ≤ 100 chars | Implemented | `types/index.ts`, `validation.ts` |
| **FR-021** | The system shall suggest previously used participant names, ranked by frequency and recency | US-013 / FEAT-022 | Local history of ≤ 30 names in `localStorage` | Implemented | `useNameSuggestions.ts` |
| **FR-022** | The system shall let a user add, edit and remove receipt line items | US-014 / FEAT-023 | Controlled inputs; ≤ 200 items; amount ≤ 1e9; qty ≤ 1000 | Implemented | `ItemsTable.tsx` |
| **FR-023** | The system shall support assigning an item equally among selected participants | US-015 / BR-002 | `assignedToIds[]`, `total / n`, remainder to the first assignee | Implemented | `calculateItemShares` |
| **FR-024** | The system shall support assigning an item by per-person quantity | US-016 / BR-001 | `assignments[{ participantId, qty }]`, proportional, remainder to the most units | Implemented | same |
| **FR-025** | The system shall allocate tax and service charge in proportion to each person's subtotal | US-017 / BR-006 | `allocateTaxService`, remainder to the largest subtotal | Implemented | `calculations.ts` |
| **FR-026** | The system shall split tax and service equally when the receipt subtotal is zero | US-017 / BR-008 | Explicit branch in `allocateTaxService` | Implemented | same |
| **FR-027** | The system shall support extra fees, each with its own split method | US-018 / BR-009, BR-010 | `ReceiptFee { splitMethod: "equal" \| "proportional" }`; ≤ 50 fees | Implemented | `allocateFees` |
| **FR-028** | The system shall support discounts at receipt, item and participant scope | US-019 / BR-012 – BR-014 | `DiscountScope`, three distribution rules; ≤ 100 discounts | Implemented | `calculateDiscountCredits` |
| **FR-029** | Percentage discounts shall resolve against a pre-discount base and shall not compound | US-019 / BR-015 | Percentages resolve against `grandTotal`, `item.total` or the person's base | Implemented | same |
| **FR-030** | A discount credit shall never exceed a person's base share | US-019 / BR-016 | `min(credit, base)` cap | Implemented | same |
| **FR-031** | The system shall designate one participant per receipt as the payer, who must be a participant | US-020 / BR-082 | `payerId` + a cross-field validator | Implemented | `validateReceiptCreate` |
| **FR-032** | The system shall compute each person's total as subtotal + tax + service + fees − discount | US-012 / BR-017 | `calculatePersonTotals` | Implemented | `calculations.ts` |
| **FR-033** | Every allocation shall assign its rounding remainder to a named recipient so shares reconcile exactly to the total | US-015 / BR-018 | Six explicit remainder rules | Implemented | `calculations.ts` |
| **FR-034** | The system shall reduce net balances to a minimal set of transfers | US-021 / BR-027, BR-028 | Exact-match elimination, then greedy | Implemented | `minimizeTransactions` |
| **FR-035** | The system shall expose a per-person, per-item breakdown of how a share was derived | US-022 / FEAT-032 | `getPersonShareDetails` → `ItemBreakdown[]` | Implemented | `calculations.ts` |
| **FR-036** | The system shall let each participant record optional bank / e-wallet payment details | US-023 / FEAT-033 | `PaymentInfo`, normalised, rendered into summary, export and share payload | Implemented | `payment-info.ts` |

## AI receipt scanning

| FR | Requirement | Supports | Implementation | Status | Evidence |
|---|---|---|---|---|---|
| **FR-037** | The system shall extract items, quantities, prices, tax, service, fees, discounts and currency from a receipt photograph | US-025 / FEAT-035 | Gemini 2.5 Flash, server-side, one structured prompt | Implemented | `api/parse-receipt` |
| **FR-038** | Model output shall be treated as untrusted and fully re-validated before use | US-025 / BR-086 | Fence-stripping balanced-JSON extraction, then per-field bounds, coercions and rejections | Implemented | same |
| **FR-039** | The system shall bound image uploads by size and media type | US-025 / BR-085 | ≤ 7 000 000 base64 chars → `413`; MIME allowlist → `415`; client resize to 1920 px | Implemented | same, `ReceiptInput.tsx` |
| **FR-040** | The system shall distinguish offline, timeout, quota and unreadable failures with specific messages | US-025 | `navigator.onLine` pre-check; `504 UPSTREAM_TIMEOUT` as a distinct code; a paywall; an empty-items state | Implemented | `api-response.ts`, `ReceiptInput.tsx` |
| **FR-041** | The system shall enforce a monthly AI scan quota for authenticated users, overridable per user | US-026 / BR-059, BR-060 | `FREE_SCAN_LIMIT = 15`, `aiScanLimit` override, UTC month window | **Partial** — guests are exempt entirely, and check/increment is not atomic | `lib/scan-quota.ts` |
| **FR-042** | The system shall obtain and lock a foreign-exchange rate when a non-base currency is detected | US-032 / BR-036 | `GET /api/fx-rate` → `Receipt.fxRate`, locked at creation | Implemented | `api/fx-rate`, `ReceiptEditor.tsx` |

## Travel Spend

| FR | Requirement | Supports | Implementation | Status | Evidence |
|---|---|---|---|---|---|
| **FR-043** | The system shall let a user create trips that persist indefinitely | US-028 / FEAT-039 | Cloud `Trip` for signed-in users; `localStorage` for guests | Implemented | `api/travel` |
| **FR-044** | The system shall store trip receipts losslessly, preserving assignments, fees, discounts and currency | US-029 / FEAT-040 | `TripReceipt.payload` JSON keyed by the client receipt id | Implemented | `prisma/schema.prisma` |
| **FR-045** | Receipt writes shall survive loss of connectivity and a page reload | US-029 / FEAT-049 | Durable outbox with per-receipt coalescing, drained on reconnect | Implemented | `travel-outbox.ts` |
| **FR-046** | The system shall distinguish retryable from permanent sync failures and never silently discard a retryable write | US-029 | 5xx/429/offline requeue; 4xx discard + re-pull; `REVIEW_REQUIRED` migrates into the proposal buffer | Implemented | `useTravelData.ts` |
| **FR-047** | The system shall serialise writes per trip so dependent operations cannot race | US-029 | `tripWriteQueues` map of promises | Implemented | same |
| **FR-048** | The system shall report sync state to the user | US-029 | `deriveSyncStatus` → `idle \| saving \| error \| conflict` | Implemented | `travel-sync.ts` |
| **FR-049** | The system shall support a trip-level spend budget | US-030 / FEAT-041 | `Trip.budget`, spent-vs-target display | Implemented | `TravelSpendView.tsx` |
| **FR-050** | The system shall support an individual spend budget per participant | US-031 / FEAT-042 | `Participant.budget`, per-person progress and over/under label | Implemented | `IndividualBudgets` |
| **FR-051** | The system shall support receipts in multiple currencies, settling in the base currency | US-032 / BR-035 – BR-039 | 14 currencies, `receiptInBaseCurrency` as the single conversion point | Implemented | `currencies.ts`, `calculations.ts` |
| **FR-052** | The system shall maintain an append-only ledger of settle-up payments as the single source of truth | US-033 / BR-023 | `TripPayment` rows applied once at trip level | Implemented | `api/travel/[id]/payments` |
| **FR-053** | The system shall let a user mark one participant's share of one receipt as paid, recording only the outstanding remainder | US-034 / BR-031 | `source = share:<receiptId>:<participantId>`, amount = `min(share, owed − paid)` | Implemented | `TravelSpendView.togglePaidShare` |
| **FR-054** | The system shall prevent the same debt being settled twice across surfaces | US-034 / BR-030 | `pairSettlement` nets manual and marker payments together | Implemented | `settle-up.ts` |
| **FR-055** | The system shall let a trip owner invite collaborators by link, with expiry and revocation | US-035 / BR-052, BR-053 | 128-bit token, 7-day TTL, owner-only list/create/revoke | Implemented | `api/travel/[id]/invites` |
| **FR-056** | The system shall require owner approval before a member's edits change canonical trip state | US-037, US-038 / BR-049 | `403 REVIEW_REQUIRED` on direct writes; `TripChangeRequest` re-validated at approval and applied atomically | Implemented | `trip-access.ts`, `apply-change-ops.ts` |

## Persistence & sharing

| FR | Requirement | Supports | Implementation | Status | Evidence |
|---|---|---|---|---|---|
| **FR-057** | The system shall persist in-progress work locally without requiring an account | US-006 / FEAT-053 | `useLocalStorage` mirroring on every change | Implemented | `useLocalStorage.ts` |
| **FR-058** | The system shall report a failed local persist to the user rather than failing silently | US-029 | `PersistError { kind: "quota" \| "unavailable" }` surfaced as a toast | Implemented | `usePersistErrorToast.ts` |
| **FR-059** | The system shall let an authenticated user save a split to the server and resume it later | US-040 / FEAT-054 | `payloadJson` document; `?resume=<id>` rehydration | Implemented | `api/receipts`, `useSaveSplit.ts` |
| **FR-060** | A saved split shall expire 7 days after its most recent save | US-040 / BR-072 | `expiresAt` reset on every save; swept by the cleanup job | **Partial** — the sweep depends on a job that may not be scheduled | `saved-splits.ts` |
| **FR-061** | The system shall detect a concurrent save and refuse to silently overwrite | US-040 / BR-087 | `updateMany … WHERE version = ?` → `409 VERSION_CONFLICT` | Implemented | `api/receipts/[id]` |
| **FR-062** | The system shall let a user search and browse their saved splits | US-041 / FEAT-055 | Debounced search on receipt and trip name; cursor or offset pagination | Implemented | `ReceiptHistoryList.tsx` |
| **FR-063** | The system shall let a user delete a saved split | US-046 / FEAT-057 | `DELETE /api/receipts/[id]` and `supabaseDataService.deleteReceipt()` exist and are creator-gated — **no UI calls either** | **Missing (UI)** | `api/receipts/[id]` |
| **FR-064** | The system shall let anyone view a split through a read-only link that requires no account | US-043, US-045 / FEAT-059 | `SharedSummary` snapshot, 14-day TTL, server-rendered at `/s/<code>`, refreshed in place on re-save | Implemented | `api/share`, `app/s/[code]` |
| **FR-065** | The system shall produce a shareable text summary suitable for a messaging app | US-044 / FEAT-061 | Formatted text with per-person amounts, transfers and payment details; `wa.me` deep link, clipboard, native share | Implemented | `SummaryPanel.tsx` |
| **FR-065a** | The system shall let a user export a split to a spreadsheet-compatible file | US-047 / FEAT-063 | `buildReceiptCsv` + `downloadCsv` are complete and unit-tested — **no component imports them** | **Missing (UI)** | `lib/receipt/csv-export.ts` |

## Money & growth

| FR | Requirement | Supports | Implementation | Status | Evidence |
|---|---|---|---|---|---|
| **FR-066** | The system shall offer a paid plan granting unlimited AI scans for a fixed period, without auto-renewal | US-048 / BR-065 | `PRO_PLAN` = Rp 29.000 / 30 days, one-time | **Dark** — behind `FLAG_XENDIT_CHECKOUT` | `billing/plans.ts` |
| **FR-067** | The system shall record a pending payment before contacting the payment provider | US-048 / BR-068 | `payment.create` precedes `createInvoice` | Implemented (Dark) | `api/billing/checkout` |
| **FR-068** | The system shall grant entitlement exactly once per successful payment, tolerating duplicate callbacks | US-048 / BR-069 | Atomic `updateMany` status claim | Implemented (Dark) | `api/webhooks/xendit` |
| **FR-069** | The system shall treat an expired paid period as free at read time, and reconcile the stored plan nightly | US-049 / BR-066 | `isProActive` + a `CRON_SECRET`-protected daily job | Implemented | `entitlements.ts`, `api/cron/expire-pro` |
| **FR-070** | The system shall reward a user when someone they referred creates an account | US-050 / BR-071 | `?ref=` cookie → 14 days of Pro on the referee's first sign-in; unique `refereeId` | Implemented | `lib/referral.ts` |

## Administration

| FR | Requirement | Supports | Implementation | Status | Evidence |
|---|---|---|---|---|---|
| **FR-071** | The system shall provide an administrator view of accounts with search, filtering and global statistics | US-051 / FEAT-071 | Cursor pagination; `q` and `plan` filters; counters computed globally regardless of filter | Implemented | `api/admin/users` |
| **FR-072** | An administrator shall be able to change a user's plan, reset or override their scan quota, ban them, and grant or revoke admin | US-052 – US-054 | `PATCH /api/admin/users/[id]` with self-lockout guards and a bootstrap-admin protection | Implemented | `api/admin/users/[id]` |
| **FR-073** | Every privileged administrative mutation shall be recorded in an immutable audit trail, atomically with the change | US-056 / BR-078 | `user.update` + `adminAuditLog.createMany` in one `$transaction`; no FK, so the trail outlives the account | Implemented | same |
| **FR-074** | The system shall purge data past its retention window | US-041 / BR-072 – BR-077 | One transaction sweeping six categories | **Partial** — the endpoint exists but is **[UNKNOWN]** whether scheduled; not present in `vercel.json` | `api/admin/cleanup` |

## Platform

| FR | Requirement | Supports | Implementation | Status | Evidence |
|---|---|---|---|---|---|
| **FR-075** | The application shall be installable as a Progressive Web App on Android, iOS and desktop | US-057 / FEAT-075 | Manifest with verified icons, iOS meta tags, a service worker with a fetch handler | Implemented | `app/manifest.ts`, `public/sw.js` |
| **FR-076** | The application shall remain usable without connectivity once loaded | US-058 / FEAT-049 | Local-first state, SW caching, durable outbox for trips | **Partial** — there is no offline fallback page, and saving a Single/Multiple split offline simply fails | `public/sw.js` |
| **FR-077** | The application shall support light and dark themes with a persisted preference | US-059 / FEAT-076 | `next-themes`, class strategy, default light | Implemented | `ThemeProvider.tsx` |
| **FR-078** | The application shall present all user-facing copy in the user's chosen language | US-011 / FEAT-077 | Two type-checked dictionaries; URL-derived locale for marketing, persisted preference for tools | **Partial** — legal, pricing, history, dashboard, share, invite, admin, error pages and the welcome email are English-only | `lib/i18n/` |

---

## Status summary

| Status | Count | Requirements |
|---|---|---|
| **Implemented** | 65 | — |
| **Partial** | 7 | FR-008, FR-017, FR-041, FR-060, FR-074, FR-076, FR-078 |
| **Missing** | 4 | FR-011 (profile editing), FR-012 (account deletion), FR-063 (delete a saved split — UI), FR-065a (export — UI) |
| **Dark** | 3 | FR-066, FR-067, FR-068 (the paid plan, complete but flag-disabled) |
| **Total** | **79** | Counts verified by parsing the Status column of every row above |

### Requirements with the largest gap between intent and reality

1. **FR-063 and FR-065a** — both are fully implemented server-side or in a library, unit-tested, and
   **entirely unreachable**. They are the clearest instances of finished work that delivers no user
   value.
2. **FR-041** — the quota requirement is written for authenticated users and simply does not apply to
   guests, which is where the unmetered cost sits.
3. **FR-074** — if the cleanup job is not scheduled, then FR-060, BR-073, BR-074 and BR-077 are all
   stated policies that nothing enforces.
4. **FR-012** — account deletion is not merely unbuilt; the current foreign-key configuration makes
   it impossible without a schema change.
5. **FR-008** — ban enforcement is inconsistent (`/api/auth/me` is exempt) and does not revoke live
   sessions.
