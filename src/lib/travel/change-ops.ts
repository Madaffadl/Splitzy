// Change-request operations (PR-style member approval workflow).
//
// A member can't write the trip directly; their edits are captured as an ordered
// batch of ChangeOp and submitted as one TripChangeRequest. When the owner
// approves, the server replays the batch onto the canonical trip (see
// apply-change-ops.ts). This module holds the shared shapes + pure helpers so
// both the client (buffer/diff) and the server (validate/apply) agree on them.

import type { Receipt, Participant, TravelTrip, TripPayment } from "@/types";

// A settle-up payment as proposed inside a change request (mirrors the direct
// POST /payments body).
export interface ChangePaymentInput {
  from: string;
  to: string;
  amount: number;
  currency?: string;
  fxRate?: number;
  note?: string;
  source?: string;
}

export type ChangeOp =
  | { kind: "receipt.add"; receipt: Receipt }
  | { kind: "receipt.update"; receipt: Receipt }
  // `title` is captured client-side so a deletion can be described in the diff
  // without resolving the (already-gone) receipt.
  | { kind: "receipt.delete"; receiptId: string; title?: string }
  | { kind: "participants.set"; participants: Participant[] }
  | { kind: "trip.update"; name?: string; budget?: number | null }
  | { kind: "payment.add"; payment: ChangePaymentInput }
  // `label` describes the payment being removed (for the diff).
  | { kind: "payment.delete"; paymentId: string; label?: string };

// Guardrail: a single review batch shouldn't be unbounded.
export const MAX_CHANGE_OPS = 200;

export type ChangeRequestStatus = "pending" | "approved" | "declined" | "superseded";

/** A change request as returned by the API (owner inbox + member status). */
export interface TripChangeRequestDTO {
  id: string;
  authorId: string;
  authorName: string | null;
  status: ChangeRequestStatus;
  baseVersion: number;
  ops: ChangeOp[];
  note: string | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

/** A member's local edit buffer for one trip, before/while it's under review. */
export interface TripProposal {
  tripId: string;
  ops: ChangeOp[];
  // draft = editable locally; submitted = sent as a change request, awaiting review.
  status: "draft" | "submitted";
  crId?: string;
  baseVersion?: number;
  note?: string;
  // The owner's reason from the last decline, surfaced so the member can revise.
  reviewNote?: string;
  updatedAt: string;
}

/** Printed bill face value of a receipt (subtotal + tax + service), pre-discount. */
export function receiptGross(r: Receipt): number {
  const subtotal = (r.items ?? []).reduce((s, it) => s + (it.total || 0), 0);
  return subtotal + (r.tax || 0) + (r.service || 0);
}

export interface ChangeOpSummary {
  // Verb phrase, e.g. "Added receipt".
  action: string;
  // Subject, e.g. the receipt title or "Budi → Sari".
  detail: string;
  // Native amount for receipt/payment ops (component formats the currency).
  amount?: number;
  currency?: string;
  // Coarse effect used to colour the diff row.
  tone: "add" | "edit" | "remove";
}

/**
 * Human-readable descriptor for one op, used by both the member's pending list
 * and the owner's review panel. Pure: currency formatting is left to the caller.
 */
export function describeChangeOp(
  op: ChangeOp,
  nameOf: (id: string) => string
): ChangeOpSummary {
  switch (op.kind) {
    case "receipt.add":
      return { action: "Added receipt", detail: op.receipt.title || "Untitled", amount: receiptGross(op.receipt), currency: op.receipt.currency, tone: "add" };
    case "receipt.update":
      return { action: "Edited receipt", detail: op.receipt.title || "Untitled", amount: receiptGross(op.receipt), currency: op.receipt.currency, tone: "edit" };
    case "receipt.delete":
      return { action: "Deleted receipt", detail: op.title || "receipt", tone: "remove" };
    case "participants.set":
      return { action: "Updated participants", detail: op.participants.map((p) => p.name).join(", ") || "none", tone: "edit" };
    case "trip.update": {
      const parts: string[] = [];
      if (op.name !== undefined) parts.push(`name → “${op.name}”`);
      if (op.budget !== undefined) parts.push(op.budget == null ? "budget cleared" : `budget → ${op.budget}`);
      return { action: "Updated trip", detail: parts.join(", ") || "settings", tone: "edit" };
    }
    case "payment.add":
      return { action: "Recorded payment", detail: `${nameOf(op.payment.from)} → ${nameOf(op.payment.to)}`, amount: op.payment.amount, currency: op.payment.currency, tone: "add" };
    case "payment.delete":
      return { action: "Removed payment", detail: op.label || "settle-up", tone: "remove" };
  }
}

/**
 * Client-side overlay: apply a member's pending ops on top of the authoritative
 * server trip so the member sees their own not-yet-approved changes. Mirrors the
 * server's applyChangeOps but on the in-memory TravelTrip. Receipt add/update
 * and delete are idempotent, so a brief double-apply (before the buffer clears
 * on approval) is harmless; payment.add uses a synthetic id for display only.
 */
export function applyOpsToTrip(trip: TravelTrip, ops: ChangeOp[]): TravelTrip {
  let receipts = [...trip.receipts];
  let participants = trip.participants;
  let payments = [...(trip.payments ?? [])];
  let name = trip.name;
  let budget = trip.budget;

  ops.forEach((op, i) => {
    switch (op.kind) {
      case "receipt.add":
      case "receipt.update": {
        const idx = receipts.findIndex((r) => r.id === op.receipt.id);
        if (idx >= 0) receipts[idx] = op.receipt;
        else receipts = [...receipts, op.receipt];
        break;
      }
      case "receipt.delete":
        receipts = receipts.filter((r) => r.id !== op.receiptId);
        break;
      case "participants.set":
        participants = op.participants;
        break;
      case "trip.update":
        if (op.name !== undefined) name = op.name;
        if (op.budget !== undefined) budget = op.budget ?? undefined;
        break;
      case "payment.add": {
        const pending: TripPayment = {
          id: `draft-pay-${i}`,
          from: op.payment.from,
          to: op.payment.to,
          amount: op.payment.amount,
          currency: op.payment.currency,
          fxRate: op.payment.fxRate,
          note: op.payment.note,
          source: op.payment.source,
          createdAt: new Date().toISOString(),
        };
        payments = [...payments, pending];
        break;
      }
      case "payment.delete":
        payments = payments.filter((p) => p.id !== op.paymentId);
        break;
    }
  });

  return { ...trip, name, budget, participants, receipts, payments };
}
