/**
 * Extended tests for calculations.ts — covering gaps in the existing
 * calculations.test.ts:
 *
 *  P0  allocateFees()           — zero direct tests
 *  P0  calculateItemShares()    — qty-based (assignments) path untested
 *  P1  buildSettlementTrace()   — zero tests
 *  P1  getPersonShareDetails()  — qty-based item breakdown untested
 *  P1  calculateDiscountCredits()  — edge cases (zero base, item discount on qty-item)
 *  P2  receiptInBaseCurrency()  — fees scaling with FX
 *  P2  minimizeTransactions()   — multi-pair exact match, circular debt
 *  P2  applyPaymentsToBalances() — fxRate=0, fxRate fallback
 */

import { describe, it, expect } from "vitest";
import {
    calculateItemShares,
    allocateFees,
    buildSettlementTrace,
    getPersonShareDetails,
    minimizeTransactions,
    receiptInBaseCurrency,
    calculatePersonTotals,
    getReceiptSummary,
    applyPaymentsToBalances,
} from "./calculations";
import { Receipt, ReceiptFee, ReceiptItem, TripPayment } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<ReceiptItem> & { id: string; total: number }): ReceiptItem {
    return {
        name: "Item",
        qty: 1,
        unitPrice: overrides.total,
        assignedToIds: [],
        ...overrides,
    };
}

function makeFee(
    label: string,
    amount: number,
    splitMethod: "equal" | "proportional"
): ReceiptFee {
    return { id: `fee-${label}`, label, amount, splitMethod };
}

