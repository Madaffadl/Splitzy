"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  classifyPersistError,
  useLocalStorage,
  type PersistError,
} from "@/hooks/useLocalStorage";
import { createClient } from "@/lib/supabase/client";
import { isEnabled } from "@/lib/flags";
import { TravelTrip, Receipt, Participant, TripPayment, TripMember } from "@/types";
import { generateId, generateUuid } from "@/lib/utils";
import {
  classifyWriteResult,
  deriveSyncStatus,
  addReceiptToTrips,
  replaceReceiptInTrips,
  removeReceiptFromTrips,
  addPaymentToTrips,
  replacePaymentInTrips,
  removePaymentFromTrips,
} from "@/lib/travel/travel-sync";
import { mergePrefs } from "@/lib/travel/trip-prefs";
import { ReceiptOp, pushOp, removeOp, replayOps } from "@/lib/travel/travel-outbox";
import {
  ChangeOp,
  TripProposal,
  TripChangeRequestDTO,
  applyOpsToTrip,
} from "@/lib/travel/change-ops";

export interface TravelStore {
  trips: TravelTrip[];
  activeId: string | null;
}

const LOCAL_KEY = "splitzy-travel";
const DEFAULT: TravelStore = { trips: [], activeId: null };

// One rebase attempt after a version conflict before it reaches the user.
const MAX_PUT_ATTEMPTS = 2;
// Floor between two foreground-triggered refetches, so tab-switching doesn't
// turn into a request per switch.
const FOCUS_REFETCH_MIN_MS = 15_000;

// Local-first (cloud mode) persistence. Both are scoped to the signed-in user
// so a shared device never shows one account's data to the next, and are cleared
// on sign-out (see useAuth). MIRROR = last-known trips for instant/offline paint;
// OUTBOX = receipt writes not yet synced to the server.
export const MIRROR_KEY = "splitzy-travel-mirror";
export const OUTBOX_KEY = "splitzy-travel-outbox";
// PROPOSALS = a member's local edit buffers (per trip) awaiting owner review.
// Members never write the trip directly; their edits accumulate here and are
// submitted as change requests. Keyed per-account like the mirror/outbox.
export const PROPOSALS_KEY = "splitzy-travel-proposals";

