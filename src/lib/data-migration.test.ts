/**
 * Tests for the guest → cloud migration fixes.
 *
 * Background: /api/import was the ONLY reachable write path to the receipts
 * table, and it stored a receipt without item assignments, fees or discounts —
 * then the client cleared localStorage. Every row it produced showed each
 * participant owing 0 against a non-zero total, and the original was gone.
 *
 * Two changes are pinned here:
 *   A. the migration prompt is flag-gated and dark by default;
 *   B. the receipt is persisted as a JSON payload, validated by the same helper
 *      the Travel path uses, so nothing is dropped on the way in.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateTripReceiptPayload } from "./travel-cloud";
import { getReceiptSummary } from "./calculations";
import { ValidationError } from "./validation";
import type { Receipt } from "@/types";

// ---------------------------------------------------------------------------
// A. The migration flag
// ---------------------------------------------------------------------------

describe("dataMigration flag", () => {
    const ENV = "NEXT_PUBLIC_FLAG_DATA_MIGRATION";
    const original = process.env[ENV];

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        if (original === undefined) delete process.env[ENV];
        else process.env[ENV] = original;
        vi.resetModules();
    });

    it("is registered as a public flag with the expected env var", async () => {
        const { flagEnvName } = await import("./flags");
        expect(flagEnvName("dataMigration")).toBe(ENV);
    });

    it("is OFF when the env var is unset — the safe default", async () => {
        delete process.env[ENV];
        vi.resetModules();
        const { isEnabled } = await import("./flags");
        expect(isEnabled("dataMigration")).toBe(false);
    });

    it("stays OFF for values that are not an explicit yes", async () => {
        for (const value of ["", "0", "false", "off", "no", "maybe"]) {
            process.env[ENV] = value;
            vi.resetModules();
            const { isEnabled } = await import("./flags");
            expect(isEnabled("dataMigration"), `value: "${value}"`).toBe(false);
        }
    });

    it("turns ON only for an explicit truthy value", async () => {
        for (const value of ["1", "true", "on", "yes", "TRUE", " true "]) {
            process.env[ENV] = value;
            vi.resetModules();
            const { isEnabled } = await import("./flags");
            expect(isEnabled("dataMigration"), `value: "${value}"`).toBe(true);
        }
    });
});

// ---------------------------------------------------------------------------
// B. The payload keeps everything the relational columns could not
// ---------------------------------------------------------------------------

const participantIds = new Set(["p1", "p2"]);

/** A guest split of the kind that used to be destroyed by migration. */
function guestReceipt(): Record<string, unknown> {
    return {
        id: "single",
        title: "GrabFood",
        payerId: "p1",
        tax: 5000,
        service: 0,
        items: [
            {
                id: "i1",
                name: "Nasi Goreng",
                qty: 1,
                unitPrice: 30000,
                total: 30000,
                assignedToIds: ["p1"],
            },
            {
                id: "i2",
                name: "Es Teh",
                qty: 2,
                unitPrice: 8000,
                total: 16000,
                assignedToIds: ["p1", "p2"],
            },
        ],
        fees: [
            { id: "f1", label: "Delivery Fee", amount: 12000, splitMethod: "equal" },
            { id: "f2", label: "Platform Fee", amount: 2000, splitMethod: "equal" },
        ],
        discounts: [{ id: "d1", scope: "receipt", type: "amount", value: 10000 }],
    };
}

describe("import payload preserves the whole split", () => {
    it("keeps item assignments — the field the relational schema cannot store", () => {
        // item_assignments.user_id is an FK to users, so a guest participant can
        // never be recorded there. This is the entire reason for the payload.
        const payload = validateTripReceiptPayload(guestReceipt(), participantIds);
        expect(payload.items[0].assignedToIds).toEqual(["p1"]);
        expect(payload.items[1].assignedToIds).toEqual(["p1", "p2"]);
    });

    it("keeps fees", () => {
        const payload = validateTripReceiptPayload(guestReceipt(), participantIds);
        expect(payload.fees).toHaveLength(2);
        expect(payload.fees!.map((f) => f.amount)).toEqual([12000, 2000]);
    });

    it("keeps discounts", () => {
        const payload = validateTripReceiptPayload(guestReceipt(), participantIds);
        expect(payload.discounts).toHaveLength(1);
        expect(payload.discounts![0].value).toBe(10000);
    });

    it("keeps foreign currency and its locked rate", () => {
        const payload = validateTripReceiptPayload(
            { ...guestReceipt(), currency: "THB", fxRate: 465 },
            participantIds
        );
        expect(payload.currency).toBe("THB");
        expect(payload.fxRate).toBe(465);
    });

    it("keeps qty-based assignments", () => {
        const withQty = guestReceipt();
        (withQty.items as Record<string, unknown>[])[1].assignments = [
            { participantId: "p1", qty: 1 },
            { participantId: "p2", qty: 1 },
        ];
        const payload = validateTripReceiptPayload(withQty, participantIds);
        expect(payload.items[1].assignments).toEqual([
            { participantId: "p1", qty: 1 },
            { participantId: "p2", qty: 1 },
        ]);
    });

    it("survives a JSON round-trip unchanged (it is stored in a jsonb column)", () => {
        const payload = validateTripReceiptPayload(guestReceipt(), participantIds);
        expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
    });
});

