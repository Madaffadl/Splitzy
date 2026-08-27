"use client";

import { useId, useState } from "react";
import {
  Discount,
  DiscountScope,
  DiscountType,
  ReceiptItem,
  Participant,
} from "@/types";
import { cn, generateId } from "@/lib/utils";
import { canAddDiscount, discountInputError } from "@/lib/receipt/input-limits";
import { formatDiscountValue, describeDiscountTarget } from "@/lib/receipt/discounts";
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
import { fill, useDictionary } from "@/lib/i18n/use-locale";

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
  const t = useDictionary().app.discounts;
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
  const typeLabelId = useId();

  const open = expanded || discounts.length > 0;

  const parseValue = (s: string): number => {
    const v = parseFloat(s.replace(/\./g, "").replace(/,/g, "."));
    return isNaN(v) || v < 0 ? 0 : v;
  };

  const numericValue = parseValue(value);

  // Rules live in lib/input-limits so they can be tested and so they read from
  // the same caps the server enforces. A 150% discount and an unselected item
  // used to look identical from the outside — both just greyed the button out.
  const discountCheck = {
    value,
    type,
    scope,
    targetId,
    existingCount: discounts.length,
  };
  const discountError = discountInputError(discountCheck);
  const canAdd = canAddDiscount(discountCheck);

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
        {t.addTrigger}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header — lets the user collapse again while nothing is entered yet. */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Tag className="h-4 w-4 text-success" />
          {t.heading}
        </div>
        {discounts.length === 0 && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {t.hide}
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
                    ? t.wholeBill
                    : `${d.scope === "item" ? t.item : t.person}: ${describeDiscountTarget(d, items, participants)}`}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-success">
                − {formatDiscountValue(d, currency)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(d.id)}
                aria-label={t.removeAria}
                className="touch-manipulation h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
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
            <Label className="text-xs">{t.appliesTo}</Label>
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
                <SelectItem value="receipt">{t.wholeBill}</SelectItem>
                <SelectItem value="item">{t.anItem}</SelectItem>
                <SelectItem value="participant">{t.aPerson}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "item" && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t.item}</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder={t.selectItem} />
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
              <Label className="text-xs">{t.person}</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder={t.selectPerson} />
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
            <Label className="text-xs" id={typeLabelId}>
              {t.type}
            </Label>
            {/* A radiogroup, not two plain buttons. Which one is selected
                decides whether "10" means Rp 10 or 10% off the bill, and it was
                conveyed by background colour alone — nothing a screen reader
                could read, and nothing that survives colour blindness. */}
            <div
              role="radiogroup"
              aria-labelledby={typeLabelId}
              className="flex h-11 rounded-md border overflow-hidden sm:h-9"
            >
              <button
                type="button"
                role="radio"
                aria-checked={type === "amount"}
                aria-label={fill(t.inCurrency, { symbol })}
                onClick={() => setType("amount")}
                className={cn(
                  "touch-manipulation px-4 text-sm font-medium transition-colors",
                  type === "amount"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                )}
              >
                {symbol}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={type === "percent"}
                aria-label={t.inPercent}
                onClick={() => setType("percent")}
                className={cn(
                  "touch-manipulation px-4 text-sm font-medium transition-colors",
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
            <Label className="text-xs">{t.value}</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "percent" ? t.percentPlaceholder : t.amountPlaceholder}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t.labelOptional}</Label>
          <Input
            value={label}
            maxLength={60}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t.labelPlaceholder}
          />
        </div>

        {discountError && (
          <p role="status" className="text-xs text-warning">
            {discountError}
          </p>
        )}

        <Button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          variant="secondary"
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t.add}
        </Button>
      </div>
    </div>
  );
}
