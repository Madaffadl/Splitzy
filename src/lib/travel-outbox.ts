// Durable outbox for Travel Spend receipt writes (local-first sync).
//
// A receipt add/update/delete is applied to the local mirror immediately and
// recorded here as a pending op. The op survives a reload (it's persisted to
// localStorage by useTravelData) and is drained to the server when online, so a
// receipt entered on flaky/no connectivity is never lost and syncs later.
//
// Only receipts live in the outbox: they use client-generated IDs and an
// idempotent server upsert, so an op can be replayed safely any number of times
// and needs no temp-ID remapping. Trip create/participant/payment writes stay
// online-optimistic (they require connectivity anyway).
//
// Kept free of React/DOM so the coalescing + replay logic is unit-testable.

import { Receipt, TravelTrip } from "@/types";
import { addReceiptToTrips, replaceReceiptInTrips, removeReceiptFromTrips } from "./travel-sync";

export type ReceiptOp =
  | { opId: string; kind: "add"; tripId: string; receipt: Receipt }
  | { opId: string; kind: "update"; tripId: string; receipt: Receipt }
  | { opId: string; kind: "delete"; tripId: string; receiptId: string };

/** The receipt an op targets — its own id, or the delete target. */
export function receiptIdOf(op: ReceiptOp): string {
  return op.kind === "delete" ? op.receiptId : op.receipt.id;
}

/** Do two ops concern the same receipt on the same trip? */
function sameTarget(a: ReceiptOp, b: ReceiptOp): boolean {
  return a.tripId === b.tripId && receiptIdOf(a) === receiptIdOf(b);
}

/**
 * Append `op`, coalescing with any pending op for the same receipt so the
 * outbox stays minimal and internally consistent:
 *
 *  - add/update after a pending add  → keep kind "add" with the latest content
 *    (the server hasn't seen the receipt yet, so it must still be *created*).
 *  - add/update after a pending update → keep kind "update" with latest content.
 *  - delete of a receipt whose add is still pending → both cancel out: a receipt
 *    created and removed before it ever synced never needs to reach the server.
 *  - delete otherwise → drop any pending update, keep the delete.
 *
 * A coalesced op keeps its original opId so any in-flight send can still match.
 */
export function pushOp(ops: ReceiptOp[], op: ReceiptOp): ReceiptOp[] {
  const related = ops.filter((o) => sameTarget(o, op));
  const others = ops.filter((o) => !sameTarget(o, op));
  const hadPendingAdd = related.some((o) => o.kind === "add");

  if (op.kind === "delete") {
    // Never-synced receipt (still has a pending add) → erase it entirely.
    if (hadPendingAdd) return others;
    return [...others, op];
  }

  const existing = related[0];
  const kind = hadPendingAdd ? "add" : op.kind;
  return [...others, { ...op, kind, opId: existing?.opId ?? op.opId }];
}

/** Remove a settled op by id. */
export function removeOp(ops: ReceiptOp[], opId: string): ReceiptOp[] {
  return ops.filter((o) => o.opId !== opId);
}

/** Upsert a receipt: replace if present, else append. Idempotent replay-safe. */
function upsertReceipt(trips: TravelTrip[], tripId: string, receipt: Receipt): TravelTrip[] {
  const exists = trips.some((t) => t.id === tripId && t.receipts.some((r) => r.id === receipt.id));
  return exists
    ? replaceReceiptInTrips(trips, tripId, receipt)
    : addReceiptToTrips(trips, tripId, receipt);
}

/**
 * Replay pending ops on top of authoritative server trips. Used at load time so
 * the reconciled state = server truth + local changes not yet synced. add and
 * update both upsert so replaying over state that already has the receipt (e.g.
 * a mirror) never duplicates it.
 */
export function replayOps(trips: TravelTrip[], ops: ReceiptOp[]): TravelTrip[] {
  return ops.reduce<TravelTrip[]>((acc, op) => {
    if (op.kind === "delete") return removeReceiptFromTrips(acc, op.tripId, op.receiptId);
    return upsertReceipt(acc, op.tripId, op.receipt);
  }, trips);
}
