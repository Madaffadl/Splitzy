import type { Receipt } from "@/types";
import type { ReceiptDetail } from "@/lib/data/types";

/**
 * The receipts that make up a saved split.
 *
 * `ReceiptDetail` describes the same split in two shapes:
 *
 *   * `receipts[]` — the authoritative payload. This is the ONLY place `fees`
 *     and `discounts` live (see the comment in api/receipts/[id]/route.ts).
 *   * the flat projection — `items`/`tax`/`service`/`payerId` at the top level,
 *     kept for rows written before `receipts` existed.
 *
 * Reading the flat fields directly silently drops fees and discounts, which is
 * how /history/<id> came to show a different Grand Total than the editor did
 * for the very same split — two numbers, one split, from two buttons on the
 * same card. Reading `receipts` directly is no better: a legacy row has none,
 * so `detail.receipts ?? []` empties it and `detail.receipts?.[0]` is a silent
 * no-op.
 *
 * Every consumer goes through here: prefer the authoritative payload, fall back
 * to synthesising the one receipt the flat columns describe.
 */
export function receiptsFromDetail(detail: ReceiptDetail): Receipt[] {
    if (detail.receipts && detail.receipts.length > 0) return detail.receipts;

    return [
        {
            id: detail.id,
            title: detail.title,
            ...(detail.date ? { date: detail.date } : {}),
            payerId: detail.payerId,
            items: detail.items ?? [],
            tax: detail.tax ?? 0,
            service: detail.service ?? 0,
        },
    ];
}

/**
 * Whether this split should render as several receipts settled together.
 *
 * Trusts the stored `type` first, but also treats an untyped row that happens
 * to carry more than one receipt as multiple — otherwise those rows render
 * through the single-receipt panel and only the first receipt is shown.
 */
export function isMultipleSplit(detail: ReceiptDetail): boolean {
    if (detail.type === "multiple") return true;
    if (detail.type === "single") return false;
    return (detail.receipts?.length ?? 0) > 1;
}
