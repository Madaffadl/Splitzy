// Lightweight runtime validators for API request bodies.
// Avoids adding zod as a dependency for the small number of POST/PUT shapes
// we actually validate. If validation needs grow, swap to zod.

export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = "ValidationError";
  }
}

const MAX_TITLE = 200;
const MAX_NAME = 100;
const MAX_ITEMS_PER_RECEIPT = 200;
const MAX_AMOUNT = 1_000_000_000; // 1 billion rupiah ceiling

export interface ValidatedReceiptItem {
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
  assignedToUserIds: string[];
}

export interface ValidatedReceiptInput {
  title: string;
  payerId: string | null;
  tax: number;
  service: number;
  date: string | null;
  tripId: string | null;
  participantsJson: ValidatedParticipant[] | null;
  items: ValidatedReceiptItem[];
}

function asString(value: unknown, field: string, max: number, allowEmpty = false): string {
  if (typeof value !== "string") {
    throw new ValidationError(field, "must be a string");
  }
  const trimmed = value.trim();
  if (!allowEmpty && !trimmed) {
    throw new ValidationError(field, "cannot be empty");
  }
  if (trimmed.length > max) {
    throw new ValidationError(field, `exceeds max length ${max}`);
  }
  return trimmed;
}

function asMoney(value: unknown, field: string): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "0"));
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    throw new ValidationError(field, "must be a finite number");
  }
  if (n < 0) {
    throw new ValidationError(field, "cannot be negative");
  }
  if (n > MAX_AMOUNT) {
    throw new ValidationError(field, "exceeds maximum amount");
  }
  return n;
}

function asPositiveInt(value: unknown, field: string, max: number): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? "1"), 10);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new ValidationError(field, `must be an integer between 1 and ${max}`);
  }
  return n;
}

function asOptionalId(value: unknown, field: string): string | null {
  if (value == null || value === "") return null;
  return asString(value, field, 100);
}

function asStringArray(value: unknown, field: string, maxItems = 50): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new ValidationError(field, "must be an array");
  }
  if (value.length > maxItems) {
    throw new ValidationError(field, `too many items (max ${maxItems})`);
  }
  return value.map((v, i) => asString(v, `${field}[${i}]`, 100));
}

export interface ValidatedPaymentInfo {
  bank?: string;
  accountNumber?: string;
  accountName?: string;
}

export interface ValidatedParticipant {
  id: string;
  name: string;
  paymentInfo?: ValidatedPaymentInfo;
}

const MAX_PARTICIPANTS = 100;

// Length ceilings mirror src/lib/payment-info.ts PAYMENT_INFO_LIMITS.
const MAX_BANK = 60;
const MAX_ACCOUNT_NUMBER = 40;
const MAX_ACCOUNT_NAME = 100;

/**
 * Validate the optional per-participant payment details. All three fields are
 * optional; a blank/whitespace field is dropped. Returns undefined when nothing
 * meaningful is present so the stored/shared payload stays clean.
 */
export function validatePaymentInfo(
  value: unknown,
  field: string
): ValidatedPaymentInfo | undefined {
  if (value == null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(field, "must be an object");
  }
  const r = value as Record<string, unknown>;
  const optionalString = (v: unknown, name: string, max: number): string | undefined => {
    if (v == null) return undefined;
    const s = asString(v, name, max, true);
    return s || undefined;
  };
  const bank = optionalString(r.bank, `${field}.bank`, MAX_BANK);
  const accountNumber = optionalString(
    r.accountNumber,
    `${field}.accountNumber`,
    MAX_ACCOUNT_NUMBER
  );
  const accountName = optionalString(
    r.accountName,
    `${field}.accountName`,
    MAX_ACCOUNT_NAME
  );
  if (!bank && !accountNumber && !accountName) return undefined;
  return { bank, accountNumber, accountName };
}

