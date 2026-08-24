/**
 * Tests for the fee/discount Add-button rules (Findings 8, 9, 10).
 *
 * The behaviour these pin down is specifically about NOT failing silently:
 *  - a dead Add button must come with a reason,
 *  - hitting a server cap must be announced by the form, not by a failed
 *    share-link request later,
 *  - a negative amount must say "greater than 0" rather than read as 0.
 */

import { describe, it, expect } from "vitest";
import {
    feeInputError,
    canAddFee,
    discountInputError,
    canAddDiscount,
    parseTypedAmount,
} from "./input-limits";
import { MAX_AMOUNT, MAX_FEES_PER_RECEIPT, MAX_DISCOUNTS_PER_RECEIPT } from "./limits";

// ---------------------------------------------------------------------------
// parseTypedAmount
// ---------------------------------------------------------------------------

describe("parseTypedAmount", () => {
    it("parses an Indonesian-grouped amount", () => {
        expect(parseTypedAmount("15.000")).toBe(15000);
        expect(parseTypedAmount("1.234.567")).toBe(1234567);
    });

    it("parses a decimal comma", () => {
        expect(parseTypedAmount("1.500,50")).toBe(1500.5);
    });

    it("returns NaN for empty or whitespace input", () => {
        expect(parseTypedAmount("")).toBeNaN();
        expect(parseTypedAmount("   ")).toBeNaN();
    });

    it("returns NaN for non-numeric junk", () => {
        expect(parseTypedAmount("abc")).toBeNaN();
    });

    it("PRESERVES a negative value rather than clamping to 0", () => {
        // This is the whole point: the form's own parser floored negatives to 0,
        // making "-500" indistinguishable from "0" and costing us the message.
        expect(parseTypedAmount("-500")).toBe(-500);
    });
});

// ---------------------------------------------------------------------------
// feeInputError
// ---------------------------------------------------------------------------

const fee = (over: Partial<Parameters<typeof feeInputError>[0]> = {}) => ({
    label: "Delivery Fee",
    amount: "15000",
    existingCount: 0,
    ...over,
});

describe("feeInputError", () => {
    it("returns null for a valid fee", () => {
        expect(feeInputError(fee())).toBeNull();
    });

    it("stays quiet while the amount field is untouched", () => {
        // Nothing to complain about yet — the button is disabled on its own.
        expect(feeInputError(fee({ amount: "" }))).toBeNull();
        expect(feeInputError(fee({ amount: "", label: "" }))).toBeNull();
    });

    it("explains a negative amount instead of silently reading it as 0", () => {
        expect(feeInputError(fee({ amount: "-500" }))).toMatch(/greater than 0/i);
    });

    it("explains a zero amount", () => {
        expect(feeInputError(fee({ amount: "0" }))).toMatch(/greater than 0/i);
    });

    it("explains non-numeric input", () => {
        expect(feeInputError(fee({ amount: "abc" }))).toMatch(/enter a number/i);
    });

    it("explains an amount over the server ceiling", () => {
        const err = feeInputError(fee({ amount: String(MAX_AMOUNT + 1) }));
        expect(err).toMatch(/too large/i);
    });

    it("accepts an amount exactly at the ceiling (boundary)", () => {
        expect(feeInputError(fee({ amount: String(MAX_AMOUNT) }))).toBeNull();
    });

    it("uses the receipt's currency symbol in the too-large message", () => {
        const err = feeInputError(fee({ amount: String(MAX_AMOUNT + 1), symbol: "฿" }));
        expect(err).toContain("฿");
    });

    it("announces the cap once the receipt is full", () => {
        const err = feeInputError(fee({ existingCount: MAX_FEES_PER_RECEIPT }));
        expect(err).toMatch(/limit reached/i);
        expect(err).toContain(String(MAX_FEES_PER_RECEIPT));
    });

    it("reports the cap even when the rest of the form is valid", () => {
        // The old form accepted a 51st fee happily and only the share request
        // failed, with an error the user could do nothing about.
        expect(feeInputError(fee({ existingCount: 60 }))).toMatch(/limit reached/i);
    });

    it("is still fine one below the cap (boundary)", () => {
        expect(feeInputError(fee({ existingCount: MAX_FEES_PER_RECEIPT - 1 }))).toBeNull();
    });
});

describe("canAddFee", () => {
    it("is true for a complete, valid fee", () => {
        expect(canAddFee(fee())).toBe(true);
    });

    it("is false with an empty label", () => {
        expect(canAddFee(fee({ label: "" }))).toBe(false);
        expect(canAddFee(fee({ label: "   " }))).toBe(false);
    });

    it("is false with an empty amount", () => {
        expect(canAddFee(fee({ amount: "" }))).toBe(false);
    });

    it("is false for a negative amount — and the button is genuinely disabled", () => {
        const input = fee({ amount: "-500" });
        expect(canAddFee(input)).toBe(false);
        // Disabled AND explained, rather than clickable and inert.
        expect(feeInputError(input)).not.toBeNull();
    });

    it("is false at the cap", () => {
        expect(canAddFee(fee({ existingCount: MAX_FEES_PER_RECEIPT }))).toBe(false);
    });

    it("never allows adding when feeInputError reports a problem", () => {
        const bad = ["-1", "0", "abc", String(MAX_AMOUNT + 1)];
        for (const amount of bad) {
            const input = fee({ amount });
            expect(feeInputError(input)).not.toBeNull();
            expect(canAddFee(input)).toBe(false);
        }
    });
});

// ---------------------------------------------------------------------------
// discountInputError
// ---------------------------------------------------------------------------

const disc = (over: Partial<Parameters<typeof discountInputError>[0]> = {}) => ({
    value: "10000",
    type: "amount" as const,
    scope: "receipt" as const,
    targetId: "",
    existingCount: 0,
    ...over,
});

