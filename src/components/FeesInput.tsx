"use client";

import { Participant } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Receipt, User } from "lucide-react";

interface FeesInputProps {
  tax: number;
  service: number;
  payerId: string;
  participants: Participant[];
  onTaxChange: (tax: number) => void;
  onServiceChange: (service: number) => void;
  onPayerChange: (payerId: string) => void;
}

export function FeesInput({
  tax,
  service,
  payerId,
  participants,
  onTaxChange,
  onServiceChange,
  onPayerChange,
}: FeesInputProps) {
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
              Rp
            </span>
            <Input
              type="number"
              min="0"
              step="100"
              value={tax || ""}
              onChange={(e) => onTaxChange(parseFloat(e.target.value) || 0)}
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
              Rp
            </span>
            <Input
              type="number"
              min="0"
              step="100"
              value={service || ""}
              onChange={(e) => onServiceChange(parseFloat(e.target.value) || 0)}
              className="pl-10"
              placeholder="0"
            />
          </div>
        </div>
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
          <p className="text-xs text-amber-600">⚠️ Please select who paid</p>
        )}
      </div>
    </div>
  );
}

