import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Canonical-host redirect (SEO Sprint 7).
//
// Both https://splitzy.my.id and https://www.splitzy.my.id were serving the site
// with a 200, so identical content lived at two hostnames. Google then has to
// pick a canonical itself and splits any accumulated link signals across the
// two. The rel=canonical tag already pointed at www, but a canonical tag is only
// a *hint* — a 301 is a directive, and it stops the duplicate being crawled at
// all.
//
// Deliberately an exact string comparison rather than a `has: [{ type: "host" }]`
// rule in next.config.mjs: that value is pattern-matched, and a pattern that also
// matched "www.splitzy.my.id" would cause an infinite redirect loop in
// production. An equality check cannot loop.
const APEX_HOST = "splitzy.my.id";
const CANONICAL_HOST = "www.splitzy.my.id";

function canonicalHostRedirect(request: NextRequest): NextResponse | null {
  // `host` has no port on Vercel; strip one anyway for local parity.
  const host = request.headers.get("host")?.split(":")[0];
  if (host !== APEX_HOST) return null;

  const url = request.nextUrl.clone();
  url.protocol = "https";
  url.host = CANONICAL_HOST;
  url.port = "";
  // 301 rather than 308: both are permanent and Google treats them identically,
  // and 301 is what every SEO auditing tool expects to see here.
  return NextResponse.redirect(url, 301);
}

// Legacy /en/* redirect.
//
// English briefly lived at /en while Indonesian owned the root; the default was
// flipped on 2026-08-21, so English now serves from the un-prefixed URLs and
// Indonesian moved to /id. Those /en URLs were already submitted to Google
// Search Console, so they must not 404 — a 301 preserves anything Google
// crawled and hands the signal to the new location.
//
// Safe to delete once Search Console shows no traffic or coverage entries for
// /en, realistically several months out.
function legacyEnglishPrefixRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (pathname !== "/en" && !pathname.startsWith("/en/")) return null;

  const url = request.nextUrl.clone();
  // "/en" → "/", "/en/about" → "/about". Same content, same language.
  url.pathname = pathname.slice("/en".length) || "/";
  return NextResponse.redirect(url, 301);
}

export default async function proxy(request: NextRequest) {
  // 0. Canonical host. Runs first so a request to the apex is redirected in one
  //    hop, rather than chaining through the maintenance/auth redirects below.
  const hostRedirect = canonicalHostRedirect(request);
  if (hostRedirect) return hostRedirect;

  // 0b. Retired /en prefix → the un-prefixed English tree.
  const legacyRedirect = legacyEnglishPrefixRedirect(request);
  if (legacyRedirect) return legacyRedirect;

  // 1. Maintenance mode check
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === "true";

  if (isMaintenanceMode && request.nextUrl.pathname !== "/maintenance") {
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }

  if (!isMaintenanceMode && request.nextUrl.pathname === "/maintenance") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 2. Refresh Supabase session (required by @supabase/ssr)
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // 3. Protected routes — require authentication
  const protectedPaths = ["/multiple", "/history"];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (isProtected && !user) {
    // If getUser() failed due to a transient network/service error (not a real
    // 401), let the request through rather than false-redirecting a logged-in
    // user. The page-level auth check will catch genuinely unauthenticated
    // requests.
    if (authError && authError.status !== 401) {
      return response;
    }

    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("login", "required");
    redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Propagate any refreshed session cookies so the browser gets the updated
    // tokens even when we redirect (prevents a second redirect loop).
    response.cookies.getAll().forEach(({ name, value, ...opts }) => {
      redirectResponse.cookies.set(name, value, opts);
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg).*)",
  ],
};
