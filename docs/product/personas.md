# Splitzy — Personas

> Every persona below is derived from a distinct code path, permission level, or product surface —
> not from generic user archetypes. Where a persona is a *product* construct rather than a *system*
> actor, that is stated.
> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**

---

## System actors vs product personas **[IMPLEMENTED]**

The codebase recognises exactly **five** distinct principals:

| Principal | Recognised by |
|---|---|
| Guest (no session) | absence of a session cookie |
| Authenticated user | `getAuthUser` returns a `User` row |
| Trip owner | `Trip.ownerId === user.id` |
| Trip member | a `TripMember` row |
| Admin | `role === "admin"` ∨ email in `ADMIN_BOOTSTRAP_EMAILS` |

Plus a **banned** state (`bannedAt != null`) that collapses to "guest" at every protected endpoint.

The personas below map onto these, plus two who never authenticate at all (the share-link recipient
and the invited collaborator) and one machine principal.

---

## P-01 — Andi, the Bill Payer *(primary persona)*

| | |
|---|---|
| **Role** | The person who paid the bill and now has to collect from everyone else. Creates splits, owns trips. |
| **Goals** | Get paid back accurately, without spending fifteen minutes on arithmetic or chasing people for a week. |
| **Problems** | Fronted a Rp 850.000 dinner for six. The receipt has PB1, a service charge, and a member discount. Two people shared a dish. Splitting evenly means losing money; splitting properly means doing per-person percentage maths at the table. |
| **Motivations** | Fairness he can *defend* — not "trust me, you owe 142k", but a breakdown nobody can argue with. Speed matters: this happens while everyone is still standing around waiting to leave. |
| **Behaviour** | Phone-first, standing up, on restaurant Wi-Fi. Photographs the receipt rather than typing it. Immediately pastes the result into the group's WhatsApp thread. Rarely returns to the app afterwards for a one-off dinner. |
| **Pain points** | Bad connectivity mid-scan · re-typing items the AI missed · people claiming they didn't order something · following up on transfers days later |
| **Product needs** | AI scan · fast per-item assignment · correct tax/service/fee allocation · a copy-paste-ready summary that includes his bank details · minimal-transfer settlement |
| **Evidence** | The entire `/single` wizard (3 steps, URL-backed) · `ReceiptInput` camera capture with `capture="environment"` · offline pre-check before scanning · `wa.me` deep link · `paymentInfo` per participant, rendered into the export text · `MAX_GUEST_SPLITS = 3` implies most usage is by unauthenticated one-off payers |

**[INFERRED]** This is the persona the product is optimised for. The `/single` route is the only one
guests can complete freely, it is the destination of the onboarding tour's final CTA
(`router.push("/single")`), and it is the highest-priority non-landing entry in the sitemap.

---

## P-02 — Sari, the Trip Organiser

| | |
|---|---|
| **Role** | Owns a multi-day, multi-person trip. Signed in. Owner of a cloud `Trip`. |
| **Goals** | Keep a running ledger across a week so the group settles up once, at the end, instead of arguing nightly. Stay inside a budget. |
| **Problems** | Six people, five days, three currencies. Different people pay for different things. Some settle up mid-trip in cash. Connectivity is unreliable abroad. |
| **Motivations** | Not being the person who loses track and eats the difference. Also: seeing whether the trip is on budget *while* there is still time to act. |
| **Behaviour** | Adds receipts throughout the day, often offline. Invites the group via a link. Checks the settle-up view repeatedly. Marks payments as they happen. |
| **Pain points** | Losing a receipt entered on a plane · currency conversion errors · two people editing the same trip · not knowing whether a save actually synced |
| **Product needs** | Cloud sync with **offline durability** · multi-currency with a rate locked at entry time · trip and per-person budgets · a settle-up ledger that survives partial payments · an explicit sync status |
| **Evidence** | `useTravelData` (1 128 lines) with a durable outbox, per-trip write queue, and `deriveSyncStatus` → `idle \| saving \| error \| conflict` · 14 currencies with a locked `fxRate` · `Trip.budget` + `Participant.budget` + the `IndividualBudgets` card · `TripPayment` ledger · invite links with a 7-day TTL |

**[INFERRED]** Travel Spend is the retention product. It is the only mode where data lives
indefinitely, the only one with collaboration, and by far the largest investment in code.

---

## P-03 — Budi, the Trip Member *(contributor)*