function readScoped<T>(key: string, uid: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { uid: string; data: T };
    // Ignore a payload belonging to a different account (stale device cache).
    return parsed.uid === uid ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Returns null on success, or the failure so the caller can tell the user.
 *
 * This used to swallow the error with a "best effort" comment. The mirror it
 * writes IS the trip data for an authenticated user between loads, so a full
 * quota meant every receipt added after that point looked saved, worked all
 * day, and was gone on the next reload — silently, in the one mode that
 * accumulates the most data.
 */
function writeScoped<T>(key: string, uid: string, data: T): PersistError | null {
  if (typeof window === "undefined") return null;
  try {
    window.localStorage.setItem(key, JSON.stringify({ uid, data }));
    return null;
  } catch (error) {
    console.warn(`useTravelData: failed to save "${key}":`, error);
    return { kind: classifyPersistError(error), key, at: Date.now() };
  }
}

/**
 * Unified Travel Spend data layer.
 *
 * Guest  → localStorage only (same behaviour as before).
 * Auth   → cloud via /api/travel; React state as working copy.
 *
 * Receipt ids double as the DB row id (POST /receipts upserts using
 * receipt.id as the primary key), so no separate _rid tracking is needed.
 */
export function useTravelData() {
  const { isAuthenticated, isLoading: authLoading, dbUser } = useAuth();
  // The 4th element was being dropped on the floor. It is the only signal that
  // a guest's trips have stopped being written to disk.
  const [local, setLocal, , localPersistError] = useLocalStorage<TravelStore>(
    LOCAL_KEY,
    DEFAULT
  );
  // Failures from the per-account mirror / outbox / proposal writes, which do
  // not go through useLocalStorage.
  const [scopedPersistError, setScopedPersistError] =
    useState<PersistError | null>(null);
  // Stable, so adding it to a dependency array changes nothing. Clears itself
  // once a write succeeds again — e.g. after the user deletes an old trip.
  const trackScoped = useCallback((err: PersistError | null) => {
    setScopedPersistError((prev) => {
      if (err) return err;
      return prev === null ? prev : null;
    });
  }, []);
  // Stable per-account key for the mirror/outbox. dbUser is the canonical app
  // user; using it (not the transient supabase id) keeps the key from changing
  // mid-session, which would otherwise orphan the cached data.
  const uid = dbUser?.id ?? null;

  // ── Cloud state ──────────────────────────────────────────────────────────
  const [cloudTrips, _setCloudTrips] = useState<TravelTrip[]>([]);
  // Ref mirrors state so callbacks always read the latest value without
  // needing cloudTrips in their dependency arrays (avoids stale closures).
  const cloudRef = useRef<TravelTrip[]>([]);
  const [cloudActiveId, setCloudActiveId] = useState<string | null>(null);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  // Bumped whenever cloud state is authoritatively replaced (a fresh load or a
  // sync). An in-flight loadCloud whose sequence is stale on resolve is dropped,
  // so a slow initial load can't clobber trips a subsequent sync just added.
  const loadSeqRef = useRef(0);
  // Serialises writes per trip so operations that depend on each other never
  // race. Two guarantees this buys us:
  //  1. Rapid successive trip PUTs never send the same expectedVersion twice
  //     (which would produce a false-positive 409 "changed elsewhere" even when
  //     the only editor is the current user).
  //  2. A receipt write never reaches the server before a participant edit that
  //     precedes it has committed — otherwise the server would validate the
  //     receipt against a stale participant list and reject it (data loss).
  const tripWriteQueues = useRef<Map<string, Promise<void>>>(new Map());

  // ── Local-first outbox (durable receipt writes) ────────────────────────────
  // Receipt add/update/delete are applied to the mirror immediately and recorded
  // here; a background loop drains them to the server, surviving reloads and
  // offline periods so a receipt entered on flaky Wi-Fi is never lost.
  const outboxRef = useRef<ReceiptOp[]>([]);
  const drainingRef = useRef(false);
  const hydratedRef = useRef(false);
  const drainRef = useRef<() => void>(() => {});
  const [pendingSync, setPendingSync] = useState(0);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  // Sync dialog: offer to push local trips to cloud when user signs in.
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const syncCheckedRef = useRef(false);

  // ── Sync status (explicit feedback + conflict handling) ────────────────────
  // Count of in-flight cloud writes, the last write error (if any), and whether
  // a concurrent edit was detected (optimistic-lock 409). Surfaced to the UI so
  // saves aren't silent and collaboration conflicts don't drop data unseen.
  const [pendingWrites, setPendingWrites] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  // ── Member proposal buffers + owner review inbox ───────────────────────────
  // proposals: this member's local edits per trip (draft = editable, submitted =
  //   awaiting review). Persisted per-account and overlaid on the server trip so
  //   the member sees their own pending changes.
  // changeRequests: pending requests for trips the current user OWNS (the inbox).
  const [proposals, setProposals] = useState<Record<string, TripProposal>>({});
  const proposalsRef = useRef<Record<string, TripProposal>>({});
  const [changeRequests, setChangeRequests] = useState<Record<string, TripChangeRequestDTO[]>>({});
  const proposalsHydratedRef = useRef(false);

  const commitProposals = useCallback(
    (next: Record<string, TripProposal>) => {
      proposalsRef.current = next;
      setProposals(next);
      if (uid) trackScoped(writeScoped(PROPOSALS_KEY, uid, next));
    },
    [uid, trackScoped]
  );

  // ── Helpers ───────────────────────────────────────────────────────────────
  // The ref is the synchronous source of truth; React state is the *rendering*
  // copy that follows it.
  //
  // This used to update `cloudRef.current` from inside the React updater. React
  // only runs that updater during the render phase, so the ref lagged a commit
  // behind — and every queued write reads the trip's version out of the ref the
  // microtask after the previous write resolved, well before React has
  // rendered. So the second of two quick edits re-sent the version the first one
  // had already consumed, the server rejected it, and the sole editor of the
  // trip was told "this changed somewhere else. Reload." (React sometimes
  // evaluates the updater eagerly when no other update is pending, which is why
  // it only bit when a save was already in flight — i.e. exactly when a person
  // types fast.) Deriving `next` from the ref keeps read-then-write correct.
  const setCloudTrips = useCallback(
    (updater: TravelTrip[] | ((prev: TravelTrip[]) => TravelTrip[])) => {
      const next = typeof updater === "function" ? updater(cloudRef.current) : updater;
      cloudRef.current = next;
      _setCloudTrips(next);
    },
    []
  );

  // The member row the server creates for whoever creates a trip. Built locally
  // so the Members card (and the invite link inside it) is populated on the very
  // first paint instead of after a refetch.
  const ownerMember = useCallback(
    (): TripMember[] =>
      dbUser
        ? [{
            userId: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            avatarUrl: dbUser.avatarUrl,
            role: "owner" as const,
            joinedAt: new Date().toISOString(),
          }]
        : [],
    [dbUser]
  );

  // The current user's role on a trip. The owner is stored as a member with
  // role "owner"; anyone else with access is a "member". Defaults to owner when
  // membership is unknown (e.g. a just-created trip) so owner behaviour is the
  // safe fallback and never accidentally gated.
  const roleForTrip = useCallback(
    (trip: TravelTrip | undefined): "owner" | "member" => {
      if (!trip || !uid) return "owner";
      const me = trip.members?.find((m) => m.userId === uid);
      return me?.role === "member" ? "member" : "owner";
    },
    [uid]
  );

  // Append one op to a trip's draft proposal (member write path). A no-op while a
  // proposal is already submitted — the UI disables editing until it's reviewed.
  const appendOp = useCallback(
    (tripId: string, op: ChangeOp) => {
      const prev = proposalsRef.current;
      const existing = prev[tripId];
      if (existing?.status === "submitted") return; // locked pending review
      const baseVersion = cloudRef.current.find((t) => t.id === tripId)?.version;
      const next: TripProposal = {
        tripId,
        ops: [...(existing?.ops ?? []), op],
        status: "draft",
        baseVersion,
        note: existing?.note,
        updatedAt: new Date().toISOString(),
      };
      commitProposals({ ...prev, [tripId]: next });
    },
    [commitProposals]
  );

  // ── Cloud load ────────────────────────────────────────────────────────────
  // Single request: the list endpoint returns fully-hydrated trips, so there's
  // no per-trip N+1 fetch (that waterfall is what made loading feel slow).
  const loadCloud = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    try {
      const res = await fetch("/api/travel");
      if (!res.ok) return;
      const { trips } = (await res.json()) as { trips: TravelTrip[] };
      // Drop a stale response (e.g. a sync bumped the sequence while in flight).
      if (seq === loadSeqRef.current) {
        // Reconciled state = authoritative server truth + local receipt writes
        // not yet synced (replayed on top). Merge device-local prefs too.
        setCloudTrips(replayOps(mergePrefs(trips), outboxRef.current));
        // Now that we're online and reconciled, flush any pending writes.
        drainRef.current();
      }
    } catch {
      // Network failure — keep whatever the mirror already painted; the outbox
      // still holds unsynced writes and will drain on reconnect.
    } finally {
      setCloudLoaded(true);
    }
  }, [setCloudTrips]);

  // Stable handle on the latest loadCloud, so listeners and timers can call it
  // without re-subscribing every time the callback identity changes.
  const loadCloudRef = useRef(loadCloud);
  useEffect(() => {
    loadCloudRef.current = loadCloud;
  }, [loadCloud]);

  // Persist the outbox and surface its size (drives the "will sync" banner).
  const persistOutbox = useCallback(() => {
    if (uid) trackScoped(writeScoped(OUTBOX_KEY, uid, outboxRef.current));
    setPendingSync(outboxRef.current.length);
  }, [uid, trackScoped]);

  // Wraps a cloud write: tracks in-flight count, distinguishes a version
  // conflict (409 / VERSION_CONFLICT) from a generic failure, and never throws
  // (returns null on network error) so callers can branch on the response.
  //
  // `retryOnNetworkError` retries transient network failures (flaky Wi-Fi) with
  // a short backoff. Only pass it for idempotent writes (receipt upsert/delete),
  // never for the version-locked trip PUT where a retry could clobber a genuine
  // concurrent edit.
  // `quietConflict` suppresses the sticky conflict banner for a write that will
  // handle its own 409 (see the rebase-and-retry in updateTrip). Without it the
  // banner latches on an attempt we are about to resolve invisibly.
  const trackedFetch = useCallback(
    async (
      input: string,
      init?: RequestInit,
      opts?: { retryOnNetworkError?: boolean; quietNetworkError?: boolean; quietConflict?: boolean }
    ): Promise<Response | null> => {
      const maxAttempts = opts?.retryOnNetworkError ? 3 : 1;
      setPendingWrites((n) => n + 1);
      try {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const res = await fetch(input, init);
            let code: string | undefined;
            let message: string | undefined;
            if (!res.ok) {
              try {
                const body = await res.clone().json();
                code = body?.code;
                message = body?.message;
              } catch {
                // non-JSON error body
              }
            }
            const outcome = classifyWriteResult(res.ok, res.status, code);
            if (outcome === "ok") setSyncError(null);
            else if (outcome === "conflict") {
              if (!opts?.quietConflict) setConflict(true);
            } else setSyncError(message || "Couldn't save your changes.");
            return res;
          } catch {
            // Network failure. Retry a couple of times before giving up so a
            // brief connectivity blip doesn't surface as a lost save.
            if (attempt < maxAttempts) {
              await new Promise((r) => setTimeout(r, 300 * attempt));
              continue;
            }
            // Durable outbox writes retry themselves on reconnect, so a network
            // blip there isn't an error to shout about — it's "will sync later".
            if (!opts?.quietNetworkError) {
              setSyncError("You appear to be offline — changes aren't saved to your account yet.");
            }
            return null;
          }
        }
        return null; // unreachable — loop always returns
      } finally {
        setPendingWrites((n) => n - 1);
      }
    },
    []
  );

  // Serialise a write behind any pending write for the same trip. Every queued
  // task is wrapped so a failure never breaks the chain for later writes; the
  // returned promise resolves after `task` settles so callers can read its result.
  const enqueue = useCallback(<T,>(tripId: string, task: () => Promise<T>): Promise<T> => {
    const prev = tripWriteQueues.current.get(tripId) ?? Promise.resolve();
    const result = prev.then(task);
    // The stored tail must never reject (one failed write must not break the
    // queue for the next writer) and must be Promise<void>.
    tripWriteQueues.current.set(
      tripId,
      result.then(
        () => undefined,
        () => undefined
      )
    );
    return result;
  }, []);

  // Send one outbox op to the server. Idempotent (receipt id = row id), so a
  // replay after a retry or reload is always safe.
  const sendOp = useCallback(
    (op: ReceiptOp): Promise<Response | null> => {
      const opts = { quietNetworkError: true };
      if (op.kind === "delete") {
        return trackedFetch(`/api/travel/${op.tripId}/receipts/${op.receiptId}`, { method: "DELETE" }, opts);
      }
      if (op.kind === "add") {
        return trackedFetch(
          `/api/travel/${op.tripId}/receipts`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receipt: op.receipt }) },
          opts
        );
      }
      return trackedFetch(
        `/api/travel/${op.tripId}/receipts/${op.receipt.id}`,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receipt: op.receipt }) },
        opts
      );
    },
    [trackedFetch]
  );

  // Drain the outbox FIFO. Each send is serialised through the per-trip queue so
  // it never races ahead of a participant edit it depends on. Stops on the first
  // network failure (resumes on reconnect / next write); drops an op the server
  // permanently rejects (e.g. it targets a deleted trip) and re-syncs.
  const drainOutbox = useCallback(async () => {
    if (!isAuthenticated) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      while (outboxRef.current.length > 0) {
        if (typeof navigator !== "undefined" && !navigator.onLine) break;
        const op = outboxRef.current[0];
        const outcome = await enqueue(op.tripId, async (): Promise<"ok" | "network" | "permanent" | "review"> => {
          const res = await sendOp(op);
          if (res && res.ok) return "ok";
          if (res) {
            // The trip now requires member changes to go through review (the user
            // was demoted to member, or an in-flight op predates that rule). Don't
            // drop it — migrate it into the member's proposal buffer instead.
            if (res.status === 403) {
              const code = await res.clone().json().then((b) => b?.code).catch(() => undefined);
              if (code === "REVIEW_REQUIRED") return "review";
            }
            // 5xx and 429 are transient (server error / rate limit) — keep the op
            // queued and retry later. Only discard on 4xx client errors (the op is
            // structurally invalid and retrying will never succeed).
            if (res.status >= 500 || res.status === 429) return "network";
            return "permanent"; // 400/404/422 — the op itself is invalid
          }
          return "network"; // offline / fetch threw
        });
        if (outcome === "ok") {
          outboxRef.current = removeOp(outboxRef.current, op.opId);
          persistOutbox();
        } else if (outcome === "review") {
          // Convert the unsynced receipt write into a pending proposal op.
          if (op.kind === "add") appendOp(op.tripId, { kind: "receipt.add", receipt: op.receipt });
          else if (op.kind === "update") appendOp(op.tripId, { kind: "receipt.update", receipt: op.receipt });
          else appendOp(op.tripId, { kind: "receipt.delete", receiptId: op.receiptId });
          outboxRef.current = removeOp(outboxRef.current, op.opId);
          persistOutbox();
        } else if (outcome === "permanent") {
          outboxRef.current = removeOp(outboxRef.current, op.opId);
          persistOutbox();
          setSyncError("A change couldn't be saved and was discarded.");
          void loadCloud(); // re-pull authoritative state; drops the phantom
          break;
        } else {
          break; // network — leave the op queued for the next reconnect
        }
      }
    } finally {
      drainingRef.current = false;
    }
  }, [isAuthenticated, enqueue, sendOp, persistOutbox, loadCloud, appendOp]);

  // Keep the ref that loadCloud calls pointed at the latest drainOutbox.
  useEffect(() => {
    drainRef.current = () => void drainOutbox();
  }, [drainOutbox]);

  // Discard local optimistic state and re-pull authoritative server state.
  // Used to resolve a detected conflict ("this trip changed elsewhere").
  const reloadCloud = useCallback(async () => {
    setConflict(false);
    setSyncError(null);
    await loadCloud();
  }, [loadCloud]);

  // Fetch authoritative server state once signed in. Independent of the mirror
  // hydration below so it runs even before dbUser (the mirror key) has loaded.
  useEffect(() => {
    if (isAuthenticated && !cloudLoaded) void loadCloud();
  }, [isAuthenticated, cloudLoaded, loadCloud]);

  // Hydrate the mirror + outbox once the account key is known. Painting the
  // mirror means trips appear instantly (and offline). Only paint over state the
  // server hasn't already replaced; either way, re-apply pending receipt ops
  // (idempotent) so unsynced work stays visible, then flush it.
  useEffect(() => {
    if (!isAuthenticated || !uid || hydratedRef.current) return;
    hydratedRef.current = true;
    outboxRef.current = readScoped<ReceiptOp[]>(OUTBOX_KEY, uid) ?? [];
    setPendingSync(outboxRef.current.length);
    const mirror = readScoped<TravelTrip[]>(MIRROR_KEY, uid);
    if (!cloudLoaded && mirror && mirror.length > 0) {
      setCloudTrips(replayOps(mergePrefs(mirror), outboxRef.current));
    } else if (outboxRef.current.length > 0) {
      setCloudTrips((prev) => replayOps(prev, outboxRef.current));
    }
    if (outboxRef.current.length > 0) drainRef.current();
  }, [isAuthenticated, uid, cloudLoaded, setCloudTrips]);

  // Persist the mirror on every cloud-state change so the last-known trips
  // survive a reload / offline restart.
  useEffect(() => {
    if (isAuthenticated && uid && hydratedRef.current)
      trackScoped(writeScoped(MIRROR_KEY, uid, cloudTrips));
  }, [cloudTrips, isAuthenticated, uid, trackScoped]);

  // Hydrate the member's proposal buffers once the account key is known, so
  // pending (draft/submitted) edits survive a reload.
  useEffect(() => {
    if (!isAuthenticated || !uid || proposalsHydratedRef.current) return;
    proposalsHydratedRef.current = true;
    const stored = readScoped<Record<string, TripProposal>>(PROPOSALS_KEY, uid) ?? {};
    proposalsRef.current = stored;
    setProposals(stored);
  }, [isAuthenticated, uid]);

  // Re-pull authoritative trips when the tab comes back to the foreground.
  //
  // Realtime is the fast path, but it is best-effort by design (flag-gated,
  // fire-and-forget broadcast, one channel for the *active* trip only) and the
  // code that ships it says clients "still refetch on focus/reconnect" — which
  // was not true: the only focus listener in this hook reconciled proposals, not
  // trips. So any dropped signal, or any change to a trip that wasn't the open
  // one, stayed invisible until a manual reload. Throttled, because switching
  // tabs is not an event worth a request every time.
  const lastFocusLoadRef = useRef(0);
  useEffect(() => {
    if (typeof window === "undefined" || !isAuthenticated) return;
    const refetch = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastFocusLoadRef.current < FOCUS_REFETCH_MIN_MS) return;
      lastFocusLoadRef.current = now;
      void loadCloudRef.current();
    };
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", refetch);
    return () => {
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", refetch);
    };
  }, [isAuthenticated]);

  // Track connectivity and flush the outbox the moment we're back online.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => {
      setIsOnline(true);
      drainRef.current();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Show sync dialog once when the user first signs in and has local trips.
  useEffect(() => {
    if (authLoading || !isAuthenticated || syncCheckedRef.current) return;
    syncCheckedRef.current = true;
    if ((local.trips ?? []).length > 0) setShowSyncDialog(true);
  }, [isAuthenticated, authLoading, local.trips]);

  // Reset per-session state on sign-out so the next sign-in re-hydrates cleanly
  // (fresh mirror/outbox for whoever signs in next on this device).
  useEffect(() => {
    if (!isAuthenticated) {
      syncCheckedRef.current = false;
      hydratedRef.current = false;
      outboxRef.current = [];
      setPendingSync(0);
      setCloudTrips([]);
      setCloudLoaded(false);
      proposalsHydratedRef.current = false;
      proposalsRef.current = {};
      setProposals({});
      setChangeRequests({});
    }
  }, [isAuthenticated, setCloudTrips]);

  // ── Derived ───────────────────────────────────────────────────────────────
  // Members see their pending (draft/submitted) edits overlaid on the server
  // truth; owners and guests see state as-is.
  const trips = useMemo(() => {
    if (!isAuthenticated) return local.trips ?? [];
    if (Object.keys(proposals).length === 0) return cloudTrips;
    return cloudTrips.map((t) => {
      const prop = proposals[t.id];
      if (!prop || prop.ops.length === 0 || roleForTrip(t) !== "member") return t;
      return applyOpsToTrip(t, prop.ops);
    });
  }, [isAuthenticated, local.trips, cloudTrips, proposals, roleForTrip]);
  const activeId = isAuthenticated ? cloudActiveId : local.activeId;
  const isLoading = authLoading || (isAuthenticated && !cloudLoaded);

  // ── Mutations: active trip ID ──────────────────────────────────────────────
  const setActiveId = useCallback(
    (id: string | null) => {
      if (isAuthenticated) setCloudActiveId(id);
      else setLocal((prev) => ({ ...prev, activeId: id }));
    },
    [isAuthenticated, setLocal]
  );

  // ── Mutations: trips ──────────────────────────────────────────────────────
  const createTrip = useCallback(
    async (name: string): Promise<void> => {
      const trip: TravelTrip = { id: generateId(), name, participants: [], receipts: [] };

      if (isAuthenticated) {
        setCloudTrips((prev) => [trip, ...prev]);
        setCloudActiveId(trip.id);
        const res = await trackedFetch("/api/travel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trip.name, participants: [], receipts: [] }),
        });
        if (res && res.ok) {
          const { id: dbId, version } = (await res.json()) as { id: string; version?: number };
          // Replace optimistic local ID with the DB-assigned ID, and seed the
          // owner membership the server just created. Without that entry the
          // Members card — which is also where the invite link is generated —
          // stayed hidden on a brand-new trip until the next full reload, so
          // "create a trip and invite someone" did not work in one sitting.
          // (syncLocalToCloud already did this; the create path did not.)
          setCloudTrips((prev) =>
            prev.map((t) => (t.id === trip.id ? { ...t, id: dbId, version, members: ownerMember() } : t))
          );
          setCloudActiveId(dbId);
        } else {
          // Server rejected or offline — remove the ghost trip (error surfaced).
          setCloudTrips((prev) => prev.filter((t) => t.id !== trip.id));
          setCloudActiveId(null);
        }
      } else {
        setLocal((prev) => ({ trips: [trip, ...prev.trips], activeId: trip.id }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal, trackedFetch, ownerMember]
  );

  // Record the version the server just wrote, so the next queued edit sends it.
  const setTripVersion = useCallback(
    (id: string, version: number) => {
      setCloudTrips((prev) => prev.map((t) => (t.id === id ? { ...t, version } : t)));
    },
    [setCloudTrips]
  );

  /**
   * PUT a trip's fields, rebasing onto the server's version if it has moved.
   *
   * The optimistic lock exists to stop a silent lost update, and it should stay.
   * But "reject and make the human reload" is the wrong *response* to it here: a
   * trip PUT only ever carries the fields the user just changed (name / budget /
   * participants), members cannot write the trip at all (they go through change
   * requests), so a stale version almost always means the same person's previous
   * save had already landed. Refusing that is a false alarm — and the reload it
   * offered threw away what they had just typed.
   *
   * So: on a 409 we take the server's current version, replay the *same* fields
   * on top of it, and try once more. Last-write-wins for the fields the user
   * touched; everything they did not send is untouched on the server either way.
   * Only if the retry also loses (a genuinely concurrent editor) does the
   * conflict reach the UI, and we resync before it does.
   */
  const putTripFields = useCallback(
    async (id: string, fields: Record<string, unknown>): Promise<void> => {
      for (let attempt = 1; attempt <= MAX_PUT_ATTEMPTS; attempt++) {
        const isLastAttempt = attempt === MAX_PUT_ATTEMPTS;
        // Read the version *now* — after any previous queued save has advanced
        // it — not at the time updateTrip was called.
        const expectedVersion = cloudRef.current.find((t) => t.id === id)?.version;
        const res = await trackedFetch(
          `/api/travel/${id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...fields, expectedVersion }),
          },
          // Don't latch the conflict banner on an attempt we are about to rebase.
          { quietConflict: !isLastAttempt }
        );
        if (!res) return; // offline — trackedFetch already surfaced it
        if (res.ok) {
          const data = (await res.json().catch(() => null)) as { version?: number } | null;
          if (typeof data?.version === "number") setTripVersion(id, data.version);
          return;
        }
        if (res.status !== 409) return; // a real error — already surfaced
        if (isLastAttempt) {
          // Someone really is editing alongside us. The banner is up; pull the
          // authoritative trip so what they see next is the truth.
          void loadCloud();
          return;
        }
        // Rebase. The 409 body carries the server's version; fall back to a GET
        // for an older deployment that doesn't send it yet.
        const body = (await res
          .clone()
          .json()
          .catch(() => null)) as { currentVersion?: number } | null;
        let serverVersion = body?.currentVersion;
        if (typeof serverVersion !== "number") {
          try {
            const fresh = await fetch(`/api/travel/${id}`);
            if (!fresh.ok) return;
            serverVersion = ((await fresh.json()) as { version?: number }).version;
          } catch {
            return;
          }
        }
        if (typeof serverVersion !== "number") return;
        setTripVersion(id, serverVersion);
      }
    },
    [trackedFetch, setTripVersion, loadCloud]
  );

  const updateTrip = useCallback(
    async (id: string, updates: Partial<Omit<TravelTrip, "id">>) => {
      if (isAuthenticated) {
        const trip = cloudRef.current.find((t) => t.id === id);
        if (roleForTrip(trip) === "member") {
          // Route the edit into the member's proposal as one or more ops.
          if ("name" in updates || "budget" in updates) {
            const op: Extract<ChangeOp, { kind: "trip.update" }> = { kind: "trip.update" };
            if ("name" in updates && typeof updates.name === "string") op.name = updates.name;
            if ("budget" in updates) op.budget = updates.budget ?? null;
            if (op.name !== undefined || op.budget !== undefined) appendOp(id, op);
          }
          if ("participants" in updates && updates.participants) {
            appendOp(id, { kind: "participants.set", participants: updates.participants });
          }
          if ("receipts" in updates && updates.receipts && trip) {
            // A participant edit can reassign/remove receipts; emit minimal ops by
            // diffing the passed list against the member's current overlaid view.
            const view = applyOpsToTrip(trip, proposalsRef.current[id]?.ops ?? []);
            const nextById = new Map(updates.receipts.map((r) => [r.id, r]));
            for (const r of updates.receipts) {
              const before = view.receipts.find((x) => x.id === r.id);
              if (!before || JSON.stringify(before) !== JSON.stringify(r)) {
                appendOp(id, { kind: "receipt.update", receipt: r });
              }
            }
            for (const before of view.receipts) {
              if (!nextById.has(before.id)) {
                appendOp(id, { kind: "receipt.delete", receiptId: before.id, title: before.title });
              }
            }
          }
          return;
        }
        // Apply optimistic update immediately so the UI responds without waiting
        // for the network (preserves snappy feel even under queued saves).
        setCloudTrips((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
        );

        // Build only fields the API accepts.
        const body: Record<string, unknown> = {};
        if ("name" in updates) body.name = updates.name;
        if ("budget" in updates) body.budget = updates.budget ?? null;
        if ("participants" in updates) body.participants = updates.participants;
        if (Object.keys(body).length === 0) return;

        // Serialise API calls for this trip: the next PUT only starts after the
        // previous write resolves, so each call reads the version the server just
        // wrote rather than the stale version seen at call time. This prevents
        // rapid successive edits from self-inflicting a false 409 "changed
        // elsewhere" and losing whichever save arrived second.
        await enqueue(id, () => putTripFields(id, body));
      } else {
        setLocal((prev) => ({
          ...prev,
          trips: prev.trips.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal, putTripFields, enqueue, roleForTrip, appendOp]
  );

  const deleteTrip = useCallback(
    async (id: string) => {
      if (isAuthenticated) {
        setCloudTrips((prev) => prev.filter((t) => t.id !== id));
        setCloudActiveId((prev) => (prev === id ? null : prev));
        await trackedFetch(`/api/travel/${id}`, { method: "DELETE" });
      } else {
        setLocal((prev) => ({
          trips: prev.trips.filter((t) => t.id !== id),
          activeId: prev.activeId === id ? null : prev.activeId,
        }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal, trackedFetch]
  );

  // Undo a trip deletion: re-add the captured trip and (cloud) un-soft-delete it.
  const restoreTrip = useCallback(
    async (trip: TravelTrip) => {
      if (isAuthenticated) {
        setCloudTrips((prev) => (prev.some((t) => t.id === trip.id) ? prev : [trip, ...prev]));
        await trackedFetch(`/api/travel/${trip.id}/restore`, { method: "POST" });
      } else {
        setLocal((prev) => ({
          ...prev,
          trips: prev.trips.some((t) => t.id === trip.id) ? prev.trips : [trip, ...prev.trips],
        }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal, trackedFetch]
  );

  // ── Mutations: receipts (local-first) ─────────────────────────────────────
  // A receipt write is applied to the local mirror immediately (durable across
  // reloads) and recorded in the outbox; the background drain syncs it to the
  // server, retrying across offline periods. So a Save always "sticks" — even on
  // no connectivity — and there are no phantom receipts to roll back. Returns
  // true once the change is durably recorded locally.
  const addReceipt = useCallback(
    async (tripId: string, receipt: Receipt): Promise<boolean> => {
      if (isAuthenticated) {
        const trip = cloudRef.current.find((t) => t.id === tripId);
        if (roleForTrip(trip) === "member") {
          appendOp(tripId, { kind: "receipt.add", receipt });
          return true;
        }
        setCloudTrips((prev) => addReceiptToTrips(prev, tripId, receipt));
        outboxRef.current = pushOp(outboxRef.current, { opId: generateId(), kind: "add", tripId, receipt });
        persistOutbox();
        void drainOutbox();
        return true;
      } else {
        setLocal((prev) => ({ ...prev, trips: addReceiptToTrips(prev.trips, tripId, receipt) }));
        return true;
      }
    },
    [isAuthenticated, setCloudTrips, setLocal, persistOutbox, drainOutbox, roleForTrip, appendOp]
  );

  const updateReceipt = useCallback(
    async (tripId: string, receipt: Receipt): Promise<boolean> => {
      if (isAuthenticated) {
        const trip = cloudRef.current.find((t) => t.id === tripId);
        if (roleForTrip(trip) === "member") {
          appendOp(tripId, { kind: "receipt.update", receipt });
          return true;
        }
        setCloudTrips((prev) => replaceReceiptInTrips(prev, tripId, receipt));
        outboxRef.current = pushOp(outboxRef.current, { opId: generateId(), kind: "update", tripId, receipt });
        persistOutbox();
        void drainOutbox();
        return true;
      } else {
        setLocal((prev) => ({ ...prev, trips: replaceReceiptInTrips(prev.trips, tripId, receipt) }));
        return true;
      }
    },
    [isAuthenticated, setCloudTrips, setLocal, persistOutbox, drainOutbox, roleForTrip, appendOp]
  );

  const deleteReceipt = useCallback(
    async (tripId: string, receiptId: string): Promise<boolean> => {
      if (isAuthenticated) {
        const trip = cloudRef.current.find((t) => t.id === tripId);
        if (roleForTrip(trip) === "member") {
          // Capture the title now (best-effort) so the diff can name a receipt
          // that will no longer exist server-side by review time.
          const draftOps = proposalsRef.current[tripId]?.ops ?? [];
          const fromDraft = draftOps
            .filter((o) => o.kind === "receipt.add" || o.kind === "receipt.update")
            .map((o) => (o as { receipt: Receipt }).receipt)
            .find((r) => r.id === receiptId);
          const title = (fromDraft ?? trip?.receipts.find((r) => r.id === receiptId))?.title;
          appendOp(tripId, { kind: "receipt.delete", receiptId, ...(title ? { title } : {}) });
          return true;
        }
        setCloudTrips((prev) => removeReceiptFromTrips(prev, tripId, receiptId));
        outboxRef.current = pushOp(outboxRef.current, { opId: generateId(), kind: "delete", tripId, receiptId });
        persistOutbox();
        void drainOutbox();
        return true;
      } else {
        setLocal((prev) => ({ ...prev, trips: removeReceiptFromTrips(prev.trips, tripId, receiptId) }));
        return true;
      }
    },
    [isAuthenticated, setCloudTrips, setLocal, persistOutbox, drainOutbox, roleForTrip, appendOp]
  );

  // ── Mutations: settle-up payments ─────────────────────────────────────────
  const addPayment = useCallback(
    async (tripId: string, input: { from: string; to: string; amount: number; note?: string; source?: string }) => {
      // A real UUID, not a generateId() token: `trip_payments.id` is a uuid
      // column, so the optimistic id has to be something the server can adopt as
      // the row id. Then the id the UI holds is the id the row has from the very
      // first paint, and toggling a "share paid" checkbox off while its POST is
      // still in the air addresses a real row instead of a placeholder the
      // database cannot even parse.
      const optimistic: TripPayment = {
        id: generateUuid(),
        createdAt: new Date().toISOString(),
        ...input,
      };

      if (isAuthenticated) {
        const trip = cloudRef.current.find((t) => t.id === tripId);
        if (roleForTrip(trip) === "member") {
          appendOp(tripId, { kind: "payment.add", payment: input });
          return;
        }
        setCloudTrips((prev) => addPaymentToTrips(prev, tripId, optimistic));
        // Through the per-trip queue so this POST and a DELETE for the same
        // payment can never cross on the wire (which used to leave the row
        // created on the server and gone from the UI — a payment that came back
        // from the dead on the next refetch).
        const res = await enqueue(tripId, () =>
          trackedFetch(`/api/travel/${tripId}/payments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...input, id: optimistic.id }),
          })
        );
        if (res && res.ok) {
          const created = (await res.json()) as TripPayment;
          setCloudTrips((prev) => replacePaymentInTrips(prev, tripId, optimistic.id, created));
        } else {
          // Server rejected or offline — drop the optimistic payment.
          setCloudTrips((prev) => removePaymentFromTrips(prev, tripId, optimistic.id));
        }
      } else {
        setLocal((prev) => ({ ...prev, trips: addPaymentToTrips(prev.trips, tripId, optimistic) }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal, trackedFetch, enqueue, roleForTrip, appendOp]
  );

  const deletePayment = useCallback(
    async (tripId: string, paymentId: string) => {
      if (isAuthenticated) {
        const trip = cloudRef.current.find((t) => t.id === tripId);
        if (roleForTrip(trip) === "member") {
          const label = (() => {
            const p = trip?.payments?.find((x) => x.id === paymentId);
            if (!p) return undefined;
            const name = (id: string) => trip?.participants.find((x) => x.id === id)?.name ?? "?";
            return `${name(p.from)} → ${name(p.to)}`;
          })();
          appendOp(tripId, { kind: "payment.delete", paymentId, ...(label ? { label } : {}) });
          return;
        }
        setCloudTrips((prev) => removePaymentFromTrips(prev, tripId, paymentId));
        // Queued behind any in-flight add for this trip, so the row exists by
        // the time we ask for it to be removed.
        await enqueue(tripId, () =>
          trackedFetch(`/api/travel/${tripId}/payments/${paymentId}`, { method: "DELETE" })
        );
      } else {
        setLocal((prev) => ({ ...prev, trips: removePaymentFromTrips(prev.trips, tripId, paymentId) }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal, trackedFetch, enqueue, roleForTrip, appendOp]
  );

  // ── Participant helpers (used by travel/page.tsx) ─────────────────────────
  const updateParticipants = useCallback(
    async (tripId: string, participants: Participant[], receipts?: Receipt[]) => {
      const updates: Partial<TravelTrip> = { participants };
      if (receipts !== undefined) updates.receipts = receipts;
      await updateTrip(tripId, updates);
    },
    [updateTrip]
  );

  // ── Change requests: member submit + owner review ─────────────────────────
  const roleOf = useCallback(
    (tripId: string) => roleForTrip(cloudRef.current.find((t) => t.id === tripId)),
    [roleForTrip]
  );

  // Submit a member's draft proposal for one trip as a single change request.
  const submitChangeRequest = useCallback(
    async (tripId: string, note?: string): Promise<boolean> => {
      const prop = proposalsRef.current[tripId];
      if (!prop || prop.ops.length === 0 || prop.status === "submitted") return false;
      const baseVersion = cloudRef.current.find((t) => t.id === tripId)?.version ?? prop.baseVersion;
      const res = await trackedFetch(`/api/travel/${tripId}/change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops: prop.ops, note, baseVersion }),
      });
      if (res && res.ok) {
        const created = (await res.json()) as TripChangeRequestDTO;
        commitProposals({
          ...proposalsRef.current,
          [tripId]: { ...prop, status: "submitted", crId: created.id, baseVersion, note, reviewNote: undefined },
        });
        return true;
      }
      return false;
    },
    [trackedFetch, commitProposals]
  );

  // Discard a member's local draft (or a declined proposal) for a trip.
  const discardProposal = useCallback(
    (tripId: string) => {
      const next = { ...proposalsRef.current };
      delete next[tripId];
      commitProposals(next);
    },
    [commitProposals]
  );

  // Reconcile submitted proposals with the server: clear on approve (ops are now
  // canonical), revert to an editable draft carrying the owner's note on decline.
  const reconcileProposals = useCallback(async () => {
    const pending = Object.values(proposalsRef.current).filter((p) => p.status === "submitted" && p.crId);
    for (const p of pending) {
      try {
        const res = await fetch(`/api/travel/${p.tripId}/change-requests?status=all`);
        if (!res.ok) continue;
        const { changeRequests: list } = (await res.json()) as { changeRequests: TripChangeRequestDTO[] };
        const cr = list.find((c) => c.id === p.crId);
        if (!cr || cr.status === "pending") continue;
        if (cr.status === "approved") {
          const next = { ...proposalsRef.current };
          delete next[p.tripId];
          commitProposals(next);
          void loadCloud();
        } else if (cr.status === "declined") {
          const cur = proposalsRef.current[p.tripId];
          if (cur) {
            commitProposals({
              ...proposalsRef.current,
              [p.tripId]: { ...cur, status: "draft", reviewNote: cr.reviewNote ?? undefined },
            });
          }
        }
      } catch {
        // offline / transient — try again on the next reconcile
      }
    }
  }, [commitProposals, loadCloud]);

  // Owner: load pending change requests for a trip (the review inbox).
  const loadChangeRequests = useCallback(async (tripId: string) => {
    try {
      const res = await fetch(`/api/travel/${tripId}/change-requests?status=pending`);
      if (!res.ok) return;
      const { changeRequests: list } = (await res.json()) as { changeRequests: TripChangeRequestDTO[] };
      setChangeRequests((prev) => ({ ...prev, [tripId]: list }));
    } catch {
      // ignore — inbox stays at its last-known value
    }
  }, []);

  const approveChangeRequest = useCallback(
    async (tripId: string, crId: string): Promise<boolean> => {
      const res = await trackedFetch(`/api/travel/${tripId}/change-requests/${crId}/approve`, { method: "POST" });
      const ok = !!(res && res.ok);
      // Resync regardless of the reported outcome: on the Supabase pooler an
      // approve can commit yet surface an error, so always reconcile the inbox +
      // trip state with server truth (avoids stale-version conflict cascades).
      await loadChangeRequests(tripId);
      await loadCloud();
      return ok;
    },
    [trackedFetch, loadCloud, loadChangeRequests]
  );

  const declineChangeRequest = useCallback(
    async (tripId: string, crId: string, reviewNote?: string): Promise<boolean> => {
      const res = await trackedFetch(`/api/travel/${tripId}/change-requests/${crId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNote }),
      });
      if (res && res.ok) {
        setChangeRequests((prev) => ({ ...prev, [tripId]: (prev[tripId] ?? []).filter((c) => c.id !== crId) }));
        return true;
      }
      return false;
    },
    [trackedFetch]
  );

  // Reconcile the member's submitted proposals once the cloud is loaded, and
  // whenever the tab regains focus (an approval/decline may have happened).
  useEffect(() => {
    if (!isAuthenticated || !cloudLoaded) return;
    void reconcileProposals();
    const onFocus = () => void reconcileProposals();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isAuthenticated, cloudLoaded, reconcileProposals]);

  // Owner: auto-load the review inbox for the active trip.
  useEffect(() => {
    if (!isAuthenticated || !cloudActiveId) return;
    if (roleOf(cloudActiveId) !== "owner") return;
    void loadChangeRequests(cloudActiveId);
  }, [isAuthenticated, cloudActiveId, roleOf, loadChangeRequests]);

  // ── Realtime: live updates for the active trip (Sprint 6, flag-gated) ───────
  // Subscribe to the trip's broadcast channel. When another member changes the
  // trip, the server sends a SIGNAL (no data); we react by refetching through
  // the normal authenticated API. Best-effort: focus/reconnect refetch is the
  // fallback when realtime is off or a signal is dropped. One shared client for
  // the hook's lifetime; one channel per active trip (subscribe on open,
  // unsubscribe on switch/unmount).
  const rtClientRef = useRef<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    if (!isEnabled("realtime")) return;
    if (!isAuthenticated || !cloudActiveId) return;

    if (!rtClientRef.current) rtClientRef.current = createClient();
    const supabase = rtClientRef.current;
    const channel = supabase.channel(`trip:${cloudActiveId}`);

    // Coalesce a burst of signals into a single refetch.
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefetch = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void loadCloudRef.current(), 500);
    };

    channel
      .on("broadcast", { event: "trip.changed" }, (msg) => {
        const actorId = (msg?.payload as { actorId?: string } | undefined)?.actorId;
        // Skip our own change — we already applied it optimistically.
        if (actorId && actorId === uid) return;
        scheduleRefetch();
      })
      .subscribe((status) => {
        // On (re)connect, pull fresh state to catch any signal missed while away.
        if (status === "SUBSCRIBED") scheduleRefetch();
      });

    return () => {
      if (debounce) clearTimeout(debounce);
      void supabase.removeChannel(channel);
    };
  }, [isAuthenticated, cloudActiveId, uid]);

  // ── Guest → cloud sync ────────────────────────────────────────────────────
  // POST every local trip in parallel, then build cloud state directly from the
  // data we already have + the server-assigned id/version. No refetch: the old
  // full loadCloud() after syncing was the main reason sync felt slow.
  const syncLocalToCloud = useCallback(async (): Promise<number> => {
    const localTrips = local.trips ?? [];
    const syncedIds = new Set<string>();
    const created: TravelTrip[] = [];

    // The current user becomes the owner member of every synced trip. Build the
    // member entry locally (matches what the server creates) so the Members
    // card is populated immediately without an extra round trip.
    const ownerMembers = ownerMember();

    await Promise.all(
      localTrips.map(async (trip) => {
        try {
          const res = await fetch("/api/travel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: trip.name,
              budget: trip.budget,
              participants: trip.participants,
              receipts: trip.receipts,
            }),
          });
          if (res.ok) {
            const { id, version } = (await res.json()) as { id: string; version?: number };
            syncedIds.add(trip.id);
            // Re-create any locally-recorded settle-up payments on the new trip.
            const syncedPayments: TripPayment[] = [];
            for (const p of trip.payments ?? []) {
              try {
                const pres = await fetch(`/api/travel/${id}/payments`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ from: p.from, to: p.to, amount: p.amount, note: p.note, source: p.source }),
                });
                if (pres.ok) syncedPayments.push((await pres.json()) as TripPayment);
              } catch {
                // Skip this payment.
              }
            }
            created.push({ ...trip, id, version, members: ownerMembers, payments: syncedPayments });
          }
        } catch {
          // Skip this trip — it stays in localStorage.
        }
      })
    );

    if (syncedIds.size > 0) {
      // Invalidate any in-flight initial load so it can't overwrite what we're
      // about to append, then merge the freshly-created trips (newest first).
      loadSeqRef.current++;
      setCloudTrips((prev) => [...created, ...prev]);
      // Drop only the trips that synced — failed ones stay in localStorage.
      setLocal((prev) => ({
        ...prev,
        trips: (prev.trips ?? []).filter((t) => !syncedIds.has(t.id)),
      }));
    }
    return created.length;
  }, [local.trips, setLocal, setCloudTrips, ownerMember]);

  const dismissSyncDialog = useCallback(() => setShowSyncDialog(false), []);

  // Single derived status for the UI banner (cloud mode only).
  const syncStatus = deriveSyncStatus(pendingWrites, syncError, conflict);

  // A failed local write, from whichever store noticed first. Travel had no
  // path for this at all: /single and /multiple have warned about full or
  // blocked storage since useLocalStorage grew the 4th tuple element, while the
  // mode that accumulates a whole trip's worth of receipts stayed silent.
  const persistError = localPersistError ?? scopedPersistError;

  return {
    trips,
    activeId,
    isLoading,
    persistError,
    cloudMode: isAuthenticated,
    setActiveId,
    createTrip,
    updateTrip,
    updateParticipants,
    deleteTrip,
    restoreTrip,
    addReceipt,
    updateReceipt,
    deleteReceipt,
    addPayment,
    deletePayment,
    showSyncDialog,
    syncLocalToCloud,
    dismissSyncDialog,
    // Sync feedback + conflict resolution (cloud mode).
    syncStatus,
    syncError,
    reloadCloud,
    // Local-first status: unsynced receipt writes waiting to reach the server,
    // and whether the browser is currently online.
    pendingSync: pendingSync > 0,
    isOnline,
    // ── Approval workflow (cloud collaboration) ──────────────────────────────
    // roleOf: the current user's role on a trip ("owner" | "member").
    // proposals: members' local edit buffers per trip (draft/submitted).
    // changeRequests: pending requests per trip the user owns (review inbox).
    roleOf,
    proposals,
    changeRequests,
    submitChangeRequest,
    discardProposal,
    loadChangeRequests,
    approveChangeRequest,
    declineChangeRequest,
  };
}
