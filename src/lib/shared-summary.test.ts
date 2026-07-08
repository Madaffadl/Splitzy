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

  it("carries participant paymentInfo through the snapshot", () => {
    const out = validateSharedSummaryInput({
      ...validTrip,
      participants: [
        {
          id: "p1",
          name: "Alex",
          paymentInfo: { bank: "BCA", accountNumber: "1234567890", accountName: "Alex P" },
        },
        { id: "p2", name: "Bella" },
      ],
    });
    expect(out.participants[0].paymentInfo).toEqual({
      bank: "BCA",
      accountNumber: "1234567890",
      accountName: "Alex P",
    });
    // Absent on those who didn't set it.
    expect(out.participants[1].paymentInfo).toBeUndefined();
  });

  it("drops an all-empty paymentInfo object", () => {
    const out = validateSharedSummaryInput({
      ...validTrip,
      participants: [
        { id: "p1", name: "Alex", paymentInfo: { bank: "  ", accountNumber: "" } },
        { id: "p2", name: "Bella" },
      ],
    });
    expect(out.participants[0].paymentInfo).toBeUndefined();
  });

  it("carries valid discounts through the snapshot", () => {
    const out = validateSharedSummaryInput({
      ...validTrip,
      receipts: [
        {
          ...validTrip.receipts[0],
          discounts: [
            { id: "x1", scope: "participant", type: "amount", value: 50000, targetId: "p1", label: "Voucher" },
            { id: "x2", scope: "item", type: "percent", value: 20, targetId: "i1" },
            { id: "x3", scope: "receipt", type: "amount", value: 10000 },
          ],
        },
      ],
    });
    expect(out.receipts[0].discounts).toHaveLength(3);
    expect(out.receipts[0].discounts![0]).toMatchObject({ scope: "participant", targetId: "p1" });
  });

  it("rejects a discount targeting an unknown item/participant", () => {
    expect(() =>
      validateSharedSummaryInput({
        ...validTrip,
        receipts: [
          {
            ...validTrip.receipts[0],
            discounts: [{ id: "x", scope: "participant", type: "amount", value: 1000, targetId: "ghost" }],
          },
        ],
      })
    ).toThrow(/unknown participant/i);
  });

  it("rejects a percent discount above 100", () => {
    expect(() =>
      validateSharedSummaryInput({
        ...validTrip,
        receipts: [
          {
            ...validTrip.receipts[0],
            discounts: [{ id: "x", scope: "receipt", type: "percent", value: 150 }],
          },
        ],
      })
    ).toThrow(/percent/i);
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
