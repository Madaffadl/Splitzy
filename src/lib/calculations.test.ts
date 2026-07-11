import { describe, it, expect } from "vitest";
import {
    calculateItemShares,
    calculatePersonSubtotals,
    calculateReceiptSubtotal,
    allocateTaxService,
    calculatePersonTotals,
    calculateReceiptBalances,
    minimizeTransactions,
    getReceiptSummary,
    getTripSummary,
} from "./calculations";
import { Receipt, ReceiptItem, Trip } from "@/types";

describe("calculateItemShares", () => {
    it("should split item equally among assigned participants", () => {
        const item: ReceiptItem = {
            id: "1",
            name: "Pizza",
            qty: 1,
            unitPrice: 30,
            total: 30,
            assignedToIds: ["a", "b", "c"],
        };

        const shares = calculateItemShares(item);

        expect(shares.get("a")).toBe(10);
        expect(shares.get("b")).toBe(10);
        expect(shares.get("c")).toBe(10);
    });

    it("should return empty map for unassigned items", () => {
        const item: ReceiptItem = {
            id: "1",
            name: "Pizza",
            qty: 1,
            unitPrice: 30,
            total: 30,
            assignedToIds: [],
        };

        const shares = calculateItemShares(item);

        expect(shares.size).toBe(0);
    });

    it("should handle single person assignment", () => {
        const item: ReceiptItem = {
            id: "1",
            name: "Drink",
            qty: 1,
            unitPrice: 15,
            total: 15,
            assignedToIds: ["a"],
        };

        const shares = calculateItemShares(item);

        expect(shares.get("a")).toBe(15);
    });
});

describe("calculatePersonSubtotals", () => {
    it("should sum up item shares correctly", () => {
        const items: ReceiptItem[] = [
            { id: "1", name: "Pizza", qty: 1, unitPrice: 30, total: 30, assignedToIds: ["a", "b"] },
            { id: "2", name: "Pasta", qty: 1, unitPrice: 20, total: 20, assignedToIds: ["a"] },
        ];

        const subtotals = calculatePersonSubtotals(items, ["a", "b"]);

        expect(subtotals.get("a")).toBe(35); // 15 + 20
        expect(subtotals.get("b")).toBe(15);
    });

    it("should handle participant with no items", () => {
        const items: ReceiptItem[] = [
            { id: "1", name: "Pizza", qty: 1, unitPrice: 30, total: 30, assignedToIds: ["a"] },
        ];

        const subtotals = calculatePersonSubtotals(items, ["a", "b"]);

        expect(subtotals.get("a")).toBe(30);
        expect(subtotals.get("b")).toBe(0);
    });
});

describe("allocateTaxService", () => {
    it("should allocate tax proportionally", () => {
        const subtotals = new Map<string, number>([
            ["a", 60],
            ["b", 40],
        ]);

        const result = allocateTaxService(subtotals, 100, 10, 5);

        expect(result.taxAllocations.get("a")).toBe(6);
        expect(result.taxAllocations.get("b")).toBe(4);
        expect(result.serviceAllocations.get("a")).toBe(3);
        expect(result.serviceAllocations.get("b")).toBe(2);
    });

    it("should handle rounding remainder by giving to largest subtotal", () => {
        const subtotals = new Map<string, number>([
            ["a", 33.33],
            ["b", 33.33],
            ["c", 33.34],
        ]);

        const result = allocateTaxService(subtotals, 100, 10, 0);

        // 10 / 3 = 3.33 each, remainder 0.01 goes to c (largest)
        const totalTax =
            (result.taxAllocations.get("a") || 0) +
            (result.taxAllocations.get("b") || 0) +
            (result.taxAllocations.get("c") || 0);

        expect(totalTax).toBe(10);
    });

    it("should split tax/service equally when receipt subtotal is zero", () => {
        // Edge case: items with no value but real fees (e.g. cover charge only).
        // Equal-split keeps the ledger balanced — the alternative (return 0)
        // leaves the payer with phantom credit and breaks settlement.
        const subtotals = new Map<string, number>([
            ["a", 0],
            ["b", 0],
        ]);

        const result = allocateTaxService(subtotals, 0, 10, 5);

        expect(result.taxAllocations.get("a")! + result.taxAllocations.get("b")!).toBe(10);
        expect(result.serviceAllocations.get("a")! + result.serviceAllocations.get("b")!).toBe(5);
        // Both participants share roughly equally (within rounding).
        expect(result.taxAllocations.get("a")).toBeCloseTo(5, 2);
        expect(result.taxAllocations.get("b")).toBeCloseTo(5, 2);
    });
});