/**
 * Validate the optional `participantsJson` payload.
 *
 * Receipt rows imported from localStorage embed a [{id, name}] snapshot of
 * the participants because those people don't have User accounts yet. When a
 * client sends this field we still want a strict shape check — the column is
 * `Json` in Postgres, so without validation arbitrary nested data could land
 * there and surface to other users via the read endpoint.
 *
 * Returns null when the input is null/undefined (legitimate "not set"); throws
 * ValidationError on shape mismatch.
 */
export function validateParticipantsJson(
  value: unknown,
  field = "participantsJson"
): ValidatedParticipant[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) {
    throw new ValidationError(field, "must be an array of participants");
  }
  if (value.length > MAX_PARTICIPANTS) {
    throw new ValidationError(field, `too many participants (max ${MAX_PARTICIPANTS})`);
  }
  const seen = new Set<string>();
  const result: ValidatedParticipant[] = value.map((raw, idx): ValidatedParticipant => {
    if (!raw || typeof raw !== "object") {
      throw new ValidationError(`${field}[${idx}]`, "must be an object");
    }
    const r = raw as Record<string, unknown>;
    const id = asString(r.id, `${field}[${idx}].id`, 100);
    const name = asString(r.name, `${field}[${idx}].name`, MAX_NAME);
    if (seen.has(id)) {
      throw new ValidationError(`${field}[${idx}].id`, "duplicate participant id");
    }
    seen.add(id);
    const paymentInfo = validatePaymentInfo(r.paymentInfo, `${field}[${idx}].paymentInfo`);
    return paymentInfo ? { id, name, paymentInfo } : { id, name };
  });
  return result;
}

export function validateTripCreate(body: unknown): { name: string } {
  if (!body || typeof body !== "object") {
    throw new ValidationError("body", "must be an object");
  }
  const b = body as Record<string, unknown>;
  return { name: asString(b.name, "name", MAX_NAME) };
}

export function validateReceiptCreate(body: unknown): ValidatedReceiptInput {
  if (!body || typeof body !== "object") {
    throw new ValidationError("body", "must be an object");
  }
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.items)) {
    throw new ValidationError("items", "must be an array");
  }
  if (b.items.length === 0) {
    throw new ValidationError("items", "must have at least one item");
  }
  if (b.items.length > MAX_ITEMS_PER_RECEIPT) {
    throw new ValidationError("items", `too many items (max ${MAX_ITEMS_PER_RECEIPT})`);
  }

  const items: ValidatedReceiptItem[] = b.items.map((rawItem: unknown, idx: number) => {
    if (!rawItem || typeof rawItem !== "object") {
      throw new ValidationError(`items[${idx}]`, "must be an object");
    }
    const it = rawItem as Record<string, unknown>;
    return {
      name: asString(it.name, `items[${idx}].name`, MAX_NAME),
      qty: asPositiveInt(it.qty ?? 1, `items[${idx}].qty`, 1000),
      unitPrice: asMoney(it.unitPrice ?? 0, `items[${idx}].unitPrice`),
      total: asMoney(it.total ?? 0, `items[${idx}].total`),
      assignedToUserIds: asStringArray(it.assignedToUserIds, `items[${idx}].assignedToUserIds`),
    };
  });

  let date: string | null = null;
  if (b.date != null && b.date !== "") {
    const parsed = new Date(String(b.date));
    if (isNaN(parsed.getTime())) {
      throw new ValidationError("date", "is not a valid date");
    }
    date = parsed.toISOString();
  }

  const participantsJson = validateParticipantsJson(b.participantsJson);
  const payerId = asOptionalId(b.payerId, "payerId");

  // Cross-field rule: when participantsJson is provided, the payerId (if set)
  // must reference one of the embedded participants. Receipts where the payer
  // isn't in the participant list produce phantom credits in settlement math.
  if (payerId && participantsJson) {
    const found = participantsJson.some((p) => p.id === payerId);
    if (!found) {
      throw new ValidationError(
        "payerId",
        "must match an id in participantsJson"
      );
    }
  }

  // Cross-field rule: every item.assignedToUserIds entry must also be in
  // participantsJson when that array is provided. Otherwise items get
  // assigned to "ghost" participants that no longer exist.
  if (participantsJson) {
    const validIds = new Set(participantsJson.map((p) => p.id));
    items.forEach((item, idx) => {
      for (const userId of item.assignedToUserIds) {
        if (!validIds.has(userId)) {
          throw new ValidationError(
            `items[${idx}].assignedToUserIds`,
            `references unknown participant ${userId}`
          );
        }
      }
    });
  }

  return {
    title: asString(b.title, "title", MAX_TITLE),
    payerId,
    tax: asMoney(b.tax ?? 0, "tax"),
    service: asMoney(b.service ?? 0, "service"),
    date,
    tripId: asOptionalId(b.tripId, "tripId"),
    participantsJson,
    items,
  };
}

