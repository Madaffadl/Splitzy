// Build a CSV file for a single receipt's per-person breakdown and trigger
// a browser download. Pure-client; no dependencies.
//
// Use case: user wants to expense a dinner — paste rows into a spreadsheet
// or attach the file to a reimbursement request.

import type { Receipt, Participant } from "@/types";
import { getPersonShareDetails } from "@/lib/receipt/calculations";

/**
 * Quote a value per RFC 4180:
 *   * Wrap in double quotes if the value contains comma, quote, or newline.
 *   * Escape inner quotes by doubling them.
 *   * Always quote string fields that might contain commas (names) for safety.
 */
function csvField(v: string | number): string {
  const s = typeof v === "number" ? String(v) : v;
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(...cols: (string | number)[]): string {
  return cols.map(csvField).join(",");
}

export function buildReceiptCsv(
  receipt: Receipt,
  participants: Participant[],
  title?: string
): string {
  const participantIds = participants.map((p) => p.id);
  const details = getPersonShareDetails(receipt, participantIds);
  const nameOf = (id: string) =>
    participants.find((p) => p.id === id)?.name ?? "Unknown";

  const lines: string[] = [];
  // Excel-friendly: BOM is added at download time; here we just produce text.
  lines.push(row("Splitzy summary", title ?? receipt.title ?? "Bill split"));
  lines.push(row("Generated", new Date().toISOString()));
  lines.push(row("Paid by", nameOf(receipt.payerId)));
  lines.push("");

  // Items table
  lines.push(row("Item", "Qty", "Total", "Shared with"));
  for (const item of receipt.items) {
    const sharedWith =
      item.assignedToIds.length === 0
        ? "(unassigned)"
        : item.assignedToIds.map(nameOf).join(", ");
    lines.push(row(item.name, item.qty, item.total, sharedWith));
  }
  lines.push("");

  // Per-person breakdown
  lines.push(row("Person", "Subtotal", "Tax share", "Service share", "Total"));
  for (const d of details) {
    lines.push(
      row(
        nameOf(d.participantId),
        d.subtotal,
        d.taxAllocation,
        d.serviceAllocation,
        d.total
      )
    );
  }
  lines.push("");

  // Bill totals — use receipt's full item total (includes unassigned items)
  // so the grand total here matches the receipt the user actually paid.
  const subtotal = receipt.items.reduce((s, i) => s + i.total, 0);
  lines.push(row("Subtotal (items)", subtotal));
  lines.push(row("Tax", receipt.tax));
  lines.push(row("Service", receipt.service));
  lines.push(row("Grand total", subtotal + receipt.tax + receipt.service));

  return lines.join("\r\n");
}

/**
 * Trigger a download of the given CSV string. Adds a UTF-8 BOM so Excel and
 * Google Sheets correctly detect encoding (without it, "Café" looks broken).
 */
export function downloadCsv(filename: string, csv: string): void {
  const BOM = "﻿";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Free the object URL on next tick so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Slugify a title into a safe filename fragment. */
export function csvFilename(title: string): string {
  const safe = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "split";
  const stamp = new Date().toISOString().slice(0, 10);
  return `splitzy-${safe}-${stamp}.csv`;
}
