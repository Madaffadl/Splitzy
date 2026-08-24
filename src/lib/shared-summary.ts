// Server-side helpers for shareable, read-only split summaries.
//
// A "shared summary" is an immutable point-in-time snapshot of a trip (or a
// single receipt) split, persisted so anyone with the short link (/s/<code>)
// can open and view the breakdown — no account required, read-only.
//
// Trip data otherwise lives only in the creator's browser, so creating a link
// is the one place a snapshot is copied server-side. Snapshots never change:
// editing the trip afterwards does not affect an already-created link. Links
// expire after SHARE_TTL_DAYS and are swept by the admin cleanup job.
//
// The same validator is used on write (untrusted client body) and on read
// (defending against a malformed/legacy row in the Json column).

import { ValidationError, validateParticipantsJson } from "@/lib/validation";
import type { Receipt, ReceiptItem, Discount, ReceiptFee, Participant, PaymentInfo, TripPayment } from "@/types";

export const SHARE_TTL_DAYS = 14;
export const SHARE_PAYLOAD_VERSION = 1 as const;

// Generous structural ceilings — these guard the Json column against junk, not
// legitimate use. A 100-receipt trip is already well beyond normal.
const MAX_TITLE = 200;
const MAX_NAME = 100;
const MAX_ID = 100;
const MAX_RECEIPTS = 100;
const MAX_ITEMS_PER_RECEIPT = 200;
const MAX_ASSIGNEES_PER_ITEM = 100;
const MAX_DISCOUNTS_PER_RECEIPT = 100;
const MAX_AMOUNT = 1_000_000_000; // 1 billion rupiah ceiling

// Hard cap on the serialized snapshot. ~256KB comfortably fits a 100-receipt
// trip and stops a client from writing a multi-MB blob into Postgres.
export const MAX_PAYLOAD_BYTES = 256_000;

// The "shared" (persisted snapshot) shapes are exactly the canonical client
// shapes — aliased here rather than re-declared so there is ONE source of truth
// and adding a field can't leave these definitions out of sync.
export type SharedItem = ReceiptItem;
export type SharedDiscount = Discount;
export type SharedReceipt = Receipt;
export type SharedPaymentInfo = PaymentInfo;
export type SharedParticipant = Participant;
export type SharedPayment = Omit<TripPayment, "createdAt">;

export interface SharedSummaryPayload {
  v: typeof SHARE_PAYLOAD_VERSION;
  type: "multiple" | "single" | "travel";
  title: string;
  participants: SharedParticipant[];
  // All three modes are receipt-based; "single" holds exactly one receipt.
  receipts: SharedReceipt[];
  // Optional spending target, only meaningful for "travel".
  budget?: number;
  // Recorded settle-up payments (Travel Spend), so the shared settlement matches.
  payments?: SharedPayment[];
}

// --- Local primitive validators (validation.ts keeps its helpers private) ---

function asString(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") throw new ValidationError(field, "must be a string");
  const trimmed = value.trim();
  if (!trimmed) throw new ValidationError(field, "cannot be empty");
  if (trimmed.length > max) throw new ValidationError(field, `exceeds max length ${max}`);
  return trimmed;
}

function asMoney(value: unknown, field: string): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "0"));
  if (!Number.isFinite(n)) throw new ValidationError(field, "must be a finite number");
  if (n < 0) throw new ValidationError(field, "cannot be negative");
  if (n > MAX_AMOUNT) throw new ValidationError(field, "exceeds maximum amount");
  return n;
}

function asPositiveInt(value: unknown, field: string, max: number): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? "1"), 10);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new ValidationError(field, `must be an integer between 1 and ${max}`);
  }
  return n;
}

function asIdArray(value: unknown, field: string, validIds: Set<string>): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new ValidationError(field, "must be an array");
  if (value.length > MAX_ASSIGNEES_PER_ITEM) {
    throw new ValidationError(field, `too many entries (max ${MAX_ASSIGNEES_PER_ITEM})`);
  }
  return value.map((v, i) => {
    const id = asString(v, `${field}[${i}]`, MAX_ID);
    if (!validIds.has(id)) {
      throw new ValidationError(`${field}[${i}]`, `references unknown participant ${id}`);
    }
    return id;
  });
}

