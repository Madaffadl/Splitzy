import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound, assertSameOrigin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { ValidationError, validationErrorResponse } from "@/lib/validation";
import { validateChangeOps } from "@/lib/travel-cloud";
import { getTripAccess } from "@/lib/trip-access";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { ChangeOp } from "@/lib/change-ops";

export const runtime = "nodejs";

const RL = { limit: 60, windowMs: 60_000 };

interface ChangeRequestDTO {
  id: string;
  authorId: string;
  authorName: string | null;
  status: string;
  baseVersion: number;
  ops: ChangeOp[];
  note: string | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

// Attach author display names to a set of change-request rows (no FK relation on
// the model, so names are resolved with one extra query).
async function withAuthorNames(
  rows: {
    id: string; authorId: string; status: string; baseVersion: number;
    ops: Prisma.JsonValue; note: string | null; reviewNote: string | null;
    createdAt: Date; reviewedAt: Date | null;
  }[]
): Promise<ChangeRequestDTO[]> {
  const ids = [...new Set(rows.map((r) => r.authorId))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    id: r.id,
    authorId: r.authorId,
    authorName: nameById.get(r.authorId) ?? null,
    status: r.status,
    baseVersion: r.baseVersion,
    ops: r.ops as unknown as ChangeOp[],
    note: r.note,
    reviewNote: r.reviewNote,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
  }));
}

// GET /api/travel/[id]/change-requests?status=pending
// Owner sees every request; a member sees only their own.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  const { id } = await params;

  const access = await getTripAccess(id, user.id);
  if (!access) return notFound();

  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  const rows = await prisma.tripChangeRequest.findMany({
    where: {
      tripId: id,
      ...(status === "all" ? {} : { status }),
      ...(access.role === "owner" ? {} : { authorId: user.id }),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ changeRequests: await withAuthorNames(rows) });
}

// POST /api/travel/[id]/change-requests — submit a batch of edits for review.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  const limited = enforceRateLimit(request, "travel:changereq", { userId: user.id, ...RL });
  if (limited) return limited;
  const { id } = await params;

  const access = await getTripAccess(id, user.id);
  if (!access) return notFound();

  const trip = await prisma.trip.findUnique({ where: { id }, select: { participantsJson: true } });
  const participants = (trip?.participantsJson as unknown as { id: string }[] | null) ?? [];
  const participantIds = new Set(participants.map((p) => p.id));

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return apiError("BAD_REQUEST", "Invalid request body");

  let ops: ChangeOp[];
  try {
    ops = validateChangeOps(body.ops, participantIds);
  } catch (err) {
    if (err instanceof ValidationError) {
      const { body: errBody, status } = validationErrorResponse(err);
      return NextResponse.json(errBody, { status });
    }
    return apiError("BAD_REQUEST", "Invalid change request");
  }

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;
  const baseVersion = typeof body.baseVersion === "number" ? body.baseVersion : access.version;

  const created = await prisma.tripChangeRequest.create({
    data: {
      tripId: id,
      authorId: user.id,
      status: "pending",
      baseVersion,
      ops: ops as unknown as Prisma.InputJsonValue,
      note,
    },
  });

  const [dto] = await withAuthorNames([created]);
  return NextResponse.json(dto, { status: 201 });
}
