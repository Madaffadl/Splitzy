// Server-side activity logger. Fire-and-forget: logging is best-effort telemetry
// and must never break the action it records, so every call swallows its errors.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { ActivityFeature } from "@/lib/activity";

export async function logActivity(input: {
  userId: string;
  userEmail: string;
  feature: ActivityFeature;
  type: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: {
        userId: input.userId,
        userEmail: input.userEmail,
        feature: input.feature,
        type: input.type,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    // Never let telemetry failures surface to the user or abort the request.
    console.error("[activity] failed to log event:", err);
  }
}
