// Travel Spend — QA acceptance suite.
//
// Scenario-driven, end-to-end tests of the money engine that powers Travel
// Spend: per-receipt balances, the settle-up ledger (manual + share markers),
// multi-currency conversion, discounts, rounding, validation, and adversarial
// / out-of-the-box inputs. Positive AND negative cases.
//
// Golden invariant asserted throughout: money is conserved — the sum of all net
// balances is always ~0, and the suggested settlements must drive every balance
// to 0. If either breaks, real money would appear or vanish.

import { describe, it, expect } from "vitest";
import {
  computeTripTotals,
  minimizeTransactions,
  applyPaymentsToBalances,
  receiptInBaseCurrency,
} from "@/lib/receipt/calculations";
import {
  pairSettlement,
  coveredShareParticipants,
  paidShareParticipants,
  sharePaymentSource,
  shareOwedOnReceipt,
} from "@/lib/travel/settle-up";
import { validateTripPaymentInput, validateTravelTripInput } from "@/lib/travel/travel-cloud";
import { ValidationError } from "@/lib/validation";
import type { Participant, Receipt, ReceiptItem, TripPayment } from "@/types";

// ── Fixtures ────────────────────────────────────────────────────────────────
const P = (id: string): Participant => ({ id, name: id.toUpperCase() });

const item = (id: string, total: number, assignedToIds: string[]): ReceiptItem => ({
  id,
  name: id,
  qty: 1,
  unitPrice: total,
  total,
  assignedToIds,
});

const receipt = (
  id: string,
  payerId: string,
  items: ReceiptItem[],
  over: Partial<Receipt> = {}
): Receipt => ({ id, title: id, payerId, items, tax: 0, service: 0, ...over });

// ── Invariant helpers ─────────────────────────────────────────────────────
const sumOf = (m: Map<string, number>) =>
  Math.round([...m.values()].reduce((a, b) => a + b, 0) * 100) / 100;

/** True when applying the settlements drives every net balance to ~0. */
function settlesFully(
  balances: Map<string, number>,
  transfers: { from: string; to: string; amount: number }[]
): boolean {
  const m = new Map(balances);
  for (const s of transfers) {
    m.set(s.from, (m.get(s.from) ?? 0) + s.amount);
    m.set(s.to, (m.get(s.to) ?? 0) - s.amount);
  }
  return [...m.values()].every((v) => Math.abs(v) < 0.01);
}

/** Replicates the UI's capped "mark share paid" (togglePaidShare / Option 1). */
function markShareCapped(
  payments: TripPayment[],
  receipts: Receipt[],
  ids: string[],
  receiptId: string,
  participantId: string
): TripPayment[] {
  const r = receipts.find((x) => x.id === receiptId)!;
  const { owed, paid } = pairSettlement(receipts, ids, payments, participantId, r.payerId);
  const remaining = Math.round((owed - paid) * 100) / 100;
  if (remaining <= 0) return payments; // already settled — no duplicate
  const share = shareOwedOnReceipt(receiptInBaseCurrency(r), ids, participantId);
  const amount = Math.round(Math.min(share, remaining) * 100) / 100;
  if (amount <= 0) return payments;
  return [
    ...payments,
    { id: `${receiptId}-${participantId}`, from: participantId, to: r.payerId, amount, source: sharePaymentSource(receiptId, participantId) },
  ];
}