describe("calculateReceiptBalances", () => {
    it("should calculate payer as creditor and others as debtors", () => {
        const receipt: Receipt = {
            id: "1",
            title: "Dinner",
            payerId: "a",
            items: [
                { id: "1", name: "Pizza", qty: 1, unitPrice: 30, total: 30, assignedToIds: ["a", "b"] },
            ],
            tax: 0,
            service: 0,
        };

        const balances = calculateReceiptBalances(receipt, ["a", "b"]);

        // Receipt total = 30
        // a owes 15, b owes 15
        // a paid 30, so a balance = 30 - 15 = 15 (creditor)
        // b paid 0, so b balance = 0 - 15 = -15 (debtor)
        expect(balances.get("a")).toBe(15);
        expect(balances.get("b")).toBe(-15);
    });
});

describe("minimizeTransactions", () => {
    it("should create minimal transfers", () => {
        const balances = new Map<string, number>([
            ["a", 50],   // creditor
            ["b", -30],  // debtor
            ["c", -20],  // debtor
        ]);

        const transfers = minimizeTransactions(balances);

        expect(transfers.length).toBe(2);

        const totalToA = transfers
            .filter((t) => t.to === "a")
            .reduce((sum, t) => sum + t.amount, 0);

        expect(totalToA).toBe(50);
    });

    it("should handle case where one person owes all", () => {
        const balances = new Map<string, number>([
            ["a", 100],  // paid for everyone
            ["b", -50],
            ["c", -50],
        ]);

        const transfers = minimizeTransactions(balances);

        expect(transfers.length).toBe(2);
        expect(transfers.every((t) => t.to === "a")).toBe(true);
    });

    it("should return empty array when balanced", () => {
        const balances = new Map<string, number>([
            ["a", 0],
            ["b", 0],
        ]);

        const transfers = minimizeTransactions(balances);

        expect(transfers.length).toBe(0);
    });
});

describe("discounts", () => {
    // Shared setup for the two voucher cases: 4 people, one 300 bill, "a"
    // consumes 150 and b/c/d consume 50 each, "a" owns a personal 50 voucher.
    const buildReceipt = (payerId: string): Receipt => ({
        id: "r1",
        title: "Restaurant A",
        payerId,
        tax: 0,
        service: 0,
        items: [
            { id: "i1", name: "My food", qty: 1, unitPrice: 150, total: 150, assignedToIds: ["a"] },
            { id: "i2", name: "Shared", qty: 1, unitPrice: 150, total: 150, assignedToIds: ["b", "c", "d"] },
        ],
        discounts: [
            { id: "d1", scope: "participant", type: "amount", value: 50, targetId: "a", label: "Voucher" },
        ],
    });
    const ids = ["a", "b", "c", "d"];

    it("case 1: voucher owner is the payer — owner only bears 100", () => {
        const receipt = buildReceipt("a");
        const summary = getReceiptSummary(receipt, ids);

        expect(summary.totalDiscount).toBe(50);
        expect(summary.amountPaid).toBe(250);

        const byId = new Map(summary.shares.map((s) => [s.participantId, s]));
        expect(byId.get("a")!.discount).toBe(50);
        expect(byId.get("a")!.total).toBe(100); // 150 − 50 voucher
        expect(byId.get("b")!.total).toBe(50);

        // a fronted 250 cash, owes 100 → is owed 150; b/c/d each owe 50.
        expect(summary.balances.get("a")).toBe(150);
        expect(summary.balances.get("b")).toBe(-50);

        const settlements = minimizeTransactions(summary.balances);
        expect(settlements.length).toBe(3);
        expect(settlements.every((t) => t.to === "a" && t.amount === 50)).toBe(true);
    });

    it("case 2: a friend pays — voucher owner still only bears 100", () => {
        const receipt = buildReceipt("b");
        const summary = getReceiptSummary(receipt, ids);

        expect(summary.amountPaid).toBe(250);
        const byId = new Map(summary.shares.map((s) => [s.participantId, s]));
        expect(byId.get("a")!.total).toBe(100);
        expect(byId.get("b")!.total).toBe(50);

        // b fronted 250 cash, owes 50 → is owed 200.
        expect(summary.balances.get("b")).toBe(200);
        expect(summary.balances.get("a")).toBe(-100);

        const settlements = minimizeTransactions(summary.balances);
        // a → b 100, c → b 50, d → b 50
        expect(settlements.every((t) => t.to === "b")).toBe(true);
        const fromA = settlements.find((t) => t.from === "a");
        expect(fromA!.amount).toBe(100);
    });

    it("item discount is split across the item's consumers", () => {
        const receipt: Receipt = {
            id: "r", title: "t", payerId: "a", tax: 0, service: 0,
            items: [{ id: "i1", name: "Pizza", qty: 1, unitPrice: 100, total: 100, assignedToIds: ["a", "b"] }],
            discounts: [{ id: "d", scope: "item", type: "amount", value: 20, targetId: "i1" }],
        };
        const shares = calculatePersonTotals(receipt, ["a", "b"]);
        const byId = new Map(shares.map((s) => [s.participantId, s]));
        expect(byId.get("a")!.discount).toBe(10);
        expect(byId.get("b")!.discount).toBe(10);
        expect(byId.get("a")!.total).toBe(40); // 50 − 10
    });

    it("receipt percent discount is split proportionally to base total", () => {
        const receipt: Receipt = {
            id: "r", title: "t", payerId: "a", tax: 0, service: 0,
            items: [{ id: "i1", name: "Food", qty: 1, unitPrice: 100, total: 100, assignedToIds: ["a", "b"] }],
            discounts: [{ id: "d", scope: "receipt", type: "percent", value: 10 }],
        };
        const summary = getReceiptSummary(receipt, ["a", "b"]);
        expect(summary.totalDiscount).toBe(10); // 10% of 100
        const byId = new Map(summary.shares.map((s) => [s.participantId, s]));
        expect(byId.get("a")!.total).toBe(45);
        expect(byId.get("b")!.total).toBe(45);
    });

    it("caps a voucher larger than the owner's share (no cash back)", () => {
        const receipt: Receipt = {
            id: "r", title: "t", payerId: "a", tax: 0, service: 0,
            items: [{ id: "i1", name: "Food", qty: 1, unitPrice: 100, total: 100, assignedToIds: ["a", "b"] }],
            discounts: [{ id: "d", scope: "participant", type: "amount", value: 200, targetId: "a" }],
        };
        const shares = calculatePersonTotals(receipt, ["a", "b"]);
        const a = shares.find((s) => s.participantId === "a")!;
        expect(a.discount).toBe(50); // capped at their 50 share
        expect(a.total).toBe(0); // never negative
    });
});

