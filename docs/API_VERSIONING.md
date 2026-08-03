# API Versioning Strategy

> Status: baseline established in Sprint 3. Full `/api/v1` namespace migration is
> intentionally **deferred** — see "Why not restructure now" below.

## Current state

- The API lives under `/api/*` and is consumed by Splitzy's own Next.js
  frontend in the same repo (a tightly-coupled, first-party client).
- Every `/api/*` response now carries an **`X-API-Version`** header
  (`next.config.mjs`), currently `1`. The constant is in
  [`src/lib/api-version.ts`](../src/lib/api-version.ts).
- This is the **v1 baseline**: the current unversioned surface *is* version 1.

## Go-forward rules

1. **Additive changes need no version bump.** New optional fields, new
   endpoints, and new query params are backward-compatible — ship them on v1.
2. **Breaking changes get a new namespace.** When a breaking change is
   unavoidable (removing/renaming a field, changing response shape or status
   semantics), introduce the new behaviour under `/api/v2/...` and keep the v1
   route working until all clients migrate. Bump `API_VERSION` accordingly and
   set the header per-namespace.
3. **Clients should read `X-API-Version`**, not infer the contract from status
   codes or payload heuristics.
4. **Error shape is part of the contract** — `{ error, code, ...context }` with
   a stable machine-readable `code` (see `src/lib/api-response.ts`). Changing a
   `code`'s meaning is breaking.

## Why not restructure into /api/v1 now

Moving ~30 existing routes under `/api/v1` today would be a large, purely
mechanical change with real risk (every frontend call site must move in
lockstep) and near-zero user value while the only client is our own frontend.
The higher-leverage moment to do it is when a **second client** appears (e.g. a
mobile app) or the **first breaking change** is needed — at which point v2 is
introduced alongside v1 and the convention above kicks in. Until then the
`X-API-Version` header makes the contract explicit and the migration cheap to
start.
