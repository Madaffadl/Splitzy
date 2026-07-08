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

export interface SharedItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
  assignedToIds: string[];
}

export interface SharedDiscount {
  id: string;
  scope: "receipt" | "item" | "participant";
  type: "amount" | "percent";
  value: number;
  label?: string;
  targetId?: string;
}

export interface SharedReceipt {
  id: string;
  title: string;
  date?: string;
  payerId: string;
  tax: number;
  service: number;
  items: SharedItem[];
  discounts?: SharedDiscount[];
}

export interface SharedPaymentInfo {
  bank?: string;
  accountNumber?: string;
  accountName?: string;
}

export interface SharedParticipant {
  id: string;
  name: string;
  // Optional bank/e-wallet details, carried through so a shared link shows the
  // recipient's account. Validated by validateParticipantsJson on write + read.
  paymentInfo?: SharedPaymentInfo;
}

export interface SharedSummaryPayload {
  v: typeof SHARE_PAYLOAD_VERSION;
  type: "multiple" | "single";
  title: string;
  participants: SharedParticipant[];
  // Always an array. For type "single" it holds exactly one receipt.
  receipts: SharedReceipt[];
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

  if (b.type !== "multiple" && b.type !== "single") {
    throw new ValidationError("type", "must be 'multiple' or 'single'");
  }
  const type = b.type;

  const title = asString(b.title, "title", MAX_TITLE);

  const participants = validateParticipantsJson(b.participants, "participants") ?? [];
  if (participants.length === 0) {
    throw new ValidationError("participants", "must have at least one participant");
  }
  const participantIds = new Set(participants.map((p) => p.id));

  if (!Array.isArray(b.receipts)) {
    throw new ValidationError("receipts", "must be an array");
  }
  if (b.receipts.length === 0) {
    throw new ValidationError("receipts", "must have at least one receipt");
  }
  if (b.receipts.length > MAX_RECEIPTS) {
    throw new ValidationError("receipts", `too many receipts (max ${MAX_RECEIPTS})`);
  }
  if (type === "single" && b.receipts.length !== 1) {
    throw new ValidationError("receipts", "a single-receipt share must have exactly one receipt");
  }

  const receipts: SharedReceipt[] = b.receipts.map((raw, ri) => {
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

    return {
      id: asString(r.id, `receipts[${ri}].id`, MAX_ID),
      title: asString(r.title, `receipts[${ri}].title`, MAX_TITLE),
      ...(date ? { date } : {}),
      payerId,
      tax: asMoney(r.tax ?? 0, `receipts[${ri}].tax`),
      service: asMoney(r.service ?? 0, `receipts[${ri}].service`),
      items,
      ...(discounts ? { discounts } : {}),
    };
  });

  return { v: SHARE_PAYLOAD_VERSION, type, title, participants, receipts };
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
