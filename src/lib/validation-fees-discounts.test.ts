/**
 * Tests for the fees[] / discounts[] validators added to the relational
 * receipt API path (validation.ts). Before this, both arrays reached
 * validateReceiptCreate completely unchecked.
 */

import { describe, it, expect } from "vitest";
import {
    validateFees,
    validateDiscounts,
    validateReceiptCreate,
    validateReceiptPatch,
    ValidationError,
} from "./validation";

// ---------------------------------------------------------------------------
// validateFees
// ---------------------------------------------------------------------------

describe("validateFees", () => {
    it("returns undefined for absent / null / empty input", () => {
        expect(validateFees(undefined)).toBeUndefined();
        expect(validateFees(null)).toBeUndefined();
        expect(validateFees([])).toBeUndefined();
    });

    it("returns undefined for a non-array (no fees is the normal case, not a 400)", () => {
        expect(validateFees("nope")).toBeUndefined();
        expect(validateFees(42)).toBeUndefined();
        expect(validateFees({})).toBeUndefined();
    });

    it("accepts a well-formed equal-split fee", () => {
        const fees = validateFees([
            { id: "f1", label: "Delivery Fee", amount: 12000, splitMethod: "equal" },
        ]);
        expect(fees).toEqual([
            { id: "f1", label: "Delivery Fee", amount: 12000, splitMethod: "equal" },
        ]);
    });

    it("accepts a proportional fee and preserves splitMethod", () => {
        const fees = validateFees([
            { id: "f1", label: "Platform Fee", amount: 5000, splitMethod: "proportional" },
        ]);
        expect(fees![0].splitMethod).toBe("proportional");
    });

    it("defaults an unknown/missing splitMethod to equal", () => {
        expect(validateFees([{ id: "f1", label: "Packaging", amount: 2000 }])![0].splitMethod)
            .toBe("equal");
        expect(
            validateFees([
                { id: "f1", label: "Packaging", amount: 2000, splitMethod: "weird" },
            ])![0].splitMethod
        ).toBe("equal");
    });

    it("rejects a zero amount", () => {
        expect(() =>
            validateFees([{ id: "f1", label: "Free", amount: 0, splitMethod: "equal" }])
        ).toThrow(ValidationError);
    });

    it("rejects a negative amount", () => {
        expect(() =>
            validateFees([{ id: "f1", label: "Refund", amount: -5000, splitMethod: "equal" }])
        ).toThrow(ValidationError);
    });

    it("rejects an amount above the money ceiling", () => {
        expect(() =>
            validateFees([
                { id: "f1", label: "Huge", amount: 2_000_000_000, splitMethod: "equal" },
            ])
        ).toThrow(ValidationError);
    });

    it("rejects a non-finite amount", () => {
        expect(() =>
            validateFees([{ id: "f1", label: "NaN", amount: NaN, splitMethod: "equal" }])
        ).toThrow(ValidationError);
        expect(() =>
            validateFees([{ id: "f1", label: "Inf", amount: Infinity, splitMethod: "equal" }])
        ).toThrow(ValidationError);
    });

    it("rejects a missing or empty label", () => {
        expect(() => validateFees([{ id: "f1", amount: 1000 }])).toThrow(ValidationError);
        expect(() => validateFees([{ id: "f1", label: "   ", amount: 1000 }])).toThrow(
            ValidationError
        );
    });

    it("rejects a missing id", () => {
        expect(() => validateFees([{ label: "Delivery", amount: 1000 }])).toThrow(
            ValidationError
        );
    });

    it("rejects a non-object entry", () => {
        expect(() => validateFees(["not an object"])).toThrow(ValidationError);
        expect(() => validateFees([null])).toThrow(ValidationError);
    });

    it("rejects more than 50 fees", () => {
        const many = Array.from({ length: 51 }, (_, i) => ({
            id: `f${i}`,
            label: `Fee ${i}`,
            amount: 100,
            splitMethod: "equal",
        }));
        expect(() => validateFees(many)).toThrow(/too many fees/);
    });

    it("accepts exactly 50 fees (boundary)", () => {
        const many = Array.from({ length: 50 }, (_, i) => ({
            id: `f${i}`,
            label: `Fee ${i}`,
            amount: 100,
            splitMethod: "equal",
        }));
        expect(validateFees(many)).toHaveLength(50);
    });

    it("trims whitespace from label and id", () => {
        const fees = validateFees([
            { id: "  f1  ", label: "  Delivery  ", amount: 1000 },
        ]);
        expect(fees![0].id).toBe("f1");
        expect(fees![0].label).toBe("Delivery");
    });

    it("names the offending index in the error field", () => {
        try {
            validateFees([
                { id: "f1", label: "Ok", amount: 100 },
                { id: "f2", label: "Bad", amount: -1 },
            ]);
            expect.unreachable("should have thrown");
        } catch (err) {
            expect((err as ValidationError).field).toBe("fees[1].amount");
        }
    });
});

