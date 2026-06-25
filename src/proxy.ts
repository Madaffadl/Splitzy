import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export default async function proxy(request: NextRequest) {
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
  const protectedPaths = ["/trip", "/history"];
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
