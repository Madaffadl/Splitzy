"use client";

import { Receipt, Participant, PaymentInfo } from "@/types";
import { ReceiptInput } from "@/components/ReceiptInput";
import { ItemsTable } from "@/components/ItemsTable";
import { FeesInput } from "@/components/FeesInput";
import { DiscountsInput } from "@/components/DiscountsInput";
import { SummaryPanel } from "@/components/SummaryPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X } from "lucide-react";

interface ReceiptEditorProps {
  receipt: Receipt;
  participants: Participant[];
  isNew: boolean;
  onChange: (updates: Partial<Receipt>) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  onUpdatePaymentInfo?: (participantId: string, info: PaymentInfo | undefined) => void;
  // Travel Spend only: when provided, the preview's per-person breakdown gets a
  // real mark-as-paid checkbox (bound to receipt.paidBy, persisted on save so it
  // syncs to the trip settlement). Single/Multiple don't pass this.
  onTogglePaidShare?: (participantId: string) => void;
}

// Full itemized receipt editor shared by Multiple Receipts and Travel Spend:
// scan/manual items, per-quantity assignment, tax/service + payer, discounts,
// with a live summary preview. Keeping it in one place means both modes get the
// same capabilities without duplicating the form.
export function ReceiptEditor({
  receipt,
  participants,
  isNew,
  onChange,
  onSave,
  onCancel,
  isSaving = false,
  onUpdatePaymentInfo,
  onTogglePaidShare,
}: ReceiptEditorProps) {
  const hasItems = receipt.items.length > 0;
  const allAssigned = receipt.items.every(
    (item) => item.total > 0 && item.assignedToIds.length > 0
  );
  const hasPayer = !!receipt.payerId;
  const canSave = hasItems && allAssigned && hasPayer;

  let blockMsg: string | null = null;
  if (!hasItems) blockMsg = "Add at least one item.";
  else if (!allAssigned) {
    const unassigned = receipt.items.filter((i) => i.assignedToIds.length === 0).length;
    blockMsg =
      unassigned > 0
        ? `Assign ${unassigned} item${unassigned > 1 ? "s" : ""} to at least one person.`
        : "Every item needs a price.";
  } else if (!hasPayer) blockMsg = "Select who paid the bill.";

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{isNew ? "New Receipt" : "Edit Receipt"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Receipt Title</Label>
              <Input
                value={receipt.title}
                onChange={(e) => onChange({ title: e.target.value })}
                placeholder="e.g., Lunch at Cafe"
              />
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-medium mb-4">Add Items</h3>
              <ReceiptInput
                onParsed={(result) =>
                  onChange({
                    items: [...receipt.items, ...result.items],
                    tax: result.tax || receipt.tax,
                    service: result.service || receipt.service,
                  })
                }
              />
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-medium mb-4">Items & Assignments</h3>
              <ItemsTable
                items={receipt.items}
                participants={participants}
                onChange={(items) => onChange({ items })}
              />
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-medium mb-4">Fees & Payer</h3>
              <FeesInput
                tax={receipt.tax}
                service={receipt.service}
                payerId={receipt.payerId}
                participants={participants}
                onTaxChange={(tax) => onChange({ tax })}
                onServiceChange={(service) => onChange({ service })}
                onPayerChange={(payerId) => onChange({ payerId })}
              />
            </div>

            <div className="pt-4 border-t">
              <DiscountsInput
                discounts={receipt.discounts ?? []}
                items={receipt.items}
                participants={participants}
                onChange={(discounts) => onChange({ discounts })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save/Cancel — sticky offset respects iOS safe-area (home indicator) */}
        <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] mx-2 md:mx-0 p-4 bg-background/80 backdrop-blur-xl border rounded-2xl shadow-premium-lg z-20">
          {blockMsg && (
            <p role="status" className="mb-2 text-right text-xs font-medium text-amber-600 dark:text-amber-400">
              ⚠️ {blockMsg}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel} className="bg-background/50 hover:bg-muted">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={onSave} disabled={!canSave || isSaving} className="shadow-md shadow-primary/20">
              <Check className="h-4 w-4 mr-2" />
              Save Receipt
            </Button>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div>
        <ErrorBoundary label="the receipt preview">
          <SummaryPanel
            receipt={receipt}
            participants={participants}
            title={receipt.title}
            onUpdatePaymentInfo={onUpdatePaymentInfo}
            // Travel only (onTogglePaidShare provided): real mark-as-paid lives on
            // the per-person rows (persisted with the receipt → syncs to the trip
            // settlement), so the minimized "Settlements" list is kept static to
            // avoid a second, cosmetic toggle. Single/Multiple are untouched.
            settlementReadOnly={!!onTogglePaidShare}
            onTogglePaidShare={onTogglePaidShare}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
