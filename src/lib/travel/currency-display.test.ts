/**
 * Tests for the foreign-currency correctness fixes:
 *
 *  - paymentInBaseCurrency(): the single rule for turning a settle-up's NATIVE
 *    amount into base currency (IDR), now shared by the balance math and by
 *    every place that displays a payment.
 *  - validateSharedPayments(): must carry currency/fxRate into a share payload,
 *    otherwise the recipient's balances disagree with the payer's.
 */

import { describe, it, expect } from "vitest";
import { paymentInBaseCurrency, applyPaymentsToBalances } from "@/lib/receipt/calculations";
import { validateSharedPayments } from "@/lib/receipt/shared-summary";
import type { TripPayment } from "@/types";

// ---------------------------------------------------------------------------
// paymentInBaseCurrency
// ---------------------------------------------------------------------------

describe("paymentInBaseCurrency", () => {
    it("returns the amount unchanged for an IDR payment (no currency field)", () => {
        const p: TripPayment = { id: "p1", from: "a", to: "b", amount: 50000 };
        expect(paymentInBaseCurrency(p)).toBe(50000);
    });

    it("returns the amount unchanged for an explicit IDR payment", () => {
        const p: TripPayment = {
            id: "p1", from: "a", to: "b", amount: 50000, currency: "IDR", fxRate: 1,
        };
        expect(paymentInBaseCurrency(p)).toBe(50000);
    });

    it("multiplies a foreign payment by its locked rate", () => {
        // The headline bug: $100 @ 16,000 is Rp 1.600.000, not "Rp 100".
        const p: TripPayment = {
            id: "p1", from: "a", to: "b", amount: 100, currency: "USD", fxRate: 16000,
        };
        expect(paymentInBaseCurrency(p)).toBe(1_600_000);
    });

    it("handles a fractional rate (THB)", () => {
        const p: TripPayment = {
            id: "p1", from: "a", to: "b", amount: 1000, currency: "THB", fxRate: 465.5,
        };
        expect(paymentInBaseCurrency(p)).toBe(465_500);
    });

    it("falls back to the raw amount when a foreign payment has no rate", () => {
        const p: TripPayment = { id: "p1", from: "a", to: "b", amount: 100, currency: "USD" };
        expect(paymentInBaseCurrency(p)).toBe(100);
    });

    it("falls back to the raw amount when fxRate is 0", () => {
        const p: TripPayment = {
            id: "p1", from: "a", to: "b", amount: 100, currency: "USD", fxRate: 0,
        };
        expect(paymentInBaseCurrency(p)).toBe(100);
    });

    it("falls back to the raw amount when fxRate is negative", () => {
        const p: TripPayment = {
            id: "p1", from: "a", to: "b", amount: 100, currency: "USD", fxRate: -5,
        };
        expect(paymentInBaseCurrency(p)).toBe(100);
    });

    it("rounds to 2 decimals", () => {
        const p: TripPayment = {
            id: "p1", from: "a", to: "b", amount: 3, currency: "USD", fxRate: 16000.333,
        };
        expect(paymentInBaseCurrency(p)).toBe(48001);
    });

    it("agrees with what applyPaymentsToBalances actually deducts", () => {
        // This is the invariant the display bug violated: the number shown to the
        // user must be the number the ledger moved.
        const p: TripPayment = {
            id: "p1", from: "b", to: "a", amount: 100, currency: "USD", fxRate: 16000,
        };
        const balances = new Map([["a", 1_600_000], ["b", -1_600_000]]);
        const after = applyPaymentsToBalances(balances, [p]);

        expect(paymentInBaseCurrency(p)).toBe(1_600_000);
        expect(after.get("a")).toBe(0);
        expect(after.get("b")).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// validateSharedPayments — currency / fxRate round-trip
// ---------------------------------------------------------------------------

describe("validateSharedPayments — foreign currency metadata", () => {
    const ids = new Set(["a", "b"]);

    it("carries currency and fxRate through a share payload", () => {
        const out = validateSharedPayments(
            [{ id: "p1", from: "a", to: "b", amount: 100, currency: "USD", fxRate: 16000 }],
            ids
        );
        expect(out).toHaveLength(1);
        expect(out![0].currency).toBe("USD");
        expect(out![0].fxRate).toBe(16000);
        // The native amount is preserved as-is; conversion happens on read.
        expect(out![0].amount).toBe(100);
    });

    it("a shared foreign payment still settles the debt after the round-trip", () => {
        // Regression guard for the actual user-visible symptom: share a trip with
        // a $100 settle-up and the recipient's balances must match the payer's.
        const shared = validateSharedPayments(
            [{ id: "p1", from: "b", to: "a", amount: 100, currency: "USD", fxRate: 16000 }],
            ids
        )!;
        const balances = new Map([["a", 1_600_000], ["b", -1_600_000]]);
        const after = applyPaymentsToBalances(balances, shared as TripPayment[]);
        expect(after.get("a")).toBe(0);
        expect(after.get("b")).toBe(0);
    });

    it("omits currency for an IDR payment (base currency needs no metadata)", () => {
        const out = validateSharedPayments(
            [{ id: "p1", from: "a", to: "b", amount: 50000, currency: "IDR", fxRate: 1 }],
            ids
        );
        expect(out![0].currency).toBeUndefined();
        expect(out![0].fxRate).toBeUndefined();
    });

    it("omits currency when the field is absent", () => {
        const out = validateSharedPayments([{ id: "p1", from: "a", to: "b", amount: 500 }], ids);
        expect(out![0].currency).toBeUndefined();
    });

    it("normalises the currency code to uppercase", () => {
        const out = validateSharedPayments(
            [{ id: "p1", from: "a", to: "b", amount: 100, currency: "thb", fxRate: 465 }],
            ids
        );
        expect(out![0].currency).toBe("THB");
    });

    it("keeps the currency but drops an unusable rate (0 / negative / missing)", () => {
        for (const bad of [0, -1, undefined, "abc"]) {
            const out = validateSharedPayments(
                [{ id: "p1", from: "a", to: "b", amount: 100, currency: "USD", fxRate: bad }],
                ids
            );
            expect(out![0].currency).toBe("USD");
            expect(out![0].fxRate).toBeUndefined();
        }
    });

    it("drops an absurd fxRate above the sanity cap", () => {
        const out = validateSharedPayments(
            [{ id: "p1", from: "a", to: "b", amount: 1, currency: "USD", fxRate: 5_000_000 }],
            ids
        );
        expect(out![0].fxRate).toBeUndefined();
    });

    it("accepts a rate exactly at the cap (boundary)", () => {
        const out = validateSharedPayments(
            [{ id: "p1", from: "a", to: "b", amount: 1, currency: "USD", fxRate: 1_000_000 }],
            ids
        );
        expect(out![0].fxRate).toBe(1_000_000);
    });

    it("truncates an over-long currency code rather than rejecting the payment", () => {
        const out = validateSharedPayments(
            [
                {
                    id: "p1", from: "a", to: "b", amount: 100,
                    currency: "VERYLONGCURRENCYCODE", fxRate: 2,
                },
            ],
            ids
        );
        expect(out![0].currency).toHaveLength(10);
    });

    it("still drops payments with unknown participants", () => {
        const out = validateSharedPayments(
            [{ id: "p1", from: "a", to: "ghost", amount: 100, currency: "USD", fxRate: 16000 }],
            ids
        );
        expect(out).toBeUndefined();
    });

    it("preserves note and source alongside currency metadata", () => {
        const out = validateSharedPayments(
            [
                {
                    id: "p1", from: "a", to: "b", amount: 100,
                    currency: "USD", fxRate: 16000,
                    note: "airport taxi", source: "share:r1:a",
                },
            ],
            ids
        );
        expect(out![0]).toMatchObject({
            note: "airport taxi",
            source: "share:r1:a",
            currency: "USD",
            fxRate: 16000,
        });
    });
});
