import { describe, it, expect } from "vitest";
import {
  validateTravelTripInput,
  validateBudget,
  validateTripReceiptPayload,
  validateTripPaymentInput,
} from "./travel-cloud";

const participants = [
  { id: "p1", name: "Alex" },
  { id: "p2", name: "Bella" },
];
const receipt = {
  id: "r1",
  title: "Dinner",
  payerId: "p1",
  tax: 0,
  service: 0,
  items: [{ id: "i1", name: "Pizza", qty: 1, unitPrice: 100, total: 100, assignedToIds: ["p1", "p2"] }],
};

describe("validateTravelTripInput", () => {
  it("accepts a full trip and normalizes it", () => {
    const out = validateTravelTripInput({ name: "Bali", budget: 5_000_000, participants, receipts: [receipt] });
    expect(out.name).toBe("Bali");
    expect(out.budget).toBe(5_000_000);
    expect(out.participants).toHaveLength(2);
    expect(out.receipts).toHaveLength(1);
  });

  it("allows an empty trip (no participants/receipts yet) and defaults the name", () => {
    const out = validateTravelTripInput({});
    expect(out.name).toBe("My Trip");
    expect(out.participants).toEqual([]);
    expect(out.receipts).toEqual([]);
    expect(out.budget).toBeUndefined();
  });

  it("drops a non-positive budget", () => {
    expect(validateTravelTripInput({ name: "X", budget: 0 }).budget).toBeUndefined();
  });

  it("rejects a receipt payer not among participants", () => {
    expect(() =>
      validateTravelTripInput({ name: "X", participants, receipts: [{ ...receipt, payerId: "ghost" }] })
    ).toThrow(/participant/i);
  });

  it("rejects an item assigned to an unknown participant", () => {
    expect(() =>
      validateTravelTripInput({
        name: "X",
        participants,
        receipts: [{ ...receipt, items: [{ ...receipt.items[0], assignedToIds: ["ghost"] }] }],
      })
    ).toThrow(/unknown participant/i);
  });

  it("preserves a positive individual participant budget", () => {
    const out = validateTravelTripInput({
      name: "X",
      participants: [{ id: "p1", name: "Alex", budget: 500000 }, { id: "p2", name: "Bella" }],
    });
    expect(out.participants[0].budget).toBe(500000);
    // Not set / non-positive budgets are dropped, not stored as 0.
    expect(out.participants[1].budget).toBeUndefined();
  });

  it("drops a non-positive individual participant budget", () => {
    const out = validateTravelTripInput({
      name: "X",
      participants: [{ id: "p1", name: "Alex", budget: 0 }, { id: "p2", name: "Bella", budget: -100 }],
    });
    expect(out.participants[0].budget).toBeUndefined();
    expect(out.participants[1].budget).toBeUndefined();
  });
});

describe("validateBudget", () => {
  it("returns undefined for empty/invalid/non-positive", () => {
    expect(validateBudget(null)).toBeUndefined();
    expect(validateBudget("")).toBeUndefined();
    expect(validateBudget(0)).toBeUndefined();
    expect(validateBudget(-5)).toBeUndefined();
  });
  it("accepts a positive number", () => {
    expect(validateBudget(250000)).toBe(250000);
  });
  it("rejects absurdly large values", () => {
    expect(() => validateBudget(2_000_000_000_000)).toThrow(/maximum/i);
  });
});

describe("validateTripReceiptPayload", () => {
  it("validates a single receipt against the participant set", () => {
    const out = validateTripReceiptPayload(receipt, new Set(["p1", "p2"]));
    expect(out.title).toBe("Dinner");
  });
  it("rejects when payer isn't a participant", () => {
    expect(() => validateTripReceiptPayload({ ...receipt, payerId: "ghost" }, new Set(["p1", "p2"]))).toThrow();
  });
  it("preserves item qty-per-person assignments through a round-trip", () => {
    const withAssign = {
      ...receipt,
      items: [{ ...receipt.items[0], assignments: [{ participantId: "p1", qty: 2 }, { participantId: "p2", qty: 1 }] }],
    };
    const out = validateTripReceiptPayload(withAssign, new Set(["p1", "p2"]));
    expect(out.items[0].assignments).toEqual([{ participantId: "p1", qty: 2 }, { participantId: "p2", qty: 1 }]);
  });
  it("drops assignments referencing unknown participants or non-positive qty", () => {
    const bad = {
      ...receipt,
      items: [{ ...receipt.items[0], assignments: [{ participantId: "ghost", qty: 2 }, { participantId: "p2", qty: 0 }] }],
    };
    const out = validateTripReceiptPayload(bad, new Set(["p1", "p2"]));
    expect(out.items[0].assignments).toBeUndefined();
  });
});

describe("validateTripPaymentInput", () => {
  const ids = new Set(["p1", "p2"]);

  it("accepts a valid payment", () => {
    const out = validateTripPaymentInput({ from: "p2", to: "p1", amount: 150000, note: " lunas " }, ids);
    expect(out).toEqual({ from: "p2", to: "p1", amount: 150000, note: "lunas" });
  });

  it("rejects unknown participants", () => {
    expect(() => validateTripPaymentInput({ from: "ghost", to: "p1", amount: 10 }, ids)).toThrow(/participant/i);
    expect(() => validateTripPaymentInput({ from: "p1", to: "ghost", amount: 10 }, ids)).toThrow(/participant/i);
  });

  it("rejects from === to", () => {
    expect(() => validateTripPaymentInput({ from: "p1", to: "p1", amount: 10 }, ids)).toThrow(/differ/i);
  });

  it("rejects non-positive or absurd amounts", () => {
    expect(() => validateTripPaymentInput({ from: "p1", to: "p2", amount: 0 }, ids)).toThrow(/positive/i);
    expect(() => validateTripPaymentInput({ from: "p1", to: "p2", amount: -5 }, ids)).toThrow(/positive/i);
    expect(() => validateTripPaymentInput({ from: "p1", to: "p2", amount: 2_000_000_000 }, ids)).toThrow(/maximum/i);
  });
});
