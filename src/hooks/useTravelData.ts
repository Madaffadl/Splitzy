"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { TravelTrip, Receipt, Participant, TripPayment } from "@/types";
import { generateId } from "@/lib/utils";
import {
  classifyWriteResult,
  deriveSyncStatus,
  addReceiptToTrips,
  replaceReceiptInTrips,
  removeReceiptFromTrips,
  addPaymentToTrips,
  replacePaymentInTrips,
  removePaymentFromTrips,
} from "@/lib/travel-sync";
import { mergePrefs } from "@/lib/trip-prefs";
import { ReceiptOp, pushOp, removeOp, replayOps } from "@/lib/travel-outbox";

export interface TravelStore {
  trips: TravelTrip[];
  activeId: string | null;
}

const LOCAL_KEY = "splitzy-travel";
const DEFAULT: TravelStore = { trips: [], activeId: null };

// Local-first (cloud mode) persistence. Both are scoped to the signed-in user
// so a shared device never shows one account's data to the next, and are cleared
// on sign-out (see useAuth). MIRROR = last-known trips for instant/offline paint;
// OUTBOX = receipt writes not yet synced to the server.
export const MIRROR_KEY = "splitzy-travel-mirror";
export const OUTBOX_KEY = "splitzy-travel-outbox";

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

function writeScoped<T>(key: string, uid: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ uid, data }));
  } catch {
    // quota / disabled storage — best effort
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
  const [local, setLocal] = useLocalStorage<TravelStore>(LOCAL_KEY, DEFAULT);
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  const setCloudTrips = useCallback(
    (updater: TravelTrip[] | ((prev: TravelTrip[]) => TravelTrip[])) => {
      _setCloudTrips((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        cloudRef.current = next;
        return next;
      });
    },
    []
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

  // Persist the outbox and surface its size (drives the "will sync" banner).
  const persistOutbox = useCallback(() => {
    if (uid) writeScoped(OUTBOX_KEY, uid, outboxRef.current);
    setPendingSync(outboxRef.current.length);
  }, [uid]);

  // Wraps a cloud write: tracks in-flight count, distinguishes a version
  // conflict (409 / VERSION_CONFLICT) from a generic failure, and never throws
  // (returns null on network error) so callers can branch on the response.
  //
  // `retryOnNetworkError` retries transient network failures (flaky Wi-Fi) with
  // a short backoff. Only pass it for idempotent writes (receipt upsert/delete),
  // never for the version-locked trip PUT where a retry could clobber a genuine
  // concurrent edit.
  const trackedFetch = useCallback(
    async (
      input: string,
      init?: RequestInit,
      opts?: { retryOnNetworkError?: boolean; quietNetworkError?: boolean }
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
            else if (outcome === "conflict") setConflict(true);
            else setSyncError(message || "Couldn't save your changes.");
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
        const outcome = await enqueue(op.tripId, async (): Promise<"ok" | "network" | "permanent"> => {
          const res = await sendOp(op);
          if (res && res.ok) return "ok";
          if (res) {
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
  }, [isAuthenticated, enqueue, sendOp, persistOutbox, loadCloud]);

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
    if (isAuthenticated && uid && hydratedRef.current) writeScoped(MIRROR_KEY, uid, cloudTrips);
  }, [cloudTrips, isAuthenticated, uid]);

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
    }
  }, [isAuthenticated, setCloudTrips]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const trips = isAuthenticated ? cloudTrips : (local.trips ?? []);
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
          // Replace optimistic local ID with the DB-assigned ID.
          setCloudTrips((prev) =>
            prev.map((t) => (t.id === trip.id ? { ...t, id: dbId, version } : t))
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
    [isAuthenticated, setCloudTrips, setLocal, trackedFetch]
  );

  const updateTrip = useCallback(
    async (id: string, updates: Partial<Omit<TravelTrip, "id">>) => {
      if (isAuthenticated) {
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
        await enqueue(id, async () => {
          // Read expectedVersion here — after the previous save has finished and
          // advanced the local version — not at the time updateTrip was called.
          body.expectedVersion = cloudRef.current.find((t) => t.id === id)?.version;
          const res = await trackedFetch(`/api/travel/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (res && res.ok) {
            const data = (await res.json().catch(() => null)) as { version?: number } | null;
            if (typeof data?.version === "number") {
              // Advance local version so the next queued edit sends the right one.
              setCloudTrips((prev) => prev.map((t) => (t.id === id ? { ...t, version: data.version } : t)));
            }
          }
        });
      } else {
        setLocal((prev) => ({
          ...prev,
          trips: prev.trips.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal, trackedFetch, enqueue]
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
    [isAuthenticated, setCloudTrips, setLocal, persistOutbox, drainOutbox]
  );

  const updateReceipt = useCallback(
    async (tripId: string, receipt: Receipt): Promise<boolean> => {
      if (isAuthenticated) {
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
    [isAuthenticated, setCloudTrips, setLocal, persistOutbox, drainOutbox]
  );

  const deleteReceipt = useCallback(
    async (tripId: string, receiptId: string): Promise<boolean> => {
      if (isAuthenticated) {
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
    [isAuthenticated, setCloudTrips, setLocal, persistOutbox, drainOutbox]
  );

  // ── Mutations: settle-up payments ─────────────────────────────────────────
  const addPayment = useCallback(
    async (tripId: string, input: { from: string; to: string; amount: number; note?: string; source?: string }) => {
      const optimistic: TripPayment = {
        id: generateId(),
        createdAt: new Date().toISOString(),
        ...input,
      };

      if (isAuthenticated) {
        setCloudTrips((prev) => addPaymentToTrips(prev, tripId, optimistic));
        const res = await trackedFetch(`/api/travel/${tripId}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
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
    [isAuthenticated, setCloudTrips, setLocal, trackedFetch]
  );

  const deletePayment = useCallback(
    async (tripId: string, paymentId: string) => {
      if (isAuthenticated) {
        setCloudTrips((prev) => removePaymentFromTrips(prev, tripId, paymentId));
        await trackedFetch(`/api/travel/${tripId}/payments/${paymentId}`, { method: "DELETE" });
      } else {
        setLocal((prev) => ({ ...prev, trips: removePaymentFromTrips(prev.trips, tripId, paymentId) }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal, trackedFetch]
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
    const ownerMembers = dbUser
      ? [{
          userId: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          avatarUrl: dbUser.avatarUrl,
          role: "owner" as const,
          joinedAt: new Date().toISOString(),
        }]
      : [];

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
  }, [local.trips, setLocal, setCloudTrips, dbUser]);

  const dismissSyncDialog = useCallback(() => setShowSyncDialog(false), []);

  // Single derived status for the UI banner (cloud mode only).
  const syncStatus = deriveSyncStatus(pendingWrites, syncError, conflict);

  return {
    trips,
    activeId,
    isLoading,
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
  };
}
