import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, assertSameOrigin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ValidationError, validationErrorResponse } from "@/lib/validation";
import {
  validateSharedSummaryInput,
  generateShareCode,
  shareExpiryFromNow,
  MAX_PAYLOAD_BYTES,
  SHARE_TTL_DAYS,
} from "@/lib/shared-summary";

export const runtime = "nodejs";

// POST /api/share — Create a read-only, shareable snapshot of a split and
// return its short code. Auth is optional: trip mode works for guests, so a
// guest can create a link too (createdById stays null). Rate-limited to curb
// abuse since this writes a row from an unauthenticated surface.
export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request); // may be null (guests allowed)

  const limited = enforceRateLimit(request, "share:create", {
    userId: user?.id ?? null,
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const body = await request.json().catch(() => null);

  let payload;
  try {
    payload = validateSharedSummaryInput(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      const { body: errBody, status } = validationErrorResponse(err);
      return NextResponse.json(errBody, { status });
    }
    return apiError("BAD_REQUEST", "Invalid request body");
  }

  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_PAYLOAD_BYTES) {
    return apiError(
      "PAYLOAD_TOO_LARGE",
      "This split is too large to share via link."
    );
  }

  const expiresAt = shareExpiryFromNow();

  // Retry on the rare code collision (unique constraint → P2002).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShareCode();
    try {
      await prisma.sharedSummary.create({
        data: {
          code,
          payload: payload as unknown as Prisma.InputJsonValue,
          createdById: user?.id ?? null,
          expiresAt,
        },
      });
      // Remember the code on the saved split it came from, so a later save
      // refreshes THIS link instead of minting a rival one. Scoped to rows the
      // caller owns; a bad id just means the link isn't linked to anything.
      const receiptId = typeof body?.receiptId === "string" ? body.receiptId : null;
      if (receiptId && user) {
        await prisma.receipt.updateMany({
          where: { id: receiptId, createdById: user.id, deletedAt: null },
          data: { shareCode: code },
        });
      }

      return NextResponse.json(
        { code, expiresAt: expiresAt.toISOString(), ttlDays: SHARE_TTL_DAYS },
        { status: 201 }
      );
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        continue; // code already taken — generate another and retry
      }
      console.error("Share create failed:", err);
      return apiError(
        "INTERNAL_ERROR",
        "Could not create share link. Please try again."
      );
    }
  }

  return apiError(
    "INTERNAL_ERROR",
    "Could not generate a unique link. Please try again."
  );
}
