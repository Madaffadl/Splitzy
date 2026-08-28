# Splitzy — Traceability Matrix

> Links every functional requirement to its story, feature, API, business rules and database
> entities — and, more usefully, surfaces the two failure modes a matrix exists to find:
> **orphaned functionality** (built, but nothing requires or reaches it) and **uncovered
> requirements** (required, but not implemented).
>
> `FR` → [functional-requirements.md](./functional-requirements.md) ·
> `US` → [user-stories.md](./user-stories.md) ·
> `FEAT` → [../product/feature-catalog.md](../product/feature-catalog.md) ·
> `API` → [../api/endpoints.md](../api/endpoints.md) ·
> `BR` → [business-rules.md](./business-rules.md) ·
> `AC` → [acceptance-criteria.md](./acceptance-criteria.md)

**Status key:** ✅ Complete · ⚠️ Partial · 🚫 Gap · 🌑 Dark (built, flag-disabled)

---

## 1. Identity & access

| FR | US | FEAT | API | BR | DB Entity | Status |
|---|---|---|---|---|---|---|
| FR-001 | US-001, US-002 | FEAT-001 | API-002, API-003 | BR-040 | `User` | ✅ |
| FR-002 | US-001 | FEAT-001 | API-002 | BR-041 | `User`, `ActivityEvent` | ✅ |
| FR-003 | US-001 | FEAT-001 | API-002 | BR-042 | `User` | ✅ |
| FR-004 | US-004 | FEAT-003 | — *(proxy excludes `/api`)* | BR-045 | — | ✅ |
| FR-005 | US-005 | FEAT-003 | — | BR-044 | — | ✅ |
| FR-006 | US-004 | FEAT-003 | — | BR-045 | — | ✅ |
| FR-007 | US-003 | FEAT-002 | — | BR-043 | — | ✅ |
| FR-008 | US-053 | FEAT-006 | API-050 | BR-043 | `User.bannedAt` | ⚠️ `/api/auth/me` exempt; no session revocation |
| FR-009 | US-006 | FEAT-004 | API-008, API-045 | BR-057 – BR-059 | `SharedSummary` | ✅ |
| FR-010 | US-007 | FEAT-005 | — | BR-057 | — | ✅ |
| FR-011 | — | FEAT-009 | — | — | `User` | 🚫 **No story, no feature, no API** |
| FR-012 | — | FEAT-009 | — | — | `User` | 🚫 **Blocked by 5 `Restrict` FKs** |

## 2. Onboarding & marketing

| FR | US | FEAT | API | BR | DB Entity | Status |
|---|---|---|---|---|---|---|
| FR-013 | US-008 | FEAT-010 | — | — | — | ✅ |
| FR-014 | US-008 | FEAT-010 | — | — | — | ✅ |
| FR-015 | US-009 | FEAT-011 | — | BR-089 | — | ✅ |
| FR-016 | US-010 | FEAT-012, FEAT-013 | — | BR-090, BR-091 | — | ✅ |
| FR-017 | US-010 | FEAT-014 | — | BR-091 | — | ⚠️ English only |
| FR-018 | US-048 | FEAT-015 | API-046 | BR-065, BR-094 | `Payment` | ✅ *(page)* / 🌑 *(checkout)* |
| FR-019 | — | FEAT-018 | — | BR-093 | — | ✅ |

## 3. Splitting engine

