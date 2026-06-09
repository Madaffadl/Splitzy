import { describe, it, expect } from "vitest";
import {
  validateSharedSummaryInput,
  parseSharedSummaryPayload,
  generateShareCode,
  shareExpiryFromNow,
  SHARE_TTL_DAYS,
} from "./shared-summary";

const validTrip = {
  type: "trip" as const,
  title: "Bali Trip",
  participants: [
    { id: "p1", name: "Alex" },
    { id: "p2", name: "Bella" },
  ],
  receipts: [
    {
      id: "r1",
      title: "Dinner",
      payerId: "p1",
      tax: 22000,
      service: 18000,
      items: [
        {
          id: "i1",
          name: "Pizza",
          qty: 1,
          unitPrice: 95000,
          total: 95000,
          assignedToIds: ["p1", "p2"],
        },
      ],
    },
  ],
};

describe("validateSharedSummaryInput", () => {
  it("accepts and normalizes a valid trip", () => {
    const out = validateSharedSummaryInput(validTrip);
    expect(out.v).toBe(1);
    expect(out.type).toBe("trip");
    expect(out.title).toBe("Bali Trip");
    expect(out.participants).toHaveLength(2);
    expect(out.receipts[0].items[0].assignedToIds).toEqual(["p1", "p2"]);
  });

  it("strips unknown fields (only known shape is persisted)", () => {
    const out = validateSharedSummaryInput({
      ...validTrip,
      evil: "<script>",
      receipts: [{ ...validTrip.receipts[0], secret: 42 }],
    });
    expect(out).not.toHaveProperty("evil");
    expect(out.receipts[0]).not.toHaveProperty("secret");
  });

  it("rejects an invalid type", () => {
    expect(() => validateSharedSummaryInput({ ...validTrip, type: "nope" })).toThrow(
      /type/i
    );
  });

  it("rejects a payer not among participants", () => {
    expect(() =>
      validateSharedSummaryInput({
        ...validTrip,
        receipts: [{ ...validTrip.receipts[0], payerId: "ghost" }],
      })
    ).toThrow(/payer/i);
  });

  it("rejects items assigned to an unknown participant", () => {
    expect(() =>
      validateSharedSummaryInput({
        ...validTrip,
        receipts: [
          {
            ...validTrip.receipts[0],
            items: [{ ...validTrip.receipts[0].items[0], assignedToIds: ["ghost"] }],
          },
        ],
      })
    ).toThrow(/unknown participant/i);
  });

  it("requires at least one participant and one receipt", () => {
    expect(() => validateSharedSummaryInput({ ...validTrip, participants: [] })).toThrow(
      /participant/i
    );
    expect(() => validateSharedSummaryInput({ ...validTrip, receipts: [] })).toThrow(
      /receipt/i
    );
  });

  it("requires exactly one receipt for a single share", () => {
    expect(() =>
      validateSharedSummaryInput({
        ...validTrip,
        type: "single",
        receipts: [validTrip.receipts[0], validTrip.receipts[0]],
      })
    ).toThrow(/exactly one/i);
  });
});

describe("parseSharedSummaryPayload", () => {
  it("round-trips a valid stored payload", () => {
    const stored = validateSharedSummaryInput(validTrip);
    expect(parseSharedSummaryPayload(stored)).not.toBeNull();
  });

  it("returns null for malformed/legacy rows", () => {
    expect(parseSharedSummaryPayload(null)).toBeNull();
    expect(parseSharedSummaryPayload({ type: "trip" })).toBeNull();
  });
});

describe("generateShareCode", () => {
  it("produces a code of the requested length using the unambiguous alphabet", () => {
    const code = generateShareCode();
    expect(code).toHaveLength(8);
    // No ambiguous characters (0, O, 1, I, l).
    expect(code).not.toMatch(/[0O1Il]/);
  });

  it("is highly unlikely to collide across many calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateShareCode());
    expect(seen.size).toBe(1000);
  });
});

describe("shareExpiryFromNow", () => {
  it("returns a date SHARE_TTL_DAYS in the future", () => {
    const now = Date.UTC(2026, 0, 1);
    const expiry = shareExpiryFromNow(now);
    expect(expiry.getTime() - now).toBe(SHARE_TTL_DAYS * 24 * 60 * 60 * 1000);
  });
});
