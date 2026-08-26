import type {
  ReceiptRecord,
  PaginatedResult,
  ReceiptDetail,
  SavedSplitPayload,
  SaveSplitResult,
} from "./types";
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

  /**
   * Save a split (Single or Multiple) so it can be resumed later.
   *
   * Omit `id` to create, pass it with `expectedVersion` to update an existing
   * saved split. The version guard turns a concurrent save from another device
   * into a clear conflict rather than a silent overwrite.
   */
  async saveSplit(input: {
    id?: string;
    expectedVersion?: number;
    payload: SavedSplitPayload;
  }): Promise<SaveSplitResult> {
    const url = input.id ? `/api/receipts/${input.id}` : "/api/receipts";
    const res = await fetch(url, {
      method: input.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input.payload,
        ...(input.expectedVersion !== undefined
          ? { expectedVersion: input.expectedVersion }
          : {}),
      }),
    });

    if (!res.ok) {
      // Carry the server's message and code through: a version conflict needs
      // different handling from a validation failure, and the caller can only
      // tell them apart if we don't flatten both into one generic Error.
      const body = (await res.json().catch(() => null)) as
        | { error?: string; code?: string }
        | null;
      const err = new Error(body?.error || "Failed to save split.") as Error & {
        code?: string;
      };
      err.code = body?.code;
      throw err;
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

};