| FR | US | FEAT | API | BR | DB Entity | Status | AC coverage |
|---|---|---|---|---|---|---|---|
| FR-020 | US-013 | FEAT-021 | — | BR-080, BR-081 | `participantsJson` | ✅ | — |
| FR-021 | US-013 | FEAT-022 | — | — | *(localStorage)* | ✅ | — |
| FR-022 | US-014 | FEAT-023 | — | BR-080 | `payloadJson.items` | ✅ | AC-069 |
| FR-023 | US-015 | FEAT-024 | — | BR-002, BR-004 | `payloadJson` | ✅ | AC-041 – AC-043 |
| FR-024 | US-016 | FEAT-025 | — | BR-001, BR-003 | `payloadJson` | ✅ | AC-044 – AC-046 |
| FR-025 | US-017 | FEAT-026 | — | BR-006, BR-007 | `payloadJson` | ✅ | AC-047, AC-048 |
| FR-026 | US-017 | FEAT-026 | — | BR-008 | `payloadJson` | ✅ | AC-049 |
| FR-027 | US-018 | FEAT-027 | — | BR-009 – BR-011 | `payloadJson.fees` | ✅ | AC-050 – AC-052 |
| FR-028 | US-019 | FEAT-028 | — | BR-012 – BR-014 | `payloadJson.discounts` | ✅ | AC-053 – AC-055 |
| FR-029 | US-019 | FEAT-028 | — | BR-015 | `payloadJson` | ✅ | AC-057 |
| FR-030 | US-019 | FEAT-028 | — | BR-016 | `payloadJson` | ✅ | AC-056 |
| FR-031 | US-020 | FEAT-029 | API-023 | BR-029, BR-082 | `Receipt.payerId` | ✅ | AC-058 |
| FR-032 | US-012 | FEAT-030 | — | BR-017 | `payloadJson` | ✅ | AC-041 – AC-057 |
| FR-033 | US-015 | FEAT-030 | — | BR-018 | — | ✅ | AC-042, AC-045, AC-048 |
| FR-034 | US-021 | FEAT-031 | — | BR-026 – BR-028 | — | ✅ | AC-060 – AC-062 |
| FR-035 | US-022 | FEAT-032 | — | BR-017 | — | ✅ | AC-063 |
| FR-036 | US-023 | FEAT-033 | — | BR-080 | `payloadJson.participants` | ✅ | AC-064, AC-065 |

## 4. AI receipt scanning

| FR | US | FEAT | API | BR | DB Entity | Status |
|---|---|---|---|---|---|---|
| FR-037 | US-025 | FEAT-035 | API-045 | — | — | ✅ |
| FR-038 | US-025 | FEAT-035 | API-045 | BR-086 | — | ✅ |
| FR-039 | US-025 | FEAT-035 | API-045 | BR-085 | — | ✅ |
| FR-040 | US-025 | FEAT-035 | API-045 | — | — | ✅ |
| FR-041 | US-026 | FEAT-036, FEAT-037 | API-045, API-004 | BR-059 – BR-063 | `User.aiScanCount` | ⚠️ **Guests exempt; not atomic** |
| FR-042 | US-032 | FEAT-038 | API-007 | BR-036 | `payloadJson.fxRate` | ✅ |

## 5. Travel Spend

| FR | US | FEAT | API | BR | DB Entity | Status |
|---|---|---|---|---|---|---|
| FR-043 | US-028 | FEAT-039 | API-025 – API-029 | BR-049, BR-080 | `Trip` | ✅ |
| FR-044 | US-029 | FEAT-040 | API-031 – API-033 | BR-081 | `TripReceipt` | ✅ |
| FR-045 | US-029 | FEAT-049 | API-031 | — | *(localStorage outbox)* | ✅ |
| FR-046 | US-029 | FEAT-049 | API-031 | — | — | ✅ |
| FR-047 | US-029 | FEAT-049 | API-028, API-031 | BR-087 | — | ✅ |
| FR-048 | US-029 | FEAT-049 | — | — | — | ✅ |
| FR-049 | US-030 | FEAT-041 | API-028 | — | `Trip.budget` | ✅ |
| FR-050 | US-031 | FEAT-042 | API-028 | — | `participantsJson[].budget` | ✅ |
| FR-051 | US-032 | FEAT-043 | API-007 | BR-035 – BR-039 | `TripReceipt.payload` | ✅ |
| FR-052 | US-033 | FEAT-044 | API-034, API-035 | BR-023 – BR-025 | `TripPayment` | ✅ |
| FR-053 | US-034 | FEAT-045 | API-034 | BR-031 | `TripPayment.source` | ✅ |
| FR-054 | US-034 | FEAT-045 | — | BR-030, BR-032 | `TripPayment` | ✅ |
| FR-055 | US-035, US-036 | FEAT-047 | API-036 – API-038, API-043, API-044 | BR-052, BR-053 | `TripInvite`, `TripMember` | ✅ |
| FR-056 | US-037, US-038 | FEAT-048 | API-039 – API-042 | BR-049, BR-051, BR-081 | `TripChangeRequest` | ✅ |

