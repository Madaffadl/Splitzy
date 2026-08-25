/**
 * Tests for saved splits — Single/Multiple parked on the server so they can be
 * resumed later.
 *
 * The two behaviours worth pinning are the ones a user would notice going
 * wrong: a work-in-progress split must be savable (draft mode), and a saved
 * split must come back byte-for-byte, assignments and fees included.
 */

import { describe, it, expect } from "vitest";
import {
    validateSavedSplit,
    savedSplitExpiryFromNow,
    daysUntilExpiry,
    SAVED_SPLIT_TTL_DAYS,
} from "./saved-splits";
import { validateSharedReceipts } from "./shared-summary";
import { ValidationError } from "./validation";
import { getReceiptSummary } from "./calculations";
import type { Receipt } from "@/types";

const participants = [
    { id: "p1", name: "Budi" },
    { id: "p2", name: "Sari" },
];

/** A finished split: payer chosen, everything assigned. */
function completeSplit(): Record<string, unknown> {
    return {
        type: "single",
        title: "Dinner",
        participants,
        receipts: [
            {
                id: "r1",
                title: "Dinner",
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
                        assignedToIds: ["p1", "p2"],
                    },
                ],
                fees: [{ id: "f1", label: "Delivery", amount: 10000, splitMethod: "equal" }],
                discounts: [{ id: "d1", scope: "receipt", type: "amount", value: 5000 }],
            },
        ],
    };
}

