import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { apiError } from "@/lib/api-response";

// React's `cache()` dedupes function calls within a single render/request.
// Multiple `getAuthUser(request)` calls in the same handler (or its children)
// resolve to a single Supabase + Prisma roundtrip. Different requests get
// fresh results because each request is a new render cycle.
//
// We key the inner cached function on the cookie header string so the dedupe
// is correct even if a route somehow constructs multiple requests.
const resolveAuth = cache(
  async (cookieHeader: string): Promise<User | null> => {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            // Reconstruct cookies from the captured header string.
            return cookieHeader
              .split(";")
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p) => {
                const eq = p.indexOf("=");
                return eq === -1
                  ? { name: p, value: "" }
                  : { name: p.slice(0, eq), value: p.slice(eq + 1) };
              });
          },
          setAll() {
            // Read-only in API routes
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    return prisma.user.findUnique({ where: { googleId: user.id } });
  }
);

/**
 * Extract authenticated user from Supabase session.
 * Returns the Prisma User record or null if not authenticated.
 *
 * Result is per-request memoized via React.cache() — calling this multiple
 * times in the same handler is free after the first call.
 */
export async function getAuthUser(
  request: NextRequest
): Promise<User | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return resolveAuth(cookieHeader);
}

/**
 * Helper to return a 401 JSON response.
 */
export function unauthorized() {
  return apiError("UNAUTHORIZED", "Unauthorized");
}

/**
 * Helper to return a 403 JSON response.
 */
export function forbidden(message = "Forbidden") {
  return apiError("FORBIDDEN", message);
}

/**
 * Helper to return a 404 JSON response.
 */
export function notFound(message = "Not found") {
  return apiError("NOT_FOUND", message);
}

/**
 * CSRF mitigation: ensure the request originates from the same site.
 *
 * Works in concert with SameSite=Lax cookies that Supabase SSR sets — together
 * they block cross-origin POST/PUT/DELETE that try to ride the user's session.
 * Returns null if the request is acceptable, otherwise a 403 response.
 *
 * Should be called at the top of every state-changing API handler.
 */
export function assertSameOrigin(request: NextRequest): NextResponse | null {
  // Same-origin requests must include either Origin or Referer; cross-origin
  // requests usually include Origin per spec.
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  if (!host) {
    return apiError("BAD_REQUEST", "Missing host header");
  }

  // Build the set of acceptable origins. Trust the request's host (Vercel sets
  // x-forwarded-host correctly) and respect explicit allowlist if configured.
  const allowed = new Set<string>();
  allowed.add(`https://${host}`);
  allowed.add(`http://${host}`); // local dev
  if (process.env.NEXT_PUBLIC_APP_URL) {
    allowed.add(process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ""));
  }

  const sourceUrl = origin || referer;
  if (!sourceUrl) {
    return apiError("FORBIDDEN", "Missing Origin/Referer header");
  }

  let sourceOrigin: string;
  try {
    sourceOrigin = new URL(sourceUrl).origin;
  } catch {
    return apiError("FORBIDDEN", "Invalid Origin/Referer header");
  }

  if (!allowed.has(sourceOrigin)) {
    return apiError("FORBIDDEN", "Cross-origin request blocked");
  }

  return null;
}
