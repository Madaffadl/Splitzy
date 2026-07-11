// Helpers for the consolidated settle-up model: the TripPayment ledger is the
// single source of truth for what has been settled. A "receipt share" checkbox
// ("B has paid their share of receipt R") is stored as a ledger payment whose
// `source` encodes which receipt/participant it settles, so the client can
// render the checkbox state and remove the payment when unchecked.

import { TripPayment } from "@/types";

const SHARE_PREFIX = "share:";

/** Stable source key for a per-receipt share payment. */
export function sharePaymentSource(receiptId: string, participantId: string): string {
  return `${SHARE_PREFIX}${receiptId}:${participantId}`;
}

/** Parse a share source key; null for manual payments / unrecognised sources. */
export function parseShareSource(
  source: string | undefined | null
): { receiptId: string; participantId: string } | null {
  if (!source || !source.startsWith(SHARE_PREFIX)) return null;
  const rest = source.slice(SHARE_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep <= 0 || sep === rest.length - 1) return null;
  return { receiptId: rest.slice(0, sep), participantId: rest.slice(sep + 1) };
}

export function isManualPayment(payment: TripPayment): boolean {
  return parseShareSource(payment.source) === null;
}

/** The existing share payment for (receipt, participant), if any. */
export function findSharePayment(
  payments: TripPayment[] | undefined,
  receiptId: string,
  participantId: string
): TripPayment | undefined {
  const key = sharePaymentSource(receiptId, participantId);
  return (payments ?? []).find((p) => p.source === key);
}

/** Participant ids whose share of the given receipt has been marked paid. */
export function paidShareParticipants(
  payments: TripPayment[] | undefined,
  receiptId: string
): Set<string> {
  const out = new Set<string>();
  for (const p of payments ?? []) {
    const parsed = parseShareSource(p.source);
    if (parsed && parsed.receiptId === receiptId) out.add(parsed.participantId);
  }
  return out;
}
