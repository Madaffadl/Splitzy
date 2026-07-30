// Helpers for the consolidated settle-up model: the TripPayment ledger is the
// single source of truth for what has been settled. A "receipt share" checkbox
// ("B has paid their share of receipt R") is stored as a ledger payment whose
// `source` encodes which receipt/participant it settles, so the client can
// render the checkbox state and remove the payment when unchecked.

import { Receipt, TripPayment } from "@/types";
import { calculatePersonTotals, receiptInBaseCurrency } from "@/lib/calculations";
import { roundTo2 } from "@/lib/utils";

const SHARE_PREFIX = "share:";

// Rounding tolerance for "is this debt settled?" comparisons.
const SETTLE_EPS = 0.01;

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

/** IDR value of a payment — foreign amounts converted via their locked fxRate. */
export function paymentIdrAmount(p: TripPayment): number {
  return p.currency && p.currency !== "IDR" && p.fxRate && p.fxRate > 0
    ? roundTo2(p.amount * p.fxRate)
    : roundTo2(p.amount);
}

/**
 * `from`'s effective (post-discount) share of one receipt, in IDR. 0 when they
 * are the payer (a payer never owes their own receipt). Converts foreign
 * receipts to the base currency so it matches the IDR settlement ledger.
 */
export function shareOwedOnReceipt(
  receipt: Receipt,
  participantIds: string[],
  from: string
): number {
  if (from === receipt.payerId) return 0;
  const total =
    calculatePersonTotals(receiptInBaseCurrency(receipt), participantIds).find(
      (s) => s.participantId === from
    )?.total ?? 0;
  return total > 0 ? roundTo2(total) : 0;
}

/**
 * Net settle-up position of one debtor→payer pair across the whole trip:
 *   owed = the debtor's total share of every receipt this payer fronted,
 *   paid = every ledger payment debtor→payer (manual settle-up AND per-receipt
 *          share markers), converted to IDR.
 * `settled` is true once `paid` covers `owed` within rounding. This single check
 * is what stops the same debt being settled twice — e.g. a manual "A paid B
 * 200k" and then ticking A's receipt shares, which used to double-count.
 */
export function pairSettlement(
  receipts: Receipt[],
  participantIds: string[],
  payments: TripPayment[] | undefined,
  from: string,
  to: string
): { owed: number; paid: number; settled: boolean } {
  let owed = 0;
  for (const r of receipts) {
    if (r.payerId !== to) continue;
    owed = roundTo2(owed + shareOwedOnReceipt(r, participantIds, from));
  }
  let paid = 0;
  for (const p of payments ?? []) {
    if (p.from === from && p.to === to) paid = roundTo2(paid + paymentIdrAmount(p));
  }
  return { owed, paid, settled: owed > 0 && paid >= owed - SETTLE_EPS };
}

/**
 * Participants whose share of `receiptId` should render as *covered*: either an
 * explicit per-receipt share payment exists, OR they have already fully settled
 * their whole debt to this receipt's payer (e.g. via a manual settle-up). This
 * reconciles the receipt checkboxes with the ledger, so marking a settlement
 * paid anywhere (receipt row, summary transfer, or a manual payment) is
 * reflected consistently across every surface.
 */
export function coveredShareParticipants(
  receipts: Receipt[],
  participantIds: string[],
  payments: TripPayment[] | undefined,
  receiptId: string
): Set<string> {
  const receipt = receipts.find((r) => r.id === receiptId);
  if (!receipt) return new Set();
  const covered = paidShareParticipants(payments, receiptId);
  for (const pid of participantIds) {
    if (pid === receipt.payerId || covered.has(pid)) continue;
    if (pairSettlement(receipts, participantIds, payments, pid, receipt.payerId).settled) {
      covered.add(pid);
    }
  }
  return covered;
}
