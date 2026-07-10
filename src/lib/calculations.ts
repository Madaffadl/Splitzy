import {
    Receipt,
    ReceiptItem,
    PersonShare,
    PersonShareDetail,
    ItemBreakdown,
    WalletStats,
    ReceiptSummary,
    SettlementTransfer,
    TripSummary,
    Trip,
} from "@/types";
import { roundTo2 } from "./utils";

/**
 * Calculate the share of a single item for each assigned participant.
 * Uses qty-based split when assignments are present, otherwise equal split.
 */
export function calculateItemShares(item: ReceiptItem): Map<string, number> {
    const shares = new Map<string, number>();

    // Qty-based split: divide proportionally by units each person took
    if (item.assignments && item.assignments.length > 0) {
        const active = item.assignments.filter((a) => a.qty > 0);
        const totalAssignedQty = active.reduce((sum, a) => sum + a.qty, 0);

        if (totalAssignedQty === 0) return shares;

        let runningSum = 0;
        for (const assignment of active) {
            const share = roundTo2((assignment.qty / totalAssignedQty) * item.total);
            shares.set(assignment.participantId, share);
            runningSum = roundTo2(runningSum + share);
        }

        // Fix rounding: assign remainder to person with most units
        const remainder = roundTo2(item.total - runningSum);
        if (remainder !== 0) {
            const largest = active.reduce((max, a) => (a.qty > max.qty ? a : max));
            const current = shares.get(largest.participantId) ?? 0;
            shares.set(largest.participantId, roundTo2(current + remainder));
        }

        return shares;
    }

    // Equal split fallback
    if (item.assignedToIds.length === 0) {
        return shares;
    }

    const sharePerPerson = item.total / item.assignedToIds.length;
    for (const participantId of item.assignedToIds) {
        shares.set(participantId, roundTo2(sharePerPerson));
    }

    return shares;
}

/**
 * Calculate subtotals for each person from all items in a receipt.
 */
export function calculatePersonSubtotals(
    items: ReceiptItem[],
    participantIds: string[]
): Map<string, number> {
    const subtotals = new Map<string, number>();

    // Initialize all participants with 0
    for (const id of participantIds) {
        subtotals.set(id, 0);
    }

    // Sum up item shares
    for (const item of items) {
        const itemShares = calculateItemShares(item);
        for (const [participantId, share] of itemShares) {
            const current = subtotals.get(participantId) || 0;
            subtotals.set(participantId, roundTo2(current + share));
        }
    }

    return subtotals;
}

/**
 * Calculate receipt subtotal (sum of all item totals, including unassigned).
 */
export function calculateReceiptSubtotal(items: ReceiptItem[]): number {
    return roundTo2(items.reduce((sum, item) => sum + item.total, 0));
}

/**
 * Allocate tax and service proportionally based on each person's subtotal.
 * Handles rounding by assigning remainder to person with largest subtotal.
 */
