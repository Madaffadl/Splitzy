import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=no_code`);
  }

  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("Auth callback error:", error);
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  const supabaseUser = data.user;

  // Upsert user into our database
  try {
    await prisma.user.upsert({
      where: { googleId: supabaseUser.id },
      update: {
        email: supabaseUser.email ?? "",
        name:
          supabaseUser.user_metadata?.full_name ??
          supabaseUser.user_metadata?.name ??
          null,
        avatarUrl:
          supabaseUser.user_metadata?.avatar_url ??
          supabaseUser.user_metadata?.picture ??
          null,
      },
      create: {
        googleId: supabaseUser.id,
        email: supabaseUser.email ?? "",
        name:
          supabaseUser.user_metadata?.full_name ??
          supabaseUser.user_metadata?.name ??
          null,
        avatarUrl:
          supabaseUser.user_metadata?.avatar_url ??
          supabaseUser.user_metadata?.picture ??
          null,
      },
    });
  } catch (dbError) {
    console.error("Failed to upsert user:", dbError);
    // Don't block login if DB upsert fails — auth session is still valid
  }

  return response;
}
