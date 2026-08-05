import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// realtime.ts reads env at module load (Supabase URL + service key) and the
// flag via flags.ts (also module-load). So we set env, reset modules, and
// dynamic-import a fresh copy per scenario — same pattern as admin-auth.test.
const ORIGINAL = { ...process.env };

function setEnv(env: Record<string, string | undefined>) {
  process.env = { ...ORIGINAL, ...env };
}

async function loadWithFetch(env: Record<string, string | undefined>) {
  setEnv(env);
  vi.resetModules();
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  const mod = await import("./realtime");
  return { mod, fetchMock };
}

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("broadcastTripChange", () => {
  const KEYS = {
    NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  };

  it("is inert when the realtime flag is off", async () => {
    const { mod, fetchMock } = await loadWithFetch({ ...KEYS, NEXT_PUBLIC_FLAG_REALTIME: "0" });
    await mod.broadcastTripChange("trip-1", { kind: "receipt", actorId: "u1" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is inert when the service-role key is missing", async () => {
    const { mod, fetchMock } = await loadWithFetch({
      NEXT_PUBLIC_SUPABASE_URL: KEYS.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      NEXT_PUBLIC_FLAG_REALTIME: "1",
    });
    await mod.broadcastTripChange("trip-1", { kind: "receipt", actorId: "u1" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a signal-only broadcast with the right topic, event, and payload when enabled", async () => {
    const { mod, fetchMock } = await loadWithFetch({ ...KEYS, NEXT_PUBLIC_FLAG_REALTIME: "1" });
    await mod.broadcastTripChange("trip-1", { kind: "trip", actorId: "u1", version: 7 });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://proj.supabase.co/realtime/v1/api/broadcast");
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe("service-role-key");
    expect(headers.Authorization).toBe("Bearer service-role-key");

    const body = JSON.parse(init.body as string);
    const message = body.messages[0];
    expect(message.topic).toBe("trip:trip-1");
    expect(message.event).toBe("trip.changed");
    expect(message.payload).toMatchObject({ tripId: "trip-1", kind: "trip", actorId: "u1", version: 7 });
    // Signal only — no trip data (receipts/participants/amounts) in the payload.
    const payloadKeys = Object.keys(message.payload).sort();
    expect(payloadKeys).toEqual(["actorId", "kind", "tripId", "v", "version"]);
  });

  it("never throws when the broadcast request fails", async () => {
    setEnv({ ...KEYS, NEXT_PUBLIC_FLAG_REALTIME: "1" });
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const mod = await import("./realtime");
    await expect(
      mod.broadcastTripChange("trip-1", { kind: "payment", actorId: "u1" })
    ).resolves.toBeUndefined();
  });
});
