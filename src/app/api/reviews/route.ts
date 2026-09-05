import { NextRequest, NextResponse } from "next/server";
import type { Review } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin, getAuthUser, unauthorized } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  ValidationError,
  validateReviewSubmit,
  validationErrorResponse,
} from "@/lib/validation";

export const runtime = "nodejs";

// The author's own view of their review. `reviewNote` is included because a
// rejection is only actionable if the reason comes back to them; everything
// else about moderation stays internal.
interface ReviewDTO {
  id: string;
  rating: number;
  body: string | null;
  status: string;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

function toDTO(review: Review): ReviewDTO {
  return {
    id: review.id,
    rating: review.rating,
    body: review.body,
    status: review.status,
    reviewNote: review.reviewNote,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  };
}

// GET /api/reviews — the caller's own review, or null if they haven't written one.
//
// "No review yet" answers 200 with `{ review: null }` rather than 404: the UI
// has to tell that apart from a failed request, and the whole point of the card
// is to render *because* nothing is there yet.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const limited = enforceRateLimit(request, "reviews:read", {
    userId: user.id,
    limit: 60,
  });
  if (limited) return limited;

  const review = await prisma.review.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ review: review ? toDTO(review) : null });
}

// POST /api/reviews — submit a review, or replace the one already on file.
export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const limited = enforceRateLimit(request, "reviews:submit", {
    userId: user.id,
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  let input;
  try {
    const body = await request.json().catch(() => null);
    input = validateReviewSubmit(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      const { body, status } = validationErrorResponse(err);
      return NextResponse.json(body, { status });
    }
    return apiError("BAD_REQUEST", "Invalid request body");
  }

  const data = {
    rating: input.rating,
    body: input.body,
    // Snapshot, so an approved quote keeps the name it was approved under.
    displayName: user.name,
    source: input.source,
    locale: input.locale,
    status: "pending",
  };

  const review = await prisma.review.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    // Editing always re-enters the queue and drops the previous verdict.
    // Without this, someone could get an innocuous review approved and then
    // rewrite the body into anything they liked, live and unmoderated.
    update: { ...data, reviewNote: null, reviewedById: null, reviewedAt: null },
  });

  return NextResponse.json({ review: toDTO(review) }, { status: 201 });
}
