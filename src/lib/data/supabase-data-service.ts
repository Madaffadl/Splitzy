import type { ReceiptRecord, PaginatedResult, ReceiptDetail } from "./types";
import type { Participant, ReceiptItem } from "@/types";

export const supabaseDataService = {
  async getReceipts(params: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<PaginatedResult<ReceiptRecord>> {
    const searchParams = new URLSearchParams({
      page: params.page.toString(),
      limit: params.limit.toString(),
    });
    if (params.search) {
      searchParams.set("search", params.search);
    }

    const res = await fetch(`/api/receipts?${searchParams}`);
    if (!res.ok) {
      throw new Error("Failed to fetch receipts");
    }
    return res.json();
  },

  async getReceiptDetail(id: string): Promise<ReceiptDetail> {
    const res = await fetch(`/api/receipts/${id}`);
    if (!res.ok) {
      throw new Error("Failed to fetch receipt detail");
    }
    const data = await res.json();
    return data.receipt;
  },

  async createReceipt(body: {
    title: string;
    payerId: string;
    tax: number;
    service: number;
    date?: string;
    tripId?: string;
    participantsJson?: Participant[];
    items: Array<{
      name: string;
      qty: number;
      unitPrice: number;
      total: number;
      assignedToUserIds: string[];
    }>;
  }): Promise<{ id: string }> {
    const res = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error("Failed to create receipt");
    }
    return res.json();
  },

  async deleteReceipt(id: string): Promise<void> {
    const res = await fetch(`/api/receipts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      throw new Error("Failed to delete receipt");
    }
  },

  // Trips
  async getTrips(): Promise<
    Array<{
      id: string;
      name: string;
      receiptCount: number;
      memberCount: number;
      createdAt: string;
    }>
  > {
    const res = await fetch("/api/trips");
    if (!res.ok) {
      throw new Error("Failed to fetch trips");
    }
    const data = await res.json();
    return data.trips;
  },

  async getTrip(id: string) {
    const res = await fetch(`/api/trips/${id}`);
    if (!res.ok) {
      throw new Error("Failed to fetch trip");
    }
    const data = await res.json();
    return data.trip;
  },

  async createTrip(body: { name: string }): Promise<{ id: string }> {
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error("Failed to create trip");
    }
    return res.json();
  },

  async importLocalData(data: {
    single: unknown;
    trip: unknown;
    idempotencyKey?: string;
  }): Promise<{ imported: number; replayed?: boolean }> {
    // Idempotency key: on network retry, the server returns the cached result
    // instead of re-importing. Caller may pass their own; default to a fresh
    // UUID per attempt.
    const idempotencyKey =
      data.idempotencyKey ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, idempotencyKey }),
    });
    if (!res.ok) {
      throw new Error("Failed to import data");
    }
    return res.json();
  },
};
