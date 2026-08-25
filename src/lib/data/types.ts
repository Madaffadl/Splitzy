import type { Participant, ReceiptItem, Receipt, Trip } from "@/types";

// Mirrors the SingleState from single/page.tsx
export interface SingleState {
  participants: Participant[];
  items: ReceiptItem[];
  title: string;
  tax: number;
  service: number;
  payerId: string;
}

// Mirrors the TripState from trip/page.tsx
export interface TripState {
  trip: Trip;
}

// A row in the saved-splits list.
export interface ReceiptRecord {
  id: string;
  title: string;
  date: string | null;
  totalAmount: number;
  participantCount: number;
  itemCount?: number;
  createdAt: string;
  tripName: string | null;
  tripId: string | null;
  /** When this saved split lapses. Null = never (Travel receipts). */
  expiresAt?: string | null;
  /** Short code of the read-only link, if one was created. */
  shareCode?: string | null;
}

/** What the server returns after a successful save. */
export interface SaveSplitResult {
  id: string;
  version: number;
  expiresAt: string | null;
  shareCode?: string | null;
  ttlDays: number;
}

/** The shape the editors save and resume: a whole split as one document. */
export interface SavedSplitPayload {
  type: "single" | "multiple";
  title: string;
  participants: Participant[];
  receipts: Receipt[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Full receipt detail from API (for history detail view)
export interface ReceiptDetail {
  id: string;
  title: string;
  date: string | null;
  tax: number;
  service: number;
  payerId: string;
  createdById: string;
  tripId: string | null;
  tripName: string | null;
  participants: Participant[];
  items: ReceiptItem[];
  /** Echoed back on save for optimistic concurrency. */
  version?: number;
  expiresAt?: string | null;
  shareCode?: string | null;
  /** Present on saved splits: the receipts that make up this split. */
  receipts?: Receipt[];
  type?: "single" | "multiple";
}