/** Work in progress: no payer yet, an item still being typed. */
function draftSplit(): Record<string, unknown> {
    return {
        type: "single",
        title: "Lunch",
        participants,
        receipts: [
            {
                id: "r1",
                title: "Lunch",
                payerId: "",
                tax: 0,
                service: 0,
                items: [
                    { id: "i1", name: "", qty: 1, unitPrice: 0, total: 0, assignedToIds: [] },
                ],
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// TTL helpers
// ---------------------------------------------------------------------------

describe("saved split expiry", () => {
    it("expires SAVED_SPLIT_TTL_DAYS after the save", () => {
        const now = Date.UTC(2026, 0, 1);
        const expiry = savedSplitExpiryFromNow(now);
        expect(expiry.getTime() - now).toBe(SAVED_SPLIT_TTL_DAYS * 24 * 60 * 60 * 1000);
    });

    it("counts whole days remaining", () => {
        const now = Date.UTC(2026, 0, 1);
        expect(daysUntilExpiry(savedSplitExpiryFromNow(now), now)).toBe(SAVED_SPLIT_TTL_DAYS);
    });

    it("floors at 0 once lapsed rather than going negative", () => {
        const now = Date.UTC(2026, 0, 10);
        expect(daysUntilExpiry(new Date(Date.UTC(2026, 0, 1)), now)).toBe(0);
    });

    it("reads 0 exactly at the deadline", () => {
        const now = Date.UTC(2026, 0, 1);
        expect(daysUntilExpiry(new Date(now), now)).toBe(0);
    });

    it("accepts an ISO string as well as a Date", () => {
        const now = Date.UTC(2026, 0, 1);
        const iso = savedSplitExpiryFromNow(now).toISOString();
        expect(daysUntilExpiry(iso, now)).toBe(SAVED_SPLIT_TTL_DAYS);
    });
});

// ---------------------------------------------------------------------------
// Draft mode — the point of the feature
// ---------------------------------------------------------------------------

describe("validateSavedSplit — work in progress", () => {
    it("accepts a split with no payer chosen yet", () => {
        const out = validateSavedSplit(draftSplit());
        expect(out.receipts[0].payerId).toBe("");
    });

    it("accepts an item whose name is still empty", () => {
        const out = validateSavedSplit(draftSplit());
        expect(out.receipts[0].items[0].name).toBe("");
    });

    it("accepts items assigned to nobody yet", () => {
        const out = validateSavedSplit(draftSplit());
        expect(out.receipts[0].items[0].assignedToIds).toEqual([]);
    });

    it("still refuses a payer who is not a participant", () => {
        // Relaxing "not chosen yet" must not also relax "points at a ghost" — a
        // stale id would produce a phantom credit the moment it is resumed.
        const bad = draftSplit();
        (bad.receipts as Record<string, unknown>[])[0].payerId = "ghost";
        expect(() => validateSavedSplit(bad)).toThrow(ValidationError);
    });

    it("still refuses an item assigned to a ghost participant", () => {
        const bad = draftSplit();
        (bad.receipts as Record<string, unknown>[])[0].items = [
            { id: "i1", name: "X", qty: 1, unitPrice: 1, total: 1, assignedToIds: ["ghost"] },
        ];
        expect(() => validateSavedSplit(bad)).toThrow(ValidationError);
    });

    it("still enforces the money ceiling", () => {
        const bad = draftSplit();
        (bad.receipts as Record<string, unknown>[])[0].tax = 5_000_000_000;
        expect(() => validateSavedSplit(bad)).toThrow(ValidationError);
    });

    it("still refuses a malformed fee", () => {
        const bad = draftSplit();
        (bad.receipts as Record<string, unknown>[])[0].fees = [
            { id: "f1", label: "Bad", amount: -1, splitMethod: "equal" },
        ];
        expect(() => validateSavedSplit(bad)).toThrow(ValidationError);
    });

    it("requires at least one receipt", () => {
        expect(() => validateSavedSplit({ ...draftSplit(), receipts: [] })).toThrow(
            ValidationError
        );
    });

    it("rejects a non-object body", () => {
        expect(() => validateSavedSplit(null)).toThrow(ValidationError);
        expect(() => validateSavedSplit("nope")).toThrow(ValidationError);
    });
});

// ---------------------------------------------------------------------------
// Strict mode is unchanged — drafts must not weaken finished splits
// ---------------------------------------------------------------------------

describe("non-draft validation still demands a payer", () => {
    const ids = new Set(["p1", "p2"]);

    it("rejects an empty payerId when draft is off", () => {
        // Item name is filled in so payerId is the only thing left to fail on —
        // items are validated first, and would otherwise mask this.
        const receipts = [
            {
                id: "r1",
                title: "X",
                payerId: "",
                tax: 0,
                service: 0,
                items: [{ id: "i1", name: "Kopi", qty: 1, unitPrice: 1, total: 1, assignedToIds: [] }],
            },
        ];
        expect(() => validateSharedReceipts(receipts, ids)).toThrow(/payerId/);
    });

    it("rejects an empty item name when draft is off", () => {
        const receipts = [
            {
                id: "r1",
                title: "X",
                payerId: "p1",
                tax: 0,
                service: 0,
                items: [{ id: "i1", name: "", qty: 1, unitPrice: 1, total: 1, assignedToIds: [] }],
            },
        ];
        expect(() => validateSharedReceipts(receipts, ids)).toThrow(/name/);
    });

    it("accepts the same receipts once draft is on", () => {
        const receipts = [(draftSplit().receipts as unknown[])[0]];
        expect(validateSharedReceipts(receipts, ids, { draft: true })).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// Round-trip: what you save is what you get back
// ---------------------------------------------------------------------------

describe("a saved split resumes intact", () => {
    it("keeps type, title and participants", () => {
        const out = validateSavedSplit(completeSplit());
        expect(out.type).toBe("single");
        expect(out.title).toBe("Dinner");
        expect(out.participants.map((p) => p.id)).toEqual(["p1", "p2"]);
    });

    it("keeps assignments, fees and discounts", () => {
        const out = validateSavedSplit(completeSplit());
        const r = out.receipts[0];
        expect(r.items[0].assignedToIds).toEqual(["p1", "p2"]);
        expect(r.fees).toHaveLength(1);
        expect(r.discounts).toHaveLength(1);
    });

    it("survives the JSON round-trip it gets stored through", () => {
        const out = validateSavedSplit(completeSplit());
        expect(JSON.parse(JSON.stringify(out))).toEqual(out);
    });

    it("still computes the same split after being reloaded", () => {
        const out = validateSavedSplit(completeSplit());
        const reloaded = JSON.parse(JSON.stringify(out)) as typeof out;
        const before = getReceiptSummary(out.receipts[0] as Receipt, ["p1", "p2"]);
        const after = getReceiptSummary(reloaded.receipts[0] as Receipt, ["p1", "p2"]);
        expect(after.grandTotal).toBe(before.grandTotal);
        expect(after.amountPaid).toBe(before.amountPaid);
        expect(after.shares.map((s) => s.total)).toEqual(before.shares.map((s) => s.total));
    });

    it("defaults type to single for anything that isn't multiple", () => {
        expect(validateSavedSplit({ ...completeSplit(), type: "weird" }).type).toBe("single");
        expect(validateSavedSplit({ ...completeSplit(), type: undefined }).type).toBe("single");
    });

    it("keeps type multiple when asked", () => {
        expect(validateSavedSplit({ ...completeSplit(), type: "multiple" }).type).toBe(
            "multiple"
        );
    });

    it("falls back to a placeholder title rather than saving an empty one", () => {
        expect(validateSavedSplit({ ...completeSplit(), title: "   " }).title).toBe(
            "Untitled split"
        );
    });

    it("carries several receipts for a Multiple split", () => {
        const multi = completeSplit();
        multi.type = "multiple";
        multi.receipts = [
            (multi.receipts as unknown[])[0],
            {
                id: "r2",
                title: "Drinks",
                payerId: "p2",
                tax: 0,
                service: 0,
                items: [
                    { id: "i2", name: "Kopi", qty: 2, unitPrice: 15000, total: 30000, assignedToIds: ["p2"] },
                ],
            },
        ];
        const out = validateSavedSplit(multi);
        expect(out.receipts).toHaveLength(2);
        expect(out.receipts[1].payerId).toBe("p2");
    });
});
