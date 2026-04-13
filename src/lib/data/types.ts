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

// A receipt record for history display
export interface ReceiptRecord {
  id: string;
  title: string;
  date: string | null;
  totalAmount: number;
  participantCount: number;
  createdAt: string;
  tripName: string | null;
  tripId: string | null;
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
}