export function allocateTaxService(
    personSubtotals: Map<string, number>,
    receiptSubtotal: number,
    tax: number,
    service: number
): { taxAllocations: Map<string, number>; serviceAllocations: Map<string, number> } {
    const taxAllocations = new Map<string, number>();
    const serviceAllocations = new Map<string, number>();

    // Handle edge case: zero subtotal — tax/service can't be proportional,
    // so split equally across all participants. Otherwise the payer would be
    // left with phantom credit and the ledger would not balance.
    if (receiptSubtotal === 0) {
        const ids = Array.from(personSubtotals.keys());
        const n = ids.length;

        if (n === 0) {
            return { taxAllocations, serviceAllocations };
        }

        const taxShare = roundTo2(tax / n);
        const serviceShare = roundTo2(service / n);

        for (const id of ids) {
            taxAllocations.set(id, taxShare);
            serviceAllocations.set(id, serviceShare);
        }

        // Push rounding remainder to the first participant so totals reconcile.
        const taxRemainder = roundTo2(tax - taxShare * n);
        const serviceRemainder = roundTo2(service - serviceShare * n);
        if (taxRemainder !== 0) {
            taxAllocations.set(ids[0], roundTo2(taxShare + taxRemainder));
        }
        if (serviceRemainder !== 0) {
            serviceAllocations.set(ids[0], roundTo2(serviceShare + serviceRemainder));
        }

        return { taxAllocations, serviceAllocations };
    }

    // Calculate raw allocations
    const rawTaxAllocations: Array<{ id: string; amount: number; subtotal: number }> = [];
    const rawServiceAllocations: Array<{ id: string; amount: number; subtotal: number }> = [];

    for (const [id, subtotal] of personSubtotals) {
        const proportion = subtotal / receiptSubtotal;
        rawTaxAllocations.push({
            id,
            amount: roundTo2(proportion * tax),
            subtotal,
        });
        rawServiceAllocations.push({
            id,
            amount: roundTo2(proportion * service),
            subtotal,
        });
    }

    // Fix rounding for tax
    const taxSum = rawTaxAllocations.reduce((sum, a) => sum + a.amount, 0);
    const taxRemainder = roundTo2(tax - taxSum);
    if (taxRemainder !== 0) {
        // Find person with largest subtotal
        const largest = rawTaxAllocations.reduce((max, curr) =>
            curr.subtotal > max.subtotal ? curr : max
        );
        largest.amount = roundTo2(largest.amount + taxRemainder);
    }

    // Fix rounding for service
    const serviceSum = rawServiceAllocations.reduce((sum, a) => sum + a.amount, 0);
    const serviceRemainder = roundTo2(service - serviceSum);
    if (serviceRemainder !== 0) {
        const largest = rawServiceAllocations.reduce((max, curr) =>
            curr.subtotal > max.subtotal ? curr : max
        );
        largest.amount = roundTo2(largest.amount + serviceRemainder);
    }

    // Build final maps
    for (const alloc of rawTaxAllocations) {
        taxAllocations.set(alloc.id, alloc.amount);
    }
    for (const alloc of rawServiceAllocations) {
        serviceAllocations.set(alloc.id, alloc.amount);
    }

    return { taxAllocations, serviceAllocations };
}

/**
 * Resolve every manual discount into a per-person credit (Rupiah).
 *
 * Discounts behave like money handed over at payment, so they are applied on
 * top of the fully-computed (subtotal + tax + service) share:
 *   - "participant": credited entirely to its owner (a personal voucher)
 *   - "item": split across the item's consumers, proportional to their share
 *   - "receipt": split across everyone, proportional to their base total
 * Percentages resolve against a pre-discount base (item total, grand total, or
 * the person's base share) so multiple discounts never compound. Finally each
 * person's credit is capped at their base share — a voucher never pays cash back
 * or turns a share negative.
 */
export function calculateDiscountCredits(
    receipt: Receipt,
    participantIds: string[],
    baseTotals: Map<string, number>
): Map<string, number> {
    const credits = new Map<string, number>();
    for (const id of participantIds) credits.set(id, 0);

    const discounts = receipt.discounts ?? [];
    if (discounts.length === 0) return credits;

    const add = (id: string, amount: number) => {
        if (!credits.has(id) || amount <= 0) return;
        credits.set(id, roundTo2((credits.get(id) || 0) + amount));
    };

    const grandTotal = roundTo2(
        calculateReceiptSubtotal(receipt.items) + receipt.tax + receipt.service
    );
    const totalBase = roundTo2(
        Array.from(baseTotals.values()).reduce((sum, v) => sum + v, 0)
    );

    for (const d of discounts) {
        const value = Math.max(0, d.value || 0);
        if (value <= 0) continue;

        if (d.scope === "participant") {
            const id = d.targetId;
            if (!id || !baseTotals.has(id)) continue;
            const base = baseTotals.get(id) || 0;
            add(id, d.type === "percent" ? roundTo2((base * value) / 100) : value);
        } else if (d.scope === "item") {
            const item = receipt.items.find((i) => i.id === d.targetId);
            if (!item || item.total <= 0) continue;
            const amount =
                d.type === "percent" ? roundTo2((item.total * value) / 100) : value;
            if (amount <= 0) continue;
            // Distribute to the item's consumers proportional to their item share.
            const itemShares = calculateItemShares(item);
            for (const [id, share] of itemShares) {
                add(id, roundTo2((amount * share) / item.total));
            }
        } else {
            // "receipt" — distribute to everyone proportional to their base total.
            const amount =
                d.type === "percent" ? roundTo2((grandTotal * value) / 100) : value;
            if (amount <= 0 || totalBase <= 0) continue;
            for (const id of participantIds) {
                const base = baseTotals.get(id) || 0;
                add(id, roundTo2((amount * base) / totalBase));
            }
        }
    }

    // Cap each person's credit at their base share so effective share ≥ 0.
    for (const id of participantIds) {
        const base = Math.max(0, baseTotals.get(id) || 0);
        credits.set(id, roundTo2(Math.min(credits.get(id) || 0, base)));
    }

    return credits;
}

