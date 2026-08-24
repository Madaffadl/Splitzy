import {
    Receipt,
    ReceiptItem,
    ReceiptFee,
    PersonShare,
    PersonShareDetail,
    ItemBreakdown,
    ReceiptSummary,
    SettlementTransfer,
    TripSummary,
    TripPayment,
    Trip,
} from "@/types";
import { roundTo2 } from "./utils";

/**
 * A settle-up payment's value in the base currency (IDR).
 *
 * Foreign payments multiply by their locked fxRate; IDR payments (and any
 * payment with a missing/invalid rate) use `amount` as-is. Exported because
 * DISPLAY must use the same rule as the balance math — showing the raw native
 * `amount` next to an "Rp" label reported a $100 settle-up as "Rp 100" while
 * the ledger had correctly moved Rp 1.600.000.
 */
export function paymentInBaseCurrency(payment: TripPayment): number {
    return payment.currency && payment.currency !== "IDR" && payment.fxRate && payment.fxRate > 0
        ? roundTo2(payment.amount * payment.fxRate)
        : roundTo2(payment.amount);
}

/**
 * Apply recorded settle-up payments to a set of net balances (mutating a copy).
 * A payment `from → to` means `from` handed cash to `to`, so it reduces `from`'s
 * debt (moves toward 0 from negative) and reduces `to`'s credit (toward 0 from
 * positive). Returns a new Map; the input is not modified.
 */