describe("getTripSummary", () => {
    it("should aggregate balances across multiple receipts", () => {
        const trip: Trip = {
            id: "trip1",
            name: "Trip",
            participants: [{ id: "a", name: "Alice" }, { id: "b", name: "Bob" }],
            receipts: [
                {
                    id: "r1",
                    title: "Meal 1",
                    payerId: "a",
                    items: [
                        { id: "1", name: "Item", qty: 1, unitPrice: 100, total: 100, assignedToIds: ["a", "b"] },
                    ],
                    tax: 0,
                    service: 0,
                },
                {
                    id: "r2",
                    title: "Meal 2",
                    payerId: "b",
                    items: [
                        { id: "2", name: "Item", qty: 1, unitPrice: 100, total: 100, assignedToIds: ["a", "b"] },
                    ],
                    tax: 0,
                    service: 0,
                },
            ],
        };

        const summary = getTripSummary(trip);

        // Receipt 1: a paid 100, each owes 50. a balance = 50, b balance = -50
        // Receipt 2: b paid 100, each owes 50. a balance = -50, b balance = 50
        // Total: a = 0, b = 0 (balanced!)
        expect(summary.aggregateBalances.get("a")).toBe(0);
        expect(summary.aggregateBalances.get("b")).toBe(0);
        expect(summary.settlements.length).toBe(0);
    });

    it("should minimize transactions for multi-receipt trip", () => {
        const trip: Trip = {
            id: "trip1",
            name: "Trip",
            participants: [
                { id: "a", name: "Alice" },
                { id: "b", name: "Bob" },
                { id: "c", name: "Carol" },
            ],
            receipts: [
                {
                    id: "r1",
                    title: "Dinner",
                    payerId: "a",
                    items: [
                        { id: "1", name: "Food", qty: 1, unitPrice: 90, total: 90, assignedToIds: ["a", "b", "c"] },
                    ],
                    tax: 0,
                    service: 0,
                },
            ],
        };

        const summary = getTripSummary(trip);

        // Each owes 30. a paid 90, so a is owed 60. b and c each owe 30.
        expect(summary.settlements.length).toBe(2);
        expect(summary.settlements.every((t) => t.to === "a")).toBe(true);
        expect(summary.settlements.every((t) => t.amount === 30)).toBe(true);
    });

    it("should exclude a settled receipt from balances but keep it in the total", () => {
        const trip: Trip = {
            id: "trip1",
            name: "Trip",
            participants: [{ id: "a", name: "Alice" }, { id: "b", name: "Bob" }],
            receipts: [
                {
                    id: "r1",
                    title: "Meal 1",
                    payerId: "a",
                    items: [
                        { id: "1", name: "Item", qty: 1, unitPrice: 100, total: 100, assignedToIds: ["a", "b"] },
                    ],
                    tax: 0,
                    service: 0,
                },
                {
                    // Already settled outside the app — should not affect balances.
                    id: "r2",
                    title: "Meal 2",
                    payerId: "b",
                    settled: true,
                    items: [
                        { id: "2", name: "Item", qty: 1, unitPrice: 100, total: 100, assignedToIds: ["a", "b"] },
                    ],
                    tax: 0,
                    service: 0,
                },
            ],
        };

        const summary = getTripSummary(trip);

        // Only receipt 1 counts toward balances: a paid 100, each owes 50.
        expect(summary.aggregateBalances.get("a")).toBe(50);
        expect(summary.aggregateBalances.get("b")).toBe(-50);
        // b owes a 50 (receipt 2 is excluded even though b fronted it).
        expect(summary.settlements).toEqual([{ from: "b", to: "a", amount: 50 }]);
        // But the settled receipt still counts toward total spend.
        expect(summary.totalGrandTotal).toBe(200);
    });

    it("should remove only a person's own share when they paid it directly (paidBy)", () => {
        const trip: Trip = {
            id: "trip1",
            name: "Trip",
            participants: [
                { id: "a", name: "Alice" },
                { id: "b", name: "Bob" },
                { id: "c", name: "Carol" },
            ],
            receipts: [
                {
                    id: "r1",
                    title: "Dinner",
                    payerId: "a",
                    paidBy: ["b"], // Bob already reimbursed Alice for his share.
                    items: [
                        { id: "1", name: "Food", qty: 1, unitPrice: 90, total: 90, assignedToIds: ["a", "b", "c"] },
                    ],
                    tax: 0,
                    service: 0,
                },
            ],
        };

        const summary = getTripSummary(trip);

        // Each share 30. Alice fronted 90, owes 30, already got Bob's 30 back → +30.
        expect(summary.aggregateBalances.get("a")).toBe(30);
        expect(summary.aggregateBalances.get("b")).toBe(0);
        expect(summary.aggregateBalances.get("c")).toBe(-30);
        // Only Carol still owes Alice; Bob is out of the settlement.
        expect(summary.settlements).toEqual([{ from: "c", to: "a", amount: 30 }]);
        expect(summary.totalGrandTotal).toBe(90);
    });

    it("should ignore the payer appearing in paidBy", () => {
        const trip: Trip = {
            id: "trip1",
            name: "Trip",
            participants: [{ id: "a", name: "Alice" }, { id: "b", name: "Bob" }],
            receipts: [
                {
                    id: "r1",
                    title: "Meal",
                    payerId: "a",
                    paidBy: ["a"], // Payer can't pay their own share — no effect.
                    items: [
                        { id: "1", name: "Item", qty: 1, unitPrice: 100, total: 100, assignedToIds: ["a", "b"] },
                    ],
                    tax: 0,
                    service: 0,
                },
            ],
        };

        const summary = getTripSummary(trip);
        expect(summary.aggregateBalances.get("a")).toBe(50);
        expect(summary.aggregateBalances.get("b")).toBe(-50);
        expect(summary.settlements).toEqual([{ from: "b", to: "a", amount: 50 }]);
    });

    it("should settle to zero when every receipt is marked settled", () => {
        const trip: Trip = {
            id: "trip1",
            name: "Trip",
            participants: [{ id: "a", name: "Alice" }, { id: "b", name: "Bob" }],
            receipts: [
                {
                    id: "r1",
                    title: "Meal 1",
                    payerId: "a",
                    settled: true,
                    items: [
                        { id: "1", name: "Item", qty: 1, unitPrice: 100, total: 100, assignedToIds: ["a", "b"] },
                    ],
                    tax: 0,
                    service: 0,
                },
            ],
        };

        const summary = getTripSummary(trip);

        expect(summary.aggregateBalances.get("a")).toBe(0);
        expect(summary.aggregateBalances.get("b")).toBe(0);
        expect(summary.settlements.length).toBe(0);
        expect(summary.totalGrandTotal).toBe(100);
    });
});
