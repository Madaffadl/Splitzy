// Server-side replay of an approved change-request batch onto the canonical
// trip. Runs inside a Prisma transaction (see the approve route) so the whole
// batch commits atomically — a single invalid op rolls the lot back and the
// change request stays pending.
//
// Approval is last-write-wins: ops are re-validated against the trip's CURRENT
// participant set (threaded through `participants.set` ops in the batch), so a
// receipt referencing a participant the owner deleted meanwhile fails loudly
// rather than corrupting the ledger.

import { Prisma } from "@prisma/client";
import { ChangeOp } from "@/lib/change-ops";
import { validateTripReceiptPayload, validateTripPaymentInput } from "@/lib/travel-cloud";

export async function applyChangeOps(
  tx: Prisma.TransactionClient,
  tripId: string,
  ops: ChangeOp[],
  userId: string,
  liveParticipantIds: Set<string>
): Promise<void> {
  let participantIds = new Set(liveParticipantIds);

  for (const op of ops) {
    switch (op.kind) {
      case "participants.set": {
        participantIds = new Set(op.participants.map((p) => p.id));
        await tx.trip.update({
          where: { id: tripId },
          data: { participantsJson: op.participants as unknown as Prisma.InputJsonValue },
        });
        break;
      }
      case "trip.update": {
        const data: Prisma.TripUpdateInput = {};
        if (op.name !== undefined) data.name = op.name;
        if (op.budget !== undefined) data.budget = op.budget;
        if (Object.keys(data).length > 0) {
          await tx.trip.update({ where: { id: tripId }, data });
        }
        break;
      }
      case "receipt.add":
      case "receipt.update": {
        // Re-validate against the live participant set (last-write-wins guard).
        const payload = validateTripReceiptPayload(op.receipt, participantIds);
        const rid = (payload as { id: string }).id;
        await tx.tripReceipt.upsert({
          where: { id: rid },
          update: { payload: payload as unknown as Prisma.InputJsonValue },
          create: {
            id: rid,
            tripId,
            payload: payload as unknown as Prisma.InputJsonValue,
            createdById: userId,
          },
        });
        break;
      }
      case "receipt.delete": {
        await tx.tripReceipt.deleteMany({ where: { id: op.receiptId, tripId } });
        break;
      }
      case "payment.add": {
        const p = validateTripPaymentInput(op.payment, participantIds);
        await tx.tripPayment.create({
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
        });
        break;
      }
      case "payment.delete": {
        await tx.tripPayment.deleteMany({ where: { id: op.paymentId, tripId } });
        break;
      }
    }
  }
}
