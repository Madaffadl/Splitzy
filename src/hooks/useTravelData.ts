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

export interface TravelStore {
  trips: TravelTrip[];
  activeId: string | null;
}

const LOCAL_KEY = "splitzy-travel";
const DEFAULT: TravelStore = { trips: [], activeId: null };

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
      if (seq === loadSeqRef.current) setCloudTrips(trips);
    } catch {
      // Network failure — cloud list stays empty; user can still work locally.
    } finally {
      setCloudLoaded(true);
    }
  }, [setCloudTrips]);

  // Wraps a cloud write: tracks in-flight count, distinguishes a version
  // conflict (409 / VERSION_CONFLICT) from a generic failure, and never throws
  // (returns null on network error) so callers can branch on the response.
  const trackedFetch = useCallback(
    async (input: string, init?: RequestInit): Promise<Response | null> => {
      setPendingWrites((n) => n + 1);
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
        setSyncError("You appear to be offline — changes aren't saved to your account yet.");
        return null;
      } finally {
        setPendingWrites((n) => n - 1);
      }
    },
    []
  );

  // Discard local optimistic state and re-pull authoritative server state.
  // Used to resolve a detected conflict ("this trip changed elsewhere").
  const reloadCloud = useCallback(async () => {
    setConflict(false);
    setSyncError(null);
    await loadCloud();
  }, [loadCloud]);

  useEffect(() => {
    if (isAuthenticated && !cloudLoaded) void loadCloud();
  }, [isAuthenticated, cloudLoaded, loadCloud]);

  // Show sync dialog once when the user first signs in and has local trips.
  useEffect(() => {
    if (authLoading || !isAuthenticated || syncCheckedRef.current) return;
    syncCheckedRef.current = true;
    if ((local.trips ?? []).length > 0) setShowSyncDialog(true);
  }, [isAuthenticated, authLoading, local.trips]);

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
        setCloudTrips((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
        );
        // Build only fields the API accepts.
        const body: Record<string, unknown> = {};
        if ("name" in updates) body.name = updates.name;
        if ("budget" in updates) body.budget = updates.budget ?? null;
        if ("participants" in updates) body.participants = updates.participants;
        if (Object.keys(body).length === 0) return;
        // Send the observed version so the server can detect a concurrent edit
        // (optimistic lock). trackedFetch flags a 409 as a conflict for the UI.
        body.expectedVersion = cloudRef.current.find((t) => t.id === id)?.version;
        const res = await trackedFetch(`/api/travel/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res && res.ok) {
          const data = (await res.json().catch(() => null)) as { version?: number } | null;
          if (typeof data?.version === "number") {
            // Advance the local version so the next edit sends the right one.
            setCloudTrips((prev) => prev.map((t) => (t.id === id ? { ...t, version: data.version } : t)));
          }
        }
      } else {
        setLocal((prev) => ({
          ...prev,
          trips: prev.trips.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal, trackedFetch]
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

  // ── Mutations: receipts ───────────────────────────────────────────────────
  const addReceipt = useCallback(
    async (tripId: string, receipt: Receipt) => {
      if (isAuthenticated) {
        setCloudTrips((prev) => addReceiptToTrips(prev, tripId, receipt));
        await trackedFetch(`/api/travel/${tripId}/receipts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receipt }),
        });
      } else {
        setLocal((prev) => ({ ...prev, trips: addReceiptToTrips(prev.trips, tripId, receipt) }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal, trackedFetch]
  );

  const updateReceipt = useCallback(
    async (tripId: string, receipt: Receipt) => {
      if (isAuthenticated) {
        setCloudTrips((prev) => replaceReceiptInTrips(prev, tripId, receipt));
        await trackedFetch(`/api/travel/${tripId}/receipts/${receipt.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receipt }),
        });
      } else {
        setLocal((prev) => ({ ...prev, trips: replaceReceiptInTrips(prev.trips, tripId, receipt) }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal, trackedFetch]
  );

  const deleteReceipt = useCallback(
    async (tripId: string, receiptId: string) => {
      if (isAuthenticated) {
        setCloudTrips((prev) => removeReceiptFromTrips(prev, tripId, receiptId));
        await trackedFetch(`/api/travel/${tripId}/receipts/${receiptId}`, { method: "DELETE" });
      } else {
        setLocal((prev) => ({ ...prev, trips: removeReceiptFromTrips(prev.trips, tripId, receiptId) }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal, trackedFetch]
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
                  body: JSON.stringify({ from: p.from, to: p.to, amount: p.amount, note: p.note }),
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
  };
}
