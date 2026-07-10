"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { TravelTrip, Receipt, Participant } from "@/types";
import { generateId } from "@/lib/utils";

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
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [local, setLocal] = useLocalStorage<TravelStore>(LOCAL_KEY, DEFAULT);

  // ── Cloud state ──────────────────────────────────────────────────────────
  const [cloudTrips, _setCloudTrips] = useState<TravelTrip[]>([]);
  // Ref mirrors state so callbacks always read the latest value without
  // needing cloudTrips in their dependency arrays (avoids stale closures).
  const cloudRef = useRef<TravelTrip[]>([]);
  const [cloudActiveId, setCloudActiveId] = useState<string | null>(null);
  const [cloudLoaded, setCloudLoaded] = useState(false);

  // Sync dialog: offer to push local trips to cloud when user signs in.
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const syncCheckedRef = useRef(false);

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
  const loadCloud = useCallback(async () => {
    try {
      const listRes = await fetch("/api/travel");
      if (!listRes.ok) return;
      const { trips: summary } = (await listRes.json()) as { trips: { id: string }[] };

      // Fetch each trip fully in parallel (N+1 is fine for personal use).
      const full = await Promise.all(
        summary.map(async ({ id }) => {
          const r = await fetch(`/api/travel/${id}`);
          return r.ok ? ((await r.json()) as TravelTrip) : null;
        })
      );
      setCloudTrips(full.filter(Boolean) as TravelTrip[]);
    } catch {
      // Network failure — cloud list stays empty; user can still work locally.
    } finally {
      setCloudLoaded(true);
    }
  }, [setCloudTrips]);

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
        try {
          const res = await fetch("/api/travel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: trip.name, participants: [], receipts: [] }),
          });
          if (res.ok) {
            const { id: dbId } = (await res.json()) as { id: string };
            // Replace optimistic local ID with the DB-assigned ID.
            setCloudTrips((prev) =>
              prev.map((t) => (t.id === trip.id ? { ...t, id: dbId } : t))
            );
            setCloudActiveId(dbId);
          } else {
            // Server rejected — remove the ghost trip.
            setCloudTrips((prev) => prev.filter((t) => t.id !== trip.id));
            setCloudActiveId(null);
          }
        } catch {
          // Network failure — remove the ghost trip.
          setCloudTrips((prev) => prev.filter((t) => t.id !== trip.id));
          setCloudActiveId(null);
        }
      } else {
        setLocal((prev) => ({ trips: [trip, ...prev.trips], activeId: trip.id }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal]
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
        try {
          await fetch(`/api/travel/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        } catch {
          // Optimistic — don't revert for v1.
        }
      } else {
        setLocal((prev) => ({
          ...prev,
          trips: prev.trips.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal]
  );

  const deleteTrip = useCallback(
    async (id: string) => {
      if (isAuthenticated) {
        setCloudTrips((prev) => prev.filter((t) => t.id !== id));
        setCloudActiveId((prev) => (prev === id ? null : prev));
        try {
          await fetch(`/api/travel/${id}`, { method: "DELETE" });
        } catch {
          // Optimistic.
        }
      } else {
        setLocal((prev) => ({
          trips: prev.trips.filter((t) => t.id !== id),
          activeId: prev.activeId === id ? null : prev.activeId,
        }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal]
  );

  // ── Mutations: receipts ───────────────────────────────────────────────────
  const addReceipt = useCallback(
    async (tripId: string, receipt: Receipt) => {
      if (isAuthenticated) {
        setCloudTrips((prev) =>
          prev.map((t) =>
            t.id === tripId ? { ...t, receipts: [...t.receipts, receipt] } : t
          )
        );
        try {
          await fetch(`/api/travel/${tripId}/receipts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ receipt }),
          });
        } catch {
          // Optimistic.
        }
      } else {
        setLocal((prev) => ({
          ...prev,
          trips: prev.trips.map((t) =>
            t.id === tripId ? { ...t, receipts: [...t.receipts, receipt] } : t
          ),
        }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal]
  );

  const updateReceipt = useCallback(
    async (tripId: string, receipt: Receipt) => {
      if (isAuthenticated) {
        setCloudTrips((prev) =>
          prev.map((t) =>
            t.id === tripId
              ? { ...t, receipts: t.receipts.map((r) => (r.id === receipt.id ? receipt : r)) }
              : t
          )
        );
        try {
          await fetch(`/api/travel/${tripId}/receipts/${receipt.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ receipt }),
          });
        } catch {
          // Optimistic.
        }
      } else {
        setLocal((prev) => ({
          ...prev,
          trips: prev.trips.map((t) =>
            t.id === tripId
              ? { ...t, receipts: t.receipts.map((r) => (r.id === receipt.id ? receipt : r)) }
              : t
          ),
        }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal]
  );

  const deleteReceipt = useCallback(
    async (tripId: string, receiptId: string) => {
      if (isAuthenticated) {
        setCloudTrips((prev) =>
          prev.map((t) =>
            t.id === tripId
              ? { ...t, receipts: t.receipts.filter((r) => r.id !== receiptId) }
              : t
          )
        );
        try {
          await fetch(`/api/travel/${tripId}/receipts/${receiptId}`, { method: "DELETE" });
        } catch {
          // Optimistic.
        }
      } else {
        setLocal((prev) => ({
          ...prev,
          trips: prev.trips.map((t) =>
            t.id === tripId
              ? { ...t, receipts: t.receipts.filter((r) => r.id !== receiptId) }
              : t
          ),
        }));
      }
    },
    [isAuthenticated, setCloudTrips, setLocal]
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
  const syncLocalToCloud = useCallback(async (): Promise<number> => {
    const localTrips = local.trips ?? [];
    let count = 0;
    const syncedIds = new Set<string>();
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
            count++;
            syncedIds.add(trip.id);
          }
        } catch {
          // Skip this trip — it stays in localStorage.
        }
      })
    );
    if (syncedIds.size > 0) {
      // Only clear trips that were successfully synced — preserve failed ones.
      setLocal((prev) => ({
        ...prev,
        trips: (prev.trips ?? []).filter((t) => !syncedIds.has(t.id)),
      }));
      await loadCloud();
    }
    return count;
  }, [local.trips, setLocal, loadCloud]);

  const dismissSyncDialog = useCallback(() => setShowSyncDialog(false), []);

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
    addReceipt,
    updateReceipt,
    deleteReceipt,
    showSyncDialog,
    syncLocalToCloud,
    dismissSyncDialog,
  };
}
