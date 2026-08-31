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

  // ── Optimistic locking ────────────────────────────────────────────────────
  // A trip PUT is version-checked, so the version the client sends has to be the
  // one the server last wrote. Three cases, and only the third is a real
  // conflict the user should ever hear about.

  it("updateTrip: back-to-back edits send the version the previous save returned", async () => {
    asAuthed();
    let serverVersion = 1;
    const sent: (number | undefined)[] = [];
    global.fetch = vi.fn(async (input: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as { expectedVersion?: number };
        sent.push(body.expectedVersion);
        if (body.expectedVersion !== serverVersion) {
          return jsonRes({ code: "VERSION_CONFLICT", currentVersion: serverVersion }, { ok: false, status: 409 });
        }
        serverVersion += 1;
        return jsonRes({ ok: true, version: serverVersion });
      }
      return jsonRes({ trips: [cloudTrip("t1", { version: 1 })] });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useTravelData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Typing a name and then nudging the budget, without waiting in between.
    // The second PUT used to re-send version 1 — which the first PUT had already
    // consumed — so the only editor of the trip was told it had changed
    // elsewhere and offered a reload that discarded what they had just typed.
    await act(async () => {
      await Promise.all([
        result.current.updateTrip("t1", { name: "Bali" }),
        result.current.updateTrip("t1", { budget: 5_000_000 }),
      ]);
    });

    expect(sent).toEqual([1, 2]);
    expect(result.current.syncStatus).not.toBe("conflict");
  });

  it("updateTrip: a stale version is rebased onto the server's and retried silently", async () => {
    asAuthed();
    const sent: (number | undefined)[] = [];
    global.fetch = vi.fn(async (input: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as { expectedVersion?: number };
        sent.push(body.expectedVersion);
        // The trip moved to 7 while we held 1 (another tab, an approved change
        // request, an interrupted save).
        if (body.expectedVersion !== 7) {
          return jsonRes({ code: "VERSION_CONFLICT", currentVersion: 7 }, { ok: false, status: 409 });
        }
        return jsonRes({ ok: true, version: 8 });
      }
      return jsonRes({ trips: [cloudTrip("t1", { version: 1 })] });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useTravelData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateTrip("t1", { name: "Renamed" });
    });

    expect(sent).toEqual([1, 7]);
    expect(result.current.trips[0].name).toBe("Renamed");
    expect(result.current.syncStatus).not.toBe("conflict");
  });

  it("updateTrip: a conflict that survives the retry does reach the user", async () => {
    asAuthed();
    // Every PUT loses — a genuinely concurrent editor, not a stale local version.
    global.fetch = vi.fn(async (input: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return jsonRes({ code: "VERSION_CONFLICT", currentVersion: 99 }, { ok: false, status: 409 });
      }
      return jsonRes({ trips: [cloudTrip("t1", { version: 2 })] });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useTravelData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateTrip("t1", { name: "Renamed" });
    });

    await waitFor(() => expect(result.current.syncStatus).toBe("conflict"));
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

  // ── Payment ids ───────────────────────────────────────────────────────────
  // `trip_payments.id` is a uuid column, so the id an optimistic payment is
  // painted with has to be one the server can adopt verbatim. It used to be a
  // 9-char generateId() token, which meant every path that addressed a payment
  // before its POST returned handed a non-UUID to Prisma — the driver rejects it
  // before Postgres is even asked, and the route 500s.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it("addPayment: mints a UUID and sends it as the row id", async () => {
    asAuthed();
    let posted: { id?: string } | null = null;
    global.fetch = vi.fn(async (input: string, init?: RequestInit) => {
      if (String(input).endsWith("/payments") && init?.method === "POST") {
        posted = JSON.parse(String(init.body)) as { id?: string };
        return jsonRes({ ...posted, createdAt: "2026-01-01T00:00:00.000Z" }, { status: 201 });
      }
      return jsonRes({ trips: [cloudTrip("t1")] });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useTravelData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addPayment("t1", { from: "b", to: "a", amount: 50 });
    });

    expect(posted!.id).toMatch(UUID_RE);
    expect(result.current.trips[0].payments![0].id).toBe(posted!.id);
  });

  it("deletePayment: queues behind the add, and addresses the same UUID", async () => {
    asAuthed();
    const calls: string[] = [];
    let releasePost = () => {};
    let postStarted = (_id: string) => {};
    const postedId = new Promise<string>((resolve) => (postStarted = resolve));

    global.fetch = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/payments") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { id: string };
        calls.push(`POST ${url}`);
        postStarted(body.id);
        // Hold the POST open so the delete is issued while it is still in flight
        // — the exact double-tap on a "share paid" checkbox from the bug report.
        await new Promise<void>((r) => (releasePost = r));
        return jsonRes({ ...body, createdAt: "2026-01-01T00:00:00.000Z" }, { status: 201 });
      }
      if (init?.method === "DELETE") {
        calls.push(`DELETE ${url}`);
        return jsonRes({ ok: true });
      }
      return jsonRes({ trips: [cloudTrip("t1")] });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useTravelData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      const add = result.current.addPayment("t1", { from: "b", to: "a", amount: 50 });
      const paymentId = await postedId;
      const del = result.current.deletePayment("t1", paymentId);
      releasePost();
      await Promise.all([add, del]);
      expect(paymentId).toMatch(UUID_RE);
    });

    // The delete must land after the add, so the row it names already exists.
    // Unordered, the server kept a payment the UI had already dropped — a
    // settle-up that reappeared by itself on the next refetch.
    expect(calls).toEqual([
      "POST /api/travel/t1/payments",
      `DELETE /api/travel/t1/payments/${await postedId}`,
    ]);
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
