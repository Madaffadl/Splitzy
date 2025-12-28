import { describe, it, expect } from "vitest";
import {
    calculateItemShares,
    calculatePersonSubtotals,
    calculateReceiptSubtotal,
    allocateTaxService,
    calculatePersonTotals,
    calculateReceiptBalances,
    minimizeTransactions,
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

    it("should handle zero subtotal", () => {
        const subtotals = new Map<string, number>([
            ["a", 0],
            ["b", 0],
        ]);

        const result = allocateTaxService(subtotals, 0, 10, 5);

        expect(result.taxAllocations.get("a")).toBe(0);
        expect(result.taxAllocations.get("b")).toBe(0);
        expect(result.serviceAllocations.get("a")).toBe(0);
        expect(result.serviceAllocations.get("b")).toBe(0);
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
});
