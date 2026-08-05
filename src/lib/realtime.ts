// Server-driven realtime "doorbell" (Sprint 6, behind the `realtime` flag).
//
// After a trip mutation succeeds, the server sends a SIGNAL (never data) to a
// per-trip Supabase Broadcast channel. Subscribed clients react by refetching
// the trip through the normal authenticated API — so authorization is unchanged
// and no trip data ever travels over the broadcast. See docs discussion.
//
// This uses Supabase's stateless HTTP broadcast endpoint (no persistent socket),
// which is the right fit for serverless route handlers. Completely inert unless
// the `realtime` flag is on AND the Supabase URL + service-role key are set —
// and it is strictly fire-and-forget: a failure here must never fail the write.
import { isEnabled } from "@/lib/flags";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** What kind of change happened — informational, lets the client label activity. */
export type TripChangeKind = "trip" | "receipt" | "payment" | "member" | "changeRequest";

export function tripChannel(tripId: string): string {
  return `trip:${tripId}`;
}

/**
 * Notify a trip's channel that something changed. Signal only — carries the
 * trip id, an optional version, the kind, and who did it (so the actor's own
 * client can skip a redundant refetch). Fire-and-forget; swallows all errors.
 */
export async function broadcastTripChange(
  tripId: string,
  opts: { kind: TripChangeKind; actorId: string; version?: number }
): Promise<void> {
  if (!isEnabled("realtime")) return;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return;

  try {
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      cache: "no-store",
      body: JSON.stringify({
        messages: [
          {
            topic: tripChannel(tripId),
            event: "trip.changed",
            payload: {
              v: 1,
              tripId,
              kind: opts.kind,
              actorId: opts.actorId,
              version: opts.version ?? null,
            },
          },
        ],
      }),
    });
  } catch {
    // Realtime is best-effort — clients still refetch on focus/reconnect.
  }
}
