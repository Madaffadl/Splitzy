// Builds the DB writes for an approved change-request batch as an array of
// Prisma operations, to be run with the *array form* of prisma.$transaction.
//
// Why array form (not an interactive `$transaction(async tx => …)`): the app's
// DATABASE_URL is the Supabase connection pooler (PgBouncer, transaction mode).
// Interactive transactions over that pooler intermittently report an error even
// when the statements committed — which surfaced as a spurious 500 on approve
// while the changes were actually applied. The array form runs as a single
// implicit transaction the pooler handles cleanly.
//
// Validation is synchronous and happens here, before any DB call, so an invalid
// op (e.g. a receipt referencing a participant the owner deleted meanwhile)
// throws a ValidationError the caller turns into a 400 — nothing is written.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ChangeOp } from "@/lib/change-ops";
import { validateTripReceiptPayload, validateTripPaymentInput } from "@/lib/travel-cloud";

export function buildChangeOpsWrites(
  tripId: string,
  ops: ChangeOp[],
  userId: string,
  liveParticipantIds: Set<string>
): Prisma.PrismaPromise<unknown>[] {
  // Thread the participant set through the batch: a `participants.set` op earlier
  // in the batch makes those ids valid for later receipt/payment ops.
  let participantIds = new Set(liveParticipantIds);
  const writes: Prisma.PrismaPromise<unknown>[] = [];

  for (const op of ops) {
    switch (op.kind) {
      case "participants.set": {
        participantIds = new Set(op.participants.map((p) => p.id));
        writes.push(
          prisma.trip.update({
            where: { id: tripId },
            data: { participantsJson: op.participants as unknown as Prisma.InputJsonValue },
          })
        );
        break;
      }
      case "trip.update": {
        const data: Prisma.TripUpdateInput = {};
        if (op.name !== undefined) data.name = op.name;
        if (op.budget !== undefined) data.budget = op.budget;
        if (Object.keys(data).length > 0) {
          writes.push(prisma.trip.update({ where: { id: tripId }, data }));
        }
        break;
      }
      case "receipt.add":
      case "receipt.update": {
        // Re-validate against the live participant set (last-write-wins guard).
        const payload = validateTripReceiptPayload(op.receipt, participantIds);
        const rid = (payload as { id: string }).id;
        writes.push(
          prisma.tripReceipt.upsert({
            where: { id: rid },
            update: { payload: payload as unknown as Prisma.InputJsonValue },
            create: {
              id: rid,
              tripId,
              payload: payload as unknown as Prisma.InputJsonValue,
              createdById: userId,
            },
          })
        );
        break;
      }
      case "receipt.delete": {
        writes.push(prisma.tripReceipt.deleteMany({ where: { id: op.receiptId, tripId } }));
        break;
      }
      case "payment.add": {
        const p = validateTripPaymentInput(op.payment, participantIds);
        writes.push(
          prisma.tripPayment.create({
            data: {
              tripId,
              fromParticipantId: p.from,
              toParticipantId: p.to,
              amount: p.amount,
              currency: p.currency ?? null,
              fxRate: p.fxRate ?? null,
              note: p.note ?? null,
              source: p.source ?? null,
              createdById: userId,
            },
          })
        );
        break;
      }
      case "payment.delete": {
        writes.push(prisma.tripPayment.deleteMany({ where: { id: op.paymentId, tripId } }));
        break;
      }
    }
  }

  return writes;
}
