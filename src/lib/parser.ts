import { ReceiptItem } from "@/types";
import { generateId, roundTo2 } from "./utils";

/**
 * Result from parsing a receipt text.
 */
export interface ParseResult {
    items: ReceiptItem[];
    tax: number;
    service: number;
}

/**
 * Interface for receipt parsers.
 */
export interface ReceiptParser {
    parse(input: string): ParseResult;
}

/**
 * Clean OCR text - remove common OCR noise and normalize
 */
function cleanOCRText(text: string): string {
    return text
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        // Fix common OCR mistakes
        .replace(/[|l]/g, (match, offset, str) => {
            // Only replace if it looks like it should be a number
            const before = str[offset - 1];
            const after = str[offset + 1];
            if (/\d/.test(before) || /\d/.test(after)) {
                return '1';
            }
            return match;
        })
        .replace(/[oO]/g, (match, offset, str) => {
            // Replace O with 0 if surrounded by numbers
            const before = str[offset - 1];
            const after = str[offset + 1];
            if (/\d/.test(before) && /\d/.test(after)) {
                return '0';
            }
            return match;
        })
        .trim();
}

/**
 * Parse Indonesian price format
 * Handles: 25.000, 25,000, 25000, Rp 25.000, Rp25000
 */
function parseIndonesianPrice(priceStr: string): number {
    // Remove Rp prefix and whitespace
    let cleaned = priceStr.replace(/^[Rr][Pp]\.?\s*/i, '').trim();

    // Remove any currency symbols
    cleaned = cleaned.replace(/[$€£¥]/g, '');

    // Handle Indonesian format: 25.000 or 150.000 (dots as thousand separators)
    // Pattern: 1-3 digits, then groups of .XXX
    if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
        cleaned = cleaned.replace(/\./g, '');
    }
    // Handle comma as thousand separator: 25,000 or 150,000
    else if (/^\d{1,3}(,\d{3})+$/.test(cleaned)) {
        cleaned = cleaned.replace(/,/g, '');
    }
    // Handle decimal with comma: 25,50 (European)
    else if (/^\d+,\d{1,2}$/.test(cleaned)) {
        cleaned = cleaned.replace(',', '.');
    }

    const value = parseFloat(cleaned);
    return isNaN(value) ? 0 : value;
}

/**
 * Extract quantity from item name
 * Patterns: "2x Nasi Goreng", "Nasi Goreng x2", "Nasi Goreng (2)", "2 Nasi Goreng"
 */
function extractQuantity(text: string): { qty: number; name: string } {
    // Pattern: "2x Item" or "2 x Item" or "2X Item"
    let match = text.match(/^(\d+)\s*[xX×]\s*(.+)/);
    if (match) {
        return { qty: parseInt(match[1], 10), name: match[2].trim() };
    }

    // Pattern: "Item x2" or "Item X2"
    match = text.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
    if (match) {
        return { qty: parseInt(match[2], 10), name: match[1].trim() };
    }

    // Pattern: "Item (2)" or "Item [2]"
    match = text.match(/^(.+?)\s*[\(\[](\d+)[\)\]]$/);
    if (match) {
        return { qty: parseInt(match[2], 10), name: match[1].trim() };
    }

    // Pattern: "2 Item" (number at start with space)
    match = text.match(/^(\d+)\s+(.{3,})/);
    if (match && parseInt(match[1], 10) <= 20) { // Max reasonable qty
        return { qty: parseInt(match[1], 10), name: match[2].trim() };
    }

    return { qty: 1, name: text.trim() };
}

/**
 * Check if line should be skipped (totals, headers, etc.)
 */
