// Core type definitions for SplitBill Trip

export interface Participant {
    id: string;
    name: string;
}

export interface ReceiptItem {
    id: string;
    name: string;
    qty: number;
    unitPrice: number;
    total: number;
    assignedToIds: string[];
}

export interface Receipt {
    id: string;
    title: string;
    date?: string;
    payerId: string;
    items: ReceiptItem[];
    tax: number;
    service: number;
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
    total: number;
}

export interface SettlementTransfer {
    from: string;
    to: string;
    amount: number;
}

export interface ReceiptSummary {
    receiptSubtotal: number;
    grandTotal: number;
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
    itemTotal: number;
    shareAmount: number;    // What this person pays for this item
    sharedWith: number;     // How many people share this item
}

// Extended person share with item breakdown
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