// Validate optional qty-per-person assignments: each entry must reference a
// current participant and carry a positive integer qty. Unknown/zero entries
// are dropped; returns undefined when nothing valid remains.
function validateAssignments(
  value: unknown,
  field: string,
  participantIds: Set<string>
): { participantId: string; qty: number }[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  if (value.length > MAX_ASSIGNEES_PER_ITEM) {
    throw new ValidationError(field, `too many entries (max ${MAX_ASSIGNEES_PER_ITEM})`);
  }
  const seen = new Set<string>();
  const out: { participantId: string; qty: number }[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const a = raw as Record<string, unknown>;
    const participantId = typeof a.participantId === "string" ? a.participantId : "";
    if (!participantIds.has(participantId) || seen.has(participantId)) continue;
    const qty = typeof a.qty === "number" ? a.qty : parseInt(String(a.qty ?? ""), 10);
    if (!Number.isInteger(qty) || qty <= 0 || qty > 100_000) continue;
    seen.add(participantId);
    out.push({ participantId, qty });
  }
  return out.length > 0 ? out : undefined;
}

function validateDiscounts(
  value: unknown,
  field: string,
  itemIds: Set<string>,
  participantIds: Set<string>
): SharedDiscount[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) throw new ValidationError(field, "must be an array");
  if (value.length === 0) return undefined;
  if (value.length > MAX_DISCOUNTS_PER_RECEIPT) {
    throw new ValidationError(field, `too many discounts (max ${MAX_DISCOUNTS_PER_RECEIPT})`);
  }

  return value.map((raw, i): SharedDiscount => {
    const f = `${field}[${i}]`;
    if (!raw || typeof raw !== "object") throw new ValidationError(f, "must be an object");
    const d = raw as Record<string, unknown>;

    if (d.scope !== "receipt" && d.scope !== "item" && d.scope !== "participant") {
      throw new ValidationError(`${f}.scope`, "must be receipt, item, or participant");
    }
    if (d.type !== "amount" && d.type !== "percent") {
      throw new ValidationError(`${f}.type`, "must be amount or percent");
    }

    let value: number;
    if (d.type === "percent") {
      const n = typeof d.value === "number" ? d.value : parseFloat(String(d.value ?? "0"));
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new ValidationError(`${f}.value`, "percent must be between 0 and 100");
      }
      value = n;
    } else {
      value = asMoney(d.value, `${f}.value`);
    }

    let targetId: string | undefined;
    if (d.scope === "item") {
      targetId = asString(d.targetId, `${f}.targetId`, MAX_ID);
      if (!itemIds.has(targetId)) {
        throw new ValidationError(`${f}.targetId`, "references unknown item");
      }
    } else if (d.scope === "participant") {
      targetId = asString(d.targetId, `${f}.targetId`, MAX_ID);
      if (!participantIds.has(targetId)) {
        throw new ValidationError(`${f}.targetId`, "references unknown participant");
      }
    }

    const label =
      d.label != null && d.label !== "" ? asString(d.label, `${f}.label`, MAX_NAME) : undefined;

    return {
      id: asString(d.id, `${f}.id`, MAX_ID),
      scope: d.scope,
      type: d.type,
      value,
      ...(label ? { label } : {}),
      ...(targetId ? { targetId } : {}),
    };
  });
}

/**
 * Validate + normalize an untrusted share payload into the exact stored shape.
 * Throws ValidationError on any shape mismatch. Used for both the POST body and
 * for re-parsing a stored row on read.
 */
export function validateSharedSummaryInput(body: unknown): SharedSummaryPayload {
  if (!body || typeof body !== "object") {
    throw new ValidationError("body", "must be an object");
  }
  const b = body as Record<string, unknown>;

  if (b.type !== "multiple" && b.type !== "single" && b.type !== "travel") {
    throw new ValidationError("type", "must be 'multiple', 'single', or 'travel'");
  }
  const type = b.type;

  const title = asString(b.title, "title", MAX_TITLE);

  const participants = validateParticipantsJson(b.participants, "participants") ?? [];
  if (participants.length === 0) {
    throw new ValidationError("participants", "must have at least one participant");
  }
  const participantIds = new Set(participants.map((p) => p.id));

  // Optional spending target (Travel Spend); dropped unless positive.
  let budget: number | undefined;
  if (b.budget != null && b.budget !== "") {
    const parsed = asMoney(b.budget, "budget");
    budget = parsed > 0 ? parsed : undefined;
  }

  const receipts = validateSharedReceipts(b.receipts, participantIds, {
    requireAtLeastOne: true,
    exactlyOne: type === "single",
  });

  const payments = validateSharedPayments(b.payments, participantIds);

  return {
    v: SHARE_PAYLOAD_VERSION,
    type,
    title,
    participants,
    receipts,
    ...(budget ? { budget } : {}),
    ...(payments ? { payments } : {}),
  };
}

