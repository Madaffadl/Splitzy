// In-memory sliding-window rate limiter.
//
// Caveats:
//   * Per-instance only — on multi-instance serverless platforms (Vercel,
//     etc.) each instance keeps its own counter, so a determined attacker
//     can hit each instance up to the limit. This is a best-effort guard
//     against accidental abuse and casual scraping; production-grade
//     protection requires a shared store (Upstash Redis, Vercel KV).
//   * Memory grows with unique keys; we evict expired entries lazily on
//     access and proactively cap the map size.
//
// TODO(Sprint 2): swap to a shared-store implementation. The public surface
// (`checkRateLimit`, `enforceRateLimit`, `RateLimitResult`) is intentionally
// store-agnostic so the swap is a one-file change.

import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function evictExpired(bucket: Bucket, windowMs: number, now: number): number[] {
  const cutoff = now - windowMs;
  // Drop timestamps older than the window.
  while (bucket.timestamps.length > 0 && bucket.timestamps[0] <= cutoff) {
    bucket.timestamps.shift();
  }
  return bucket.timestamps;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  // Prevent unbounded growth — clear oldest entries when capped.
  if (buckets.size >= MAX_BUCKETS) {
    // Cheap eviction: clear the entire map. Not surgical, but bounds memory.
    buckets.clear();
  }

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  evictExpired(bucket, windowMs, now);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  bucket.timestamps.push(now);
  return {
    allowed: true,
    remaining: limit - bucket.timestamps.length,
    retryAfterMs: 0,
  };
}

/**
 * Best-effort client identifier. Prefers x-forwarded-for (Vercel-set), then
 * x-real-ip, then a safe fallback string. Never throws.
 */
export function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be a comma list — first value is the original client.
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "anonymous";
}

/**
 * One-shot rate limit check + 429 response. Returns the 429 NextResponse if
 * the limit is exceeded, or null if the request can proceed.
 *
 * Layered keys: pass `userId` to bind a per-user bucket so even a single user
 * across multiple IPs is bounded. Falls back to IP when anonymous.
 *
 * Default limits are deliberately conservative — these protect mutation
 * endpoints from accidental loops or naive abuse, not determined attackers.
 *
 * @example
 *   const limited = enforceRateLimit(request, "trips:create", { userId: user.id });
 *   if (limited) return limited;
 */
export function enforceRateLimit(
  request: Request,
  scope: string,
  options: {
    userId?: string | null;
    limit?: number;
    windowMs?: number;
  } = {}
): NextResponse | null {
  const { userId, limit = 60, windowMs = 60_000 } = options;
  // Per-user bucket if authenticated; otherwise IP-based. We don't AND them —
  // an authenticated user behind shared NAT shouldn't be capped by their
  // neighbors, and an anonymous IP shouldn't be inflated by other users.
  const subject = userId ? `u:${userId}` : `ip:${getClientKey(request)}`;
  const result = checkRateLimit(`${scope}:${subject}`, limit, windowMs);
  if (result.allowed) return null;
  return apiError(
    "RATE_LIMITED",
    "Too many requests. Please wait a moment and try again.",
    {},
    {
      headers: {
        "Retry-After": Math.ceil(result.retryAfterMs / 1000).toString(),
      },
    }
  );
}
