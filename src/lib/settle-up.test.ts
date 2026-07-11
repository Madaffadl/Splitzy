import { describe, it, expect } from "vitest";
import {
  sharePaymentSource,
  parseShareSource,
  isManualPayment,
  findSharePayment,
  paidShareParticipants,
} from "./settle-up";
import { TripPayment } from "@/types";

const share = (receiptId: string, participantId: string, over: Partial<TripPayment> = {}): TripPayment => ({
  id: `${receiptId}-${participantId}`,
  from: participantId,
  to: "payer",
  amount: 50,
  source: sharePaymentSource(receiptId, participantId),
  ...over,
});

describe("sharePaymentSource / parseShareSource", () => {
  it("round-trips a receipt/participant pair", () => {
    const src = sharePaymentSource("r1", "b");
    expect(src).toBe("share:r1:b");
    expect(parseShareSource(src)).toEqual({ receiptId: "r1", participantId: "b" });
  });

  it("returns null for manual / unrecognised sources", () => {
    expect(parseShareSource(undefined)).toBeNull();
    expect(parseShareSource(null)).toBeNull();
    expect(parseShareSource("")).toBeNull();
    expect(parseShareSource("settlement")).toBeNull();
    expect(parseShareSource("share:r1")).toBeNull(); // missing participant
    expect(parseShareSource("share:r1:")).toBeNull(); // empty participant
  });

  it("handles participant ids that themselves contain colons", () => {
    const src = sharePaymentSource("r1", "a:b");
    expect(parseShareSource(src)).toEqual({ receiptId: "r1", participantId: "a:b" });
  });
});

describe("isManualPayment", () => {
  it("true for a payment without a share source", () => {
    expect(isManualPayment({ id: "p", from: "a", to: "b", amount: 10 })).toBe(true);
    expect(isManualPayment({ id: "p", from: "a", to: "b", amount: 10, source: "settlement" })).toBe(true);
  });
  it("false for a receipt-share payment", () => {
    expect(isManualPayment(share("r1", "b"))).toBe(false);
  });
});

describe("findSharePayment", () => {
  const payments = [share("r1", "b"), share("r2", "c"), { id: "m", from: "x", to: "y", amount: 5 }];
  it("finds the matching share payment", () => {
    expect(findSharePayment(payments, "r1", "b")?.id).toBe("r1-b");
  });
  it("returns undefined when absent", () => {
    expect(findSharePayment(payments, "r1", "z")).toBeUndefined();
    expect(findSharePayment(undefined, "r1", "b")).toBeUndefined();
  });
});

describe("paidShareParticipants", () => {
  const payments = [
    share("r1", "b"),
    share("r1", "c"),
    share("r2", "b"),
    { id: "m", from: "d", to: "a", amount: 5 }, // manual — ignored
  ];
  it("collects participant ids paid for a given receipt", () => {
    expect(paidShareParticipants(payments, "r1")).toEqual(new Set(["b", "c"]));
    expect(paidShareParticipants(payments, "r2")).toEqual(new Set(["b"]));
  });
  it("is empty for a receipt with no share payments", () => {
    expect(paidShareParticipants(payments, "r9").size).toBe(0);
    expect(paidShareParticipants(undefined, "r1").size).toBe(0);
  });
});