const MAX_PAYMENTS = 500;

/**
 * Validate + normalize recorded settle-up payments against the participant set.
 * Entries with unknown/equal participants or non-positive amounts are dropped
 * (rather than throwing) so a stale entry never invalidates the whole payload.
 */
export function validateSharedPayments(
  value: unknown,
  participantIds: Set<string>
): SharedPayment[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const out: SharedPayment[] = [];
  for (const raw of value.slice(0, MAX_PAYMENTS)) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    const from = typeof p.from === "string" ? p.from : "";
    const to = typeof p.to === "string" ? p.to : "";
    if (!participantIds.has(from) || !participantIds.has(to) || from === to) continue;
    const amount = typeof p.amount === "number" ? p.amount : parseFloat(String(p.amount ?? ""));
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) continue;
    const id = typeof p.id === "string" && p.id ? p.id.slice(0, MAX_ID) : `${from}>${to}:${out.length}`;
    const note =
      p.note != null && p.note !== "" ? asString(p.note, "payment.note", MAX_NAME) : undefined;
    const source =
      typeof p.source === "string" && p.source ? p.source.slice(0, MAX_TITLE) : undefined;
    out.push({ id, from, to, amount, ...(note ? { note } : {}), ...(source ? { source } : {}) });
  }
  return out.length > 0 ? out : undefined;
}

const MAX_FEES_PER_RECEIPT = 50;

function validateFees(value: unknown, field: string): ReceiptFee[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) return undefined;
  if (value.length === 0) return undefined;
  if (value.length > MAX_FEES_PER_RECEIPT) {
    throw new ValidationError(field, `too many fees (max ${MAX_FEES_PER_RECEIPT})`);
  }

  return value.map((raw, i): ReceiptFee => {
    const f = `${field}[${i}]`;
    if (!raw || typeof raw !== "object") throw new ValidationError(f, "must be an object");
    const entry = raw as Record<string, unknown>;

    const id = asString(entry.id, `${f}.id`, MAX_ID);
    const label = asString(entry.label, `${f}.label`, MAX_NAME);
    const amount = asMoney(entry.amount, `${f}.amount`);
    if (amount <= 0) throw new ValidationError(`${f}.amount`, "must be positive");

    const splitMethod =
      entry.splitMethod === "proportional" ? "proportional" : "equal";

    return { id, label, amount, splitMethod };
  });
}

/**
 * Validate + normalize an array of name-based receipts against a set of valid
 * participant ids. Shared by the share payload validator and the Travel Spend
 * cloud API (which persists the same receipt shape).
 */
