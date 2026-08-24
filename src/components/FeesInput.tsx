"use client";

import { useState } from "react";
import { Participant, ReceiptFee } from "@/types";
import { formatCurrency, generateId } from "@/lib/utils";
import { Info, Plus, Trash2 } from "@/components/ui/icons";
import { getCurrencyMeta } from "@/lib/currencies";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Receipt, User } from "@/components/ui/icons";

interface FeesInputProps {
  tax: number;
  service: number;
  payerId: string;
  participants: Participant[];
  onTaxChange: (tax: number) => void;
  onServiceChange: (service: number) => void;
  onPayerChange: (payerId: string) => void;
  // Receipt's native currency (Travel Spend). Undefined = IDR → "Rp" prefix.
  currency?: string;
  // Extra fees (delivery, platform, etc.) — optional, from online receipts.
  fees?: ReceiptFee[];
  onFeesChange?: (fees: ReceiptFee[]) => void;
}

export function FeesInput({
  tax,
  service,
  payerId,
  participants,
  onTaxChange,
  onServiceChange,
  onPayerChange,
  currency,
  fees = [],
  onFeesChange,
}: FeesInputProps) {
  const symbol = getCurrencyMeta(currency).symbol;
  const [draftTax, setDraftTax] = useState<string | null>(null);
  const [draftService, setDraftService] = useState<string | null>(null);
  const [newFeeLabel, setNewFeeLabel] = useState("");
  const [newFeeAmount, setNewFeeAmount] = useState("");
  const [newFeeSplit, setNewFeeSplit] = useState<"equal" | "proportional">("equal");

  const parseAmount = (s: string): number => {
    const val = parseFloat(s.replace(/\./g, "").replace(/,/g, "."));
    return isNaN(val) || val < 0 ? 0 : val;
  };

  return (
    <div className="space-y-6">
      {/* Tax and Service */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Tax
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
              {symbol}
            </span>
            <Input
              type="text"
              inputMode="numeric"
              value={draftTax !== null ? draftTax : tax ? formatCurrency(tax) : ""}
              onFocus={() => setDraftTax(tax ? String(tax) : "")}
              onChange={(e) => setDraftTax(e.target.value)}
              onBlur={() => {
                if (draftTax !== null) {
                  onTaxChange(parseAmount(draftTax));
                  setDraftTax(null);
                }
              }}
              className="pl-10"
              placeholder="0"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Service Charge
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
              {symbol}
            </span>
            <Input
              type="text"
              inputMode="numeric"
              value={draftService !== null ? draftService : service ? formatCurrency(service) : ""}
              onFocus={() => setDraftService(service ? String(service) : "")}
              onChange={(e) => setDraftService(e.target.value)}
              onBlur={() => {
                if (draftService !== null) {
                  onServiceChange(parseAmount(draftService));
                  setDraftService(null);
                }
              }}
              className="pl-10"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Info Block */}
      <div className="flex items-start gap-2 p-3 bg-muted/40 rounded-lg text-xs sm:text-sm text-muted-foreground">
        <div className="mt-0.5 shrink-0 text-primary">
          <Info className="h-4 w-4" />
        </div>
        <p>
          Tax and service charges are <span className="font-medium text-foreground">scaled proportionally</span> based on each person&rsquo;s subtotal share.
        </p>
      </div>

      {/* Extra fees (delivery, platform, etc.) */}
      {onFeesChange && (
        <div className="space-y-3 pt-2 border-t">
          <Label className="text-sm font-medium">Other Fees</Label>
          <p className="text-xs text-muted-foreground -mt-1">
            Delivery fee, platform fee, packaging, etc. — typically split equally.
          </p>

          {/* Existing fees */}
          {fees.map((fee) => (
            <div key={fee.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate font-medium">{fee.label}</span>
              <span className="text-muted-foreground text-xs">
                {fee.splitMethod === "equal" ? "equal" : "proportional"}
              </span>
              <span className="whitespace-nowrap">{symbol} {formatCurrency(fee.amount)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                onClick={() => onFeesChange(fees.filter((f) => f.id !== fee.id))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {/* Add fee row */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Label</Label>
              <Input
                value={newFeeLabel}
                onChange={(e) => setNewFeeLabel(e.target.value)}
                placeholder="Delivery Fee"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Amount</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                  {symbol}
                </span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={newFeeAmount}
                  onChange={(e) => setNewFeeAmount(e.target.value)}
                  placeholder="0"
                  className="pl-8 h-9 text-sm w-28"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Split</Label>
              <Select value={newFeeSplit} onValueChange={(v) => setNewFeeSplit(v as "equal" | "proportional")}>
                <SelectTrigger className="h-9 text-sm w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal">Equal</SelectItem>
                  <SelectItem value="proportional">Proportional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={!newFeeLabel.trim() || !newFeeAmount.trim()}
              onClick={() => {
                const val = parseAmount(newFeeAmount);
                if (!newFeeLabel.trim() || val <= 0) return;
                onFeesChange([
                  ...fees,
                  { id: generateId(), label: newFeeLabel.trim(), amount: val, splitMethod: newFeeSplit },
                ]);
                setNewFeeLabel("");
                setNewFeeAmount("");
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Payer Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Who paid?
        </Label>
        {participants.length > 0 ? (
          <Select value={payerId} onValueChange={onPayerChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select payer..." />
            </SelectTrigger>
            <SelectContent>
              {participants.map((participant) => (
                <SelectItem key={participant.id} value={participant.id}>
                  {participant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
            Add participants first
          </p>
        )}
        {participants.length > 0 && !payerId && (
          <p className="text-xs text-amber-600 dark:text-amber-400">⚠️ Please select who paid</p>
        )}
      </div>
    </div>
  );
}

