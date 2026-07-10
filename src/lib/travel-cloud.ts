// Validation for the Travel Spend cloud API. Pure (no DB) so it can be unit
// tested. Reuses the name-based participant + receipt validators shared with the
// share payload, since a cloud trip persists exactly the client Receipt shape.

import { ValidationError, validateParticipantsJson, ValidatedParticipant } from "@/lib/validation";
import { validateSharedReceipts, SharedReceipt } from "@/lib/shared-summary";

const MAX_TRIP_NAME = 200;
const MAX_BUDGET = 1_000_000_000_000; // 1 trillion rupiah ceiling (abuse guard)

export interface ValidatedTravelTrip {
  name: string;
  budget?: number;
  participants: ValidatedParticipant[];
  receipts: SharedReceipt[];
}

/**
 * Validate a full Travel trip body (create or guest→cloud sync): name, optional
 * budget, name-based participants, and 0+ receipts referencing those
 * participants. Receipts may be empty (a brand-new trip has none yet).
 */
export function validateTravelTripInput(body: unknown): ValidatedTravelTrip {
  if (!body || typeof body !== "object") {
    throw new ValidationError("body", "must be an object");
  }
  const b = body as Record<string, unknown>;

  const rawName = typeof b.name === "string" ? b.name.trim() : "";
  const name = (rawName || "My Trip").slice(0, MAX_TRIP_NAME);

  const budget = validateBudget(b.budget);

  const participants = validateParticipantsJson(b.participants, "participants") ?? [];
  const participantIds = new Set(participants.map((p) => p.id));
  const receipts = validateSharedReceipts(b.receipts ?? [], participantIds);

  return { name, budget, participants, receipts };
}

/** Optional positive money budget; returns undefined for missing/≤0/invalid. */
export function validateBudget(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n > MAX_BUDGET) throw new ValidationError("budget", "exceeds maximum");
  return n;
}

/**
 * Validate a single receipt payload (per-receipt endpoints) against the trip's
 * participant ids. Reuses the array validator for one receipt.
 */
export function validateTripReceiptPayload(
  payload: unknown,
  participantIds: Set<string>
): SharedReceipt {
  return validateSharedReceipts([payload], participantIds, { requireAtLeastOne: true })[0];
}