| | |
|---|---|
| **Role** | Joined someone else's trip via an invite link. Has an account. **Cannot write the trip directly.** |
| **Goals** | Add the receipt he just paid for, and see what he owes, without needing the organiser to enter it for him. |
| **Problems** | He has data the organiser needs but no authority to change the shared ledger. |
| **Motivations** | Contributing without being blamed for breaking the trip's numbers. |
| **Behaviour** | Adds a receipt, which silently becomes a **proposal**; waits for the owner to approve; sees his own pending change overlaid on the trip in the meantime. |
| **Pain points** | Waiting on the owner · a proposal that no longer applies because the trip moved on · not understanding why his edit "didn't save" |
| **Product needs** | Clear pending-review state · his own changes visible immediately · a reason when a proposal is declined |
| **Evidence** | `requireOwnerWrite` → `403 REVIEW_REQUIRED` on every direct write · `TripChangeRequest` with `ops`, `note`, `reviewNote` · `applyOpsToTrip` client-side overlay so he sees his own pending edits · `ProposalBar` and `ChangeOpList` components · `GET /change-requests` filters to `authorId: user.id` for members |

**[IMPLEMENTED]** This persona has a genuinely distinct permission model — a PR-style approval
workflow — which is unusual for a bill-splitting app and is the clearest evidence of a deliberate
contributor role.

---

## P-04 — Rina, the Anonymous Visitor

| | |
|---|---|
| **Role** | Landed from a Google search or a shared link. No account, and may never create one. |
| **Goals** | Find out whether this thing works, right now, without committing anything. |
| **Problems** | Every other expense app demands a sign-up before showing value. |
| **Motivations** | Immediate utility. Suspicion of yet another account. |
| **Behaviour** | Lands on `/` or `/id` → sees the onboarding tour once → taps into `/single` → completes a split → possibly shares it → leaves. May return and do it twice more before hitting the guest cap. |
| **Pain points** | Being asked to sign in before seeing anything · losing her work if she does sign in · not knowing her data is local |
| **Product needs** | Zero-friction entry · a working split without an account · **explicit reassurance about privacy** · a soft, non-destructive prompt when the cap is reached |
| **Evidence** | `/single` and `/travel` are public and in the sitemap · `MAX_GUEST_SPLITS = 3` then a *dismissible* `GuestLimitDialog` with a "Later" button · guests may create share links (`createdById` stays null) · **guests are not subject to the AI scan quota at all** · landing copy: *"Free, no sign-up needed"*; About: *"Pakai sebagai guest dan datamu tetap di perangkatmu"* |

**[IMPLEMENTED]** Signing in does **not** migrate her local data. `AuthProvider` records that the
old migration dialog was removed because *"it deleted the local copy after writing a payload the
editor could not reopen."* Saving is now an explicit action that keeps the local copy.

---

## P-05 — Dita, the Share-Link Recipient

| | |
|---|---|
| **Role** | Received a `/s/<code>` or `/share#…` link in a group chat. Almost certainly not a Splitzy user. |
| **Goals** | See what she owes and to whom, and get the account number to transfer to. |
| **Problems** | Screenshots of spreadsheets are unreadable on a phone and go stale the moment anything changes. |
| **Motivations** | Paying the right amount once, without downloading anything. |
| **Behaviour** | Taps the link, reads the summary, transfers the money, closes the tab. Never signs in. |
| **Pain points** | An expired link · numbers that changed after she looked · not knowing where to send the money |
| **Product needs** | A read-only view that works with no account · her own share clearly visible · the payer's bank details · an honest signal when the numbers were last updated |
| **Evidence** | `/s/[code]` is a server-rendered public page that distinguishes *expired* from *not found* · `SharedSummary.updatedAt` exists specifically because *"an amount that can move silently after everyone agreed on it is worse than a stale one"* · re-saving a split **refreshes** the existing link rather than minting a rival · `paymentInfo` is carried into the share payload · both share surfaces are `noindex` and `robots`-disallowed |

**[INFERRED]** This is the product's viral surface — the only path by which a non-user encounters
Splitzy through another user — yet **it is entirely in English**, with no dictionary usage on
`/s/[code]` or `/share`, in a market where the sender is likely writing in Indonesian.

---

## P-06 — The Operator / Admin

| | |
|---|---|
| **Role** | Runs the service. `role === "admin"`, or an email in `ADMIN_BOOTSTRAP_EMAILS`. **[INFERRED]** the product owner themselves — the repo has a single commit author. |
| **Goals** | Know whether anyone is using it, control abuse and cost, and grant or fix access without a database console. |
| **Problems** | AI scans cost real money per call. A single abusive account can run up a bill. Support requests ("I ran out of scans") need a lever. |
| **Motivations** | Operating safely on a free-tier Supabase with no managed backups. |
| **Behaviour** | Opens `/admin`, searches a user, opens the drawer, changes plan or resets quota, checks today's activity. |
| **Pain points** | Locking themselves out · not being able to explain a change later · not knowing which feature people actually use |
| **Product needs** | User search + plan/banned filters · global counters that ignore the current filter · per-user quota override · ban/unban · role grant/revoke · a daily activity view in **their own timezone** · an audit trail |
| **Evidence** | `/admin` with `noindex` · `GET /api/admin/users` with cursor pagination and always-global `stats` · `PATCH /api/admin/users/[id]` supporting `plan`, `resetQuota`, `aiScanLimit`, `ban`, `role` · self-lockout guards (cannot ban yourself, cannot revoke your own admin) · bootstrap-email allowlist as a **lockout-recovery** mechanism · `AdminAuditLog` written **in the same transaction** as the change · `GET /api/admin/activity` with a client-supplied local-time window |