// ---------------------------------------------------------------------------
// The symptom this fixes: a split that still computes correctly after migration
// ---------------------------------------------------------------------------

describe("a migrated receipt still computes a real split", () => {
    const ids = ["p1", "p2"];

    it("assigns a non-zero share to every participant", () => {
        const payload = validateTripReceiptPayload(guestReceipt(), participantIds);
        const summary = getReceiptSummary(payload as Receipt, ids);
        for (const share of summary.shares) {
            expect(share.total, `${share.participantId} owes nothing`).toBeGreaterThan(0);
        }
    });

    it("reproduces the OLD broken behaviour, as a guard against regressing to it", () => {
        // Exactly what the relational columns gave back: items, tax and service
        // survived; assignments, fees and discounts did not.
        const payload = validateTripReceiptPayload(guestReceipt(), participantIds) as Receipt;
        const asRelationalRow: Receipt = {
            ...payload,
            items: payload.items.map((i) => ({ ...i, assignedToIds: [], assignments: undefined })),
            fees: undefined,
            discounts: undefined,
        };

        const summary = getReceiptSummary(asRelationalRow, ids);

        // The bill still totals Rp 51.000...
        expect(summary.grandTotal).toBe(51000);

        // ...but with no assignees every subtotal is 0, so the food is owed by
        // nobody, and allocateTaxService's rounding-remainder fix dumps the
        // ENTIRE tax on whoever happens to sort first. Not merely incomplete —
        // arbitrarily wrong.
        expect(summary.shares.map((s) => s.subtotal)).toEqual([0, 0]);
        expect(summary.shares.find((s) => s.participantId === "p1")!.total).toBe(5000);
        expect(summary.shares.find((s) => s.participantId === "p2")!.total).toBe(0);

        // Rp 46.000 of a Rp 51.000 bill is accounted to no one at all.
        const owed = summary.shares.reduce((sum, s) => sum + s.total, 0);
        expect(summary.grandTotal - owed).toBe(46000);
    });

    it("the payer's fees and discounts reach the totals", () => {
        const payload = validateTripReceiptPayload(guestReceipt(), participantIds);
        const summary = getReceiptSummary(payload as Receipt, ids);
        // 46000 items + 5000 tax + 14000 fees = 65000 face value.
        expect(summary.grandTotal).toBe(65000);
        // 10000 off, so 55000 actually changes hands.
        expect(summary.amountPaid).toBe(55000);
    });

    it("every person's share sums back to what was actually paid", () => {
        const payload = validateTripReceiptPayload(guestReceipt(), participantIds);
        const summary = getReceiptSummary(payload as Receipt, ids);
        const sum = summary.shares.reduce((s, p) => s + p.total, 0);
        expect(Math.round(sum * 100) / 100).toBe(summary.amountPaid);
    });
});

// ---------------------------------------------------------------------------
// Failing loudly beats importing something wrong
// ---------------------------------------------------------------------------

describe("a payload that cannot be trusted is rejected, not silently trimmed", () => {
    it("rejects an item assigned to someone who is not a participant", () => {
        const bad = guestReceipt();
        (bad.items as Record<string, unknown>[])[0].assignedToIds = ["ghost"];
        expect(() => validateTripReceiptPayload(bad, participantIds)).toThrow(ValidationError);
    });

    it("rejects a payer who is not a participant", () => {
        expect(() =>
            validateTripReceiptPayload({ ...guestReceipt(), payerId: "ghost" }, participantIds)
        ).toThrow(ValidationError);
    });

    it("rejects a negative fee", () => {
        const bad = guestReceipt();
        bad.fees = [{ id: "f1", label: "Refund", amount: -5000, splitMethod: "equal" }];
        expect(() => validateTripReceiptPayload(bad, participantIds)).toThrow(ValidationError);
    });

    it("rejects a percent discount above 100", () => {
        const bad = guestReceipt();
        bad.discounts = [{ id: "d1", scope: "receipt", type: "percent", value: 150 }];
        expect(() => validateTripReceiptPayload(bad, participantIds)).toThrow(ValidationError);
    });

    it("names the offending field so the error is actionable", () => {
        const bad = guestReceipt();
        bad.fees = [{ id: "f1", label: "Bad", amount: -1, splitMethod: "equal" }];
        try {
            validateTripReceiptPayload(bad, participantIds);
            expect.unreachable("should have thrown");
        } catch (err) {
            expect((err as ValidationError).field).toMatch(/fees/);
        }
    });
});
