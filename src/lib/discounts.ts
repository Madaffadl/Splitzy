// Display helpers for manual discounts, shared by the input panel and the
// summary/export views so wording stays consistent.

import type { Discount, ReceiptItem, Participant } from "@/types";
import { formatMoney } from "./currencies";

/**
 * "Rp 50.000" for amount discounts, "10%" for percentage discounts. `currency`
 * is the receipt's native currency (Travel Spend) — an amount discount is
 * entered/stored in that currency, so it displays with the matching symbol
 * (undefined = IDR → "Rp").
 */
export function formatDiscountValue(d: Discount, currency?: string): string {
  return d.type === "percent" ? `${d.value}%` : formatMoney(d.value, currency);
}

/** Human name of what a discount targets (person / item / whole bill). */
export function describeDiscountTarget(
  d: Discount,
  items: ReceiptItem[],
  participants: Participant[]
): string {
  if (d.scope === "participant") {
    return participants.find((p) => p.id === d.targetId)?.name ?? "Someone";
  }
  if (d.scope === "item") {
    return items.find((i) => i.id === d.targetId)?.name || "Item";
  }
  return "Whole bill";
}

/** Short scope label for chips/subtitles. */
export function discountScopeLabel(scope: Discount["scope"]): string {
  if (scope === "participant") return "Person";
  if (scope === "item") return "Item";
  return "Whole bill";
}
