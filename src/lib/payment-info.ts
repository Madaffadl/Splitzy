// Helpers for optional per-participant payment details (bank, account number,
// account name). Shared by the summary UI (display + export text) and the
// editor so formatting/normalisation stays consistent everywhere.

import type { PaymentInfo } from "@/types";

// Field length ceilings — mirrored by the server validator in validation.ts.
export const PAYMENT_INFO_LIMITS = {
  bank: 60,
  accountNumber: 40,
  accountName: 100,
} as const;

/** True when at least one field carries a non-empty value. */
export function hasPaymentInfo(info: PaymentInfo | undefined | null): info is PaymentInfo {
  if (!info) return false;
  return Boolean(
    info.bank?.trim() || info.accountNumber?.trim() || info.accountName?.trim()
  );
}

/**
 * Trim every field and drop the object entirely when nothing is left. Returning
 * `undefined` for an all-empty form keeps stored/shared payloads clean and lets
 * "clear all fields" act as a delete.
 */
export function normalizePaymentInfo(
  info: PaymentInfo | undefined | null
): PaymentInfo | undefined {
  if (!info) return undefined;
  const bank = info.bank?.trim() || undefined;
  const accountNumber = info.accountNumber?.trim() || undefined;
  const accountName = info.accountName?.trim() || undefined;
  if (!bank && !accountNumber && !accountName) return undefined;
  return { bank, accountNumber, accountName };
}

/**
 * One-line human-readable rendering, e.g. "BCA · 1234567890 · Alex".
 * Skips missing fields. Returns null when there is nothing to show.
 */
export function formatPaymentInfoText(
  info: PaymentInfo | undefined | null
): string | null {
  if (!hasPaymentInfo(info)) return null;
  const parts: string[] = [];
  if (info.bank?.trim()) parts.push(info.bank.trim());
  if (info.accountNumber?.trim()) parts.push(info.accountNumber.trim());
  if (info.accountName?.trim()) parts.push(info.accountName.trim());
  return parts.join(" · ");
}
