// Distributed sliding-window rate limiter backed by Upstash Redis.
//
// Why: the in-memory limiter in rate-limit.ts is per-instance, so on Vercel's
// multi-instance serverless runtime each instance keeps its own counter and a
// determined caller can multiply the effective limit by the instance count.
// A shared Redis store gives one global counter (audit T-01).
//
// This talks to Upstash's REST API over fetch — no SDK/dependency, works on
// both the Edge and Node runtimes. It is gated behind the FLAG_DISTRIBUTED_
// RATE_LIMIT flag and only activates when both env vars are present; otherwise
// callers fall back to the in-memory limiter (see rate-limit.ts).
//
// Algorithm: a Redis sorted set per key, scored by timestamp. Each check
//   1. drops entries older than the window,
//   2. adds the current request,
//   3. counts what remains,
//   4. refreshes the TTL,
//   5. reads the oldest entry (to compute an accurate Retry-After).
// All five run in one pipelined round-trip.

import type { RateLimitResult } from "@/lib/rate-limit";

const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/** True only when Upstash credentials are configured in this environment. */
export function isDistributedRateLimitConfigured(): boolean {
  return Boolean(REST_URL && REST_TOKEN);
}

interface PipelineEntry {
  result?: unknown;
  error?: string;
}

/**
 * Redis-backed sliding-window check. Throws on any transport/Redis error so
 * the caller can fail open to the in-memory limiter rather than dropping the
 * request. Never call this without first checking isDistributedRateLimitConfigured().
 */
export async function checkRateLimitRedis(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (!REST_URL || !REST_TOKEN) {
    throw new Error("Upstash Redis is not configured");
  }

  const now = Date.now();
  const windowStart = now - windowMs;
  const redisKey = `rl:${key}`;
  // Unique member so simultaneous requests in the same millisecond don't
  // collide (a sorted set dedupes identical members).
  const member = `${now}-${Math.random().toString(36).slice(2)}`;

  const commands = [
    ["ZREMRANGEBYSCORE", redisKey, "0", String(windowStart)],
    ["ZADD", redisKey, String(now), member],
    ["ZCARD", redisKey],
    ["PEXPIRE", redisKey, String(windowMs)],
    ["ZRANGE", redisKey, "0", "0", "WITHSCORES"],
  ];

  const res = await fetch(`${REST_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    // Never let a slow store hang a request longer than the caller expects.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Upstash pipeline failed: HTTP ${res.status}`);
  }

  const payload = (await res.json()) as PipelineEntry[];
  if (!Array.isArray(payload) || payload.length < 5) {
    throw new Error("Upstash pipeline returned an unexpected shape");
  }
  const firstError = payload.find((entry) => entry?.error);
  if (firstError) {
    throw new Error(`Upstash command error: ${firstError.error}`);
  }

  const count = Number(payload[2]?.result ?? 0);
  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);

  let retryAfterMs = 0;
  if (!allowed) {
    // ZRANGE ... WITHSCORES → [member, score, ...]; the oldest score tells us
    // when the window frees up.
    const oldest = payload[4]?.result;
    const oldestScore = Array.isArray(oldest) ? Number(oldest[1]) : NaN;
    retryAfterMs = Number.isFinite(oldestScore)
      ? Math.max(0, oldestScore + windowMs - now)
      : windowMs;
  }

  return { allowed, remaining, retryAfterMs };
}
