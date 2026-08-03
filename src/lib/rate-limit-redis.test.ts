import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The module reads UPSTASH_* env at import time, so each test stubs the env
// then re-imports through a fresh registry.
async function loadWith(url: string | undefined, token: string | undefined) {
  vi.resetModules();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", url ?? "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", token ?? "");
  return import("./rate-limit-redis");
}

function pipelineResponse(entries: Array<{ result?: unknown; error?: string }>) {
  return {
    ok: true,
    status: 200,
    json: async () => entries,
  } as Response;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("isDistributedRateLimitConfigured", () => {
  it("is false when either credential is missing", async () => {
    const a = await loadWith(undefined, undefined);
    expect(a.isDistributedRateLimitConfigured()).toBe(false);

    const b = await loadWith("https://x.upstash.io", undefined);
    expect(b.isDistributedRateLimitConfigured()).toBe(false);
  });

  it("is true when both credentials are present", async () => {
    const m = await loadWith("https://x.upstash.io", "tok");
    expect(m.isDistributedRateLimitConfigured()).toBe(true);
  });
});

describe("checkRateLimitRedis", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  });

  it("allows when count is within the limit", async () => {
    const { checkRateLimitRedis } = await loadWith("https://x.upstash.io", "tok");
    const fetchMock = vi.fn().mockResolvedValue(
      pipelineResponse([
        { result: 0 }, // ZREMRANGEBYSCORE
        { result: 1 }, // ZADD
        { result: 3 }, // ZCARD → 3 requests in window
        { result: 1 }, // PEXPIRE
        { result: [] }, // ZRANGE oldest
      ])
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await checkRateLimitRedis("scope:u:1", 10, 60_000);
    expect(res).toEqual({ allowed: true, remaining: 7, retryAfterMs: 0 });

    // Sanity-check the request shape.
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://x.upstash.io/pipeline");
    expect(init.headers.Authorization).toBe("Bearer tok");
    const commands = JSON.parse(init.body);
    expect(commands).toHaveLength(5);
    expect(commands[2]).toEqual(["ZCARD", "rl:scope:u:1"]);
  });

  it("blocks when count exceeds the limit and derives Retry-After from the oldest entry", async () => {
    const { checkRateLimitRedis } = await loadWith("https://x.upstash.io", "tok");
    const oldest = 1_000_000 - 40_000; // 40s ago, window 60s → 20s remaining
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        pipelineResponse([
          { result: 0 },
          { result: 1 },
          { result: 11 }, // over the limit of 10
          { result: 1 },
          { result: ["member", String(oldest)] },
        ])
      )
    );

    const res = await checkRateLimitRedis("scope:ip:1.2.3.4", 10, 60_000);
    expect(res.allowed).toBe(false);
    expect(res.remaining).toBe(0);
    expect(res.retryAfterMs).toBe(20_000);
  });

  it("throws on HTTP error so the caller can fall back", async () => {
    const { checkRateLimitRedis } = await loadWith("https://x.upstash.io", "tok");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response)
    );
    await expect(checkRateLimitRedis("k", 10, 60_000)).rejects.toThrow(/HTTP 500/);
  });

  it("throws when a Redis command reports an error", async () => {
    const { checkRateLimitRedis } = await loadWith("https://x.upstash.io", "tok");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        pipelineResponse([
          { result: 0 },
          { error: "WRONGTYPE" },
          { result: 1 },
          { result: 1 },
          { result: [] },
        ])
      )
    );
    await expect(checkRateLimitRedis("k", 10, 60_000)).rejects.toThrow(/WRONGTYPE/);
  });
});
