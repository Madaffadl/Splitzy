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
