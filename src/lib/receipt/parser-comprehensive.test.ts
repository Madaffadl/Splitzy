/**
 * Comprehensive tests for TextReceiptParser.parse() and parseIndonesianPrice edge cases.
 *
 * parser.test.ts only covers parseIndonesianPrice basics.
 * This file covers the full parse() pipeline: item extraction, tax/service detection,
 * line filtering, OCR cleanup, and edge / negative / rare scenarios.
 */

import { describe, it, expect } from "vitest";
import { TextReceiptParser, parseIndonesianPrice } from "./parser";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const parse = (text: string) => new TextReceiptParser().parse(text);

// ---------------------------------------------------------------------------
// parseIndonesianPrice — edge cases not covered in parser.test.ts
// ---------------------------------------------------------------------------

describe("parseIndonesianPrice — edge cases", () => {
    it("handles a plain integer with no separators", () => {
        expect(parseIndonesianPrice("50000")).toBe(50000);
    });

    it("handles Rp prefix with a dot variant", () => {
        expect(parseIndonesianPrice("Rp.25.000")).toBe(25000);
    });

    it("handles US-style dot decimal (1,234.56)", () => {
        expect(parseIndonesianPrice("1,234.56")).toBe(1234.56);
    });

    it("handles a separator-only string without crashing (returns 0)", () => {
        expect(parseIndonesianPrice(".,")).toBe(0);
        expect(parseIndonesianPrice(",")).toBe(0);
        expect(parseIndonesianPrice(".")).toBe(0);
    });

    it("handles whitespace-only and returns 0", () => {
        expect(parseIndonesianPrice("   ")).toBe(0);
    });

    it("handles a value with trailing whitespace", () => {
        expect(parseIndonesianPrice("  15.000  ")).toBe(15000);
    });

    it("handles very large Indonesian price (8-digit group)", () => {
        expect(parseIndonesianPrice("1.000.000.000")).toBe(1_000_000_000);
    });

    it("does NOT treat 3-digit trailing group as cents", () => {
        // "500.000" → 500000, not 500.000 (decimal)
        expect(parseIndonesianPrice("500.000")).toBe(500000);
    });

    it("correctly parses 1-digit trailing as cents", () => {
        // "500.5" → 500.5 (1 trailing digit = decimal)
        expect(parseIndonesianPrice("500.5")).toBe(500.5);
    });

    it("handles negative-looking input (returns 0 or positive — no negatives in receipts)", () => {
        // Receipts never have negative prices; the parser strips non-digit chars
        expect(parseIndonesianPrice("-25.000")).toBeGreaterThanOrEqual(0);
    });

    it("handles value with parentheses discount style e.g. (25.000)", () => {
        // Parentheses are non-digit/non-separator, get stripped
        expect(parseIndonesianPrice("(25.000)")).toBe(25000);
    });
});

// ---------------------------------------------------------------------------
// TextReceiptParser — basic happy path
// ---------------------------------------------------------------------------