## 6. Persistence & sharing

| FR | US | FEAT | API | BR | DB Entity | Status |
|---|---|---|---|---|---|---|
| FR-057 | US-006 | FEAT-053 | — | — | *(localStorage)* | ✅ |
| FR-058 | US-029 | FEAT-053 | — | — | — | ✅ |
| FR-059 | US-040 | FEAT-054 | API-010, API-011, API-012 | BR-046, BR-083 | `Receipt.payloadJson` | ✅ |
| FR-060 | US-040 | FEAT-054 | API-054 | BR-072 | `Receipt.expiresAt` | ⚠️ **Sweep may not be scheduled** |
| FR-061 | US-040 | FEAT-054 | API-012 | BR-087 | `Receipt.version` | ✅ |
| FR-062 | US-041 | FEAT-055 | API-009 | BR-047 | `Receipt` | ✅ |
| **FR-063** | **US-046** | **FEAT-057, FEAT-058** | **API-013, API-014** | **BR-046** | `Receipt.deletedAt` | 🚫 **API + service method exist; no UI caller** |
| FR-064 | US-043, US-045 | FEAT-059, FEAT-060 | API-008 | BR-058, BR-073, BR-079 | `SharedSummary` | ✅ |
| FR-065 | US-044 | FEAT-061, FEAT-062 | — | — | — | ✅ |
| **FR-065a** | **US-047** | **FEAT-063** | — | — | — | 🚫 **Module + unit test exist; no UI caller** |

## 7. Money & growth

| FR | US | FEAT | API | BR | DB Entity | Status |
|---|---|---|---|---|---|---|
| FR-066 | US-048 | FEAT-064, FEAT-065 | API-046 | BR-065 | `Payment`, `User.plan` | 🌑 |
| FR-067 | US-048 | FEAT-065 | API-046 | BR-068 | `Payment` | 🌑 |
| FR-068 | US-048 | FEAT-066 | API-047 | BR-069 | `Payment`, `User.proExpiresAt` | 🌑 |
| FR-069 | US-049 | FEAT-064, FEAT-067 | API-004, API-048 | BR-066, BR-067 | `User.proExpiresAt` | ✅ |
| FR-070 | US-050 | FEAT-068 | API-005, API-002 | BR-071 | `Referral` | ✅ |

## 8. Administration

| FR | US | FEAT | API | BR | DB Entity | Status |
|---|---|---|---|---|---|---|
| FR-071 | US-051 | FEAT-071 | API-049, API-051 | BR-054 | `User`, `Trip` | ✅ |
| FR-072 | US-052 – US-054 | FEAT-071 | API-050 | BR-055, BR-056, BR-060 | `User` | ✅ |
| FR-073 | US-056 | FEAT-072 | API-053 | BR-078 | `AdminAuditLog` | ✅ |
| FR-074 | US-041, US-055 | FEAT-074 | API-054 | BR-072 – BR-077 | 6 tables | ⚠️ **[UNKNOWN]** if scheduled |
| *(none)* | US-055 | FEAT-073 | API-052 | BR-077, BR-084 | `ActivityEvent` | ✅ **Feature with no FR — see §10** |

## 9. Platform

| FR | US | FEAT | API | BR | DB Entity | Status |
|---|---|---|---|---|---|---|
| FR-075 | US-057 | FEAT-075 | — | — | — | ✅ |
| FR-076 | US-058 | FEAT-049, FEAT-075 | — | — | — | ⚠️ No offline page; Single/Multiple saves fail offline |
| FR-077 | US-059 | FEAT-076 | — | — | — | ✅ |
| FR-078 | US-011 | FEAT-077 | — | BR-089, BR-090 | — | ⚠️ 10 surfaces English-only |

