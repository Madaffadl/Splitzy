import { describe, expect, it } from "vitest";
import { isMultipleSplit, receiptsFromDetail } from "./receipt-detail";
import type { ReceiptDetail } from "@/lib/data/types";

// The flat columns and `receipts[]` describe the same split, but only the
// latter carries fees and discounts. These tests pin the bug that made
// /history/<id> and the editor disagree on the Grand Total.

function detail(overrides: Partial<ReceiptDetail> = {}): ReceiptDetail {
    return {
        id: "split-1",
        title: "Dinner",
        date: "2026-08-20",
        tax: 10_000,
        service: 5_000,
        payerId: "p1",
        createdById: "u1",
        tripId: null,
        tripName: null,
        participants: [{ id: "p1", name: "Alya" }],
        items: [
            { id: "i1", name: "Pizza", qty: 1, unitPrice: 95_000, total: 95_000, assignedToIds: ["p1"] },
        ],
        ...overrides,
    };
}

describe("receiptsFromDetail", () => {
    it("keeps the fees and discounts that only exist on receipts[]", () => {
        const d = detail({
            receipts: [
                {
                    id: "r1",
                    title: "Dinner",
                    payerId: "p1",
                    items: [
                        { id: "i1", name: "Pizza", qty: 1, unitPrice: 95_000, total: 95_000, assignedToIds: ["p1"] },
                    ],
                    tax: 10_000,
                    service: 5_000,
                    fees: [{ id: "f1", label: "Delivery", amount: 15_000, splitMethod: "equal" }],
                    discounts: [{ id: "d1", scope: "receipt", type: "amount", value: 50_000 }],
                },
            ],
        });

        const [receipt] = receiptsFromDetail(d);

        expect(receipt.fees).toHaveLength(1);
        expect(receipt.discounts).toHaveLength(1);
    });

    it("returns every receipt of a multi-receipt split, not just the first", () => {
        const d = detail({
            type: "multiple",
            receipts: [
                { id: "r1", title: "Lunch", payerId: "p1", items: [], tax: 0, service: 0 },
                { id: "r2", title: "Coffee", payerId: "p1", items: [], tax: 0, service: 0 },
            ],
        });

        expect(receiptsFromDetail(d)).toHaveLength(2);
    });

    it("synthesises a receipt from the flat columns when receipts[] is absent", () => {
        const [receipt] = receiptsFromDetail(detail());

        expect(receipt).toMatchObject({
            id: "split-1",
            title: "Dinner",
            date: "2026-08-20",
            payerId: "p1",
            tax: 10_000,
            service: 5_000,
        });
        expect(receipt.items).toHaveLength(1);
    });

    it("synthesises a receipt when receipts[] is present but empty", () => {
        // `detail.receipts ?? []` used to pass this straight through, which is
        // how a resumed split could open with no receipts at all.
        expect(receiptsFromDetail(detail({ receipts: [] }))).toHaveLength(1);
    });

    it("omits `date` rather than setting it to undefined when there is none", () => {
        const [receipt] = receiptsFromDetail(detail({ date: null }));
        expect("date" in receipt).toBe(false);
    });
});

describe("isMultipleSplit", () => {
    it("trusts an explicit type", () => {
        expect(isMultipleSplit(detail({ type: "multiple" }))).toBe(true);
        expect(
            isMultipleSplit(
                detail({
                    type: "single",
                    receipts: [
                        { id: "r1", title: "a", payerId: "p1", items: [], tax: 0, service: 0 },
                        { id: "r2", title: "b", payerId: "p1", items: [], tax: 0, service: 0 },
                    ],
                })
            )
        ).toBe(false);
    });

    it("infers multiple from an untyped row carrying several receipts", () => {
        expect(
            isMultipleSplit(
                detail({
                    receipts: [
                        { id: "r1", title: "a", payerId: "p1", items: [], tax: 0, service: 0 },
                        { id: "r2", title: "b", payerId: "p1", items: [], tax: 0, service: 0 },
                    ],
                })
            )
        ).toBe(true);
    });

    it("treats a legacy flat row as single", () => {
        expect(isMultipleSplit(detail())).toBe(false);
    });
});
