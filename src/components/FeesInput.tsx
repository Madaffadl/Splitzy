"use client";

import { useState } from "react";
import { Participant } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Info } from "@/components/ui/icons";
import { getCurrencyMeta } from "@/lib/currencies";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
}: FeesInputProps) {
  // Tax/service are entered in the receipt's native currency, so the input
  // prefix must match it (₫, ฿, …) — not a hardcoded "Rp". The stored value is
  // native; conversion to IDR happens at the trip level (receiptInBaseCurrency).
  const symbol = getCurrencyMeta(currency).symbol;
  const [draftTax, setDraftTax] = useState<string | null>(null);
  const [draftService, setDraftService] = useState<string | null>(null);

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

