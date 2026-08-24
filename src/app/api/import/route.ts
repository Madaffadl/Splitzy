import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, assertSameOrigin } from "@/lib/api-auth";
import {
  validateParticipantsJson,
  ValidationError,
  validationErrorResponse,
  ValidatedParticipant,
} from "@/lib/validation";
import { apiError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { validateTripReceiptPayload } from "@/lib/travel-cloud";

interface LocalItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
  assignedToIds: string[];
  assignments?: { participantId: string; qty: number }[];
}

interface LocalReceipt {
  id: string;
  title: string;
  date?: string;
  payerId: string;
  items: LocalItem[];
  tax: number;
  service: number;
  discounts?: unknown[];
  fees?: unknown[];
  currency?: string;
  fxRate?: number;
}

interface LocalSingleState {
  participants: ValidatedParticipant[];
  items: LocalItem[];
  title: string;
  date?: string;
  tax: number;
  service: number;
  payerId: string;
  discounts?: unknown[];
  fees?: unknown[];
  currency?: string;
  fxRate?: number;
}

interface LocalTripState {
  trip: {
    id: string;
    name: string;
    participants: ValidatedParticipant[];
    receipts: LocalReceipt[];
  };
}

// Idempotency: clients pass an opaque token (UUID) per import attempt. Same
// token within the retention window returns the previous result instead of
// re-importing. Cheap in-memory map — acceptable for a single-instance setup
// and harmless if it resets (worst case the user just gets one duplicate).
//
// Stored value is the import response so retries see the same `imported` count.
interface ImportRecord {
  userId: string;
  imported: number;
  expiresAt: number;
}
const idempotency = new Map<string, ImportRecord>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_IDEMPOTENCY_ENTRIES = 5_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pruneIdempotency(now: number) {
  if (idempotency.size < MAX_IDEMPOTENCY_ENTRIES) {
    // Lazy: only sweep when the map actually fills up.
    return;
  }
  for (const [key, record] of idempotency) {
    if (record.expiresAt <= now) idempotency.delete(key);
  }
  // If still over cap after sweeping expired, clear oldest half.
  if (idempotency.size >= MAX_IDEMPOTENCY_ENTRIES) {
    const drop = Math.floor(idempotency.size / 2);
    let i = 0;
    for (const key of idempotency.keys()) {
      if (i++ >= drop) break;
      idempotency.delete(key);
    }
  }
}