// ---------------------------------------------------------------------------
// validateDiscounts
// ---------------------------------------------------------------------------

describe("validateDiscounts", () => {
    it("returns undefined for absent / empty input", () => {
        expect(validateDiscounts(undefined)).toBeUndefined();
        expect(validateDiscounts(null)).toBeUndefined();
        expect(validateDiscounts([])).toBeUndefined();
    });

    it("accepts a receipt-scoped amount discount", () => {
        const out = validateDiscounts([
            { id: "d1", scope: "receipt", type: "amount", value: 15000 },
        ]);
        expect(out).toEqual([{ id: "d1", scope: "receipt", type: "amount", value: 15000 }]);
    });

    it("accepts a receipt-scoped percent discount", () => {
        const out = validateDiscounts([
            { id: "d1", scope: "receipt", type: "percent", value: 20 },
        ]);
        expect(out![0].value).toBe(20);
    });

    it("accepts 0 and 100 as percent boundaries", () => {
        expect(
            validateDiscounts([{ id: "d1", scope: "receipt", type: "percent", value: 0 }])![0].value
        ).toBe(0);
        expect(
            validateDiscounts([{ id: "d1", scope: "receipt", type: "percent", value: 100 }])![0]
                .value
        ).toBe(100);
    });

    it("rejects a percent above 100 (the wipe-the-bill typo)", () => {
        expect(() =>
            validateDiscounts([{ id: "d1", scope: "receipt", type: "percent", value: 1000 }])
        ).toThrow(/between 0 and 100/);
    });

    it("rejects a negative percent", () => {
        expect(() =>
            validateDiscounts([{ id: "d1", scope: "receipt", type: "percent", value: -10 }])
        ).toThrow(ValidationError);
    });

    it("rejects a negative amount", () => {
        expect(() =>
            validateDiscounts([{ id: "d1", scope: "receipt", type: "amount", value: -100 }])
        ).toThrow(ValidationError);
    });

    it("rejects an unknown scope", () => {
        expect(() =>
            validateDiscounts([{ id: "d1", scope: "global", type: "amount", value: 100 }])
        ).toThrow(/must be receipt, item, or participant/);
    });

    it("rejects an unknown type", () => {
        expect(() =>
            validateDiscounts([{ id: "d1", scope: "receipt", type: "fraction", value: 1 }])
        ).toThrow(/must be amount or percent/);
    });

    it("requires targetId for item scope", () => {
        expect(() =>
            validateDiscounts([{ id: "d1", scope: "item", type: "amount", value: 100 }])
        ).toThrow(ValidationError);
    });

    it("requires targetId for participant scope", () => {
        expect(() =>
            validateDiscounts([{ id: "d1", scope: "participant", type: "amount", value: 100 }])
        ).toThrow(ValidationError);
    });

    it("keeps targetId for item scope and omits it for receipt scope", () => {
        const item = validateDiscounts([
            { id: "d1", scope: "item", type: "amount", value: 100, targetId: "item-9" },
        ]);
        expect(item![0].targetId).toBe("item-9");

        const receipt = validateDiscounts([
            { id: "d2", scope: "receipt", type: "amount", value: 100, targetId: "ignored" },
        ]);
        expect(receipt![0].targetId).toBeUndefined();
    });

    it("keeps an optional label and omits an empty one", () => {
        expect(
            validateDiscounts([
                { id: "d1", scope: "receipt", type: "amount", value: 100, label: "Promo GOPAY" },
            ])![0].label
        ).toBe("Promo GOPAY");
        expect(
            validateDiscounts([
                { id: "d1", scope: "receipt", type: "amount", value: 100, label: "" },
            ])![0].label
        ).toBeUndefined();
    });

    it("rejects more than 100 discounts", () => {
        const many = Array.from({ length: 101 }, (_, i) => ({
            id: `d${i}`,
            scope: "receipt",
            type: "amount",
            value: 1,
        }));
        expect(() => validateDiscounts(many)).toThrow(/too many discounts/);
    });

    it("accepts exactly 100 discounts (boundary)", () => {
        const many = Array.from({ length: 100 }, (_, i) => ({
            id: `d${i}`,
            scope: "receipt",
            type: "amount",
            value: 1,
        }));
        expect(validateDiscounts(many)).toHaveLength(100);
    });

    it("names the offending index in the error field", () => {
        try {
            validateDiscounts([
                { id: "d1", scope: "receipt", type: "amount", value: 10 },
                { id: "d2", scope: "receipt", type: "percent", value: 500 },
            ]);
            expect.unreachable("should have thrown");
        } catch (err) {
            expect((err as ValidationError).field).toBe("discounts[1].value");
        }
    });
});