export interface ValidatedReceiptPatch {
  title?: string;
  payerId?: string;
  tax?: number;
  service?: number;
  date?: string | null;
  /**
   * Version observed by the client. Required for safe concurrent edits — see
   * the optimistic-locking flow in PUT /api/receipts/[id]. Optional in the
   * type because legacy callers may omit it.
   */
  expectedVersion?: number;
}

function asVersion(value: unknown, field: string): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isInteger(n) || n < 1) {
    throw new ValidationError(field, "must be a positive integer");
  }
  return n;
}

export function validateReceiptPatch(body: unknown): ValidatedReceiptPatch {
  if (!body || typeof body !== "object") {
    throw new ValidationError("body", "must be an object");
  }
  const b = body as Record<string, unknown>;
  const out: ValidatedReceiptPatch = {};

  if (b.title !== undefined) {
    out.title = asString(b.title, "title", MAX_TITLE);
  }
  if (b.payerId !== undefined && b.payerId !== null && b.payerId !== "") {
    out.payerId = asString(b.payerId, "payerId", 100);
  }
  if (b.tax !== undefined) out.tax = asMoney(b.tax, "tax");
  if (b.service !== undefined) out.service = asMoney(b.service, "service");
  if (b.date !== undefined) {
    if (b.date === null || b.date === "") {
      out.date = null;
    } else {
      const parsed = new Date(String(b.date));
      if (isNaN(parsed.getTime())) {
        throw new ValidationError("date", "is not a valid date");
      }
      out.date = parsed.toISOString();
    }
  }
  if (b.expectedVersion !== undefined) {
    out.expectedVersion = asVersion(b.expectedVersion, "expectedVersion");
  }

  return out;
}

export interface ValidatedTripPatch {
  name?: string;
  expectedVersion?: number;
}

export function validateTripPatch(body: unknown): ValidatedTripPatch {
  if (!body || typeof body !== "object") {
    throw new ValidationError("body", "must be an object");
  }
  const b = body as Record<string, unknown>;
  const out: ValidatedTripPatch = {};
  if (b.name !== undefined) {
    out.name = asString(b.name, "name", MAX_NAME);
  }
  if (b.expectedVersion !== undefined) {
    out.expectedVersion = asVersion(b.expectedVersion, "expectedVersion");
  }
  return out;
}

export function validateMemberAdd(body: unknown): { email: string } {
  if (!body || typeof body !== "object") {
    throw new ValidationError("body", "must be an object");
  }
  const b = body as Record<string, unknown>;
  const email = asString(b.email, "email", 320).toLowerCase();
  // RFC-5321 compliant minimum: x@y.z
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("email", "is not a valid email");
  }
  return { email };
}

export function validationErrorResponse(err: unknown): {
  body: { error: string; code: "VALIDATION_FAILED"; field?: string };
  status: 400;
} {
  if (err instanceof ValidationError) {
    return {
      body: { error: err.message, code: "VALIDATION_FAILED", field: err.field },
      status: 400,
    };
  }
  return {
    body: { error: "Invalid request body", code: "VALIDATION_FAILED" },
    status: 400,
  };
}