// POST /api/import - Import localStorage data into user's account.
// All writes happen inside a single Prisma transaction so a network failure
// or DB error mid-import cannot leave the account in a partially-imported state.
export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  // Tight cap — import is a once-per-account operation in normal use.
  const limited = enforceRateLimit(request, "import", {
    userId: user.id,
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const body = await request.json().catch(() => null);

  // Idempotency token — required to make retries safe. Without it, a network
  // hiccup mid-import would cause the client to retry and double-write.
  const idempotencyKey = typeof body?.idempotencyKey === "string"
    ? body.idempotencyKey
    : null;
  if (!idempotencyKey || !UUID_RE.test(idempotencyKey)) {
    return apiError(
      "VALIDATION_FAILED",
      "idempotencyKey is required (UUID v4)",
      { field: "idempotencyKey" }
    );
  }

  const now = Date.now();
  pruneIdempotency(now);

  // Replay protection: if the same user retries with the same key, return the
  // recorded result. Keyed on (userId, key) so guessed keys can't collide.
  const cacheKey = `${user.id}:${idempotencyKey}`;
  const cached = idempotency.get(cacheKey);
  if (cached && cached.expiresAt > now && cached.userId === user.id) {
    return NextResponse.json({ imported: cached.imported, replayed: true });
  }

  const single = (body?.single ?? null) as LocalSingleState | null;
  const trip = (body?.trip ?? null) as LocalTripState | null;

  // Guard against absurd payloads.
  const totalItemCount =
    (single?.items?.length ?? 0) +
    (trip?.trip?.receipts?.reduce((sum, r) => sum + (r.items?.length ?? 0), 0) ?? 0);
  if (totalItemCount > 5000) {
    return apiError("PAYLOAD_TOO_LARGE", "Import payload too large.");
  }

  // Validate participant snapshots — throwing here returns a clean 400 instead
  // of the receipts later silently containing arbitrary JSON.
  let singleParticipants: ValidatedParticipant[] | null = null;
  let tripParticipants: ValidatedParticipant[] | null = null;
  try {
    if (single?.participants) {
      singleParticipants = validateParticipantsJson(
        single.participants,
        "single.participants"
      );
    }
    if (trip?.trip?.participants) {
      tripParticipants = validateParticipantsJson(
        trip.trip.participants,
        "trip.participants"
      );
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      const { body: errBody, status } = validationErrorResponse(err);
      return NextResponse.json(errBody, { status });
    }
    return apiError("BAD_REQUEST", "Invalid request body");
  }

  // Per-receipt date parsing, fail-safe: skip invalid dates rather than reject
  // the whole import (legacy localStorage data may have malformed strings).
  const parseReceiptDate = (raw?: string): Date | null => {
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  /**
   * Build the lossless JSON document for one receipt.
   *
   * Validated with the SAME helper the Travel cloud path uses, so both places
   * that persist a receipt agree on the shape — and so assignments, fees and
   * discounts are checked against the participant list rather than trusted.
   *
   * Throws ValidationError, which the caller turns into a 400. Failing loudly
   * matters here: the client only clears localStorage after a success response,
   * so a rejected import leaves the user's data intact, whereas quietly
   * dropping the parts that don't validate is the exact bug being fixed.
   */
  const buildPayload = (
    receipt: LocalReceipt,
    participants: ValidatedParticipant[] | null,
    field: string
  ): Prisma.InputJsonValue => {
    const participantIds = new Set((participants ?? []).map((p) => p.id));
    try {
      return validateTripReceiptPayload(
        receipt,
        participantIds
      ) as unknown as Prisma.InputJsonValue;
    } catch (err) {
      if (err instanceof ValidationError) {
        throw new ValidationError(`${field}.${err.field}`, err.message);
      }
      throw err;
    }
  };

  try {
    const importedCount = await prisma.$transaction(async (tx) => {
      let count = 0;

      if (single && single.items.length > 0) {
        await tx.receipt.create({
          data: {
            title: single.title || "Imported Receipt",
            payerId: user.id,
            tax: single.tax || 0,
            service: single.service || 0,
            date: parseReceiptDate(single.date),
            createdById: user.id,
            participantsJson:
              (singleParticipants as unknown as Prisma.InputJsonValue) ??
              Prisma.JsonNull,
            payloadJson: buildPayload(
              {
                id: "single",
                title: single.title || "Imported Receipt",
                date: single.date,
                payerId: single.payerId,
                items: single.items,
                tax: single.tax || 0,
                service: single.service || 0,
                discounts: single.discounts,
                fees: single.fees,
                currency: single.currency,
                fxRate: single.fxRate,
              },
              singleParticipants,
              "single"
            ),
            items: {
              create: single.items.map((item, index) => ({
                name: item.name,
                qty: item.qty || 1,
                unitPrice: item.unitPrice,
                total: item.total,
                sortOrder: index,
              })),
            },
          },
        });
        count++;
      }

      if (trip && trip.trip.receipts.length > 0) {
        const dbTrip = await tx.trip.create({
          data: {
            name: trip.trip.name || "Imported Trip",
            ownerId: user.id,
            members: {
              create: {
                userId: user.id,
                role: "owner",
              },
            },
          },
        });

        for (const receipt of trip.trip.receipts) {
          await tx.receipt.create({
            data: {
              title: receipt.title || "Untitled Receipt",
              payerId: user.id,
              tax: receipt.tax || 0,
              service: receipt.service || 0,
              date: parseReceiptDate(receipt.date),
              tripId: dbTrip.id,
              createdById: user.id,
              participantsJson:
                (tripParticipants as unknown as Prisma.InputJsonValue) ??
                Prisma.JsonNull,
              payloadJson: buildPayload(
                receipt,
                tripParticipants,
                `trip.receipts[${receipt.id}]`
              ),
              items: {
                create: receipt.items.map((item, index) => ({
                  name: item.name,
                  qty: item.qty || 1,
                  unitPrice: item.unitPrice,
                  total: item.total,
                  sortOrder: index,
                })),
              },
            },
          });
          count++;
        }
      }

      return count;
    });

    idempotency.set(cacheKey, {
      userId: user.id,
      imported: importedCount,
      expiresAt: now + IDEMPOTENCY_TTL_MS,
    });

    return NextResponse.json({ imported: importedCount });
  } catch (error) {
    // A payload that fails validation is the user's data being unusual, not the
    // server breaking — say which field so the report is actionable. The
    // transaction has rolled back and localStorage is untouched either way.
    if (error instanceof ValidationError) {
      const { body: errBody, status } = validationErrorResponse(error);
      return NextResponse.json(errBody, { status });
    }
    console.error("Import failed:", error);
    return apiError(
      "INTERNAL_ERROR",
      "Import failed. Your local data has not been removed — please try again."
    );
  }
}
