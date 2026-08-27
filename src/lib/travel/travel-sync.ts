// Pure helpers for the Travel Spend data layer (useTravelData). Kept free of
// React/DOM so the risky sync + optimistic-update logic is unit-testable in a
// node environment.

import { TravelTrip, Receipt, TripPayment } from "@/types";

export type WriteOutcome = "ok" | "conflict" | "error";

/**
 * Classify a cloud write response. A 409 (or explicit VERSION_CONFLICT code) is
 * a concurrent-edit conflict; any other non-OK is a generic error.
 */
export function classifyWriteResult(ok: boolean, status: number, code?: string): WriteOutcome {
  if (ok) return "ok";
  if (status === 409 || code === "VERSION_CONFLICT") return "conflict";
  return "error";
}

export type SyncStatus = "idle" | "saving" | "error" | "conflict";

/** Single derived status for the sync banner. Conflict outranks in-flight. */
export function deriveSyncStatus(
  pendingWrites: number,
  syncError: string | null,
  conflict: boolean
): SyncStatus {
  if (conflict) return "conflict";
  if (pendingWrites > 0) return "saving";
  if (syncError) return "error";
  return "idle";
}

// ── Optimistic reducers (pure array transforms) ────────────────────────────
// Shared by the cloud and guest(localStorage) branches so both stay in sync.

const mapTrip = (
  trips: TravelTrip[],
  tripId: string,
  fn: (t: TravelTrip) => TravelTrip
): TravelTrip[] => trips.map((t) => (t.id === tripId ? fn(t) : t));

export function addReceiptToTrips(trips: TravelTrip[], tripId: string, receipt: Receipt): TravelTrip[] {
  return mapTrip(trips, tripId, (t) => ({ ...t, receipts: [...t.receipts, receipt] }));
}

export function replaceReceiptInTrips(trips: TravelTrip[], tripId: string, receipt: Receipt): TravelTrip[] {
  return mapTrip(trips, tripId, (t) => ({
    ...t,
    receipts: t.receipts.map((r) => (r.id === receipt.id ? receipt : r)),
  }));
}

export function removeReceiptFromTrips(trips: TravelTrip[], tripId: string, receiptId: string): TravelTrip[] {
  return mapTrip(trips, tripId, (t) => ({
    ...t,
    receipts: t.receipts.filter((r) => r.id !== receiptId),
  }));
}

export function addPaymentToTrips(trips: TravelTrip[], tripId: string, payment: TripPayment): TravelTrip[] {
  return mapTrip(trips, tripId, (t) => ({ ...t, payments: [...(t.payments ?? []), payment] }));
}

export function replacePaymentInTrips(
  trips: TravelTrip[],
  tripId: string,
  tempId: string,
  payment: TripPayment
): TravelTrip[] {
  return mapTrip(trips, tripId, (t) => ({
    ...t,
    payments: (t.payments ?? []).map((p) => (p.id === tempId ? payment : p)),
  }));
}

export function removePaymentFromTrips(trips: TravelTrip[], tripId: string, paymentId: string): TravelTrip[] {
  return mapTrip(trips, tripId, (t) => ({
    ...t,
    payments: (t.payments ?? []).filter((p) => p.id !== paymentId),
  }));
}
