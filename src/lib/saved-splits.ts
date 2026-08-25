// Server-side rules for saved splits — a signed-in user parking a Single or
// Multiple split so they can pick it up again later.
//
// These are deliberately NOT an archive. Single and Multiple stay local-first:
// localStorage is the working state, and saving is an explicit action that
// parks a copy on the server for a week. The durable record of a FINISHED split
// is the text the user copies into WhatsApp — it carries every amount plus the
// payment details — so letting the saved copy lapse costs them nothing they
// were relying on. Travel is the mode for splits that must live indefinitely,
// and its receipts carry no expiry.

import { validateSharedReceipts, type SharedReceipt } from "@/lib/shared-summary";
import {
  ValidationError,
  validateParticipantsJson,
  type ValidatedParticipant,
} from "@/lib/validation";

/**
 * How long a saved split survives after its LAST save.
 *
 * The clock is reset by saving, not by opening — the server has no idea the
 * user is mid-edit, so a resumed split that is never re-saved still lapses on
 * the original schedule. The UI has to make Save prominent after an edit for
 * that reason.
 */
export const SAVED_SPLIT_TTL_DAYS = 7;

/** Expiry for a split saved right now. */
export function savedSplitExpiryFromNow(now: number = Date.now()): Date {
  return new Date(now + SAVED_SPLIT_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Whole days until expiry, floored at 0. Drives the "3 days left" label. */
export function daysUntilExpiry(expiresAt: Date | string, now: number = Date.now()): number {
  const ms = new Date(expiresAt).getTime() - now;
  return ms <= 0 ? 0 : Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export interface SavedSplitInput {
  /** Which editor owns this split, so Resume reopens the right one. */
  type: "single" | "multiple";
  title: string;
  participants: ValidatedParticipant[];
  receipts: SharedReceipt[];
}

/**
 * Validate the body of a save request.
 *
 * `draft` relaxes exactly two rules — an unchosen payer and half-typed item
 * names — because refusing to save work in progress defeats the point of the
 * feature. Every other rule holds: amounts are bounded, ids must reference real
 * participants, and fees/discounts must be well formed. A draft is still data
 * we will hand back to the editor later, so it has to be trustworthy.
 */
export function validateSavedSplit(body: unknown): SavedSplitInput {
  if (!body || typeof body !== "object") {
    throw new ValidationError("body", "must be an object");
  }
  const b = body as Record<string, unknown>;

  const participants = validateParticipantsJson(b.participants, "participants") ?? [];
  const participantIds = new Set(participants.map((p) => p.id));

  const receipts = validateSharedReceipts(b.receipts, participantIds, {
    requireAtLeastOne: true,
    draft: true,
  });

  const rawTitle = typeof b.title === "string" ? b.title.trim() : "";
  // Anything other than an explicit "multiple" reopens in the Single editor —
  // the safer default, since a single-receipt payload renders correctly there.
  const type = b.type === "multiple" ? "multiple" : "single";

  return {
    type,
    title: rawTitle || "Untitled split",
    participants,
    receipts,
  };
}