export function validateSharedReceipts(
  value: unknown,
  participantIds: Set<string>,
  opts: { requireAtLeastOne?: boolean; exactlyOne?: boolean } = {}
): SharedReceipt[] {
  if (!Array.isArray(value)) {
    throw new ValidationError("receipts", "must be an array");
  }
  if (opts.requireAtLeastOne && value.length === 0) {
    throw new ValidationError("receipts", "must have at least one receipt");
  }
  if (value.length > MAX_RECEIPTS) {
    throw new ValidationError("receipts", `too many receipts (max ${MAX_RECEIPTS})`);
  }
  if (opts.exactlyOne && value.length !== 1) {
    throw new ValidationError("receipts", "a single-receipt share must have exactly one receipt");
  }

  return value.map((raw, ri): SharedReceipt => {
    if (!raw || typeof raw !== "object") {
      throw new ValidationError(`receipts[${ri}]`, "must be an object");
    }
    const r = raw as Record<string, unknown>;

    if (!Array.isArray(r.items)) {
      throw new ValidationError(`receipts[${ri}].items`, "must be an array");
    }
    if (r.items.length > MAX_ITEMS_PER_RECEIPT) {
      throw new ValidationError(`receipts[${ri}].items`, `too many items (max ${MAX_ITEMS_PER_RECEIPT})`);
    }

    const items: SharedItem[] = r.items.map((rawItem, ii) => {
      if (!rawItem || typeof rawItem !== "object") {
        throw new ValidationError(`receipts[${ri}].items[${ii}]`, "must be an object");
      }
      const it = rawItem as Record<string, unknown>;
      const assignments = validateAssignments(
        it.assignments,
        `receipts[${ri}].items[${ii}].assignments`,
        participantIds
      );
      return {
        id: asString(it.id, `receipts[${ri}].items[${ii}].id`, MAX_ID),
        name: asString(it.name, `receipts[${ri}].items[${ii}].name`, MAX_NAME),
        qty: asPositiveInt(it.qty ?? 1, `receipts[${ri}].items[${ii}].qty`, 100_000),
        unitPrice: asMoney(it.unitPrice ?? 0, `receipts[${ri}].items[${ii}].unitPrice`),
        total: asMoney(it.total ?? 0, `receipts[${ri}].items[${ii}].total`),
        assignedToIds: asIdArray(
          it.assignedToIds,
          `receipts[${ri}].items[${ii}].assignedToIds`,
          participantIds
        ),
        ...(assignments ? { assignments } : {}),
      };
    });

    const payerId = asString(r.payerId, `receipts[${ri}].payerId`, MAX_ID);
    if (!participantIds.has(payerId)) {
      throw new ValidationError(`receipts[${ri}].payerId`, "must reference a participant");
    }

    let date: string | undefined;
    if (r.date != null && r.date !== "") {
      const parsed = new Date(String(r.date));
      if (isNaN(parsed.getTime())) {
        throw new ValidationError(`receipts[${ri}].date`, "is not a valid date");
      }
      date = parsed.toISOString();
    }

    const itemIds = new Set(items.map((it) => it.id));
    const discounts = validateDiscounts(
      r.discounts,
      `receipts[${ri}].discounts`,
      itemIds,
      participantIds
    );

    // Preserve foreign currency metadata (ISO 4217 code + locked rate).
    // Only stored when the receipt is in a non-IDR currency — undefined = IDR.
    const MAX_CURRENCY_CODE = 10;
    const MAX_FX_RATE = 1_000_000; // sanity cap (1 unit of currency = max 1M IDR)
    let currency: string | undefined;
    let fxRate: number | undefined;
    if (typeof r.currency === "string" && r.currency.trim().length > 0) {
      const code = r.currency.trim().toUpperCase().slice(0, MAX_CURRENCY_CODE);
      if (code !== "IDR") {
        currency = code;
        if (typeof r.fxRate === "number" && r.fxRate > 0 && r.fxRate <= MAX_FX_RATE) {
          fxRate = r.fxRate;
        }
      }
    }

    const fees = validateFees(r.fees, `receipts[${ri}].fees`);

    return {
      id: asString(r.id, `receipts[${ri}].id`, MAX_ID),
      title: asString(r.title, `receipts[${ri}].title`, MAX_TITLE),
      ...(date ? { date } : {}),
      payerId,
      tax: asMoney(r.tax ?? 0, `receipts[${ri}].tax`),
      service: asMoney(r.service ?? 0, `receipts[${ri}].service`),
      items,
      ...(discounts ? { discounts } : {}),
      ...(fees ? { fees } : {}),
      ...(currency ? { currency, ...(fxRate !== undefined ? { fxRate } : {}) } : {}),
    };
  });
}

/** Re-parse a stored row's payload, returning null if it's malformed/legacy. */
export function parseSharedSummaryPayload(value: unknown): SharedSummaryPayload | null {
  try {
    return validateSharedSummaryInput(value);
  } catch {
    return null;
  }
}

// Unambiguous alphabet (no 0/O/1/I/l). 8 chars over 54 symbols ≈ 7.2e13
// combinations — collisions are vanishingly rare and handled by retry on the
// unique constraint anyway.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";

export function generateShareCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

export function shareExpiryFromNow(now = Date.now()): Date {
  return new Date(now + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000);
}
