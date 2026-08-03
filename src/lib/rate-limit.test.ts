import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { checkRateLimit, checkRateLimitAsync } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T00:00:00Z"));
  });

  it("allows requests under the limit", () => {
    const result = checkRateLimit("test-key-1", 3, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks requests over the limit", () => {
    checkRateLimit("test-key-2", 2, 60_000);
    checkRateLimit("test-key-2", 2, 60_000);
    const blocked = checkRateLimit("test-key-2", 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("isolates buckets per key", () => {
    checkRateLimit("test-key-3a", 1, 60_000);
    const otherKey = checkRateLimit("test-key-3b", 1, 60_000);
    expect(otherKey.allowed).toBe(true);
  });

  it("re-allows after the window expires", () => {
    checkRateLimit("test-key-4", 1, 1000);
    const blocked = checkRateLimit("test-key-4", 1, 1000);
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(1100);

    const after = checkRateLimit("test-key-4", 1, 1000);
    expect(after.allowed).toBe(true);
  });
});

describe("checkRateLimitAsync (distributed flag gating)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses the in-memory limiter and never touches the network when the flag is OFF", async () => {
    vi.stubEnv("FLAG_DISTRIBUTED_RATE_LIMIT", "0");
    // Even with Upstash configured, an OFF flag must not reach out.
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://x.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await checkRateLimitAsync("async-off-key", 2, 60_000);
    expect(res.allowed).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to in-memory when the flag is ON but Upstash is unconfigured", async () => {
    vi.stubEnv("FLAG_DISTRIBUTED_RATE_LIMIT", "1");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await checkRateLimitAsync("async-noconfig-key", 2, 60_000);
    expect(res.allowed).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