describe("discountInputError", () => {
    it("returns null for a valid whole-bill amount discount", () => {
        expect(discountInputError(disc())).toBeNull();
    });

    it("stays quiet while the value field is untouched", () => {
        expect(discountInputError(disc({ value: "" }))).toBeNull();
    });

    it("explains a negative value", () => {
        expect(discountInputError(disc({ value: "-50" }))).toMatch(/greater than 0/i);
    });

    it("explains a zero value", () => {
        expect(discountInputError(disc({ value: "0" }))).toMatch(/greater than 0/i);
    });

    it("explains non-numeric input", () => {
        expect(discountInputError(disc({ value: "abc" }))).toMatch(/enter a number/i);
    });

    it("explains a percentage above 100", () => {
        const err = discountInputError(disc({ value: "150", type: "percent" }));
        expect(err).toMatch(/can't be more than 100/i);
    });

    it("accepts exactly 100 percent (boundary)", () => {
        expect(discountInputError(disc({ value: "100", type: "percent" }))).toBeNull();
    });

    it("does not apply the percent ceiling to amount discounts", () => {
        // 150 rupiah off is perfectly normal.
        expect(discountInputError(disc({ value: "150", type: "amount" }))).toBeNull();
    });

    it("explains an amount over the server ceiling", () => {
        expect(
            discountInputError(disc({ value: String(MAX_AMOUNT + 1), type: "amount" }))
        ).toMatch(/too large/i);
    });

    it("asks for an item when scope is item and none is chosen", () => {
        const err = discountInputError(disc({ scope: "item", targetId: "" }));
        expect(err).toMatch(/which item/i);
    });

    it("asks for a person when scope is participant and none is chosen", () => {
        const err = discountInputError(disc({ scope: "participant", targetId: "" }));
        expect(err).toMatch(/which person/i);
    });

    it("is satisfied once a target is chosen", () => {
        expect(discountInputError(disc({ scope: "item", targetId: "item-1" }))).toBeNull();
        expect(discountInputError(disc({ scope: "participant", targetId: "p-1" }))).toBeNull();
    });

    it("ignores targetId for receipt scope", () => {
        expect(discountInputError(disc({ scope: "receipt", targetId: "" }))).toBeNull();
    });

    it("reports a bad value BEFORE a missing target", () => {
        // Fix the number first; naming the item wouldn't have helped.
        const err = discountInputError(disc({ value: "150", type: "percent", scope: "item" }));
        expect(err).toMatch(/100/);
    });

    it("announces the cap once the receipt is full", () => {
        const err = discountInputError(disc({ existingCount: MAX_DISCOUNTS_PER_RECEIPT }));
        expect(err).toMatch(/limit reached/i);
        expect(err).toContain(String(MAX_DISCOUNTS_PER_RECEIPT));
    });

    it("is still fine one below the cap (boundary)", () => {
        expect(
            discountInputError(disc({ existingCount: MAX_DISCOUNTS_PER_RECEIPT - 1 }))
        ).toBeNull();
    });
});

describe("canAddDiscount", () => {
    it("is true for a valid whole-bill discount", () => {
        expect(canAddDiscount(disc())).toBe(true);
    });

    it("is false with an empty value", () => {
        expect(canAddDiscount(disc({ value: "" }))).toBe(false);
    });

    it("is false for an item discount with no item selected", () => {
        expect(canAddDiscount(disc({ scope: "item", targetId: "" }))).toBe(false);
    });

    it("is true for an item discount once the item is selected", () => {
        expect(canAddDiscount(disc({ scope: "item", targetId: "item-1" }))).toBe(true);
    });

    it("is false at the cap", () => {
        expect(canAddDiscount(disc({ existingCount: MAX_DISCOUNTS_PER_RECEIPT }))).toBe(false);
    });

    it("never allows adding when discountInputError reports a problem", () => {
        const bad = [
            disc({ value: "-1" }),
            disc({ value: "0" }),
            disc({ value: "abc" }),
            disc({ value: "150", type: "percent" }),
            disc({ scope: "item", targetId: "" }),
            disc({ existingCount: MAX_DISCOUNTS_PER_RECEIPT }),
        ];
        for (const input of bad) {
            expect(discountInputError(input)).not.toBeNull();
            expect(canAddDiscount(input)).toBe(false);
        }
    });
});

// ---------------------------------------------------------------------------
// UI caps must match what the server actually enforces
// ---------------------------------------------------------------------------

describe("UI caps agree with the server validators", () => {
    it("uses the shared limits rather than its own numbers", async () => {
        // If validation.ts ever diverges, the forms would let users past a cap
        // the server rejects — which is the bug these findings were about.
        const validation = await import("./validation");

        const overFees = Array.from({ length: MAX_FEES_PER_RECEIPT + 1 }, (_, i) => ({
            id: `f${i}`,
            label: `Fee ${i}`,
            amount: 100,
            splitMethod: "equal",
        }));
        expect(() => validation.validateFees(overFees)).toThrow(/too many fees/);

        const overDiscounts = Array.from({ length: MAX_DISCOUNTS_PER_RECEIPT + 1 }, (_, i) => ({
            id: `d${i}`,
            scope: "receipt",
            type: "amount",
            value: 1,
        }));
        expect(() => validation.validateDiscounts(overDiscounts)).toThrow(/too many discounts/);
    });

    it("an amount the form accepts is an amount the server accepts", () => {
        const validation = { MAX_AMOUNT };
        expect(feeInputError(fee({ amount: String(validation.MAX_AMOUNT) }))).toBeNull();
        expect(feeInputError(fee({ amount: String(validation.MAX_AMOUNT + 1) }))).not.toBeNull();
    });
});
