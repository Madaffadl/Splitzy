/**
 * Tests for the fxRate guards (Finding 12).
 *
 * A foreign receipt with no usable rate is returned unconverted, so its NATIVE
 * amounts land in IDR aggregates at 1:1 — a ฿1.000 dinner counted as Rp 1.000.
 * That behaviour is deliberate (throwing mid-entry would be worse), but it has
 * to be DETECTABLE so the UI can refuse to present the total as final.
 * `needsFxRate` is that predicate; these tests pin it and the invariant that it
 * agrees with what `receiptInBaseCurrency` actually does.
 */

import { describe, it, expect } from "vitest";
import {
    needsFxRate,
    isForeignReceipt,
    receiptInBaseCurrency,
    computeTripTotals,
    paymentInBaseCurrency,
} from "@/lib/receipt/calculations";
import { paymentIdrAmount } from "./settle-up";
import type { Receipt, TripPayment } from "@/types";

function makeReceipt(overrides: Partial<Receipt> = {}): Receipt {
    return {
        id: "r1",
        title: "Dinner",
        payerId: "a",
        items: [
            { id: "i1", name: "Pad Thai", qty: 1, unitPrice: 1000, total: 1000, assignedToIds: ["a", "b"] },
        ],
        tax: 0,
        service: 0,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// isForeignReceipt
// ---------------------------------------------------------------------------

describe("isForeignReceipt", () => {
    it("is false when no currency is set (IDR is the implicit base)", () => {
        expect(isForeignReceipt(makeReceipt())).toBe(false);
    });

    it("is false for an explicit IDR receipt", () => {
        expect(isForeignReceipt(makeReceipt({ currency: "IDR" }))).toBe(false);
    });

    it("is true for a non-IDR currency, with or without a rate", () => {
        expect(isForeignReceipt(makeReceipt({ currency: "THB" }))).toBe(true);
        expect(isForeignReceipt(makeReceipt({ currency: "THB", fxRate: 465 }))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// needsFxRate
// ---------------------------------------------------------------------------

describe("needsFxRate", () => {
    it("is false for domestic receipts (nothing to convert)", () => {
        expect(needsFxRate(makeReceipt())).toBe(false);
        expect(needsFxRate(makeReceipt({ currency: "IDR" }))).toBe(false);
        // An IDR receipt with a nonsense rate still needs nothing.
        expect(needsFxRate(makeReceipt({ currency: "IDR", fxRate: 0 }))).toBe(false);
    });

    it("is false for a foreign receipt with a usable rate", () => {
        expect(needsFxRate(makeReceipt({ currency: "THB", fxRate: 465 }))).toBe(false);
        // A rate of exactly 1 is unusual but legitimate.
        expect(needsFxRate(makeReceipt({ currency: "USD", fxRate: 1 }))).toBe(false);
    });

    it("is true for a foreign receipt with a missing rate", () => {
        expect(needsFxRate(makeReceipt({ currency: "THB" }))).toBe(true);
    });

    it("is true for a foreign receipt with a zero rate", () => {
        // The headline case: fxRate 0 silently meant "no conversion".
        expect(needsFxRate(makeReceipt({ currency: "THB", fxRate: 0 }))).toBe(true);
    });

    it("is true for a foreign receipt with a negative rate", () => {
        expect(needsFxRate(makeReceipt({ currency: "THB", fxRate: -465 }))).toBe(true);
    });

    it("is true for a foreign receipt with a non-finite rate", () => {
        expect(needsFxRate(makeReceipt({ currency: "THB", fxRate: NaN }))).toBe(true);
        expect(needsFxRate(makeReceipt({ currency: "THB", fxRate: Infinity }))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// The invariant: needsFxRate must describe receiptInBaseCurrency's behaviour
// ---------------------------------------------------------------------------

describe("needsFxRate agrees with receiptInBaseCurrency", () => {
    const cases: Array<{ label: string; receipt: Receipt }> = [
        { label: "no currency", receipt: makeReceipt() },
        { label: "IDR", receipt: makeReceipt({ currency: "IDR", fxRate: 1 }) },
        { label: "THB no rate", receipt: makeReceipt({ currency: "THB" }) },
        { label: "THB rate 0", receipt: makeReceipt({ currency: "THB", fxRate: 0 }) },
        { label: "THB negative rate", receipt: makeReceipt({ currency: "THB", fxRate: -1 }) },
        { label: "THB NaN rate", receipt: makeReceipt({ currency: "THB", fxRate: NaN }) },
        { label: "THB valid rate", receipt: makeReceipt({ currency: "THB", fxRate: 465 }) },
    ];

    for (const { label, receipt } of cases) {
        it(`${label}: unconverted output iff needsFxRate or not foreign`, () => {
            const converted = receiptInBaseCurrency(receipt);
            const wasConverted = converted !== receipt;
            const shouldConvert = isForeignReceipt(receipt) && !needsFxRate(receipt);
            // A valid rate of exactly 1 is a no-op, so it returns the same object
            // despite being convertible — exclude that one from the identity check.
            const isNoOpRate = shouldConvert && receipt.fxRate === 1;
            if (!isNoOpRate) {
                expect(wasConverted).toBe(shouldConvert);
            }
        });
    }

    it("a THB receipt with rate 0 keeps its native amounts (the understated total)", () => {
        const r = makeReceipt({ currency: "THB", fxRate: 0 });
        const converted = receiptInBaseCurrency(r);
        // 1000 THB stays 1000 — which downstream reads as Rp 1.000.
        expect(converted.items[0].total).toBe(1000);
        expect(needsFxRate(r)).toBe(true);
    });

    it("a THB receipt with a valid rate converts its amounts", () => {
        const r = makeReceipt({ currency: "THB", fxRate: 465 });
        const converted = receiptInBaseCurrency(r);
        expect(converted.items[0].total).toBe(465_000);
        expect(needsFxRate(r)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Trip-level impact — what the UI warning is there to explain
// ---------------------------------------------------------------------------

describe("trip totals with a rateless foreign receipt", () => {
    it("understates the grand total, which is why the UI must flag it", () => {
        const rateless = makeReceipt({ id: "r1", currency: "THB" });
        const totals = computeTripTotals([rateless], ["a", "b"]);
        // 1000 THB folded in as Rp 1.000 rather than ~Rp 465.000.
        expect(totals.totalGrandTotal).toBe(1000);
        expect(needsFxRate(rateless)).toBe(true);
    });

    it("is correct once a rate is supplied", () => {
        const priced = makeReceipt({ id: "r1", currency: "THB", fxRate: 465 });
        const totals = computeTripTotals([priced], ["a", "b"]);
        expect(totals.totalGrandTotal).toBe(465_000);
    });

    it("a mixed trip flags only the receipts that actually lack a rate", () => {
        const receipts = [
            makeReceipt({ id: "r1" }), // IDR
            makeReceipt({ id: "r2", currency: "THB", fxRate: 465 }),
            makeReceipt({ id: "r3", currency: "VND" }), // no rate
            makeReceipt({ id: "r4", currency: "USD", fxRate: 0 }), // unusable rate
        ];
        const flagged = receipts.filter(needsFxRate).map((r) => r.id);
        expect(flagged).toEqual(["r3", "r4"]);
    });
});

// ---------------------------------------------------------------------------
// Consolidation: settle-up's paymentIdrAmount must be the same rule
// ---------------------------------------------------------------------------

describe("paymentIdrAmount is the same rule as paymentInBaseCurrency", () => {
    const payments: TripPayment[] = [
        { id: "p1", from: "a", to: "b", amount: 500 },
        { id: "p2", from: "a", to: "b", amount: 500, currency: "IDR", fxRate: 1 },
        { id: "p3", from: "a", to: "b", amount: 100, currency: "USD", fxRate: 16000 },
        { id: "p4", from: "a", to: "b", amount: 100, currency: "USD", fxRate: 0 },
        { id: "p5", from: "a", to: "b", amount: 100, currency: "USD", fxRate: -3 },
        { id: "p6", from: "a", to: "b", amount: 100, currency: "USD" },
    ];

    it("returns an identical value for every shape", () => {
        for (const p of payments) {
            expect(paymentIdrAmount(p)).toBe(paymentInBaseCurrency(p));
        }
    });

    it("still converts a valid foreign payment", () => {
        expect(paymentIdrAmount(payments[2])).toBe(1_600_000);
    });

    it("still falls back to the native amount for an unusable rate", () => {
        expect(paymentIdrAmount(payments[3])).toBe(100);
        expect(paymentIdrAmount(payments[4])).toBe(100);
        expect(paymentIdrAmount(payments[5])).toBe(100);
    });
});
