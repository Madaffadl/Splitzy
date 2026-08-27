// "Why can't I add this?" — the rules behind the Add buttons on the fee and
// discount forms.
//
// Pulled out of the components for two reasons. It is business logic (the same
// rules the server enforces), so it belongs next to the limits it checks rather
// than inside JSX. And it was previously unreachable by tests, which is how the
// fee form shipped with a button you could click that did nothing: a negative
// amount was clamped to 0, the handler bailed on `val <= 0`, and the user got no
// message at all.
//
// Every function returns the message to show, or null when the input is fine.

import { formatCurrency } from "@/lib/utils";
import {
  MAX_AMOUNT,
  MAX_DISCOUNTS_PER_RECEIPT,
  MAX_FEES_PER_RECEIPT,
} from "@/lib/limits";
import type { DiscountScope, DiscountType } from "@/types";

/**
 * Parse an amount as TYPED, without clamping.
 *
 * The input helpers deliberately keep the raw (possibly negative) value: the
 * form's own parser floors negatives to 0, which makes "-500" and "0"
 * indistinguishable and costs us the chance to explain the problem.
 */
export function parseTypedAmount(raw: string): number {
  if (!raw.trim()) return NaN;
  return parseFloat(raw.replace(/\./g, "").replace(/,/g, "."));
}

export interface FeeInput {
  label: string;
  /** Raw text straight from the input, not yet parsed. */
  amount: string;
  /** How many fees the receipt already has. */
  existingCount: number;
  /** Currency symbol for the "too large" message. Defaults to Rp. */
  symbol?: string;
}

export function feeInputError(input: FeeInput): string | null {
  const { label, amount, existingCount, symbol = "Rp" } = input;

  if (existingCount >= MAX_FEES_PER_RECEIPT) {
    return `Limit reached — a receipt can have at most ${MAX_FEES_PER_RECEIPT} fees.`;
  }

  // An untouched amount field is not an error yet; the button stays disabled on
  // its own. Only complain once there is something to complain about.
  if (!amount.trim()) return null;

  const value = parseTypedAmount(amount);
  if (!Number.isFinite(value)) return "Enter a number, e.g. 15000.";
  if (value <= 0) return "Amount must be greater than 0.";
  if (value > MAX_AMOUNT) {
    return `Amount is too large (max ${symbol} ${formatCurrency(MAX_AMOUNT)}).`;
  }

  // A blank label is deliberately NOT reported: an empty required text field
  // speaks for itself, and `canAddFee` keeps the button disabled for it.
  return null;
}

/** Can the fee form submit? Distinct from `feeInputError`, which may be null
 *  while the form is merely incomplete (empty label or untouched amount). */
export function canAddFee(input: FeeInput): boolean {
  return (
    input.existingCount < MAX_FEES_PER_RECEIPT &&
    input.label.trim().length > 0 &&
    input.amount.trim().length > 0 &&
    feeInputError(input) === null
  );
}

export interface DiscountInput {
  /** Raw text straight from the input, not yet parsed. */
  value: string;
  type: DiscountType;
  scope: DiscountScope;
  /** Selected item/participant id — required for item and participant scope. */
  targetId: string;
  /** How many discounts the receipt already has. */
  existingCount: number;
}

export function discountInputError(input: DiscountInput): string | null {
  const { value, type, scope, targetId, existingCount } = input;

  if (existingCount >= MAX_DISCOUNTS_PER_RECEIPT) {
    return `Limit reached — a receipt can have at most ${MAX_DISCOUNTS_PER_RECEIPT} discounts.`;
  }

  if (!value.trim()) return null;

  const n = parseTypedAmount(value);
  if (!Number.isFinite(n)) return "Enter a number, e.g. 10.";
  if (n <= 0) return "Value must be greater than 0.";
  if (type === "percent" && n > 100) return "A percentage can't be more than 100.";
  if (type === "amount" && n > MAX_AMOUNT) return "Amount is too large.";

  // A 150% discount and an unselected item used to look identical from the
  // outside — both just greyed the button out.
  if ((scope === "item" || scope === "participant") && !targetId) {
    return `Choose which ${scope === "item" ? "item" : "person"} this applies to.`;
  }

  return null;
}

/** Can the discount form submit? */
export function canAddDiscount(input: DiscountInput): boolean {
  return (
    input.existingCount < MAX_DISCOUNTS_PER_RECEIPT &&
    input.value.trim().length > 0 &&
    discountInputError(input) === null
  );
}
