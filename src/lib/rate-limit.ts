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
// Distributed upgrade (audit T-01): the async variants below
// (`checkRateLimitAsync` / `enforceRateLimitAsync`) route to a shared Upstash
// Redis store when the FLAG_DISTRIBUTED_RATE_LIMIT flag is ON and Upstash env
// is configured, and fail open to this in-memory path otherwise. The sync
// functions remain for callers that haven't migrated — behaviour is identical
// when the flag is OFF.

import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { isServerEnabled } from "@/lib/flags";

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
interface EnforceOptions {
  userId?: string | null;
  limit?: number;
  windowMs?: number;
}

// Per-user bucket if authenticated; otherwise IP-based. We don't AND them —
// an authenticated user behind shared NAT shouldn't be capped by their
// neighbors, and an anonymous IP shouldn't be inflated by other users.
function rateLimitKey(request: Request, scope: string, userId?: string | null): string {
  const subject = userId ? `u:${userId}` : `ip:${getClientKey(request)}`;
  return `${scope}:${subject}`;
}

function rateLimitedResponse(result: RateLimitResult): NextResponse {
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

export function enforceRateLimit(
  request: Request,
  scope: string,
  options: EnforceOptions = {}
): NextResponse | null {
  const { userId, limit = 60, windowMs = 60_000 } = options;
  const result = checkRateLimit(rateLimitKey(request, scope, userId), limit, windowMs);
  if (result.allowed) return null;
  return rateLimitedResponse(result);
}

/**
 * Store-aware rate limit check. When FLAG_DISTRIBUTED_RATE_LIMIT is ON and
 * Upstash is configured, uses a shared Redis counter (consistent across all
 * serverless instances). Otherwise — or if Redis errors — falls back to the
 * in-memory limiter, so the request path never fails because the store is down.
 */
export async function checkRateLimitAsync(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (isServerEnabled("distributedRateLimit")) {
    // Imported lazily so the Upstash module never loads when the flag is OFF.
    const { isDistributedRateLimitConfigured, checkRateLimitRedis } = await import(
      "@/lib/rate-limit-redis"
    );
    if (isDistributedRateLimitConfigured()) {
      try {
        return await checkRateLimitRedis(key, limit, windowMs);
      } catch (err) {
        // Fail open to in-memory rather than dropping the request.
        console.error("Distributed rate limit failed; using in-memory fallback:", err);
      }
    }
  }
  return checkRateLimit(key, limit, windowMs);
}

/**
 * Async twin of enforceRateLimit that honours the distributed-store flag.
 * Prefer this in route handlers (they are already async); the sync version
 * stays for callers that haven't migrated.
 */
export async function enforceRateLimitAsync(
  request: Request,
  scope: string,
  options: EnforceOptions = {}
): Promise<NextResponse | null> {
  const { userId, limit = 60, windowMs = 60_000 } = options;
  const result = await checkRateLimitAsync(rateLimitKey(request, scope, userId), limit, windowMs);
  if (result.allowed) return null;
  return rateLimitedResponse(result);
}