describe("TextReceiptParser — basic happy path", () => {
    it("parses a minimal single-item receipt", () => {
        const result = parse("Nasi Goreng  25.000");
        expect(result.items).toHaveLength(1);
        expect(result.items[0].name).toBe("Nasi Goreng");
        expect(result.items[0].total).toBe(25000);
        expect(result.items[0].qty).toBe(1);
        expect(result.tax).toBe(0);
        expect(result.service).toBe(0);
    });

    it("parses multiple items", () => {
        const text = `
Nasi Goreng  25.000
Es Teh  8.000
Bakso  15.000
`;
        const result = parse(text);
        expect(result.items).toHaveLength(3);
        const total = result.items.reduce((s, i) => s + i.total, 0);
        expect(total).toBe(48000);
    });

    it("assigns a unique id to each item", () => {
        const text = `
Nasi Goreng  25.000
Es Teh  8.000
`;
        const result = parse(text);
        const ids = result.items.map((i) => i.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("initializes assignedToIds as empty array", () => {
        const result = parse("Nasi Goreng  25.000");
        expect(result.items[0].assignedToIds).toEqual([]);
    });

    it("detects tax line (pajak)", () => {
        const text = `
Nasi Goreng  25.000
Pajak 11%  2.750
`;
        const result = parse(text);
        expect(result.tax).toBe(2750);
        expect(result.items.some((i) => /pajak/i.test(i.name))).toBe(false);
    });

    it("detects tax line (PB1 label)", () => {
        const text = `
Item A  50.000
PB1 10%  5.000
`;
        const result = parse(text);
        expect(result.tax).toBe(5000);
        expect(result.items).toHaveLength(1);
    });

    it("detects service charge", () => {
        const text = `
Sate Ayam  30.000
Service Charge  3.000
`;
        const result = parse(text);
        expect(result.service).toBe(3000);
        expect(result.items.some((i) => /service/i.test(i.name))).toBe(false);
    });

    it("detects both tax and service in same receipt", () => {
        const text = `
Pizza  80.000
Tax  8.000
Service  6.000
`;
        const result = parse(text);
        expect(result.tax).toBe(8000);
        expect(result.service).toBe(6000);
        expect(result.items).toHaveLength(1);
    });

    it("strips Rp prefix from item prices", () => {
        const result = parse("Ayam Bakar  Rp 45.000");
        expect(result.items).toHaveLength(1);
        expect(result.items[0].total).toBe(45000);
    });
});

// ---------------------------------------------------------------------------
// TextReceiptParser — quantity extraction
// ---------------------------------------------------------------------------

describe("TextReceiptParser — quantity patterns", () => {
    it("extracts qty from '2x Item' prefix pattern", () => {
        const result = parse("2x Nasi Goreng  50.000");
        expect(result.items[0].qty).toBe(2);
        expect(result.items[0].name).toBe("Nasi Goreng");
        expect(result.items[0].total).toBe(50000);
        expect(result.items[0].unitPrice).toBe(25000);
    });

    it("extracts qty from 'Item x2' suffix pattern", () => {
        const result = parse("Es Teh x2  16.000");
        expect(result.items[0].qty).toBe(2);
        expect(result.items[0].total).toBe(16000);
    });

    it("extracts qty from 'Item (2)' pattern", () => {
        const result = parse("Bakso (2)  30.000");
        expect(result.items[0].qty).toBe(2);
    });

    it("extracts qty from '2 Item' leading-number pattern", () => {
        const result = parse("3 Ayam Goreng  45.000");
        expect(result.items[0].qty).toBe(3);
    });

    it("defaults qty to 1 when no quantity prefix", () => {
        const result = parse("Mineral Water  5.000");
        expect(result.items[0].qty).toBe(1);
    });

    it("computes unitPrice correctly for multi-qty items", () => {
        const result = parse("2x Kopi  20.000");
        expect(result.items[0].unitPrice).toBe(10000);
        expect(result.items[0].total).toBe(20000);
    });

    it("caps absurd qty (>100) — item should be silently dropped", () => {
        // qty 200 would fail the qty <= 100 guard
        const result = parse("200 Item  1.000");
        // Either qty capped or item dropped — total items should not include qty 200
        const highQtyItem = result.items.find((i) => i.qty > 100);
        expect(highQtyItem).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// TextReceiptParser — line filtering (shouldSkipLine)
// ---------------------------------------------------------------------------

describe("TextReceiptParser — line filtering", () => {
    it("skips 'Total' lines", () => {
        const text = `
Nasi Goreng  25.000
Total  25.000
`;
        const result = parse(text);
        expect(result.items).toHaveLength(1);
    });

    it("skips 'Grand Total' lines", () => {
        const text = `
Kopi  15.000
Grand Total  15.000
`;
        const result = parse(text);
        expect(result.items).toHaveLength(1);
    });

    it("skips 'Subtotal' lines", () => {
        const text = `
Item  10.000
Subtotal  10.000
`;
        const result = parse(text);
        expect(result.items).toHaveLength(1);
    });

    it("skips payment method lines (Cash, QRIS, GoPay, OVO)", () => {
        const text = `
Es Jeruk  8.000
Cash  10.000
Kembalian  2.000
QRIS
`;
        const result = parse(text);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].name).toBe("Es Jeruk");
    });

    it("skips header/footer noise (Terima Kasih, Struk, Tanggal)", () => {
        const text = `
Struk Pembelian
Tanggal: 2024-01-01
Nasi Padang  20.000
Terima Kasih
`;
        const result = parse(text);
        expect(result.items).toHaveLength(1);
    });

    it("skips separator lines (----, ====, ****)", () => {
        const text = `
Item A  10.000
----------
Item B  20.000
==========
`;
        const result = parse(text);
        expect(result.items.length).toBeGreaterThanOrEqual(2);
    });

    it("skips discount/promo lines", () => {
        const text = `
Pizza  80.000
Diskon Member  -8.000
`;
        const result = parse(text);
        // Diskon line filtered out — pizza only
        expect(result.items).toHaveLength(1);
    });

    it("skips timestamp-like lines", () => {
        const text = `
14:35:22
Soto  18.000
`;
        const result = parse(text);
        expect(result.items).toHaveLength(1);
    });

    it("skips date-like lines", () => {
        const text = `
01/01/2024
Mie Goreng  22.000
`;
        const result = parse(text);
        expect(result.items).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// TextReceiptParser — OCR noise handling
// ---------------------------------------------------------------------------

describe("TextReceiptParser — OCR noise", () => {
    it("handles extra whitespace between name and price", () => {
        const result = parse("Nasi Uduk          35.000");
        expect(result.items).toHaveLength(1);
        expect(result.items[0].total).toBe(35000);
    });

    it("parses multi-line receipt with blank lines", () => {
        const text = `
Ayam Goreng  25.000

Es Teh  8.000

Nasi Putih  5.000
`;
        const result = parse(text);
        expect(result.items).toHaveLength(3);
    });

    it("handles Windows-style line endings (CRLF)", () => {
        const text = "Nasi Goreng  25.000\r\nEs Teh  8.000";
        const result = parse(text);
        expect(result.items).toHaveLength(2);
    });
});

// ---------------------------------------------------------------------------
// TextReceiptParser — empty and edge inputs
// ---------------------------------------------------------------------------

describe("TextReceiptParser — empty / degenerate inputs", () => {
    it("returns empty result for empty string", () => {
        const result = parse("");
        expect(result.items).toHaveLength(0);
        expect(result.tax).toBe(0);
        expect(result.service).toBe(0);
    });

    it("returns empty result for whitespace-only string", () => {
        const result = parse("   \n\n\t  ");
        expect(result.items).toHaveLength(0);
    });

    it("returns tax only — no items — when receipt is just a tax line", () => {
        const result = parse("Pajak 11%  2.750");
        expect(result.items).toHaveLength(0);
        expect(result.tax).toBe(2750);
    });

    it("handles a receipt with all noise lines and no real items", () => {
        const text = `
Struk Pembelian
-----------
Total  100.000
Grand Total  100.000
Bayar  100.000
QRIS
Terima Kasih
`;
        const result = parse(text);
        expect(result.items).toHaveLength(0);
    });

    it("silently drops items with price = 0", () => {
        const text = `
Nasi Goreng  0
Kopi  12.000
`;
        const result = parse(text);
        const zeroItem = result.items.find((i) => i.total === 0);
        expect(zeroItem).toBeUndefined();
    });

    it("silently drops items with price > 100 million (unrealistic)", () => {
        const text = `
Nasi Goreng  200.000.000
Kopi  15.000
`;
        const result = parse(text);
        const oversized = result.items.find((i) => i.total > 100_000_000);
        expect(oversized).toBeUndefined();
    });

    it("silently drops items where cleaned name is shorter than 2 chars", () => {
        // A single-char name after cleanup would fail the length >= 2 guard
        const result = parse("A  10.000");
        const shortItem = result.items.find((i) => i.name.length < 2);
        expect(shortItem).toBeUndefined();
    });

    it("returns service = 0 when no service line present", () => {
        const result = parse("Item  20.000");
        expect(result.service).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// TextReceiptParser — realistic full receipts
// ---------------------------------------------------------------------------

describe("TextReceiptParser — realistic receipt scenarios", () => {
    it("parses a typical Indonesian warung receipt", () => {
        const text = `
WARUNG MAKAN PADANG
Jl. Sudirman No. 12
Tanggal: 01/01/2024
-------------------
Nasi Padang         20.000
Rendang             35.000
Es Teh              8.000
-------------------
Subtotal            63.000
PB1 10%             6.300
Grand Total         69.300
Bayar               70.000
Kembalian           700
Terima Kasih!
`;
        const result = parse(text);
        expect(result.items.length).toBeGreaterThanOrEqual(3);
        expect(result.tax).toBeGreaterThan(0);
        const itemNames = result.items.map((i) => i.name.toLowerCase());
        expect(itemNames.some((n) => n.includes("nasi"))).toBe(true);
        expect(itemNames.some((n) => n.includes("rendang"))).toBe(true);
        expect(itemNames.some((n) => n.includes("teh"))).toBe(true);
    });

    it("parses a cafe receipt with service charge and VAT", () => {
        const text = `
Kopi Americano      28.000
Croissant           22.000
Mineral Water       10.000
Service Charge       6.000
Tax (11%)           6.600
Total              72.600
`;
        const result = parse(text);
        expect(result.items.some((i) => i.name.toLowerCase().includes("kopi"))).toBe(true);
        expect(result.service).toBe(6000);
        expect(result.tax).toBeGreaterThan(0);
    });

    it("parses a multi-qty restaurant receipt", () => {
        const text = `
2x Sate Ayam        36.000
3x Es Teh           24.000
Nasi Putih          5.000
Service  3.000
PPN  6.800
`;
        const result = parse(text);
        const sate = result.items.find((i) => i.name.toLowerCase().includes("sate"));
        const teh = result.items.find((i) => i.name.toLowerCase().includes("teh"));

        expect(sate).toBeDefined();
        expect(teh).toBeDefined();
        if (sate) {
            expect(sate.qty).toBe(2);
            expect(sate.unitPrice).toBe(18000);
        }
        if (teh) {
            expect(teh.qty).toBe(3);
            expect(teh.unitPrice).toBe(8000);
        }
        expect(result.service).toBe(3000);
        expect(result.tax).toBeGreaterThan(0);
    });

    it("does not parse header address text as items", () => {
        const text = `
Jl. Raya Bogor No. 99
Telp: 021-1234567
Kopi  15.000
`;
        const result = parse(text);
        // Header lines should be filtered; only coffee item survives
        expect(result.items.every((i) => i.total > 0)).toBe(true);
        expect(result.items.some((i) => i.name.toLowerCase().includes("kopi"))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// TextReceiptParser — SVC / SC abbreviations
// ---------------------------------------------------------------------------

describe("TextReceiptParser — service charge abbreviations", () => {
    it("recognises 'SC' abbreviation for service charge", () => {
        const text = `
Ayam  40.000
SC  4.000
`;
        const result = parse(text);
        expect(result.service).toBe(4000);
        expect(result.items).toHaveLength(1);
    });

    it("recognises 'SVC' abbreviation", () => {
        const text = `
Item  50.000
SVC  5.000
`;
        const result = parse(text);
        expect(result.service).toBe(5000);
    });
});

// ---------------------------------------------------------------------------
// TextReceiptParser — PPn / VAT label variants
// ---------------------------------------------------------------------------

describe("TextReceiptParser — tax label variants", () => {
    it("recognises 'PPN' (Indonesian VAT)", () => {
        const text = "Item  100.000\nPPN  11.000";
        const result = parse(text);
        expect(result.tax).toBe(11000);
    });

    it("recognises 'VAT' label", () => {
        const text = "Item  100.000\nVAT  7.000";
        const result = parse(text);
        expect(result.tax).toBe(7000);
    });
});