/**
 * Base (pre-discount) totals per person: subtotal + tax + service.
 */
function calculateBaseTotals(
    subtotals: Map<string, number>,
    taxAllocations: Map<string, number>,
    serviceAllocations: Map<string, number>,
    participantIds: string[]
): Map<string, number> {
    const base = new Map<string, number>();
    for (const id of participantIds) {
        base.set(
            id,
            roundTo2(
                (subtotals.get(id) || 0) +
                    (taxAllocations.get(id) || 0) +
                    (serviceAllocations.get(id) || 0)
            )
        );
    }
    return base;
}

/**
 * Calculate the full per-person totals for a receipt.
 */
export function calculatePersonTotals(
    receipt: Receipt,
    participantIds: string[]
): PersonShare[] {
    const subtotals = calculatePersonSubtotals(receipt.items, participantIds);
    const receiptSubtotal = calculateReceiptSubtotal(receipt.items);
    const { taxAllocations, serviceAllocations } = allocateTaxService(
        subtotals,
        receiptSubtotal,
        receipt.tax,
        receipt.service
    );

    const baseTotals = calculateBaseTotals(
        subtotals,
        taxAllocations,
        serviceAllocations,
        participantIds
    );
    const credits = calculateDiscountCredits(receipt, participantIds, baseTotals);

    const shares: PersonShare[] = [];

    for (const id of participantIds) {
        const subtotal = subtotals.get(id) || 0;
        const taxAlloc = taxAllocations.get(id) || 0;
        const serviceAlloc = serviceAllocations.get(id) || 0;
        const discount = credits.get(id) || 0;

        shares.push({
            participantId: id,
            subtotal,
            taxAllocation: taxAlloc,
            serviceAllocation: serviceAlloc,
            discount,
            total: roundTo2(subtotal + taxAlloc + serviceAlloc - discount),
        });
    }

    return shares;
}

/**
 * Calculate balances for a single receipt.
 * Positive balance = should receive money
 * Negative balance = should pay money
 */
export function calculateReceiptBalances(
    receipt: Receipt,
    participantIds: string[]
): Map<string, number> {
    const shares = calculatePersonTotals(receipt, participantIds);
    // The payer only fronted the actual cash handed to the merchant, which is
    // the sum of everyone's effective (post-discount) share. A personal voucher
    // is the owner's own money-equivalent, so it reduces that owner's share
    // rather than crediting the payer.
    const amountPaid = roundTo2(shares.reduce((sum, s) => sum + s.total, 0));

    const balances = new Map<string, number>();

    for (const share of shares) {
        if (share.participantId === receipt.payerId) {
            // Payer: paid amountPaid, owes share.total
            balances.set(share.participantId, roundTo2(amountPaid - share.total));
        } else {
            // Others: paid 0, owes share.total
            balances.set(share.participantId, roundTo2(0 - share.total));
        }
    }

    return balances;
}

/**
 * Get full summary for a single receipt.
 */
export function getReceiptSummary(
    receipt: Receipt,
    participantIds: string[]
): ReceiptSummary {
    const receiptSubtotal = calculateReceiptSubtotal(receipt.items);
    const grandTotal = roundTo2(receiptSubtotal + receipt.tax + receipt.service);
    const shares = calculatePersonTotals(receipt, participantIds);
    const balances = calculateReceiptBalances(receipt, participantIds);
    const totalDiscount = roundTo2(shares.reduce((sum, s) => sum + s.discount, 0));
    const amountPaid = roundTo2(grandTotal - totalDiscount);

    return {
        receiptSubtotal,
        grandTotal,
        totalDiscount,
        amountPaid,
        shares,
        balances,
    };
}