---

## P-07 — Machine Callers *(non-human actors)* **[IMPLEMENTED]**

| Actor | Credential | Purpose |
|---|---|---|
| **Vercel Cron** | `Authorization: Bearer ${CRON_SECRET}` | Daily Pro-expiry downgrade at 03:00 UTC |
| **Xendit** | `x-callback-token` header | Invoice status callback → grants Pro |
| **Cleanup job** | `Bearer ${CLEANUP_TOKEN}` or `x-vercel-cron: 1` | Retention sweep. **[UNKNOWN]** whether it is scheduled anywhere |
| **Uptime monitor** | none | `GET /api/health`. **[UNKNOWN]** whether one exists |
| **Googlebot** | none | Crawls the marketing tree; explicitly reasoned about in `robots.ts` and `sitemap.ts` |

Googlebot is worth naming as a persona in its own right: `/multiple` is deliberately **excluded from
the sitemap** because the proxy 307s unauthenticated requests, and the code comment flags making it
publicly viewable as an unresolved *product* decision, not an SEO one.

---

## Persona → capability matrix **[IMPLEMENTED]**

| Capability | P-04 Guest | P-01 Payer (signed in) | P-02 Owner | P-03 Member | P-05 Recipient | P-06 Admin |
|---|---|---|---|---|---|---|
| `/single` split | ✅ (3 cap) | ✅ | ✅ | ✅ | — | ✅ |
| `/multiple` split | ❌ proxy-gated | ✅ | ✅ | ✅ | — | ✅ |
| Travel trip (local) | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Travel trip (cloud) | ❌ | ✅ | ✅ owner | ✅ read | — | ✅ |
| AI scan | ✅ **unmetered** | ✅ 15/mo | ✅ | ✅ | — | ✅ |
| Create a share link | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| View a share link | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Save & resume a split | ❌ | ✅ | ✅ | ✅ | — | ✅ |
| History | ❌ | ✅ | ✅ | ✅ | — | ✅ |
| Write a cloud trip directly | ❌ | — | ✅ | ❌ `REVIEW_REQUIRED` | — | ❌ (unless owner) |
| Propose a change | ❌ | — | ✅ | ✅ | — | — |
| Approve / decline | ❌ | — | ✅ | ❌ | — | ❌ (unless owner) |
| Invite / revoke | ❌ | — | ✅ | ❌ | — | ❌ |
| Record a settle-up | ❌ | — | ✅ | ❌ | — | ❌ |
| Buy Pro | ❌ | ✅ | ✅ | ✅ | — | ✅ |
| Referral link | ❌ | ✅ | ✅ | ✅ | — | ✅ |
| `/admin` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

**[IMPLEMENTED]** Note the row that surprises: an admin has no elevated rights over *user data* —
`/admin` exposes accounts, quota and activity, never the contents of anyone's receipts.

---

## Personas the product does *not* serve **[INFERRED]**

Named so their absence is legible:

- **The corporate expense claimant.** No categories, no reimbursement workflow, no receipt image
  storage, no approval chain for expenses. The one artefact aimed at this user — **CSV export** —
  is fully implemented, unit-tested, and **wired to no UI at all**.
- **The recurring-household user.** No recurring expenses, no standing groups, no monthly rollup.
  "Groups" do not exist; trips do, and they are episodic.
- **The non-payer participant who wants their own view.** A participant is a name in someone else's
  payload. They can read a share link, but they cannot log in and see "all bills I'm part of" unless
  they happen to also be a `TripMember`.

---

## Open questions

| # | Question | Label |
|---|---|---|
| 1 | Is the trip **member** role expected to grow (direct writes with conflict resolution), or is approval the intended permanent model? | **[UNKNOWN]** |
| 2 | Should the share-link recipient (P-05) get a localised page? It is the main non-user touchpoint and is English-only | **[UNKNOWN]** |
| 3 | Was CSV export built for a persona that was later dropped, or is it simply unfinished? | **[UNKNOWN]** |
| 4 | Is unmetered guest scanning an intentional acquisition subsidy for P-04? | **[UNKNOWN]** |
| 5 | Is there more than one admin in production? | **[UNKNOWN]** |