function shouldSkipLine(line: string): boolean {
    const skipPatterns = [
        // Totals
        /^(sub)?total/i,
        /^grand\s*total/i,
        /^jumlah/i,
        /^amount/i,
        /^bayar/i,

        // Payment methods
        /^(cash|tunai|kartu|card|debit|credit|kredit)/i,
        /^(visa|mastercard|bca|mandiri|gopay|ovo|dana|shopeepay)/i,
        /^(qris|qr\s*code)/i,
        /^(pembayaran|payment)/i,
        /^(kembalian|change|kembali)/i,

        // Headers and footers
        /^(terima\s*kasih|thank\s*you)/i,
        /^(selamat\s*datang|welcome)/i,
        /^(struk|receipt|invoice|nota)/i,
        /^(tanggal|date|waktu|time)/i,
        /^(kasir|cashier|server)/i,
        /^(meja|table|no\.?\s*(meja|table))/i,
        /^(order|pesanan)/i,
        /^(customer|pelanggan)/i,
        /^(alamat|address)/i,
        /^(telp|tel|phone|hp)/i,

        // Discounts and promos
        /^(diskon|discount|potongan)/i,
        /^(promo|voucher|coupon)/i,

        // Tips
        /^(tip|tips|gratuity)/i,

        // Other noise
        /^[-=_*#]{3,}/,  // Separator lines
        /^\d+$/, // Just numbers
        /^[A-Z]{2,3}\s*\d+/, // Receipt numbers like "TRX001"
        /^\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/, // Dates
        /^\d{2}:\d{2}/, // Times
    ];

    return skipPatterns.some(pattern => pattern.test(line.trim()));
}

/**
 * Check if line is tax
 */
function extractTax(line: string): number | null {
    const taxPatterns = [
        /^(tax|pajak|pb1|ppn|vat|pbr)\s*[:\s]\s*([\d.,]+)/i,
        /^(tax|pajak|pb1|ppn|vat|pbr)\s+([\d.,]+)/i,
        /(tax|pajak|pb1|ppn|vat|pbr)\s*[:\s]?\s*([\d.,]+)\s*$/i,
        /^(tax|pajak|pb1|ppn|vat|pbr)\s*\(?(\d+%?)\)?\s*([\d.,]+)/i,
    ];

    for (const pattern of taxPatterns) {
        const match = line.match(pattern);
        if (match) {
            // Get the last numeric group
            const priceStr = match[match.length - 1] || match[2];
            const value = parseIndonesianPrice(priceStr);
            if (value > 0) return value;
        }
    }
    return null;
}

/**
 * Check if line is service charge
 */
function extractService(line: string): number | null {
    const servicePatterns = [
        /^(service\s*charge|service|sc|svc)\s*[:\s]\s*([\d.,]+)/i,
        /^(service\s*charge|service|sc|svc)\s+([\d.,]+)/i,
        /(service\s*charge|service|sc|svc)\s*[:\s]?\s*([\d.,]+)\s*$/i,
        /^(service\s*charge|service|sc|svc)\s*\(?(\d+%?)\)?\s*([\d.,]+)/i,
    ];

    for (const pattern of servicePatterns) {
        const match = line.match(pattern);
        if (match) {
            const priceStr = match[match.length - 1] || match[2];
            const value = parseIndonesianPrice(priceStr);
            if (value > 0) return value;
        }
    }
    return null;
}

/**
 * Try to extract item and price from a line
 */
function extractItemFromLine(line: string): { name: string; qty: number; total: number } | null {
    // Clean the line
    const cleaned = cleanOCRText(line);

    // Skip short lines
    if (cleaned.length < 4) return null;

    // Multiple patterns to try (from most specific to least)
    const patterns = [
        // Pattern: "Item Name    Rp 25.000" or "Item Name Rp25000"
        /^(.+?)\s+[Rr][Pp]\.?\s*([\d.,]+)\s*$/,

        // Pattern: "Item Name    25.000" (with multiple spaces before price)
        /^(.+?)\s{2,}([\d.,]+)\s*$/,

        // Pattern: "Item Name @ 25.000 = 50.000" (with unit and total)
        /^(.+?)\s*@\s*[\d.,]+\s*[=x×]\s*([\d.,]+)\s*$/,

        // Pattern: "1 x Item Name    25.000"
        /^(\d+)\s*[xX×]\s*(.+?)\s+([\d.,]+)\s*$/,

        // Pattern: "Item Name 25.000" (basic, last resort)
        /^(.+?)\s+([\d.,]+)\s*$/,
    ];

    for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (match) {
            let name: string;
            let qty: number;
            let priceStr: string;

            // Handle "1 x Item 25.000" pattern
            if (match.length === 4 && /^\d+$/.test(match[1])) {
                qty = parseInt(match[1], 10);
                name = match[2].trim();
                priceStr = match[3];
            } else {
                name = match[1].trim();
                priceStr = match[2];
                const qtyExtract = extractQuantity(name);
                qty = qtyExtract.qty;
                name = qtyExtract.name;
            }

            const total = parseIndonesianPrice(priceStr);

            // Validation
            if (
                name.length >= 2 &&
                total > 0 &&
                total < 100000000 && // Max 100 juta per item
                qty >= 1 &&
                qty <= 100 // Max 100 qty per item
            ) {
                // Clean up name - remove trailing numbers/symbols
                name = name.replace(/[\d.,]+$/, '').trim();
                name = name.replace(/[-:@]$/, '').trim();

                // Still valid after cleanup?
                if (name.length >= 2) {
                    return { name, qty, total };
                }
            }
        }
    }

    return null;
}

/**
 * Improved receipt text parser for Indonesian receipts
 */
export class TextReceiptParser implements ReceiptParser {
    parse(input: string): ParseResult {
        const items: ReceiptItem[] = [];
        let tax = 0;
        let service = 0;

        // Split by lines and clean
        const lines = input
            .split(/[\n\r]+/)
            .map(l => l.trim())
            .filter(l => l.length > 0);

        for (const line of lines) {
            // Skip unwanted lines
            if (shouldSkipLine(line)) {
                continue;
            }

            // Check for tax
            const taxValue = extractTax(line);
            if (taxValue !== null) {
                tax = roundTo2(taxValue);
                continue;
            }

            // Check for service
            const serviceValue = extractService(line);
            if (serviceValue !== null) {
                service = roundTo2(serviceValue);
                continue;
            }

            // Try to extract item
            const item = extractItemFromLine(line);
            if (item) {
                items.push({
                    id: generateId(),
                    name: item.name,
                    qty: item.qty,
                    unitPrice: roundTo2(item.total / item.qty),
                    total: roundTo2(item.total),
                    assignedToIds: [],
                });
            }
        }

        return { items, tax, service };
    }
}

/**
 * Create a default parser instance.
 */
export function createParser(): ReceiptParser {
    return new TextReceiptParser();
}