/**
 * Minimize transactions using greedy algorithm.
 * Match largest debtor to largest creditor.
 */
export function minimizeTransactions(
    balances: Map<string, number>
): SettlementTransfer[] {
    const transfers: SettlementTransfer[] = [];

    // Create mutable copies
    let debtors: Array<{ id: string; amount: number }> = [];
    let creditors: Array<{ id: string; amount: number }> = [];

    for (const [id, balance] of balances) {
        if (balance < -0.01) {
            debtors.push({ id, amount: Math.abs(balance) });
        } else if (balance > 0.01) {
            creditors.push({ id, amount: balance });
        }
    }

    // STEP 1: Exact Match Elimination (Optimization)
    // Find people who owe exactly what someone else needs to receive.
    // This prevents breaking up perfect 1-to-1 matches in the greedy loop.
    for (let i = 0; i < debtors.length; i++) {
        for (let j = 0; j < creditors.length; j++) {
            if (
                debtors[i].amount > 0.01 && 
                creditors[j].amount > 0.01 && 
                Math.abs(debtors[i].amount - creditors[j].amount) < 0.01
            ) {
                transfers.push({
                    from: debtors[i].id,
                    to: creditors[j].id,
                    amount: roundTo2(debtors[i].amount),
                });
                debtors[i].amount = 0;
                creditors[j].amount = 0;
            }
        }
    }

    // Filter out settled participants
    debtors = debtors.filter((d) => d.amount > 0.01);
    creditors = creditors.filter((c) => c.amount > 0.01);

    // STEP 2: Greedy approach for remaining balances
    // Sort by amount descending
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    while (debtors.length > 0 && creditors.length > 0) {
        const debtor = debtors[0];
        const creditor = creditors[0];

        const amount = roundTo2(Math.min(debtor.amount, creditor.amount));

        if (amount > 0.01) {
            transfers.push({
                from: debtor.id,
                to: creditor.id,
                amount,
            });
        }

        debtor.amount = roundTo2(debtor.amount - amount);
        creditor.amount = roundTo2(creditor.amount - amount);

        if (debtor.amount < 0.01) {
            debtors.shift();
        }
        if (creditor.amount < 0.01) {
            creditors.shift();
        }
    }

    return transfers;
}

/**
 * Build a step-by-step trace of how each transfer resolves the net balances.
 * Returns one entry per transfer, showing the balance state after that transfer.
 * Useful for explaining *why* A pays B even if B never paid for A directly.
 */
export function buildSettlementTrace(
    initialBalances: Map<string, number>,
    transfers: SettlementTransfer[]
): Array<{ transfer: SettlementTransfer; balancesAfter: Map<string, number> }> {
    const current = new Map(
        Array.from(initialBalances.entries()).map(([k, v]) => [k, roundTo2(v)])
    );

    return transfers.map((transfer) => {
        // Paying reduces the payer's debt (moves toward 0 from negative)
        current.set(transfer.from, roundTo2((current.get(transfer.from) ?? 0) + transfer.amount));
        // Receiving reduces the creditor's credit (moves toward 0 from positive)
        current.set(transfer.to, roundTo2((current.get(transfer.to) ?? 0) - transfer.amount));
        return { transfer, balancesAfter: new Map(current) };
    });
}

/**
 * Calculate trip summary with aggregated balances and minimized settlements.
 */
export function getTripSummary(trip: Trip): TripSummary {
    const participantIds = trip.participants.map((p) => p.id);
    const aggregateBalances = new Map<string, number>();

    // Initialize all participants with 0
    for (const id of participantIds) {
        aggregateBalances.set(id, 0);
    }

    let totalGrandTotal = 0;

    // Sum up balances across all receipts. A receipt marked "settled" was
    // already squared up outside the app, so it still counts toward the trip
    // total but is excluded from the balances that drive the final settlement.
    for (const receipt of trip.receipts) {
        const summary = getReceiptSummary(receipt, participantIds);
        totalGrandTotal += summary.grandTotal;

        if (receipt.settled) continue;

        for (const [id, balance] of summary.balances) {
            const current = aggregateBalances.get(id) || 0;
            aggregateBalances.set(id, roundTo2(current + balance));
        }
    }

    const settlements = minimizeTransactions(aggregateBalances);

    return {
        totalGrandTotal: roundTo2(totalGrandTotal),
        aggregateBalances,
        settlements,
    };
}

