import type { SingleState, TripState, ReceiptRecord, PaginatedResult } from "./types";
import type { Participant } from "@/types";
import { calculateReceiptSubtotal } from "@/lib/calculations";

const SINGLE_KEY = "splitbill-single";
const TRIPS_KEY = "splitbill-trips";
const HISTORY_KEY = "splitzy-history";

function getFromStorage<T>(key: string, fallback: T): T {
  try {
    const item = window.localStorage.getItem(key);
    if (item) return JSON.parse(item);
  } catch {
    // ignore parse errors
  }
  return fallback;
}

function setToStorage<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

export const localDataService = {
  // History (local receipt records)
  getReceipts(params: {
    page: number;
    limit: number;
    search?: string;
  }): PaginatedResult<ReceiptRecord> {
    const all: ReceiptRecord[] = getFromStorage(HISTORY_KEY, []);
    let filtered = all;

    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = all.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.tripName?.toLowerCase().includes(q)
      );
    }

    // Sort by createdAt desc
    filtered.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const start = (params.page - 1) * params.limit;
    const data = filtered.slice(start, start + params.limit);

    return {
      data,
      total: filtered.length,
      page: params.page,
      limit: params.limit,
      hasMore: start + params.limit < filtered.length,
    };
  },

  persistReceipt(
    receipt: { title: string; tax: number; service: number; items: Array<{ total: number }> },
    participants: Participant[],
    tripName?: string
  ): void {
    const history: ReceiptRecord[] = getFromStorage(HISTORY_KEY, []);
    const subtotal = receipt.items.reduce((sum, item) => sum + item.total, 0);
    const totalAmount = subtotal + receipt.tax + receipt.service;

    history.unshift({
      id: `local-${Date.now()}`,
      title: receipt.title,
      date: new Date().toISOString(),
      totalAmount,
      participantCount: participants.length,
      createdAt: new Date().toISOString(),
      tripName: tripName ?? null,
      tripId: null,
    });

    setToStorage(HISTORY_KEY, history);
  },

  hasLocalData(): boolean {
    const single = window.localStorage.getItem(SINGLE_KEY);
    const trips = window.localStorage.getItem(TRIPS_KEY);

    if (single) {
      try {
        const data: SingleState = JSON.parse(single);
        if (data.items.length > 0) return true;
      } catch {
        // ignore
      }
    }

    if (trips) {
      try {
        const data: TripState = JSON.parse(trips);
        if (data.trip.receipts.length > 0) return true;
      } catch {
        // ignore
      }
    }

    return false;
  },

  getLocalDataForImport(): { single: SingleState | null; trip: TripState | null } {
    let single: SingleState | null = null;
    let trip: TripState | null = null;

    try {
      const singleRaw = window.localStorage.getItem(SINGLE_KEY);
      if (singleRaw) {
        const data: SingleState = JSON.parse(singleRaw);
        if (data.items.length > 0) single = data;
      }
    } catch {
      // ignore
    }

    try {
      const tripRaw = window.localStorage.getItem(TRIPS_KEY);
      if (tripRaw) {
        const data: TripState = JSON.parse(tripRaw);
        if (data.trip.receipts.length > 0) trip = data;
      }
    } catch {
      // ignore
    }

    return { single, trip };
  },

  clearImportedData(): void {
    window.localStorage.removeItem(SINGLE_KEY);
    window.localStorage.removeItem(TRIPS_KEY);
  },
};
