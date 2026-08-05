"use client";

import { useState } from "react";
import {
  Discount,
  DiscountScope,
  DiscountType,
  ReceiptItem,
  Participant,
} from "@/types";
import { cn, generateId } from "@/lib/utils";
import { formatDiscountValue, describeDiscountTarget } from "@/lib/discounts";
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
import { Plus, Trash2, Tag } from "@/components/ui/icons";

interface DiscountsInputProps {
  discounts: Discount[];
  items: ReceiptItem[];
  participants: Participant[];
  onChange: (discounts: Discount[]) => void;
  // Receipt's native currency (Travel Spend). Undefined = IDR → "Rp".
  currency?: string;
}

export function DiscountsInput({
  discounts,
  items,
  participants,
  onChange,
  currency,
}: DiscountsInputProps) {
  // Amount discounts are entered in the receipt's native currency, so the
  // "amount" toggle shows that symbol (₫, ฿, …) instead of a hardcoded "Rp".
  const symbol = getCurrencyMeta(currency).symbol;
  // Progressive disclosure: discounts are an edge case, so keep the panel
  // collapsed behind a lightweight trigger by default. Force it open whenever
  // discounts already exist so we never hide data the user entered.
  const [expanded, setExpanded] = useState(false);
  const [scope, setScope] = useState<DiscountScope>("receipt");
  const [type, setType] = useState<DiscountType>("amount");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [targetId, setTargetId] = useState("");

  const open = expanded || discounts.length > 0;

  const parseValue = (s: string): number => {
    const v = parseFloat(s.replace(/\./g, "").replace(/,/g, "."));
    return isNaN(v) || v < 0 ? 0 : v;
  };

  const numericValue = parseValue(value);
  const needsTarget = scope === "item" || scope === "participant";
  const canAdd =
    numericValue > 0 &&
    !(type === "percent" && numericValue > 100) &&
    (!needsTarget || !!targetId);

  const handleAdd = () => {
    if (!canAdd) return;
    const discount: Discount = {
      id: generateId(),
      scope,
      type,
      value: numericValue,
      ...(label.trim() ? { label: label.trim() } : {}),
      ...(scope !== "receipt" ? { targetId } : {}),
    };
    onChange([...discounts, discount]);
    setValue("");
    setLabel("");
    setTargetId("");
  };

  const handleRemove = (id: string) =>
    onChange(discounts.filter((d) => d.id !== id));

  // Collapsed: a single opt-in trigger, styled as a secondary action.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
      >
        <Tag className="h-4 w-4" />
        Add a discount or voucher
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header — lets the user collapse again while nothing is entered yet. */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Tag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Discounts &amp; Vouchers
        </div>
        {discounts.length === 0 && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Hide
          </button>
        )}
      </div>

      {/* Existing discounts */}
      {discounts.length > 0 && (
        <div className="space-y-2">
          {discounts.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {d.label || describeDiscountTarget(d, items, participants)}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {d.scope === "receipt"
                    ? "Whole bill"
                    : `${d.scope === "item" ? "Item" : "Person"}: ${describeDiscountTarget(d, items, participants)}`}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                − {formatDiscountValue(d, currency)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(d.id)}
                aria-label="Remove discount"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="space-y-3 rounded-lg border border-dashed p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Applies to</Label>
            <Select
              value={scope}
              onValueChange={(v) => {
                setScope(v as DiscountScope);
                setTargetId("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="receipt">Whole bill</SelectItem>
                <SelectItem value="item">An item</SelectItem>
                <SelectItem value="participant">A person (voucher)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "item" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Item</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((it, i) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.name || `Item ${i + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {scope === "participant" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Person</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select person" />
                </SelectTrigger>
                <SelectContent>
                  {participants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <div className="flex rounded-md border overflow-hidden">
              <button
                type="button"
                onClick={() => setType("amount")}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors",
                  type === "amount"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                )}
              >
                {symbol}
              </button>
              <button
                type="button"
                onClick={() => setType("percent")}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors",
                  type === "percent"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                )}
              >
                %
              </button>
            </div>
          </div>
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Value</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "percent" ? "e.g. 10" : "e.g. 50000"}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Label (optional)</Label>
          <Input
            value={label}
            maxLength={60}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. GoFood voucher"
          />
        </div>

        <Button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          variant="secondary"
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add discount
        </Button>
      </div>
    </div>
  );
}