/**
 * Get detailed person share breakdown with item list (for audit/transparency view).
 */
export function getPersonShareDetails(
    receipt: Receipt,
    participantIds: string[]
): PersonShareDetail[] {
    const subtotals = calculatePersonSubtotals(receipt.items, participantIds);
    const receiptSubtotal = calculateReceiptSubtotal(receipt.items);
    const { taxAllocations, serviceAllocations } = allocateTaxService(
        subtotals,
        receiptSubtotal,
        receipt.tax,
        receipt.service
    );

    const baseTotals = calculateBaseTotals(
        subtotals,
        taxAllocations,
        serviceAllocations,
        participantIds
    );
    const credits = calculateDiscountCredits(receipt, participantIds, baseTotals);

    const details: PersonShareDetail[] = [];

    for (const id of participantIds) {
        const subtotal = subtotals.get(id) || 0;
        const taxAlloc = taxAllocations.get(id) || 0;
        const serviceAlloc = serviceAllocations.get(id) || 0;

        // Build item breakdown for this person
        const items: ItemBreakdown[] = [];
        for (const item of receipt.items) {
            const assignment = item.assignments?.find((a) => a.participantId === id);

            if (assignment && assignment.qty > 0) {
                // Qty-based: show how many units this person took
                const active = item.assignments!.filter((a) => a.qty > 0);
                const totalAssignedQty = active.reduce((sum, a) => sum + a.qty, 0);
                const shareAmount =
                    totalAssignedQty > 0
                        ? roundTo2((assignment.qty / totalAssignedQty) * item.total)
                        : 0;
                items.push({
                    itemId: item.id,
                    itemName: item.name,
                    qty: item.qty,
                    personQty: assignment.qty,
                    itemTotal: item.total,
                    shareAmount,
                    sharedWith: active.length,
                });
            } else if (!item.assignments && item.assignedToIds.includes(id)) {
                // Equal split
                items.push({
                    itemId: item.id,
                    itemName: item.name,
                    qty: item.qty,
                    personQty: 1,
                    itemTotal: item.total,
                    shareAmount: roundTo2(item.total / item.assignedToIds.length),
                    sharedWith: item.assignedToIds.length,
                });
            }
        }

        const discount = credits.get(id) || 0;
        details.push({
            participantId: id,
            subtotal,
            taxAllocation: taxAlloc,
            serviceAllocation: serviceAlloc,
            discount,
            total: roundTo2(subtotal + taxAlloc + serviceAlloc - discount),
            items,
        });
    }

    return details;
}

/**
 * Get wallet stats for all participants in a trip (paid vs consumed).
 */
export function getWalletStats(
    trip: Trip
): WalletStats[] {
    const participantIds = trip.participants.map((p) => p.id);
    const stats = new Map<string, { paid: number; consumed: number }>();

    // Initialize all participants
    for (const id of participantIds) {
        stats.set(id, { paid: 0, consumed: 0 });
    }

    // Calculate for each receipt
    for (const receipt of trip.receipts) {
        const summary = getReceiptSummary(receipt, participantIds);

        // Add to payer's "paid" total — the actual cash fronted (after any
        // discounts that acted like money at payment), not the printed total.
        const payerStats = stats.get(receipt.payerId);
        if (payerStats) {
            payerStats.paid = roundTo2(payerStats.paid + summary.amountPaid);
        }

        // Add to each person's "consumed" total based on their share
        for (const share of summary.shares) {
            const personStats = stats.get(share.participantId);
            if (personStats) {
                personStats.consumed = roundTo2(personStats.consumed + share.total);
            }
        }
    }

    // Convert map to array
    const result: WalletStats[] = [];
    for (const id of participantIds) {
        const s = stats.get(id)!;
        result.push({
            participantId: id,
            totalPaid: s.paid,
            totalConsumed: s.consumed,
            netBalance: roundTo2(s.paid - s.consumed),
        });
    }

    return result;
}