---

## 10. Orphans — implemented, but with no requirement or no way to reach it

The primary output of this matrix.

### 10.1 Unreachable code — built, tested, and no user can use it

| Item | Evidence of completeness | Why unreachable |
|---|---|---|
| **CSV export** (FR-065a, FEAT-063) | 110 lines, RFC-4180 quoting, UTF-8 BOM, dated filename, **its own unit-test file** | No component imports `buildReceiptCsv` or `downloadCsv` |
| **Delete a saved split** (FR-063, FEAT-057) | Rate-limited, creator-gated, soft-deleting API + a typed service method | `ReceiptHistoryCard` offers only "Continue" |
| **Restore a saved split** (FEAT-058) | Idempotent API | No UI can delete, so nothing can be restored |
| **`EmptyState` component** | Full component in `components/ui/` | Zero consumers |

### 10.2 Orphaned API surface — endpoints with no caller in the shipped frontend

| Endpoints | Note |
|---|---|
| API-015 – API-024 *(the whole legacy `/api/trips/*` family — 10 endpoints)* | Superseded by `/api/travel/*`; still fully implemented, authorized and **writable** |
| API-013, API-014 *(receipt delete / restore)* | See §10.1 |
| API-054 *(cleanup)* | No caller and **not in `vercel.json`** |

That is **13 of 54 endpoints (24 %)** with no consumer.

### 10.3 Orphaned service methods

`supabaseDataService` exposes 7 methods; **5 are never called**: `deleteReceipt`, `getReceipts`,
`getTrips`, `getTrip`, `createTrip`. `ReceiptHistoryList` bypasses the service and calls
`/api/receipts` with a raw `fetch`.

### 10.4 Orphaned analytics

| Item | Note |
|---|---|
| `EVENTS.splitCompleted` | **The core conversion event** — declared, never fired |
| `EVENTS.modeSelected` | Declared, never fired |
| `EVENTS.pricingViewed` | Declared, never fired |
| `identify()`, `resetAnalytics()` | Exported, never called — so no PostHog person profiles exist |
| `BEACON_TYPES` `"share.created"` | Allowlisted server-side, never sent |
| `ErrorBoundary.onError` | Prop written explicitly for error reporting, never supplied |

### 10.4b Features with no user story — and why

| Feature | Reason |
|---|---|
| FEAT-007 email/password auth | A **Missing** feature recording an absence. US-001 states that Google OAuth is the only method |
| FEAT-008 password reset | Not applicable — there are no passwords to reset |
| FEAT-034 percentage / custom-amount splitting | A **Missing** feature recording a deliberate model choice: Splitzy splits by consumption |

All three are catalogued so their absence is legible; none represents unbuilt requested work.

### 10.5 Features with no functional requirement

| Feature | Why it has no FR |
|---|---|
| FEAT-073 admin activity feed | Operational tooling, not a product requirement — listed in §8 for completeness |
| FEAT-016 SEO entity graph | Covered by NFR-068 – NFR-075 rather than an FR |
| FEAT-017 social share card | Covered by NFR-072 territory |
| FEAT-051 realtime updates | An optimisation of FR-048, flag-disabled |
| FEAT-079 observability | Covered by NFR-047 – NFR-051 |

---

## 11. Requirements with no implementation

| FR | Requirement | Blocker |
|---|---|---|
| FR-011 | Profile editing | Not built. Profile fields are overwritten from Google on every sign-in |
| FR-012 | Account deletion | Not built **and currently impossible** — five `User` relations use `Restrict` |
| FR-063 | Delete a saved split | UI only — the whole server side exists |
| FR-065a | Export a split | UI only — the whole library exists |

Plus one advertised capability with no requirement *and* no implementation:
**"Priority AI processing"** in `PRO_FEATURES` — Pro and free share the same model, rate limit and
queue.

---

## 12. Business rules with no automated verification

Of 94 rules, these carry material risk and have **no test**:

