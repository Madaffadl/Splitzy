"use client";

import { ReceiptItem, Participant } from "@/types";
import { generateId, roundTo2 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ShoppingCart } from "lucide-react";

interface ItemsTableProps {
  items: ReceiptItem[];
  participants: Participant[];
  onChange: (items: ReceiptItem[]) => void;
}

export function ItemsTable({ items, participants, onChange }: ItemsTableProps) {
  const addItem = () => {
    const newItem: ReceiptItem = {
      id: generateId(),
      name: "",
      qty: 1,
      unitPrice: 0,
      total: 0,
      assignedToIds: [],
    };
    onChange([...items, newItem]);
  };

  const updateItem = (id: string, updates: Partial<ReceiptItem>) => {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, ...updates };

        // Sync total with qty * unitPrice if qty or unitPrice changed
        if ("qty" in updates || "unitPrice" in updates) {
          updated.total = roundTo2(updated.qty * updated.unitPrice);
        }
        // If total is manually edited, update unitPrice
        if ("total" in updates && !("qty" in updates) && !("unitPrice" in updates)) {
          updated.unitPrice = roundTo2(updated.total / updated.qty);
        }

        return updated;
      })
    );
  };

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const toggleAssignment = (itemId: string, participantId: string) => {
    onChange(
      items.map((item) => {
        if (item.id !== itemId) return item;

        const isAssigned = item.assignedToIds.includes(participantId);
        return {
          ...item,
          assignedToIds: isAssigned
            ? item.assignedToIds.filter((id) => id !== participantId)
            : [...item.assignedToIds, participantId],
        };
      })
    );
  };

  const assignAll = (itemId: string) => {
    onChange(
      items.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          assignedToIds: participants.map((p) => p.id),
        };
      })
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ShoppingCart className="h-4 w-4" />
          <span className="text-sm font-medium">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
        </div>
        <Button type="button" onClick={addItem} size="sm" variant="outline" className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Add Item Manually</span>
          <span className="sm:hidden">Add Manual</span>
        </Button>
      </div>

      {/* Error message id is shared per-item between the input and the inline
          warning so screen readers announce the cause when the field gets
          aria-invalid + aria-describedby. */}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed bg-muted/20 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <ShoppingCart className="h-6 w-6 text-muted-foreground opacity-50" />
          </div>
          <p className="font-semibold text-foreground mb-1">No items yet</p>
          <p className="text-sm text-muted-foreground max-w-sm">Scan a receipt or add items manually to start splitting the bill.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => {
            const nameInvalid = !item.name.trim();
            const totalInvalid = item.total <= 0;
            const noAssignees = item.assignedToIds.length === 0;
            const assignmentErrorId = `item-${item.id}-assignment-error`;
            const totalErrorId = `item-${item.id}-total-error`;
            const nameErrorId = `item-${item.id}-name-error`;
            return (
              <div
                key={item.id}
                className="p-4 rounded-lg border bg-card space-y-4"
              >
                {/* Item details row */}
                <div className="space-y-3">
                  {/* Item Name - Full width */}
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">
                        Item #{index + 1}
                      </Label>
                      <Input
                        placeholder="Item name"
                        value={item.name}
                        onChange={(e) =>
                          updateItem(item.id, { name: e.target.value })
                        }
                        aria-invalid={nameInvalid || undefined}
                        aria-describedby={nameInvalid ? nameErrorId : undefined}
                      />
                      {nameInvalid && (
                        <p id={nameErrorId} className="sr-only">
                          Item name is required
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label={`Remove item ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Qty, Price, Total - 3 columns */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Qty</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min="1"
                        required
                        value={item.qty}
                        onChange={(e) =>
                          updateItem(item.id, {
                            qty: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Price
                      </Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={item.unitPrice || ""}
                        onChange={(e) =>
                          updateItem(item.id, {
                            unitPrice: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Total</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        required
                        value={item.total || ""}
                        onChange={(e) =>
                          updateItem(item.id, {
                            total: parseFloat(e.target.value) || 0,
                          })
                        }
                        aria-invalid={totalInvalid || undefined}
                        aria-describedby={totalInvalid ? totalErrorId : undefined}
                        className="font-semibold"
                      />
                      {totalInvalid && (
                        <p id={totalErrorId} className="sr-only">
                          Total must be greater than zero
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Assignment row */}
                {participants.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        Who&rsquo;s having this?
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => assignAll(item.id)}
                        className="text-xs h-6"
                      >
                        Select All
                      </Button>
                    </div>
                    {/* role="group" doesn't support aria-invalid; we surface
                        the error state via the inline alert below + per-button
                        pressed state. The describedby points to the alert so
                        screen readers announce the cause when focus enters. */}
                    <div
                      role="group"
                      aria-label={`Assign ${item.name || `item ${index + 1}`} to`}
                      aria-describedby={noAssignees ? assignmentErrorId : undefined}
                      className="flex flex-wrap gap-2"
                    >
                      {participants.map((participant) => {
                        const isAssigned = item.assignedToIds.includes(
                          participant.id
                        );
                        return (
                          <button
                            type="button"
                            key={participant.id}
                            aria-pressed={isAssigned}
                            onClick={() => toggleAssignment(item.id, participant.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-all select-none shrink-0 ${
                              isAssigned
                                ? 'bg-primary/15 border-primary/40 text-foreground font-medium shadow-sm'
                                : 'bg-background border-border hover:bg-muted/80 text-muted-foreground'
                            }`}
                          >
                            <div
                              aria-hidden="true"
                              className={`flex items-center justify-center w-3.5 h-3.5 rounded-full transition-colors ${
                                isAssigned ? 'bg-primary' : 'border border-muted-foreground/50'
                              }`}
                            >
                              {isAssigned && <div className="w-1.5 h-1.5 bg-background rounded-full" />}
                            </div>
                            <span>{participant.name}</span>
                          </button>
                        );
                      })}
                    </div>
                    {noAssignees && (
                      <p
                        id={assignmentErrorId}
                        role="alert"
                        className="text-xs font-semibold text-destructive mt-1 flex items-center gap-1"
                      >
                        <span aria-hidden="true">⚠️</span> Item must be assigned to at least one person
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