function makeReceipt(overrides: Partial<Receipt>): Receipt {
    return {
        id: "r1",
        title: "Test",
        payerId: "a",
        items: [],
        tax: 0,
        service: 0,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// calculateItemShares — qty-based (assignments) path
// ---------------------------------------------------------------------------

describe("calculateItemShares — qty-based (assignments)", () => {
    it("distributes total proportionally by qty", () => {
        const item = makeItem({
            id: "1",
            qty: 3,
            total: 90,
            assignedToIds: [],
            assignments: [
                { participantId: "a", qty: 1 },
                { participantId: "b", qty: 2 },
            ],
        });
        const shares = calculateItemShares(item);
        expect(shares.get("a")).toBe(30); // 1/3 of 90
        expect(shares.get("b")).toBe(60); // 2/3 of 90
    });

    it("gives full total to single qty-based assignee", () => {
        const item = makeItem({
            id: "1",
            qty: 5,
            total: 100,
            assignedToIds: [],
            assignments: [{ participantId: "a", qty: 5 }],
        });
        const shares = calculateItemShares(item);
        expect(shares.get("a")).toBe(100);
        expect(shares.size).toBe(1);
    });

    it("fixes rounding remainder — shares sum exactly to item.total", () => {
        // 100 / 3 parts (1+1+1 qty) = 33.33 × 3 = 99.99 → remainder 0.01 on largest
        const item = makeItem({
            id: "1",
            qty: 3,
            total: 100,
            assignedToIds: [],
            assignments: [
                { participantId: "a", qty: 1 },
                { participantId: "b", qty: 1 },
                { participantId: "c", qty: 1 },
            ],
        });
        const shares = calculateItemShares(item);
        const sum = [...shares.values()].reduce((s, v) => s + v, 0);
        expect(Math.round(sum * 100) / 100).toBe(100);
    });

    it("pushes rounding remainder onto the person with the most qty", () => {
        // 100 split: a=1qty, b=2qty → b gets the remainder if any
        const item = makeItem({
            id: "1",
            qty: 3,
            total: 100,
            assignedToIds: [],
            assignments: [
                { participantId: "a", qty: 1 },
                { participantId: "b", qty: 2 },
            ],
        });
        const shares = calculateItemShares(item);
        const sumCheck = (shares.get("a") ?? 0) + (shares.get("b") ?? 0);
        expect(Math.round(sumCheck * 100) / 100).toBe(100);
    });

    it("ignores assignments with qty=0", () => {
        const item = makeItem({
            id: "1",
            qty: 2,
            total: 50,
            assignedToIds: [],
            assignments: [
                { participantId: "a", qty: 0 },
                { participantId: "b", qty: 2 },
            ],
        });
        const shares = calculateItemShares(item);
        expect(shares.has("a")).toBe(false);
        expect(shares.get("b")).toBe(50);
    });

    it("returns empty map when all assignments have qty=0", () => {
        const item = makeItem({
            id: "1",
            qty: 2,
            total: 50,
            assignedToIds: [],
            assignments: [
                { participantId: "a", qty: 0 },
                { participantId: "b", qty: 0 },
            ],
        });
        expect(calculateItemShares(item).size).toBe(0);
    });

    it("returns empty map when assignments array is empty", () => {
        const item = makeItem({
            id: "1",
            qty: 1,
            total: 50,
            assignedToIds: [],
            assignments: [],
        });
        // Empty assignments array falls through to equal-split path; no assignedToIds → empty
        expect(calculateItemShares(item).size).toBe(0);
    });

    it("unequal qty split — 4 units 3 people (2+1+1)", () => {
        const item = makeItem({
            id: "1",
            qty: 4,
            total: 80,
            assignedToIds: [],
            assignments: [
                { participantId: "a", qty: 2 },
                { participantId: "b", qty: 1 },
                { participantId: "c", qty: 1 },
            ],
        });
        const shares = calculateItemShares(item);
        expect(shares.get("a")).toBe(40);
        expect(shares.get("b")).toBe(20);
        expect(shares.get("c")).toBe(20);
    });
});

// ---------------------------------------------------------------------------
// allocateFees
// ---------------------------------------------------------------------------

describe("allocateFees", () => {
    const ids = ["a", "b"];
    const sub = new Map([["a", 60], ["b", 40]]);

    it("returns zero allocations when fees array is empty", () => {
        const alloc = allocateFees(sub, 100, [], ids);
        expect(alloc.get("a")).toBe(0);
        expect(alloc.get("b")).toBe(0);
    });

    it("splits an equal fee evenly between two participants", () => {
        const alloc = allocateFees(sub, 100, [makeFee("delivery", 20, "equal")], ids);
        expect(alloc.get("a")).toBe(10);
        expect(alloc.get("b")).toBe(10);
    });

    it("equal fee — fixes rounding remainder (10 / 3 participants)", () => {
        const three = ["a", "b", "c"];
        const sub3 = new Map([["a", 30], ["b", 30], ["c", 30]]);
        const alloc = allocateFees(sub3, 90, [makeFee("fee", 10, "equal")], three);
        const sum = [...alloc.values()].reduce((s, v) => s + v, 0);
        expect(Math.round(sum * 100) / 100).toBe(10);
    });

    it("splits a proportional fee by subtotal ratio", () => {
        // a has 60%, b has 40% of 100 subtotal
        const alloc = allocateFees(sub, 100, [makeFee("platform", 10, "proportional")], ids);
        expect(alloc.get("a")).toBe(6);
        expect(alloc.get("b")).toBe(4);
    });

    it("proportional fee — sum equals fee amount exactly", () => {
        const alloc = allocateFees(sub, 100, [makeFee("fee", 7, "proportional")], ids);
        const sum = (alloc.get("a") ?? 0) + (alloc.get("b") ?? 0);
        expect(Math.round(sum * 100) / 100).toBe(7);
    });

    it("proportional fee with zero subtotal falls back to equal split", () => {
        const zeroSub = new Map([["a", 0], ["b", 0]]);
        const alloc = allocateFees(zeroSub, 0, [makeFee("delivery", 20, "proportional")], ids);
        expect(alloc.get("a")).toBe(10);
        expect(alloc.get("b")).toBe(10);
    });

    it("skips a fee with amount = 0", () => {
        const alloc = allocateFees(sub, 100, [makeFee("zero", 0, "equal")], ids);
        expect(alloc.get("a")).toBe(0);
        expect(alloc.get("b")).toBe(0);
    });

    it("skips a fee with negative amount", () => {
        const alloc = allocateFees(sub, 100, [makeFee("neg", -5, "equal")], ids);
        expect(alloc.get("a")).toBe(0);
        expect(alloc.get("b")).toBe(0);
    });

    it("returns zero map when participantIds is empty", () => {
        const alloc = allocateFees(sub, 100, [makeFee("d", 20, "equal")], []);
        expect(alloc.size).toBe(0);
    });

    it("accumulates multiple fees correctly", () => {
        const fees = [
            makeFee("delivery", 10, "equal"),   // 5 each
            makeFee("platform", 10, "proportional"), // 6 for a, 4 for b
        ];
        const alloc = allocateFees(sub, 100, fees, ids);
        expect(alloc.get("a")).toBe(11); // 5 + 6
        expect(alloc.get("b")).toBe(9);  // 5 + 4
    });

    it("single participant gets the full equal fee", () => {
        const sub1 = new Map([["a", 100]]);
        const alloc = allocateFees(sub1, 100, [makeFee("d", 15, "equal")], ["a"]);
        expect(alloc.get("a")).toBe(15);
    });

    it("single participant gets full proportional fee", () => {
        const sub1 = new Map([["a", 100]]);
        const alloc = allocateFees(sub1, 100, [makeFee("p", 15, "proportional")], ["a"]);
        expect(alloc.get("a")).toBe(15);
    });

    it("equal fee — large indivisible amount across 3 people rounds correctly", () => {
        const three = ["a", "b", "c"];
        const sub3 = new Map([["a", 10], ["b", 10], ["c", 10]]);
        const alloc = allocateFees(sub3, 30, [makeFee("surcharge", 100, "equal")], three);
        const sum = [...alloc.values()].reduce((s, v) => s + v, 0);
        expect(Math.round(sum * 100) / 100).toBe(100);
    });
});

// ---------------------------------------------------------------------------
// allocateFees integration — via calculatePersonTotals
// ---------------------------------------------------------------------------

describe("allocateFees — integration via calculatePersonTotals", () => {
    it("fees appear in PersonShare.feesAllocation and total", () => {
        const receipt = makeReceipt({
            items: [makeItem({ id: "1", total: 100, assignedToIds: ["a", "b"] })],
            fees: [makeFee("delivery", 20, "equal")],
        });
        const shares = calculatePersonTotals(receipt, ["a", "b"]);
        const a = shares.find((s) => s.participantId === "a")!;
        const b = shares.find((s) => s.participantId === "b")!;

        expect(a.feesAllocation).toBe(10);
        expect(b.feesAllocation).toBe(10);
        expect(a.total).toBe(60); // 50 subtotal + 10 fee
        expect(b.total).toBe(60);
    });

    it("getReceiptSummary grandTotal includes fees", () => {
        const receipt = makeReceipt({
            items: [makeItem({ id: "1", total: 100, assignedToIds: ["a", "b"] })],
            fees: [makeFee("delivery", 20, "equal")],
        });
        const summary = getReceiptSummary(receipt, ["a", "b"]);
        expect(summary.grandTotal).toBe(120);
    });

    it("proportional fee respects who ordered more", () => {
        const receipt = makeReceipt({
            items: [
                makeItem({ id: "1", total: 60, assignedToIds: ["a"] }),
                makeItem({ id: "2", total: 40, assignedToIds: ["b"] }),
            ],
            fees: [makeFee("platform", 10, "proportional")],
        });
        const shares = calculatePersonTotals(receipt, ["a", "b"]);
        const a = shares.find((s) => s.participantId === "a")!;
        const b = shares.find((s) => s.participantId === "b")!;
        expect(a.feesAllocation).toBe(6);
        expect(b.feesAllocation).toBe(4);
    });
});

// ---------------------------------------------------------------------------
// buildSettlementTrace
// ---------------------------------------------------------------------------

describe("buildSettlementTrace", () => {
    it("returns empty trace for empty transfers", () => {
        const balances = new Map([["a", 100], ["b", -100]]);
        expect(buildSettlementTrace(balances, [])).toHaveLength(0);
    });

    it("produces one trace entry per transfer", () => {
        const balances = new Map([["a", 100], ["b", -100]]);
        const transfers = [{ from: "b", to: "a", amount: 100 }];
        const trace = buildSettlementTrace(balances, transfers);
        expect(trace).toHaveLength(1);
        expect(trace[0].transfer).toEqual({ from: "b", to: "a", amount: 100 });
    });

    it("balancesAfter reflects the payment correctly", () => {
        const balances = new Map([["a", 100], ["b", -100]]);
        const trace = buildSettlementTrace(balances, [{ from: "b", to: "a", amount: 100 }]);
        const after = trace[0].balancesAfter;
        expect(after.get("a")).toBe(0);
        expect(after.get("b")).toBe(0);
    });

    it("partial payment leaves residual balance", () => {
        const balances = new Map([["a", 100], ["b", -100]]);
        const trace = buildSettlementTrace(balances, [{ from: "b", to: "a", amount: 40 }]);
        const after = trace[0].balancesAfter;
        expect(after.get("a")).toBe(60);
        expect(after.get("b")).toBe(-60);
    });

    it("sequential trace — each step's balancesAfter feeds the next", () => {
        const balances = new Map([["a", 200], ["b", -100], ["c", -100]]);
        const transfers = [
            { from: "b", to: "a", amount: 100 },
            { from: "c", to: "a", amount: 100 },
        ];
        const trace = buildSettlementTrace(balances, transfers);
        expect(trace[1].balancesAfter.get("a")).toBe(0);
        expect(trace[1].balancesAfter.get("b")).toBe(0);
        expect(trace[1].balancesAfter.get("c")).toBe(0);
    });

    it("does not mutate the original initialBalances map", () => {
        const balances = new Map([["a", 50], ["b", -50]]);
        buildSettlementTrace(balances, [{ from: "b", to: "a", amount: 50 }]);
        expect(balances.get("a")).toBe(50);
        expect(balances.get("b")).toBe(-50);
    });

    it("each balancesAfter snapshot is independent (not a shared reference)", () => {
        const balances = new Map([["a", 200], ["b", -100], ["c", -100]]);
        const transfers = [
            { from: "b", to: "a", amount: 100 },
            { from: "c", to: "a", amount: 100 },
        ];
        const trace = buildSettlementTrace(balances, transfers);
        // Snapshot at step 0 should still show a=100 after step 1 completes
        expect(trace[0].balancesAfter.get("a")).toBe(100);
        expect(trace[1].balancesAfter.get("a")).toBe(0);
    });

    it("works when a person not in initialBalances is involved (new key created)", () => {
        const balances = new Map([["a", 50]]);
        const trace = buildSettlementTrace(balances, [{ from: "b", to: "a", amount: 50 }]);
        const after = trace[0].balancesAfter;
        expect(after.get("a")).toBe(0);
        // b starts at undefined → treated as 0; after paying 50 → b = 50 (creditor now)
        expect(after.get("b")).toBe(50);
    });
});

// ---------------------------------------------------------------------------
// getPersonShareDetails — qty-based item breakdown
// ---------------------------------------------------------------------------

describe("getPersonShareDetails — qty-based item breakdown", () => {
    it("includes qty-based items in the breakdown with correct personQty and shareAmount", () => {
        const receipt = makeReceipt({
            items: [
                makeItem({
                    id: "1",
                    name: "Sate",
                    qty: 4,
                    unitPrice: 10,
                    total: 40,
                    assignedToIds: [],
                    assignments: [
                        { participantId: "a", qty: 3 },
                        { participantId: "b", qty: 1 },
                    ],
                }),
            ],
        });
        const details = getPersonShareDetails(receipt, ["a", "b"]);
        const aDetail = details.find((d) => d.participantId === "a")!;
        const bDetail = details.find((d) => d.participantId === "b")!;

        expect(aDetail.items).toHaveLength(1);
        expect(aDetail.items[0].personQty).toBe(3);
        expect(aDetail.items[0].shareAmount).toBe(30);
        expect(aDetail.items[0].sharedWith).toBe(2);

        expect(bDetail.items).toHaveLength(1);
        expect(bDetail.items[0].personQty).toBe(1);
        expect(bDetail.items[0].shareAmount).toBe(10);
    });

    it("excludes an item from breakdown if participant has no qty assignment", () => {
        const receipt = makeReceipt({
            items: [
                makeItem({
                    id: "1",
                    name: "Sate",
                    qty: 2,
                    total: 20,
                    assignedToIds: [],
                    assignments: [{ participantId: "a", qty: 2 }],
                }),
            ],
        });
        const details = getPersonShareDetails(receipt, ["a", "b"]);
        const bDetail = details.find((d) => d.participantId === "b")!;
        expect(bDetail.items).toHaveLength(0);
        expect(bDetail.subtotal).toBe(0);
    });

    it("includes feesAllocation in each PersonShareDetail", () => {
        const receipt = makeReceipt({
            items: [makeItem({ id: "1", total: 100, assignedToIds: ["a", "b"] })],
            fees: [makeFee("delivery", 20, "equal")],
        });
        const details = getPersonShareDetails(receipt, ["a", "b"]);
        expect(details.every((d) => d.feesAllocation === 10)).toBe(true);
    });

    it("equal-split items appear correctly in breakdown", () => {
        const receipt = makeReceipt({
            items: [
                makeItem({ id: "1", name: "Pizza", total: 60, assignedToIds: ["a", "b", "c"] }),
            ],
        });
        const details = getPersonShareDetails(receipt, ["a", "b", "c"]);
        for (const d of details) {
            expect(d.items).toHaveLength(1);
            expect(d.items[0].shareAmount).toBe(20);
            expect(d.items[0].sharedWith).toBe(3);
        }
    });
});

// ---------------------------------------------------------------------------
// calculateDiscountCredits — edge cases
// ---------------------------------------------------------------------------

describe("calculateDiscountCredits — edge cases (via calculatePersonTotals)", () => {
    it("receipt-scope discount credits 0 to everyone when all base totals are 0", () => {
        // No items → subtotal = 0 → no base totals → discount credits nothing
        const receipt = makeReceipt({
            items: [],
            discounts: [{ id: "d1", scope: "receipt", type: "amount", value: 100 }],
        });
        const shares = calculatePersonTotals(receipt, ["a", "b"]);
        expect(shares.every((s) => s.discount === 0)).toBe(true);
    });

    it("participant-scope discount applied only to the target", () => {
        const receipt = makeReceipt({
            items: [makeItem({ id: "1", total: 100, assignedToIds: ["a", "b"] })],
            discounts: [
                { id: "d1", scope: "participant", type: "amount", value: 20, targetId: "a" },
            ],
        });
        const shares = calculatePersonTotals(receipt, ["a", "b"]);
        const a = shares.find((s) => s.participantId === "a")!;
        const b = shares.find((s) => s.participantId === "b")!;
        expect(a.discount).toBe(20);
        expect(b.discount).toBe(0);
    });

    it("percent discount resolves against base total, not subtotal", () => {
        const receipt = makeReceipt({
            items: [makeItem({ id: "1", total: 100, assignedToIds: ["a"] })],
            tax: 10,
            discounts: [{ id: "d1", scope: "participant", type: "percent", value: 10, targetId: "a" }],
        });
        const shares = calculatePersonTotals(receipt, ["a"]);
        const a = shares.find((s) => s.participantId === "a")!;
        // Base total for a = 100 subtotal + 10 tax = 110; 10% = 11
        expect(a.discount).toBe(11);
    });

    it("discount capped at base total — never makes share go negative", () => {
        const receipt = makeReceipt({
            items: [makeItem({ id: "1", total: 30, assignedToIds: ["a"] })],
            discounts: [
                { id: "d1", scope: "participant", type: "amount", value: 9999, targetId: "a" },
            ],
        });
        const shares = calculatePersonTotals(receipt, ["a"]);
        const a = shares.find((s) => s.participantId === "a")!;
        expect(a.total).toBeGreaterThanOrEqual(0);
    });

    it("item-scope discount distributed to item's consumers only", () => {
        const receipt = makeReceipt({
            items: [
                makeItem({ id: "1", name: "Shared", total: 100, assignedToIds: ["a", "b"] }),
                makeItem({ id: "2", name: "Solo",   total: 50,  assignedToIds: ["c"] }),
            ],
            discounts: [
                { id: "d1", scope: "item", type: "amount", value: 20, targetId: "1" },
            ],
        });
        const shares = calculatePersonTotals(receipt, ["a", "b", "c"]);
        const a = shares.find((s) => s.participantId === "a")!;
        const b = shares.find((s) => s.participantId === "b")!;
        const c = shares.find((s) => s.participantId === "c")!;
        expect(a.discount).toBeGreaterThan(0);
        expect(b.discount).toBeGreaterThan(0);
        expect(c.discount).toBe(0);
        expect(a.discount + b.discount).toBe(20);
    });

    it("item-scope percent discount resolves against item.total", () => {
        const receipt = makeReceipt({
            items: [makeItem({ id: "1", total: 80, assignedToIds: ["a"] })],
            discounts: [{ id: "d1", scope: "item", type: "percent", value: 25, targetId: "1" }],
        });
        const shares = calculatePersonTotals(receipt, ["a"]);
        // 25% of 80 = 20
        expect(shares[0].discount).toBe(20);
    });

    it("ignores discount with value = 0", () => {
        const receipt = makeReceipt({
            items: [makeItem({ id: "1", total: 100, assignedToIds: ["a"] })],
            discounts: [{ id: "d1", scope: "receipt", type: "amount", value: 0 }],
        });
        const shares = calculatePersonTotals(receipt, ["a"]);
        expect(shares[0].discount).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// receiptInBaseCurrency — fees scaling
// ---------------------------------------------------------------------------

describe("receiptInBaseCurrency — fees scaling with FX", () => {
    it("scales fee amounts by fxRate", () => {
        const receipt = makeReceipt({
            currency: "USD",
            fxRate: 16000,
            items: [makeItem({ id: "1", total: 10, assignedToIds: ["a"] })],
            fees: [makeFee("delivery", 2, "equal")],
        });
        const converted = receiptInBaseCurrency(receipt);
        expect(converted.fees![0].amount).toBe(32000); // 2 × 16000
    });

    it("preserves splitMethod on fees after FX conversion", () => {
        const receipt = makeReceipt({
            currency: "USD",
            fxRate: 16000,
            items: [makeItem({ id: "1", total: 10, assignedToIds: ["a"] })],
            fees: [makeFee("platform", 1, "proportional")],
        });
        const converted = receiptInBaseCurrency(receipt);
        expect(converted.fees![0].splitMethod).toBe("proportional");
    });

    it("does not scale fees when receipt is IDR (no conversion)", () => {
        const receipt = makeReceipt({
            items: [makeItem({ id: "1", total: 100, assignedToIds: ["a"] })],
            fees: [makeFee("delivery", 15000, "equal")],
        });
        const converted = receiptInBaseCurrency(receipt);
        expect(converted).toBe(receipt); // identity — no conversion
    });

    it("does not scale fees when fxRate is 0 (falls back to identity)", () => {
        const receipt = makeReceipt({
            currency: "USD",
            fxRate: 0,
            items: [makeItem({ id: "1", total: 10, assignedToIds: ["a"] })],
            fees: [makeFee("delivery", 5, "equal")],
        });
        const converted = receiptInBaseCurrency(receipt);
        // fxRate=0 is treated as no valid rate → identity
        expect(converted).toBe(receipt);
    });

    it("handles receipt with no fees gracefully (fees stays undefined/empty)", () => {
        const receipt = makeReceipt({
            currency: "USD",
            fxRate: 15000,
            items: [makeItem({ id: "1", total: 10, assignedToIds: ["a"] })],
        });
        const converted = receiptInBaseCurrency(receipt);
        expect(converted.fees).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// minimizeTransactions — multi-pair and edge cases
// ---------------------------------------------------------------------------

describe("minimizeTransactions — multi-pair and edge cases", () => {
    it("handles two independent debtor-creditor pairs", () => {
        // A owed by B 100; C owed by D 100 — two exact pairs, 2 transfers expected
        const balances = new Map([
            ["A", 100], ["B", -100],
            ["C", 100], ["D", -100],
        ]);
        const transfers = minimizeTransactions(balances);
        expect(transfers).toHaveLength(2);
        expect(transfers.every((t) => t.amount === 100)).toBe(true);
    });

    it("produces zero transfers for zero balances", () => {
        const balances = new Map([["a", 0], ["b", 0]]);
        expect(minimizeTransactions(balances)).toHaveLength(0);
    });

    it("minimizes three-way debt: A→B, B→C, C→A collapse", () => {
        // Circular debt of same amount — minimizes to 0 transfers
        const balances = new Map([["a", 0], ["b", 0], ["c", 0]]);
        expect(minimizeTransactions(balances)).toHaveLength(0);
    });

    it("minimizes: A owes B 100, A owes C 50 — two transfers from A", () => {
        const balances = new Map([["a", -150], ["b", 100], ["c", 50]]);
        const transfers = minimizeTransactions(balances);
        const totalSent = transfers.filter((t) => t.from === "a").reduce((s, t) => s + t.amount, 0);
        expect(totalSent).toBe(150);
    });

    it("exact-match optimization: B owes A 100 → single transfer of exactly 100", () => {
        const balances = new Map([["a", 100], ["b", -100]]);
        const transfers = minimizeTransactions(balances);
        expect(transfers).toHaveLength(1);
        expect(transfers[0]).toEqual({ from: "b", to: "a", amount: 100 });
    });

    it("handles single participant with zero balance", () => {
        const balances = new Map([["a", 0]]);
        expect(minimizeTransactions(balances)).toHaveLength(0);
    });

    it("produces correct transfers for 4-person asymmetric debts", () => {
        // A paid for everyone: balance = +300, each of B/C/D owes 100
        const balances = new Map([
            ["a", 300], ["b", -100], ["c", -100], ["d", -100],
        ]);
        const transfers = minimizeTransactions(balances);
        const totalReceived = transfers.filter((t) => t.to === "a").reduce((s, t) => s + t.amount, 0);
        expect(totalReceived).toBe(300);
    });
});

// ---------------------------------------------------------------------------
// applyPaymentsToBalances — edge cases
// ---------------------------------------------------------------------------

describe("applyPaymentsToBalances — edge cases", () => {
    it("no payments returns the original balances unchanged", () => {
        const balances = new Map([["a", 100], ["b", -100]]);
        const result = applyPaymentsToBalances(balances, []);
        expect(result.get("a")).toBe(100);
        expect(result.get("b")).toBe(-100);
    });

    it("payment of full amount zeroes both balances", () => {
        const balances = new Map([["a", 100], ["b", -100]]);
        const payment: TripPayment = { id: "p1", from: "b", to: "a", amount: 100 };
        const result = applyPaymentsToBalances(balances, [payment]);
        expect(result.get("a")).toBe(0);
        expect(result.get("b")).toBe(0);
    });

    it("foreign-currency payment uses fxRate to convert to IDR", () => {
        const balances = new Map([["a", 16000], ["b", -16000]]);
        // Payment of 1 USD at 16000 = 16000 IDR
        const payment: TripPayment = {
            id: "p1", from: "b", to: "a",
            amount: 1, currency: "USD", fxRate: 16000,
        };
        const result = applyPaymentsToBalances(balances, [payment]);
        expect(result.get("a")).toBe(0);
        expect(result.get("b")).toBe(0);
    });

    it("payment with fxRate=0 is treated as IDR (no FX multiplication)", () => {
        const balances = new Map([["a", 50], ["b", -50]]);
        // fxRate=0 fails the > 0 guard → amount used as-is (IDR)
        const payment: TripPayment = {
            id: "p1", from: "b", to: "a",
            amount: 50, currency: "USD", fxRate: 0,
        };
        const result = applyPaymentsToBalances(balances, [payment]);
        expect(result.get("a")).toBe(0);
        expect(result.get("b")).toBe(0);
    });

    it("overpayment pushes balance beyond zero (negative for creditor)", () => {
        const balances = new Map([["a", 50], ["b", -50]]);
        const payment: TripPayment = { id: "p1", from: "b", to: "a", amount: 80 };
        const result = applyPaymentsToBalances(balances, [payment]);
        // a is now owed less than expected; a received more than owed
        expect(result.get("a")).toBe(-30);
        expect(result.get("b")).toBe(30);
    });

    it("multiple payments from different payers settle independently", () => {
        const balances = new Map([["a", 200], ["b", -100], ["c", -100]]);
        const payments: TripPayment[] = [
            { id: "p1", from: "b", to: "a", amount: 100 },
            { id: "p2", from: "c", to: "a", amount: 100 },
        ];
        const result = applyPaymentsToBalances(balances, payments);
        expect(result.get("a")).toBe(0);
        expect(result.get("b")).toBe(0);
        expect(result.get("c")).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// End-to-end: receipt with fees + discounts + multi-currency
// ---------------------------------------------------------------------------

describe("end-to-end: receipt with fees + discounts + FX", () => {
    it("USD receipt with delivery fee and receipt discount — full calculation pipeline", () => {
        const receipt: Receipt = {
            id: "r1",
            title: "GrabFood",
            payerId: "a",
            currency: "USD",
            fxRate: 16000,
            items: [
                makeItem({ id: "1", name: "Burger", total: 10, assignedToIds: ["a", "b"] }),
                makeItem({ id: "2", name: "Fries",  total: 5,  assignedToIds: ["b"] }),
            ],
            tax: 1.5,
            service: 0,
            fees: [makeFee("delivery", 2, "equal")],
            discounts: [{ id: "d1", scope: "receipt", type: "amount", value: 1.5 }],
        };

        // Convert to base currency first, then calculate
        const base = receiptInBaseCurrency(receipt);
        expect(base.tax).toBe(24000);
        expect(base.fees![0].amount).toBe(32000);
        expect(base.discounts![0].value).toBe(24000);

        const shares = calculatePersonTotals(base, ["a", "b"]);
        const sumTotals = shares.reduce((s, p) => s + p.total, 0);
        const summary = getReceiptSummary(base, ["a", "b"]);

        // amountPaid should equal sum of individual totals
        expect(Math.round(sumTotals * 100) / 100).toBe(
            Math.round(summary.amountPaid * 100) / 100
        );
    });

    it("receipt with proportional fee and item discount — feesAllocation matches proportion", () => {
        const receipt = makeReceipt({
            items: [
                makeItem({ id: "1", total: 70, assignedToIds: ["a"] }),
                makeItem({ id: "2", total: 30, assignedToIds: ["b"] }),
            ],
            fees: [makeFee("platform", 10, "proportional")],
            discounts: [{ id: "d1", scope: "item", type: "amount", value: 10, targetId: "1" }],
        });
        const shares = calculatePersonTotals(receipt, ["a", "b"]);
        const a = shares.find((s) => s.participantId === "a")!;
        const b = shares.find((s) => s.participantId === "b")!;

        // Proportional fee: a=7 (70%), b=3 (30%)
        expect(a.feesAllocation).toBe(7);
        expect(b.feesAllocation).toBe(3);

        // Discount on item 1 goes to a
        expect(a.discount).toBe(10);
        expect(b.discount).toBe(0);

        // a total: 70 subtotal + 7 fee - 10 discount = 67
        expect(a.total).toBe(67);
        // b total: 30 + 3 = 33
        expect(b.total).toBe(33);
    });
});
