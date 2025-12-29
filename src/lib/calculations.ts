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
 * Equal split among all assigned participants.
 */
export function calculateItemShares(item: ReceiptItem): Map<string, number> {
    const shares = new Map<string, number>();

    if (item.assignedToIds.length === 0) {
        return shares; // Unassigned items return empty map
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

    // Handle edge case: zero subtotal
    if (receiptSubtotal === 0) {
        for (const id of personSubtotals.keys()) {
            taxAllocations.set(id, 0);
            serviceAllocations.set(id, 0);
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

    const shares: PersonShare[] = [];

    for (const id of participantIds) {
        const subtotal = subtotals.get(id) || 0;
        const taxAlloc = taxAllocations.get(id) || 0;
        const serviceAlloc = serviceAllocations.get(id) || 0;

        shares.push({
            participantId: id,
            subtotal,
            taxAllocation: taxAlloc,
            serviceAllocation: serviceAlloc,
            total: roundTo2(subtotal + taxAlloc + serviceAlloc),
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
    const receiptSubtotal = calculateReceiptSubtotal(receipt.items);
    const grandTotal = roundTo2(receiptSubtotal + receipt.tax + receipt.service);

    const balances = new Map<string, number>();

    for (const share of shares) {
        if (share.participantId === receipt.payerId) {
            // Payer: paid grandTotal, owes share.total
            balances.set(share.participantId, roundTo2(grandTotal - share.total));
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

    return {
        receiptSubtotal,
        grandTotal,
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
    const debtors: Array<{ id: string; amount: number }> = [];
    const creditors: Array<{ id: string; amount: number }> = [];

    for (const [id, balance] of balances) {
        if (balance < -0.01) {
            debtors.push({ id, amount: Math.abs(balance) });
        } else if (balance > 0.01) {
            creditors.push({ id, amount: balance });
        }
    }

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

    // Sum up balances across all receipts
    for (const receipt of trip.receipts) {
        const summary = getReceiptSummary(receipt, participantIds);
        totalGrandTotal += summary.grandTotal;

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

    const details: PersonShareDetail[] = [];

    for (const id of participantIds) {
        const subtotal = subtotals.get(id) || 0;
        const taxAlloc = taxAllocations.get(id) || 0;
        const serviceAlloc = serviceAllocations.get(id) || 0;

        // Build item breakdown for this person
        const items: ItemBreakdown[] = [];
        for (const item of receipt.items) {
            if (item.assignedToIds.includes(id)) {
                const shareAmount = roundTo2(item.total / item.assignedToIds.length);
                items.push({
                    itemId: item.id,
                    itemName: item.name,
                    qty: item.qty,
                    itemTotal: item.total,
                    shareAmount,
                    sharedWith: item.assignedToIds.length,
                });
            }
        }

        details.push({
            participantId: id,
            subtotal,
            taxAllocation: taxAlloc,
            serviceAllocation: serviceAlloc,
            total: roundTo2(subtotal + taxAlloc + serviceAlloc),
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

        // Add to payer's "paid" total
        const payerStats = stats.get(receipt.payerId);
        if (payerStats) {
            payerStats.paid = roundTo2(payerStats.paid + summary.grandTotal);
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

