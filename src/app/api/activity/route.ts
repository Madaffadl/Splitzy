import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized, assertSameOrigin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseBeacon } from "@/lib/activity";
import { logActivity } from "@/lib/activity-server";

export const runtime = "nodejs";

// POST /api/activity — client beacon reporting a completed feature action
// (single/multiple/travel). Auth-gated so events are always attributable; a
// no-op for guests. Fire-and-forget from the client.
export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  const limited = enforceRateLimit(request, "activity", { userId: user.id, limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const beacon = parseBeacon(await request.json().catch(() => null));
  if (!beacon) return apiError("BAD_REQUEST", "Invalid activity beacon");

  await logActivity({
    userId: user.id,
    userEmail: user.email,
    feature: beacon.feature,
    type: beacon.type,
  });

  // 202: accepted telemetry; nothing for the client to read.
  return new NextResponse(null, { status: 202 });
}