export function applyPaymentsToBalances(
    balances: Map<string, number>,
    payments: TripPayment[]
): Map<string, number> {
    const next = new Map(balances);
    for (const p of payments) {
        if (!p || p.from === p.to) continue;
        const idrAmount = paymentInBaseCurrency(p);
        if (!(idrAmount > 0)) continue;
        // Apply only when BOTH endpoints are tracked participants. A payment that
        // references a removed participant would otherwise be half-applied (one
        // side moves, the other doesn't), silently breaking conservation so the
        // net balances no longer sum to zero.
        if (!next.has(p.from) || !next.has(p.to)) continue;
        next.set(p.from, roundTo2((next.get(p.from) ?? 0) + idrAmount));
        next.set(p.to, roundTo2((next.get(p.to) ?? 0) - idrAmount));
    }
    return next;
}

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

    const sharePerPerson = roundTo2(item.total / item.assignedToIds.length);
    let runningSum = 0;
    for (const participantId of item.assignedToIds) {
        shares.set(participantId, sharePerPerson);
        runningSum = roundTo2(runningSum + sharePerPerson);
    }

    // Fix rounding: an indivisible total (e.g. 100 / 3 = 33.33 × 3 = 99.99) would
    // otherwise leave the shares short of the item total, so the payer under-fronts
    // by a cent. Push the remainder onto the first assignee so shares reconcile
    // exactly to item.total (mirrors the qty-based branch above).
    const remainder = roundTo2(item.total - runningSum);
    if (remainder !== 0) {
        const first = item.assignedToIds[0];
        shares.set(first, roundTo2((shares.get(first) ?? 0) + remainder));
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
 * Allocate extra receipt fees (delivery, platform, etc.) to each participant.
 * "equal" fees split evenly regardless of item consumption.
 * "proportional" fees mirror how tax/service are distributed.
 */
export function allocateFees(
    personSubtotals: Map<string, number>,
    receiptSubtotal: number,
    fees: ReceiptFee[],
    participantIds: string[]
): Map<string, number> {
    const allocations = new Map<string, number>();
    for (const id of participantIds) allocations.set(id, 0);

    if (!fees || fees.length === 0) return allocations;

    const add = (id: string, amount: number) => {
        if (amount <= 0) return;
        allocations.set(id, roundTo2((allocations.get(id) || 0) + amount));
    };

    for (const fee of fees) {
        if (!fee.amount || fee.amount <= 0) continue;
        const n = participantIds.length;
        if (n === 0) continue;

        if (fee.splitMethod === "equal") {
            const share = roundTo2(fee.amount / n);
            let runningSum = 0;
            for (const id of participantIds) {
                add(id, share);
                runningSum = roundTo2(runningSum + share);
            }
            const remainder = roundTo2(fee.amount - runningSum);
            if (remainder !== 0) {
                const first = participantIds[0];
                allocations.set(first, roundTo2((allocations.get(first) || 0) + remainder));
            }
        } else {
            // proportional — same algorithm as allocateTaxService
            if (receiptSubtotal === 0) {
                const share = roundTo2(fee.amount / n);
                for (const id of participantIds) add(id, share);
            } else {
                const raw: Array<{ id: string; amount: number; subtotal: number }> = [];
                for (const [id, sub] of personSubtotals) {
                    raw.push({ id, amount: roundTo2((sub / receiptSubtotal) * fee.amount), subtotal: sub });
                }
                const sum = raw.reduce((s, a) => s + a.amount, 0);
                const rem = roundTo2(fee.amount - sum);
                if (rem !== 0 && raw.length > 0) {
                    const largest = raw.reduce((max, a) => (a.subtotal > max.subtotal ? a : max));
                    largest.amount = roundTo2(largest.amount + rem);
                }
                for (const alloc of raw) add(alloc.id, alloc.amount);
            }
        }
    }

    return allocations;
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

    const feesTotal = roundTo2((receipt.fees ?? []).reduce((s, f) => s + (f.amount || 0), 0));
    const grandTotal = roundTo2(
        calculateReceiptSubtotal(receipt.items) + receipt.tax + receipt.service + feesTotal
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
 * Base (pre-discount) totals per person: subtotal + tax + service + fees.
 */
function calculateBaseTotals(
    subtotals: Map<string, number>,
    taxAllocations: Map<string, number>,
    serviceAllocations: Map<string, number>,
    feesAllocations: Map<string, number>,
    participantIds: string[]
): Map<string, number> {
    const base = new Map<string, number>();
    for (const id of participantIds) {
        base.set(
            id,
            roundTo2(
                (subtotals.get(id) || 0) +
                    (taxAllocations.get(id) || 0) +
                    (serviceAllocations.get(id) || 0) +
                    (feesAllocations.get(id) || 0)
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
    const feesAllocations = allocateFees(subtotals, receiptSubtotal, receipt.fees ?? [], participantIds);

    const baseTotals = calculateBaseTotals(
        subtotals,
        taxAllocations,
        serviceAllocations,
        feesAllocations,
        participantIds
    );
    const credits = calculateDiscountCredits(receipt, participantIds, baseTotals);

    const shares: PersonShare[] = [];

    for (const id of participantIds) {
        const subtotal = subtotals.get(id) || 0;
        const taxAlloc = taxAllocations.get(id) || 0;
        const serviceAlloc = serviceAllocations.get(id) || 0;
        const feesAlloc = feesAllocations.get(id) || 0;
        const discount = credits.get(id) || 0;

        shares.push({
            participantId: id,
            subtotal,
            taxAllocation: taxAlloc,
            serviceAllocation: serviceAlloc,
            feesAllocation: feesAlloc,
            discount,
            total: roundTo2(subtotal + taxAlloc + serviceAlloc + feesAlloc - discount),
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

    // Gross per-receipt balances only. Settle-ups (who has paid whom) live in the
    // TripPayment ledger and are applied once, at the trip level, via
    // applyPaymentsToBalances — so there is a single source of truth and no way
    // to double-count a payment.
    const balances = new Map<string, number>();
    for (const share of shares) {
        if (share.participantId === receipt.payerId) {
            // Payer: fronted amountPaid, owes their own share.
            balances.set(share.participantId, roundTo2(amountPaid - share.total));
        } else {
            // Others: paid 0, owe share.total
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
    const feesTotal = roundTo2((receipt.fees ?? []).reduce((s, f) => s + (f.amount || 0), 0));
    const grandTotal = roundTo2(receiptSubtotal + receipt.tax + receipt.service + feesTotal);
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

/** Everything a trip-level summary needs, computed in one place. */
export interface TripTotals {
    aggregateBalances: Map<string, number>;
    settlements: SettlementTransfer[];
    totalGrandTotal: number; // printed bill face value across all receipts
    totalDiscount: number;   // discount credits applied across all receipts
    totalPaid: number;       // actual cash fronted (grandTotal − discount)
}

/** True when a receipt is in a currency other than the IDR base. */
export function isForeignReceipt(receipt: Receipt): boolean {
    return Boolean(receipt.currency && receipt.currency !== "IDR");
}

/**
 * A foreign receipt that cannot be converted, because no usable rate is locked
 * (missing, zero, negative, or non-finite).
 *
 * `receiptInBaseCurrency` returns such a receipt untouched, so its NATIVE
 * amounts flow into IDR aggregates at 1:1 — a ฿1.000 dinner lands in the trip
 * total as Rp 1.000. Nothing about that is recoverable from the numbers alone,
 * so any surface that shows a converted total has to check this and say so
 * rather than let a wrong figure look authoritative.
 */
export function needsFxRate(receipt: Receipt): boolean {
    return (
        isForeignReceipt(receipt) &&
        !(typeof receipt.fxRate === "number" && Number.isFinite(receipt.fxRate) && receipt.fxRate > 0)
    );
}

/**
 * Convert a receipt's monetary fields into the trip's base currency (IDR) using
 * its locked fxRate, returning a new receipt whose `currency`/`fxRate` are
 * cleared. Non-foreign receipts (IDR, or missing/invalid rate) are returned
 * unchanged — see `needsFxRate` for why the latter needs surfacing.
 *
 * ANY aggregation across multiple receipts MUST run each receipt through this
 * first — otherwise native amounts of different currencies get summed together
 * (mixing e.g. ₫ and Rp). This is the single conversion point so every
 * trip-level view converts identically and can't drift.
 */
export function receiptInBaseCurrency(receipt: Receipt): Receipt {
    const rate = isForeignReceipt(receipt) && !needsFxRate(receipt) ? receipt.fxRate! : 1;
    if (rate === 1) return receipt;
    return {
        ...receipt,
        items: receipt.items.map((it) => ({
            ...it,
            unitPrice: roundTo2(it.unitPrice * rate),
            total: roundTo2(it.total * rate),
        })),
        tax: roundTo2(receipt.tax * rate),
        service: roundTo2(receipt.service * rate),
        // Fee amounts are always absolute — they all scale with FX.
        fees: receipt.fees?.map((f) => ({ ...f, amount: roundTo2(f.amount * rate) })),
        // Only fixed-amount discounts scale with FX; percentages are rate-invariant.
        discounts: receipt.discounts?.map((d) =>
            d.type === "amount" ? { ...d, value: roundTo2(d.value * rate) } : d
        ),
        currency: undefined,
        fxRate: undefined,
    };
}

/**
 * Single source of truth for trip-level money math: gross per-receipt balances,
 * minus recorded settle-up payments, then minimized into transfers — plus the
 * headline totals. Both getTripSummary and the summary UI use this so they can
 * never diverge. Foreign-currency receipts are converted to the base currency
 * (IDR) via receiptInBaseCurrency before accumulation.
 */
export function computeTripTotals(
    receipts: Receipt[],
    participantIds: string[],
    payments: TripPayment[] = []
): TripTotals {
    const balances = new Map<string, number>();
    for (const id of participantIds) balances.set(id, 0);

    let totalGrandTotal = 0;
    let totalDiscount = 0;
    let totalPaid = 0;

    // Gross per-receipt balances (in base currency); settle-ups applied below.
    for (const receipt of receipts) {
        const summary = getReceiptSummary(receiptInBaseCurrency(receipt), participantIds);
        totalGrandTotal = roundTo2(totalGrandTotal + summary.grandTotal);
        totalDiscount = roundTo2(totalDiscount + summary.totalDiscount);
        totalPaid = roundTo2(totalPaid + summary.amountPaid);

        for (const [id, balance] of summary.balances) {
            balances.set(id, roundTo2((balances.get(id) || 0) + balance));
        }
    }

    // Recorded settle-up payments (the single source of truth for what has been
    // paid) reduce the outstanding balances.
    const aggregateBalances = applyPaymentsToBalances(balances, payments);
    const settlements = minimizeTransactions(aggregateBalances);

    return { aggregateBalances, settlements, totalGrandTotal, totalDiscount, totalPaid };
}

/**
 * Calculate trip summary with aggregated balances and minimized settlements.
 */
export function getTripSummary(trip: Trip, payments: TripPayment[] = []): TripSummary {
    const participantIds = trip.participants.map((p) => p.id);
    const { aggregateBalances, settlements, totalGrandTotal } = computeTripTotals(
        trip.receipts,
        participantIds,
        payments
    );
    return { totalGrandTotal, aggregateBalances, settlements };
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
    const feesAllocations = allocateFees(subtotals, receiptSubtotal, receipt.fees ?? [], participantIds);

    const baseTotals = calculateBaseTotals(
        subtotals,
        taxAllocations,
        serviceAllocations,
        feesAllocations,
        participantIds
    );
    const credits = calculateDiscountCredits(receipt, participantIds, baseTotals);

    const details: PersonShareDetail[] = [];

    for (const id of participantIds) {
        const subtotal = subtotals.get(id) || 0;
        const taxAlloc = taxAllocations.get(id) || 0;
        const serviceAlloc = serviceAllocations.get(id) || 0;
        const feesAlloc = feesAllocations.get(id) || 0;

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
            feesAllocation: feesAlloc,
            discount,
            total: roundTo2(subtotal + taxAlloc + serviceAlloc + feesAlloc - discount),
            items,
        });
    }

    return details;
}