| BR | Rule | Risk |
|---|---|---|
| BR-043 | Banned users treated as unauthenticated | Auth bypass |
| BR-044 | `/multiple` and `/history` require auth | Auth bypass |
| BR-046 | Only the creator may write a saved split | **Data tampering** |
| BR-047 | Saved splits readable only by involved parties | **Data leak** |
| BR-049 | Members cannot write a trip directly | **Data tampering** |
| BR-050 | Trip existence not disclosed to non-members | Information disclosure |
| BR-051 | Members see only their own change requests | Information disclosure |
| BR-055 | Admin self-lockout guards | Operational lockout |
| BR-059 | Quota enforced for authenticated users | Cost |
| BR-068, BR-069 | Payment written before provider call; webhook idempotency | **Revenue correctness** |
| BR-087 | Optimistic locking → 409 | Silent data loss |
| BR-088 | CSRF same-origin | **CSRF** |

**[INFERRED]** Every rule in this list is an **authorization, money or integrity** rule. The
94-rule catalogue is well covered where it concerns arithmetic and poorly covered everywhere the
consequences are security or revenue. This is the single clearest actionable finding of the matrix —
see RNFR-013 in
[non-functional-requirements.md](./non-functional-requirements.md).

---

## 13. Database entities → features

| Entity | Features | Active? |
|---|---|---|
| `User` | FEAT-001, 006, 036, 064, 068, 071 | ✅ |
| `Payment` | FEAT-065, 066 | 🌑 Dark |
| `Referral` | FEAT-068 | ✅ |
| `Trip` | FEAT-039, 041, 046, 052 | ✅ |
| `TripReceipt` | FEAT-040 | ✅ |
| `TripPayment` | FEAT-044, 045 | ✅ |
| `TripInvite` | FEAT-047 | ✅ |
| `TripMember` | FEAT-046, 047, 048 | ✅ |
| `TripChangeRequest` | FEAT-048 | ✅ |
| `Receipt` | FEAT-054, 055, 056 *(payload path)* | ✅ |
| **`ReceiptItem`** | Legacy relational path only | ⚠️ **Written only by the orphaned API-023** |
| **`ItemAssignment`** | Legacy relational path only | ⚠️ **Same — and the reason `payloadJson` exists** |
| `SharedSummary` | FEAT-059 | ✅ |
| `AdminAuditLog` | FEAT-072 | ✅ |
| `ActivityEvent` | FEAT-073, 079 | ✅ |

**[INFERRED]** Two of fifteen entities are written only by an orphaned endpoint. They are the
Contract half of an Expand–Contract migration that has not been completed.

---

## 14. Coverage scorecard

| Dimension | Result |
|---|---|
| Functional requirements | 79 |
| — Complete | 65 (82 %) |
| — Partial | 7 (9 %) |
| — Gap | 4 (5 %) |
| — Dark | 3 (4 %) |
| User stories | 60 · **57 met**, 2 unmet by UI, 1 dark |
| Features | 79 · 64 implemented, 3 flag-disabled, 7 partial, 5 missing |
| Business rules | 94 · all traced to code; **12 high-risk rules untested** |
| API endpoints | 54 · **13 with no consumer (24 %)** |
| Acceptance criteria | 162 · **105 automated (65 %)** |
| Every FEAT has ≥ 1 US | ✅ |
| Every US has acceptance criteria | ✅ |
| Every BR cites a source file | ✅ |
| Every FR maps to ≥ 1 US | ⚠️ **FR-011 and FR-012 have no story** — they are gaps identified during documentation, not user-requested work |

---

## 15. The five findings worth acting on

1. **Two finished features are unreachable** (FR-063 delete, FR-065a export). Wiring either is a
   small change with immediate user value; deleting them is equally valid. Leaving them is the only
   bad option.
2. **The core conversion event is never fired.** `split_completed` means the product cannot measure
   whether anyone finishes a split.
3. **Twelve high-risk business rules — all authorization, money or integrity — have no test.**
4. **24 % of the API surface has no consumer**, including ten fully-writable legacy endpoints.
5. **The retention cleanup job may not be scheduled**, which would make BR-072 – BR-077 policies
   that nothing enforces.
