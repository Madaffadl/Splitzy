import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound, forbidden, assertSameOrigin } from "@/lib/api-auth";
import { getTripAccess } from "@/lib/travel/trip-access";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// GET /api/travel/[id]/invites — list active (non-expired) invite tokens.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  const { id } = await params;

  const access = await getTripAccess(id, user.id);
  if (!access) return notFound();
  if (access.ownerId !== user.id) return forbidden("Only the trip owner can view invites");

  const invites = await prisma.tripInvite.findMany({
    where: { tripId: id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    invites: invites.map((inv) => ({
      token: inv.token,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    })),
  });
}

// POST /api/travel/[id]/invites — create a new invite token (owner only).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  const limited = enforceRateLimit(request, "travel:invite", { userId: user.id, limit: 30, windowMs: 60_000 });
  if (limited) return limited;
  const { id } = await params;

  const access = await getTripAccess(id, user.id);
  if (!access) return notFound();
  if (access.ownerId !== user.id) return forbidden("Only the trip owner can create invites");

  const token = crypto.randomBytes(16).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await prisma.tripInvite.create({
    data: { token, tripId: id, createdById: user.id, expiresAt },
  });

  return NextResponse.json({ token, expiresAt: expiresAt.toISOString() }, { status: 201 });
}
