import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-auth";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { googleId: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
    },
  });

  if (!dbUser) {
    return NextResponse.json({ user: null }, { status: 404 });
  }

  // Surface effective admin so the client can show the admin entry point.
  // `role` stays internal — the UI only needs the boolean.
  const { role, ...safe } = dbUser;
  return NextResponse.json({ user: { ...safe, isAdmin: isAdmin({ email: dbUser.email, role }) } });
}
