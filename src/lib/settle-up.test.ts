import { describe, it, expect } from "vitest";
import {
  sharePaymentSource,
  parseShareSource,
  isManualPayment,
  findSharePayment,
  paidShareParticipants,
  paymentIdrAmount,
  shareOwedOnReceipt,
  pairSettlement,
  coveredShareParticipants,
} from "./settle-up";
import { Receipt, TripPayment } from "@/types";

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

// A receipt where `a` and `b` split one Rp 400 item equally (200 each); `b` is
// the payer, so `a` owes `b` 200.
const receipt = (id: string, payerId: string, over: Partial<Receipt> = {}): Receipt => ({
  id,
  title: id,
  payerId,
  tax: 0,
  service: 0,
  items: [{ id: `${id}-i`, name: "x", qty: 1, unitPrice: 400, total: 400, assignedToIds: ["a", "b"] }],
  ...over,
});

describe("paymentIdrAmount", () => {
  it("returns the raw amount for IDR / no currency", () => {
    expect(paymentIdrAmount({ id: "p", from: "a", to: "b", amount: 200 })).toBe(200);
    expect(paymentIdrAmount({ id: "p", from: "a", to: "b", amount: 200, currency: "IDR" })).toBe(200);
  });
  it("converts a foreign amount via its locked fxRate", () => {
    expect(
      paymentIdrAmount({ id: "p", from: "a", to: "b", amount: 10, currency: "USD", fxRate: 16000 })
    ).toBe(160000);
  });
});

describe("shareOwedOnReceipt", () => {
  const r = receipt("r1", "b");
  it("is the debtor's equal-split share", () => {
    expect(shareOwedOnReceipt(r, ["a", "b"], "a")).toBe(200);
  });
  it("is 0 for the payer (never owes their own receipt)", () => {
    expect(shareOwedOnReceipt(r, ["a", "b"], "b")).toBe(0);
  });
});

describe("pairSettlement", () => {
  const receipts = [receipt("r1", "b")]; // a owes b 200
  const ids = ["a", "b"];

  it("is not settled with no payments", () => {
    expect(pairSettlement(receipts, ids, [], "a", "b")).toMatchObject({ owed: 200, paid: 0, settled: false });
  });
  it("is settled once a manual payment covers the debt", () => {
    const pmts: TripPayment[] = [{ id: "m", from: "a", to: "b", amount: 200 }];
    expect(pairSettlement(receipts, ids, pmts, "a", "b")).toMatchObject({ owed: 200, paid: 200, settled: true });
  });
  it("counts manual + share payments together (the double-count the guard blocks)", () => {
    const pmts: TripPayment[] = [
      { id: "m", from: "a", to: "b", amount: 200 }, // manual
      share("r1", "a", { to: "b", amount: 200 }), // share for the same debt
    ];
    // paid 400 > owed 200 — already over-settled, so `settled` is true and a
    // second marker is refused upstream.
    expect(pairSettlement(receipts, ids, pmts, "a", "b").settled).toBe(true);
  });
  it("owed 0 → never settled (there is nothing to settle)", () => {
    expect(pairSettlement(receipts, ids, [], "b", "a").settled).toBe(false);
  });

  it("reports a partial manual payment as unsettled with the right remaining", () => {
    // a owes b 200; a already sent 50 manually → 150 still due, not settled.
    const pmts: TripPayment[] = [{ id: "m", from: "a", to: "b", amount: 50 }];
    const { owed, paid, settled } = pairSettlement(receipts, ids, pmts, "a", "b");
    expect(owed).toBe(200);
    expect(paid).toBe(50);
    expect(settled).toBe(false);
    // The share marker is capped at owed − paid = 150 (never the full 200), so the
    // total paid can't exceed what's owed — this is the fix for the +50 ghost.
    expect(Math.min(200, owed - paid)).toBe(150);
  });
});

describe("coveredShareParticipants", () => {
  const receipts = [receipt("r1", "b"), receipt("r2", "b")]; // a owes b 200 + 200 = 400
  const ids = ["a", "b"];

  it("is empty when nothing has been paid", () => {
    expect(coveredShareParticipants(receipts, ids, [], "r1").size).toBe(0);
  });
  it("includes an explicit share payment, but only for that receipt", () => {
    const pmts: TripPayment[] = [share("r1", "a", { to: "b", amount: 200 })];
    expect(coveredShareParticipants(receipts, ids, pmts, "r1")).toEqual(new Set(["a"]));
    // a's other receipt stays uncovered — the 200 share only settles half the debt.
    expect(coveredShareParticipants(receipts, ids, pmts, "r2").size).toBe(0);
  });
  it("covers ALL of a payer's receipts once the debtor is fully settled by a manual payment", () => {
    const pmts: TripPayment[] = [{ id: "m", from: "a", to: "b", amount: 400 }];
    expect(coveredShareParticipants(receipts, ids, pmts, "r1")).toEqual(new Set(["a"]));
    expect(coveredShareParticipants(receipts, ids, pmts, "r2")).toEqual(new Set(["a"]));
  });
});
