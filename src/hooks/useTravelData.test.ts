// @vitest-environment happy-dom
import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Receipt, TravelTrip } from "@/types";

// Control the auth state per test (hoisted so the mock factory can see it).
const hoisted = vi.hoisted(() => ({
  auth: { isAuthenticated: false, isLoading: false, dbUser: null as unknown },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => hoisted.auth }));

import { useTravelData } from "./useTravelData";

// Minimal fake Response: trackedFetch reads .ok/.status/.json() and .clone().json().
function jsonRes(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  const ok = init.ok ?? true;
  const status = init.status ?? (ok ? 200 : 400);
  const r = {
    ok,
    status,
    json: async () => body,
    clone() {
      return this;
    },
  };
  return r as unknown as Response;
}

const receipt = (id: string): Receipt => ({
  id,
  title: id,
  payerId: "a",
  items: [],
  tax: 0,
  service: 0,
});

const cloudTrip = (id: string, over: Partial<TravelTrip> = {}): TravelTrip => ({
  id,
  name: id,
  participants: [],
  receipts: [],
  version: 1,
  members: [],
  payments: [],
  ...over,
});

const asAuthed = () =>
  (hoisted.auth = { isAuthenticated: true, isLoading: false, dbUser: { id: "u1" } });

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  hoisted.auth = { isAuthenticated: false, isLoading: false, dbUser: null };
});

describe("useTravelData — guest (localStorage)", () => {
  it("creates a trip, adds a receipt, then deletes the trip", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    const { result } = renderHook(() => useTravelData());

    expect(result.current.trips).toEqual([]);
    await act(async () => {
      await result.current.createTrip("Bali");
    });
    expect(result.current.trips).toHaveLength(1);

    const id = result.current.trips[0].id;
    await act(async () => {
      await result.current.addReceipt(id, receipt("r1"));
    });
    expect(result.current.trips[0].receipts).toHaveLength(1);

    await act(async () => {
      await result.current.deleteTrip(id);
    });
    expect(result.current.trips).toEqual([]);
    // Guest mode never touches the network.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("useTravelData — cloud", () => {
  it("loads trips on mount (single request)", async () => {
    asAuthed();
    global.fetch = vi.fn().mockResolvedValueOnce(jsonRes({ trips: [cloudTrip("t1")] }));

    const { result } = renderHook(() => useTravelData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.trips).toHaveLength(1);
    expect(result.current.trips[0].id).toBe("t1");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("createTrip: optimistic add, then adopts the server id + version", async () => {
    asAuthed();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ trips: [] })) // loadCloud
      .mockResolvedValueOnce(jsonRes({ id: "server-1", version: 3 }, { status: 201 }));

    const { result } = renderHook(() => useTravelData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createTrip("New");
    });

    expect(result.current.trips).toHaveLength(1);
    expect(result.current.trips[0].id).toBe("server-1");
    expect(result.current.trips[0].version).toBe(3);
    expect(result.current.syncStatus).toBe("idle");
  });

  it("createTrip: server rejection removes the ghost trip and flags an error", async () => {
    asAuthed();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ trips: [] }))
      .mockResolvedValueOnce(jsonRes({ message: "nope" }, { ok: false, status: 500 }));

    const { result } = renderHook(() => useTravelData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createTrip("New");
    });

    expect(result.current.trips).toEqual([]);
    expect(result.current.syncStatus).toBe("error");
  });

  it("updateTrip: a 409 surfaces as a conflict", async () => {
    asAuthed();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ trips: [cloudTrip("t1", { version: 2 })] }))
      .mockResolvedValueOnce(jsonRes({ code: "VERSION_CONFLICT" }, { ok: false, status: 409 }));

    const { result } = renderHook(() => useTravelData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateTrip("t1", { name: "Renamed" });
    });

    expect(result.current.syncStatus).toBe("conflict");
  });

  it("addPayment: optimistic add, then rollback when the server rejects", async () => {
    asAuthed();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ trips: [cloudTrip("t1")] }))
      .mockResolvedValueOnce(jsonRes({ message: "bad" }, { ok: false, status: 400 }));

    const { result } = renderHook(() => useTravelData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addPayment("t1", { from: "b", to: "a", amount: 50 });
    });

    expect(result.current.trips[0].payments ?? []).toEqual([]);
    expect(result.current.syncStatus).toBe("error");
  });

  it("restoreTrip: re-adds the trip and calls the restore endpoint", async () => {
    asAuthed();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ trips: [] })) // loadCloud
      .mockResolvedValueOnce(jsonRes({ ok: true })); // restore
    global.fetch = fetchMock;

    const { result } = renderHook(() => useTravelData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.restoreTrip(cloudTrip("t9", { name: "Recovered" }));
    });

    expect(result.current.trips.map((t) => t.id)).toContain("t9");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/travel/t9/restore", { method: "POST" });
  });

  it("addPayment: success replaces the optimistic row with the server payment", async () => {
    asAuthed();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ trips: [cloudTrip("t1")] }))
      .mockResolvedValueOnce(
        jsonRes({ id: "pay-1", from: "b", to: "a", amount: 50 }, { status: 201 })
      );

    const { result } = renderHook(() => useTravelData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addPayment("t1", { from: "b", to: "a", amount: 50 });
    });

    expect(result.current.trips[0].payments).toHaveLength(1);
    expect(result.current.trips[0].payments![0].id).toBe("pay-1");
  });

  it("addReceipt: durable via the outbox and synced to the server", async () => {
    asAuthed();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ trips: [cloudTrip("t1")] })) // loadCloud
      .mockResolvedValueOnce(jsonRes({ id: "r1" }, { status: 201 })); // POST /receipts

    const { result } = renderHook(() => useTravelData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addReceipt("t1", receipt("r1"));
    });

    // Optimistically visible straight away…
    expect(result.current.trips[0].receipts.map((r) => r.id)).toEqual(["r1"]);
    // …persisted to the local mirror (survives reload)…
    expect(localStorage.getItem("splitzy-travel-mirror")).toContain("r1");
    // …and drained to the server, after which nothing is pending.
    await waitFor(() => expect(result.current.pendingSync).toBe(false));
    expect(global.fetch).toHaveBeenLastCalledWith(
      "/api/travel/t1/receipts",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("addReceipt: offline stays durable and pending, without hitting the network", async () => {
    asAuthed();
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    try {
      global.fetch = vi.fn().mockResolvedValueOnce(jsonRes({ trips: [cloudTrip("t1")] })); // loadCloud only

      const { result } = renderHook(() => useTravelData());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.addReceipt("t1", receipt("r1"));
      });

      // The receipt is saved locally and flagged as pending sync — no data lost —
      // and no receipt request was attempted while offline.
      expect(result.current.trips[0].receipts).toHaveLength(1);
      expect(result.current.pendingSync).toBe(true);
      expect(result.current.isOnline).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(1); // just the initial load
      // The op is persisted so it survives a reload until connectivity returns.
      expect(localStorage.getItem("splitzy-travel-outbox")).toContain("r1");
    } finally {
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    }
  });
});
