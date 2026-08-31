import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function generateId(): string {
    return Math.random().toString(36).substring(2, 11);
}

/**
 * A real UUID, for rows whose primary key is a `@db.Uuid` column.
 *
 * Optimistic rows need an id before the server has assigned one, and the
 * placeholder is what the UI addresses the row by. When that placeholder was a
 * `generateId()` token, deleting the row before its POST came back sent
 * `DELETE .../payments/cyzfjp6vz` — a 9-char base36 string into a uuid column,
 * which Prisma rejects outright. Minting a UUID client-side instead means the
 * optimistic id IS the row id: nothing to swap, nothing to get caught halfway.
 */
export function generateUuid(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    // Older WebViews / insecure contexts: RFC-4122 v4 from getRandomValues, or
    // Math.random as the last resort (ids only need to be collision-free here).
    const bytes = new Uint8Array(16);
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Today's date as a local `YYYY-MM-DD` string (no UTC/timezone drift). */
export function todayDateString(): string {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
}

export function roundTo2(n: number): number {
    return Math.round(n * 100) / 100;
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.round(amount));
}
