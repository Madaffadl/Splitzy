import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-server";
import { sendWelcomeEmail } from "@/lib/email";
import { processReferral } from "@/lib/referral";

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
    const now = new Date();
    const name =
      supabaseUser.user_metadata?.full_name ??
      supabaseUser.user_metadata?.name ??
      null;
    const avatarUrl =
      supabaseUser.user_metadata?.avatar_url ??
      supabaseUser.user_metadata?.picture ??
      null;
    // Detect first sign-in so we only welcome-email brand-new accounts.
    const existing = await prisma.user.findUnique({
      where: { googleId: supabaseUser.id },
      select: { id: true },
    });
    const dbUser = await prisma.user.upsert({
      where: { googleId: supabaseUser.id },
      update: { email: supabaseUser.email ?? "", name, avatarUrl, lastLoginAt: now },
      create: {
        googleId: supabaseUser.id,
        email: supabaseUser.email ?? "",
        name,
        avatarUrl,
        lastLoginAt: now,
      },
      select: { id: true, email: true },
    });
    // Record the sign-in in the activity log (best-effort).
    await logActivity({ userId: dbUser.id, userEmail: dbUser.email, feature: "account", type: "login" });
    if (!existing) {
      // Process referral if the user arrived via a ?ref= link (cookie set by RefCapture).
      const refCode = request.cookies.get("splitzy_ref")?.value;
      if (refCode) {
        await processReferral(dbUser.id, refCode).catch((e) =>
          console.error("referral processing failed:", e)
        );
        response.cookies.set("splitzy_ref", "", { maxAge: 0, path: "/" });
      }
      // Welcome email (no-op unless RESEND_API_KEY is set).
      await sendWelcomeEmail(dbUser.email, name).catch((e) =>
        console.error("welcome email failed:", e)
      );
    }
  } catch (dbError) {
    console.error("Failed to upsert user:", dbError);
    // Don't block login if DB upsert fails — auth session is still valid
  }

  return response;
}
