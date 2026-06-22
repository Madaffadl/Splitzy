"use client";

import { useState } from "react";
import { ReceiptItem, Participant, ItemAssignment } from "@/types";
import { generateId, roundTo2 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Plus, Minus, Trash2, ShoppingCart } from "lucide-react";

interface ItemsTableProps {
  items: ReceiptItem[];
  participants: Participant[];
  onChange: (items: ReceiptItem[]) => void;
}

export function ItemsTable({ items, participants, onChange }: ItemsTableProps) {
  // Draft values for qty while user is actively editing — allows clearing the field
  // before typing a new number. Committed on blur; reverts on empty/invalid.
  const [draftQtys, setDraftQtys] = useState<Record<string, string>>({});

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

        // When qty changes, clear qty-based assignments to avoid stale data
        if ("qty" in updates && item.qty !== updated.qty) {
          updated.assignments = undefined;
          updated.assignedToIds = [];
        }

        return updated;
      })
    );
  };

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
    setDraftQtys((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
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

  // Set a specific person's qty for a qty-based item
  const updateAssignment = (itemId: string, participantId: string, newQty: number) => {
    onChange(
      items.map((item) => {
        if (item.id !== itemId) return item;

        const clampedQty = Math.max(0, newQty);
        const existing: ItemAssignment[] = item.assignments ?? [];
        const newAssignments: ItemAssignment[] = existing.some(
          (a) => a.participantId === participantId
        )
          ? existing.map((a) =>
              a.participantId === participantId ? { ...a, qty: clampedQty } : a
            )
          : [...existing, { participantId, qty: clampedQty }];

        const assignedToIds = newAssignments
          .filter((a) => a.qty > 0)
          .map((a) => a.participantId);

        return { ...item, assignments: newAssignments, assignedToIds };
      })
    );
  };

  // Distribute item qty as evenly as possible across all participants
  const distributeEvenly = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item || participants.length === 0) return;

    const n = participants.length;
    const base = Math.floor(item.qty / n);
    const remainder = item.qty % n;

    const newAssignments: ItemAssignment[] = participants.map((p, i) => ({
      participantId: p.id,
      qty: base + (i < remainder ? 1 : 0),
    }));

    const assignedToIds = newAssignments
      .filter((a) => a.qty > 0)
      .map((a) => a.participantId);

    onChange(
      items.map((i) =>
        i.id === itemId ? { ...i, assignments: newAssignments, assignedToIds } : i
      )
    );
  };

  // Switch item to qty-per-person mode (explicit opt-in by user)
  const enterQtyMode = (itemId: string) => {
    onChange(
      items.map((item) => {
        if (item.id !== itemId) return item;
        const newAssignments: ItemAssignment[] = participants.map((p) => ({
          participantId: p.id,
          qty: 0,
        }));
        return { ...item, assignments: newAssignments, assignedToIds: [] };
      })
    );
  };

  // Switch back to equal-split toggle mode, preserving who was assigned
  const exitQtyMode = (itemId: string) => {
    onChange(
      items.map((item) => {
        if (item.id !== itemId) return item;
        return { ...item, assignments: undefined };
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
            // Qty mode is user-controlled via enterQtyMode/exitQtyMode, not auto-triggered
            const isQtyMode = item.assignments !== undefined;
            const totalAssigned = item.assignments?.reduce((sum, a) => sum + a.qty, 0) ?? 0;
            const noAssignees = isQtyMode
              ? totalAssigned === 0
              : item.assignedToIds.length === 0;
            const allUnitsAssigned = isQtyMode && totalAssigned === item.qty;
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
                        value={item.id in draftQtys ? draftQtys[item.id] : item.qty}
                        onChange={(e) =>
                          setDraftQtys((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        onBlur={() => {
                          const draft = draftQtys[item.id];
                          if (draft !== undefined) {
                            const parsed = parseInt(draft, 10);
                            if (!isNaN(parsed) && parsed >= 1) {
                              updateItem(item.id, { qty: parsed });
                            }
                            // empty or invalid → discard draft, display reverts to item.qty
                            setDraftQtys((prev) => {
                              const next = { ...prev };
                              delete next[item.id];
                              return next;
                            });
                          }
                        }}
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
                        {isQtyMode ? "How many units per person?" : "Who’s having this?"}
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          isQtyMode ? distributeEvenly(item.id) : assignAll(item.id)
                        }
                        className="text-xs h-6"
                      >
                        {isQtyMode ? "Distribute Evenly" : "Select All"}
                      </Button>
                    </div>

                    {isQtyMode ? (
                      /* Qty-based stepper mode — user explicitly opted in */
                      <div
                        role="group"
                        aria-label={`Assign units of ${item.name || `item ${index + 1}`}`}
                        aria-describedby={noAssignees ? assignmentErrorId : undefined}
                        className="space-y-1.5"
                      >
                        {participants.map((participant) => {
                          const personQty =
                            item.assignments?.find(
                              (a) => a.participantId === participant.id
                            )?.qty ?? 0;
                          const canAdd = totalAssigned < item.qty;
                          return (
                            <div key={participant.id} className="flex items-center gap-3">
                              <span className="text-sm flex-1 truncate">{participant.name}</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  aria-label={`Remove one unit from ${participant.name}`}
                                  disabled={personQty <= 0}
                                  onClick={() =>
                                    updateAssignment(item.id, participant.id, personQty - 1)
                                  }
                                  className="w-7 h-7 rounded-md border flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-6 text-center text-sm font-semibold tabular-nums">
                                  {personQty}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Add one unit to ${participant.name}`}
                                  disabled={!canAdd}
                                  onClick={() =>
                                    updateAssignment(item.id, participant.id, personQty + 1)
                                  }
                                  className="w-7 h-7 rounded-md border flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Unit counter + back-to-equal button */}
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => exitQtyMode(item.id)}
                            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                          >
                            ← Equal split
                          </button>
                          <span
                            className={`text-xs font-medium ${
                              allUnitsAssigned
                                ? "text-emerald-600 dark:text-emerald-400"
                                : totalAssigned > 0
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {totalAssigned}/{item.qty} units{allUnitsAssigned ? " ✓" : ""}
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Equal-split toggle mode (default) */
                      <>
                        <div
                          role="group"
                          aria-label={`Assign ${item.name || `item ${index + 1}`} to`}
                          aria-describedby={noAssignees ? assignmentErrorId : undefined}
                          className="flex flex-wrap gap-2"
                        >
                          {participants.map((participant) => {
                            const isAssigned = item.assignedToIds.includes(participant.id);
                            return (
                              <button
                                type="button"
                                key={participant.id}
                                aria-pressed={isAssigned}
                                onClick={() => toggleAssignment(item.id, participant.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-all select-none shrink-0 ${
                                  isAssigned
                                    ? "bg-primary/15 border-primary/40 text-foreground font-medium shadow-sm"
                                    : "bg-background border-border hover:bg-muted/80 text-muted-foreground"
                                }`}
                              >
                                <div
                                  aria-hidden="true"
                                  className={`flex items-center justify-center w-3.5 h-3.5 rounded-full transition-colors ${
                                    isAssigned ? "bg-primary" : "border border-muted-foreground/50"
                                  }`}
                                >
                                  {isAssigned && (
                                    <div className="w-1.5 h-1.5 bg-background rounded-full" />
                                  )}
                                </div>
                                <span>{participant.name}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Opt-in to qty mode — only shown when item has multiple units */}
                        {item.qty > 1 && (
                          <button
                            type="button"
                            onClick={() => enterQtyMode(item.id)}
                            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                          >
                            Split by quantity →
                          </button>
                        )}
                      </>
                    )}

                    {noAssignees && (
                      <p
                        id={assignmentErrorId}
                        role="alert"
                        className="text-xs font-semibold text-destructive mt-1 flex items-center gap-1"
                      >
                        <span aria-hidden="true">⚠️</span> Item must be assigned to at least one
                        person
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