// ---------------------------------------------------------------------------
// Integration into validateReceiptCreate / validateReceiptPatch
// ---------------------------------------------------------------------------

describe("validateReceiptCreate — fees & discounts", () => {
    const baseBody = {
        title: "Dinner",
        tax: 0,
        service: 0,
        items: [{ name: "Nasi Goreng", qty: 1, unitPrice: 25000, total: 25000, assignedToUserIds: [] }],
    };

    it("omits fees and discounts entirely when not supplied", () => {
        const out = validateReceiptCreate(baseBody);
        expect(out.fees).toBeUndefined();
        expect(out.discounts).toBeUndefined();
    });

    it("passes through valid fees", () => {
        const out = validateReceiptCreate({
            ...baseBody,
            fees: [{ id: "f1", label: "Delivery", amount: 10000, splitMethod: "equal" }],
        });
        expect(out.fees).toHaveLength(1);
        expect(out.fees![0].amount).toBe(10000);
    });

    it("passes through valid discounts", () => {
        const out = validateReceiptCreate({
            ...baseBody,
            discounts: [{ id: "d1", scope: "receipt", type: "percent", value: 10 }],
        });
        expect(out.discounts).toHaveLength(1);
    });

    it("rejects the whole request when a fee is malformed", () => {
        expect(() =>
            validateReceiptCreate({
                ...baseBody,
                fees: [{ id: "f1", label: "Delivery", amount: -1 }],
            })
        ).toThrow(ValidationError);
    });

    it("rejects the whole request when a discount percent is out of range", () => {
        expect(() =>
            validateReceiptCreate({
                ...baseBody,
                discounts: [{ id: "d1", scope: "receipt", type: "percent", value: 250 }],
            })
        ).toThrow(ValidationError);
    });

    it("still validates the rest of the body normally alongside fees", () => {
        const out = validateReceiptCreate({
            ...baseBody,
            title: "  GrabFood Order  ",
            fees: [{ id: "f1", label: "Delivery", amount: 8000 }],
        });
        expect(out.title).toBe("GrabFood Order");
        expect(out.items).toHaveLength(1);
        expect(out.fees).toHaveLength(1);
    });
});

describe("validateReceiptPatch — fees & discounts", () => {
    it("leaves both absent when the patch does not mention them", () => {
        const out = validateReceiptPatch({ title: "Updated" });
        expect(out.fees).toBeUndefined();
        expect(out.discounts).toBeUndefined();
    });

    it("accepts a fees patch", () => {
        const out = validateReceiptPatch({
            fees: [{ id: "f1", label: "Platform", amount: 3000, splitMethod: "proportional" }],
        });
        expect(out.fees).toHaveLength(1);
        expect(out.fees![0].splitMethod).toBe("proportional");
    });

    it("accepts a discounts patch", () => {
        const out = validateReceiptPatch({
            discounts: [{ id: "d1", scope: "receipt", type: "amount", value: 5000 }],
        });
        expect(out.discounts).toHaveLength(1);
    });

    it("treats an explicit empty array as 'nothing to set' rather than an error", () => {
        const out = validateReceiptPatch({ fees: [], discounts: [] });
        expect(out.fees).toBeUndefined();
        expect(out.discounts).toBeUndefined();
    });

    it("rejects a malformed fee in a patch", () => {
        expect(() => validateReceiptPatch({ fees: [{ id: "f1", amount: 100 }] })).toThrow(
            ValidationError
        );
    });
});
