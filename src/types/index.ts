// Core type definitions for SplitBill Trip

// Optional bank/e-wallet details so people who owe money know where to transfer.
// Every field is optional — a participant may fill in only what they want, and
// the whole object is omitted when nothing meaningful is entered.
export interface PaymentInfo {
    bank?: string;          // Bank / e-wallet name, e.g. "BCA", "GoPay"
    accountNumber?: string; // Account / phone number ("No. Rekening")
    accountName?: string;   // Account holder name ("Nama Pemilik")
}

export interface Participant {
    id: string;
    name: string;
    // Where this person should be paid. Only meaningful for people who are owed
    // money (settlement recipients), but stored per-participant so single and
    // trip flows share one model.
    paymentInfo?: PaymentInfo;
}

export interface ItemAssignment {
    participantId: string;
    qty: number;
}

export interface ReceiptItem {
    id: string;
    name: string;
    qty: number;
    unitPrice: number;
    total: number;
    assignedToIds: string[];
    assignments?: ItemAssignment[]; // qty-per-person; used when item.qty > 1
}

// A manual discount not printed on the receipt (voucher, promo, coupon) that
// behaves like money at payment time. Modeled at three scopes so the *benefit*
// lands on the right people:
//   - "receipt": whole-bill discount, shared by everyone (proportional to total)
//   - "item": discount on one item, shared by that item's consumers
//   - "participant": a personal voucher, benefits only its owner
// `value` is Rupiah when type is "amount", or a percent (0-100) when "percent".
// `targetId` is the item id (scope "item") or participant id (scope "participant").
export type DiscountType = "amount" | "percent";
export type DiscountScope = "receipt" | "item" | "participant";

export interface Discount {
    id: string;
    scope: DiscountScope;
    type: DiscountType;
    value: number;
    label?: string;
    targetId?: string;
}

export interface Receipt {
    id: string;
    title: string;
    date?: string;
    payerId: string;
    items: ReceiptItem[];
    tax: number;
    service: number;
    discounts?: Discount[];
}

export interface Trip {
    id: string;
    name: string;
    participants: Participant[];
    receipts: Receipt[];
}

// Calculation result types
export interface PersonShare {
    participantId: string;
    subtotal: number;
    taxAllocation: number;
    serviceAllocation: number;
    // Discount credited to this person (their share of receipt/item discounts
    // plus any personal voucher), capped so `total` never goes below 0.
    discount: number;
    // Effective amount this person owes: subtotal + tax + service − discount.
    total: number;
}

export interface SettlementTransfer {
    from: string;
    to: string;
    amount: number;
}

export interface ReceiptSummary {
    receiptSubtotal: number;
    // Printed bill face value: subtotal + tax + service (before manual discounts).
    grandTotal: number;
    // Sum of discount credits actually applied across all participants.
    totalDiscount: number;
    // Actual cash handed to the merchant: grandTotal − totalDiscount. Equals the
    // sum of every person's effective share, and is what the payer really paid.
    amountPaid: number;
    shares: PersonShare[];
    balances: Map<string, number>;
}

export interface TripSummary {
    totalGrandTotal: number;
    aggregateBalances: Map<string, number>;
    settlements: SettlementTransfer[];
}

// Item breakdown for audit view (transparency)
export interface ItemBreakdown {
    itemId: string;
    itemName: string;
    qty: number;
    personQty: number;      // Units this person took (1 for equal-split items)
    itemTotal: number;
    shareAmount: number;    // What this person pays for this item
    sharedWith: number;     // How many people share this item
}

// Extended person share with item breakdown. Inherits `discount` from
// PersonShare; `total` is the effective (post-discount) amount owed.
export interface PersonShareDetail extends PersonShare {
    items: ItemBreakdown[];
}

// Wallet tracking for trip mode
export interface WalletStats {
    participantId: string;
    totalPaid: number;       // Total amount this person paid (receipts they covered)
    totalConsumed: number;   // Total amount this person consumed (their share)
    netBalance: number;      // totalPaid - totalConsumed
}

// Database user profile
export interface DbUser {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    createdAt: string;
}