// ══════════════════════════════════════════════════════════════════════════
describe("Travel Spend QA — core balances (positive)", () => {
  const ids = ["a", "b", "c"];

  it("single receipt, equal 3-way split → payer is owed, others owe", () => {
    const r = receipt("r1", "a", [item("i1", 300, ids)]);
    const { aggregateBalances, settlements, totalGrandTotal } = computeTripTotals([r], ids);

    expect(aggregateBalances.get("a")).toBe(200);
    expect(aggregateBalances.get("b")).toBe(-100);
    expect(aggregateBalances.get("c")).toBe(-100);
    expect(sumOf(aggregateBalances)).toBe(0); // money conserved
    expect(totalGrandTotal).toBe(300);
    expect(settlements).toHaveLength(2);
    expect(settlements.every((s) => s.to === "a")).toBe(true);
    expect(settlesFully(aggregateBalances, settlements)).toBe(true);
  });

  it("two receipts, different payers → balances net across the trip", () => {
    const r1 = receipt("r1", "a", [item("i1", 300, ids)]);
    const r2 = receipt("r2", "b", [item("i2", 300, ids)]);
    const { aggregateBalances, settlements } = computeTripTotals([r1, r2], ids);

    expect(aggregateBalances.get("a")).toBe(100);
    expect(aggregateBalances.get("b")).toBe(100);
    expect(aggregateBalances.get("c")).toBe(-200);
    expect(sumOf(aggregateBalances)).toBe(0);
    expect(settlesFully(aggregateBalances, settlements)).toBe(true);
  });

  it("everyone's shares marked paid → all settled, no transfers left", () => {
    const r = receipt("r1", "a", [item("i1", 300, ids)]);
    const payments: TripPayment[] = [
      { id: "1", from: "b", to: "a", amount: 100, source: sharePaymentSource("r1", "b") },
      { id: "2", from: "c", to: "a", amount: 100, source: sharePaymentSource("r1", "c") },
    ];
    const { aggregateBalances, settlements } = computeTripTotals([r], ids, payments);
    expect([...aggregateBalances.values()].every((v) => Math.abs(v) < 0.01)).toBe(true);
    expect(settlements).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("Travel Spend QA — the partial-payment double-count regression", () => {
  // Mirrors the reported bug: A pays for 2 receipts; B & C owe. B sends a partial
  // manual advance BEFORE marking shares. Full-share markers used to over-settle
  // by exactly the advance ("+Rp 50k / -Rp 50k" ghost).
  const ids = ["a", "b", "c"];
  const r1 = receipt("r1", "a", [item("i1", 300, ids)]); // each owes a 100
  const r2 = receipt("r2", "a", [item("i2", 60, ids)]); //  each owes a 20
  const receipts = [r1, r2];

  it("NEGATIVE (documents the bug): naive full-share markers + manual advance over-settle", () => {
    const naive: TripPayment[] = [
      { id: "m", from: "b", to: "a", amount: 50 }, // manual advance
      { id: "1", from: "b", to: "a", amount: 100, source: sharePaymentSource("r1", "b") },
      { id: "2", from: "b", to: "a", amount: 20, source: sharePaymentSource("r2", "b") },
      { id: "3", from: "c", to: "a", amount: 100, source: sharePaymentSource("r1", "c") },
      { id: "4", from: "c", to: "a", amount: 20, source: sharePaymentSource("r2", "c") },
    ];
    const { aggregateBalances } = computeTripTotals(receipts, ids, naive);
    // B overpaid by the 50 advance → ghost balances (this is what was fixed).
    expect(aggregateBalances.get("b")).toBe(50);
    expect(aggregateBalances.get("a")).toBe(-50);
  });

  it("POSITIVE (the fix): capped markers + manual advance settle everyone to 0", () => {
    let payments: TripPayment[] = [{ id: "m", from: "b", to: "a", amount: 50 }];
    // B marks both receipts, then C marks both — via the capped rule.
    payments = markShareCapped(payments, receipts, ids, "r1", "b");
    payments = markShareCapped(payments, receipts, ids, "r2", "b");
    payments = markShareCapped(payments, receipts, ids, "r1", "c");
    payments = markShareCapped(payments, receipts, ids, "r2", "c");

    const { aggregateBalances, settlements } = computeTripTotals(receipts, ids, payments);
    expect([...aggregateBalances.values()].every((v) => Math.abs(v) < 0.01)).toBe(true);
    expect(settlements).toHaveLength(0);
    // Total B→A (manual 50 + capped shares) equals exactly the 120 owed — never
    // more. The r2 marker was skipped once B hit the cap.
    const bToA = payments.filter((p) => p.from === "b" && p.to === "a").reduce((s, p) => s + p.amount, 0);
    expect(bToA).toBe(120); // 50 manual + 70 capped share = owed, no overshoot
    const bShares = payments.filter((p) => p.from === "b" && p.source).reduce((s, p) => s + p.amount, 0);
    expect(bShares).toBe(70); // 120 owed − 50 already paid manually
  });

  it("marking a fully-settled person again is refused (remaining ≤ 0)", () => {
    const settled: TripPayment[] = [{ id: "m", from: "b", to: "a", amount: 120 }];
    const after = markShareCapped(settled, receipts, ids, "r1", "b");
    expect(after).toHaveLength(1); // nothing added
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("Travel Spend QA — coverage reconciliation & genuine overpayment", () => {
  const ids = ["a", "b", "c"];
  const r1 = receipt("r1", "a", [item("i1", 300, ids)]);
  const r2 = receipt("r2", "a", [item("i2", 60, ids)]);
  const receipts = [r1, r2];

  it("a manual payment that fully settles a person covers ALL their shares", () => {
    const payments: TripPayment[] = [{ id: "m", from: "b", to: "a", amount: 120 }];
    expect(pairSettlement(receipts, ids, payments, "b", "a").settled).toBe(true);
    expect(coveredShareParticipants(receipts, ids, payments, "r1")).toEqual(new Set(["b"]));
    expect(coveredShareParticipants(receipts, ids, payments, "r2")).toEqual(new Set(["b"]));
    // C untouched.
    expect(coveredShareParticipants(receipts, ids, payments, "r1").has("c")).toBe(false);
  });

  it("an explicit share payment only covers its own receipt", () => {
    const payments: TripPayment[] = [
      { id: "1", from: "b", to: "a", amount: 100, source: sharePaymentSource("r1", "b") },
    ];
    expect(coveredShareParticipants(receipts, ids, payments, "r1")).toEqual(new Set(["b"]));
    expect(coveredShareParticipants(receipts, ids, payments, "r2").has("b")).toBe(false);
    expect(paidShareParticipants(payments, "r1")).toEqual(new Set(["b"]));
  });

  it("genuine manual cash overpayment DOES flip to a reverse debt (real money)", () => {
    const r = receipt("r1", "b", [item("i1", 200, ["a", "b"])]); // a owes b 100
    const payments: TripPayment[] = [{ id: "m", from: "a", to: "b", amount: 150 }];
    const { aggregateBalances, settlements } = computeTripTotals(r ? [r] : [], ["a", "b"], payments);
    expect(aggregateBalances.get("a")).toBe(50); // a is now owed 50 back
    expect(aggregateBalances.get("b")).toBe(-50);
    expect(settlesFully(aggregateBalances, settlements)).toBe(true);
  });

  it("known Option-1 limit: marking everything THEN adding manual shows overpayment", () => {
    // Order the fix does NOT cover (documented): full markers first, manual after.
    const payments: TripPayment[] = [
      { id: "1", from: "b", to: "a", amount: 100, source: sharePaymentSource("r1", "b") },
      { id: "2", from: "b", to: "a", amount: 20, source: sharePaymentSource("r2", "b") },
      { id: "m", from: "b", to: "a", amount: 50 }, // added AFTER full settlement
    ];
    const { aggregateBalances } = computeTripTotals(receipts, ids, payments);
    expect(aggregateBalances.get("b")).toBe(50); // treated as a real overpayment
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("Travel Spend QA — multi-currency (out-of-the-box)", () => {
  it("a foreign receipt is converted to IDR via its locked fxRate", () => {
    const r = receipt("r1", "a", [item("i1", 10000, ["a", "b"])], { currency: "VND", fxRate: 0.6 });
    const { aggregateBalances, totalGrandTotal } = computeTripTotals([r], ["a", "b"]);
    expect(totalGrandTotal).toBe(6000); // 10000 × 0.6
    expect(aggregateBalances.get("a")).toBe(3000);
    expect(aggregateBalances.get("b")).toBe(-3000);
  });

  it("mixed IDR + foreign receipts aggregate in IDR without mixing units", () => {
    const ids = ["a", "b", "c"];
    const r1 = receipt("r1", "a", [item("i1", 300, ids)]); // IDR
    const r2 = receipt("r2", "b", [item("i2", 30000, ids)], { currency: "VND", fxRate: 0.1 }); // → 3000 IDR
    const { aggregateBalances, settlements, totalGrandTotal } = computeTripTotals([r1, r2], ids);
    expect(totalGrandTotal).toBe(3300);
    expect(sumOf(aggregateBalances)).toBe(0);
    expect(settlesFully(aggregateBalances, settlements)).toBe(true);
  });

  it("a foreign settle-up payment is converted before it reduces balances", () => {
    const r = receipt("r1", "b", [item("i1", 200, ["a", "b"])]); // a owes b 100
    const payments: TripPayment[] = [{ id: "m", from: "a", to: "b", amount: 0.005, currency: "USD", fxRate: 16000 }]; // = 80 IDR
    const { aggregateBalances } = computeTripTotals([r], ["a", "b"], payments);
    expect(aggregateBalances.get("a")).toBe(-20);
    expect(aggregateBalances.get("b")).toBe(20);
  });

  it("a foreign receipt missing its fxRate is left at 1:1 (defensive, no crash)", () => {
    const r = receipt("r1", "a", [item("i1", 500, ["a", "b"])], { currency: "VND" }); // no fxRate
    const converted = receiptInBaseCurrency(r);
    expect(converted.items[0].total).toBe(500); // unchanged — treated as rate 1
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("Travel Spend QA — discounts & rounding (edge)", () => {
  it("a participant voucher reduces only that person's share; ledger still balances", () => {
    const ids = ["a", "b", "c"];
    const r = receipt("r1", "a", [item("i1", 300, ids)], {
      discounts: [{ id: "d1", scope: "participant", type: "amount", value: 30, targetId: "b" }],
    });
    const { aggregateBalances, totalDiscount } = computeTripTotals([r], ids);
    expect(totalDiscount).toBe(30);
    expect(aggregateBalances.get("b")).toBe(-70); // 100 − 30
    expect(aggregateBalances.get("a")).toBe(170); // fronted 270, owes own 100
    expect(aggregateBalances.get("c")).toBe(-100);
    expect(sumOf(aggregateBalances)).toBe(0);
  });

  it("an indivisible 3-way split still conserves money (sum of balances ~0)", () => {
    const ids = ["a", "b", "c"];
    const r = receipt("r1", "a", [item("i1", 100, ids)]); // 100 / 3
    const { aggregateBalances, settlements } = computeTripTotals([r], ids);
    expect(Math.abs(sumOf(aggregateBalances))).toBeLessThan(0.02);
    expect(settlesFully(aggregateBalances, settlements)).toBe(true);
  });

  it("very large amounts do not overflow or lose conservation", () => {
    const ids = ["a", "b"];
    const r = receipt("r1", "a", [item("i1", 1_000_000_000, ids)]);
    const { aggregateBalances } = computeTripTotals([r], ids);
    expect(aggregateBalances.get("a")).toBe(500_000_000);
    expect(aggregateBalances.get("b")).toBe(-500_000_000);
    expect(sumOf(aggregateBalances)).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("Travel Spend QA — adversarial / boundary inputs", () => {
  it("empty trip (no receipts) → zeros, no settlements, no crash", () => {
    const { aggregateBalances, settlements, totalGrandTotal } = computeTripTotals([], ["a", "b"], []);
    expect(totalGrandTotal).toBe(0);
    expect(settlements).toHaveLength(0);
    expect([...aggregateBalances.values()].every((v) => v === 0)).toBe(true);
  });

  it("single-participant trip settles trivially at 0", () => {
    const r = receipt("r1", "a", [item("i1", 100, ["a"])]);
    const { aggregateBalances, settlements } = computeTripTotals([r], ["a"]);
    expect(aggregateBalances.get("a")).toBe(0);
    expect(settlements).toHaveLength(0);
  });

  it("a payment from a non-participant is ignored by the balance engine", () => {
    const base = new Map<string, number>([["a", -100], ["b", 100]]);
    const out = applyPaymentsToBalances(base, [{ id: "x", from: "z", to: "b", amount: 100 }]);
    expect(out.get("a")).toBe(-100);
    expect(out.get("b")).toBe(100); // unchanged: "z" isn't tracked
  });

  it("a self-payment (from === to) is a no-op", () => {
    const base = new Map<string, number>([["a", -100], ["b", 100]]);
    const out = applyPaymentsToBalances(base, [{ id: "x", from: "a", to: "a", amount: 100 }]);
    expect(out.get("a")).toBe(-100);
  });

  it("minimizeTransactions returns nothing when all balances are ~0", () => {
    expect(minimizeTransactions(new Map([["a", 0], ["b", 0.004], ["c", -0.004]]))).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("Travel Spend QA — settle-up payment validation (negative)", () => {
  const ids = new Set(["a", "b"]);

  it("rejects from === to", () => {
    expect(() => validateTripPaymentInput({ from: "a", to: "a", amount: 10 }, ids)).toThrow(ValidationError);
  });
  it("rejects an unknown participant", () => {
    expect(() => validateTripPaymentInput({ from: "z", to: "b", amount: 10 }, ids)).toThrow(ValidationError);
  });
  it("rejects a zero or negative amount", () => {
    expect(() => validateTripPaymentInput({ from: "a", to: "b", amount: 0 }, ids)).toThrow(ValidationError);
    expect(() => validateTripPaymentInput({ from: "a", to: "b", amount: -5 }, ids)).toThrow(ValidationError);
  });
  it("rejects an amount past the abuse ceiling", () => {
    expect(() => validateTripPaymentInput({ from: "a", to: "b", amount: 2_000_000_000 }, ids)).toThrow(ValidationError);
  });
  it("accepts a valid payment and normalizes optional fields", () => {
    const out = validateTripPaymentInput({ from: "a", to: "b", amount: 100, note: " dinner " }, ids);
    expect(out).toMatchObject({ from: "a", to: "b", amount: 100, note: "dinner" });
  });
  it("accepts a foreign payment with a positive fxRate", () => {
    const out = validateTripPaymentInput({ from: "a", to: "b", amount: 10, currency: "usd", fxRate: 16000 }, ids);
    expect(out).toMatchObject({ currency: "USD", fxRate: 16000 });
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("Travel Spend QA — trip input validation (negative + positive)", () => {
  it("rejects a non-object body", () => {
    expect(() => validateTravelTripInput(null)).toThrow(ValidationError);
    expect(() => validateTravelTripInput("nope")).toThrow(ValidationError);
  });

  it("defaults a blank name to 'My Trip'", () => {
    const out = validateTravelTripInput({ name: "   ", participants: [], receipts: [] });
    expect(out.name).toBe("My Trip");
  });

  it("rejects a receipt whose payer is not a participant", () => {
    const body = {
      name: "Trip",
      participants: [{ id: "a", name: "A" }],
      receipts: [{ id: "r1", title: "x", payerId: "ghost", tax: 0, service: 0, items: [] }],
    };
    expect(() => validateTravelTripInput(body)).toThrow(ValidationError);
  });

  it("accepts a well-formed trip and preserves the receipt date", () => {
    const body = {
      name: "Bali",
      participants: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
      receipts: [
        {
          id: "r1",
          title: "Lunch",
          date: "2026-07-28",
          payerId: "a",
          tax: 0,
          service: 0,
          items: [{ id: "i1", name: "Nasi", qty: 1, unitPrice: 100, total: 100, assignedToIds: ["a", "b"] }],
        },
      ],
    };
    const out = validateTravelTripInput(body);
    expect(out.name).toBe("Bali");
    expect(out.receipts).toHaveLength(1);
    expect(out.receipts[0].date).toBe("2026-07-28T00:00:00.000Z");
  });
});
