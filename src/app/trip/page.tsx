"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Participant, ReceiptItem, Receipt, Trip } from "@/types";
import { useHybridState } from "@/hooks/useHybridState";
import { generateId } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";
import { ParticipantManager } from "@/components/ParticipantManager";
import { useToast } from "@/components/ui/toast";
import { ReceiptInput } from "@/components/ReceiptInput";
import { ItemsTable } from "@/components/ItemsTable";
import { FeesInput } from "@/components/FeesInput";
import { SummaryPanel, TripSummaryPanel } from "@/components/SummaryPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  RotateCcw,
  Plus,
  Plane,
  Receipt as ReceiptIcon,
  Trash2,
  Edit2,
  Check,
  X,
  Users,
  Info,
} from "lucide-react";
import { AppFooter } from "@/components/AppFooter";

interface TripState {
  trip: Trip;
}

const DEFAULT_TRIP: Trip = {
  id: generateId(),
  name: "My Trip",
  participants: [],
  receipts: [],
};

const DEFAULT_STATE: TripState = {
  trip: DEFAULT_TRIP,
};

type ViewMode = "overview" | "edit-receipt";

interface EditingReceipt {
  receipt: Receipt;
  isNew: boolean;
}

export default function TripPage() {
  const [state, setState, resetState] = useHybridState<TripState>(
    "splitbill-trips",
    DEFAULT_STATE
  );
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [editingReceipt, setEditingReceipt] = useState<EditingReceipt | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  // Guard rapid double-clicks on Save Receipt — without it, two clicks could
  // append the same new receipt twice before viewMode flips to "overview".
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const trip = state.trip;

  const updateTrip = (updates: Partial<Trip>) => {
    setState((prev) => ({
      trip: { ...prev.trip, ...updates },
    }));
  };

  const handleReset = () => {
    setShowResetDialog(true);
  };

  const confirmReset = () => {
    resetState();
    setViewMode("overview");
    setEditingReceipt(null);
    setShowResetDialog(false);
    toast({
      title: "Trip reset",
      description: "All trip data was cleared.",
      variant: "success",
    });
  };

  const startNewReceipt = () => {
    const newReceipt: Receipt = {
      id: generateId(),
      title: `Receipt ${trip.receipts.length + 1}`,
      payerId: trip.participants[0]?.id || "",
      items: [],
      tax: 0,
      service: 0,
    };
    setEditingReceipt({ receipt: newReceipt, isNew: true });
    setViewMode("edit-receipt");
  };

  const editReceipt = (receiptId: string) => {
    const receipt = trip.receipts.find((r) => r.id === receiptId);
    if (receipt) {
      setEditingReceipt({ receipt: { ...receipt }, isNew: false });
      setViewMode("edit-receipt");
    }
  };

  const saveReceipt = () => {
    if (!editingReceipt || isSaving) return;
    setIsSaving(true);

    const { receipt, isNew } = editingReceipt;

    if (isNew) {
      updateTrip({ receipts: [...trip.receipts, receipt] });
    } else {
      updateTrip({
        receipts: trip.receipts.map((r) => (r.id === receipt.id ? receipt : r)),
      });
    }

    setEditingReceipt(null);
    setViewMode("overview");
    toast({
      title: isNew ? "Receipt added" : "Receipt updated",
      description: receipt.title,
      variant: "success",
    });
    // Release on next tick — synchronous double-clicks within the same paint
    // are coalesced.
    setTimeout(() => setIsSaving(false), 0);
  };

  const deleteReceipt = (receiptId: string) => {
    const removed = trip.receipts.find((r) => r.id === receiptId);
    updateTrip({ receipts: trip.receipts.filter((r) => r.id !== receiptId) });
    setShowDeleteDialog(null);
    toast({
      title: "Receipt deleted",
      description: removed?.title,
      variant: "success",
    });
  };

  const updateEditingReceipt = (updates: Partial<Receipt>) => {
    if (!editingReceipt) return;
    setEditingReceipt({
      ...editingReceipt,
      receipt: { ...editingReceipt.receipt, ...updates },
    });
  };

  const getParticipantName = (id: string) =>
    trip.participants.find((p) => p.id === id)?.name || "Unknown";

  // Calculate receipt total for display
  const getReceiptTotal = (receipt: Receipt) => {
    const subtotal = receipt.items.reduce((sum, item) => sum + item.total, 0);
    return (subtotal + receipt.tax + receipt.service).toFixed(2);
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-3 sm:px-6 py-3 sm:py-4 border-b glass sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {viewMode === "overview" ? (
            <Link
              href="/"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline text-sm font-medium">Back</span>
            </Link>
          ) : (
            <button
              onClick={() => {
                setEditingReceipt(null);
                setViewMode("overview");
              }}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline text-sm font-medium">Back to Trip</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Plane className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm sm:text-base">Trip Mode</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <AuthButton />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              aria-label="Reset"
              className="px-2 sm:px-3 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
            >
              <RotateCcw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex-grow">
        {/* Local-only notice — sets the right expectation. Trip data is not yet
            synced to the cloud, so users won't think a phone reset means safety. */}
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-foreground/90">
            <span className="font-semibold text-amber-700 dark:text-amber-300">
              Saved on this device only.
            </span>{" "}
            Trip data is stored in your browser. Clearing browser data or switching devices will lose this trip.
          </p>
        </div>
        {viewMode === "overview" && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Trip Name */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plane className="h-5 w-5" />
                    Trip Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Trip Name</Label>
                    <Input
                      value={trip.name}
                      onChange={(e) => updateTrip({ name: e.target.value })}
                      placeholder="e.g., Beach Vacation 2024"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Participants */}
              <Card>
                <CardHeader>
                  <CardTitle>Participants</CardTitle>
                  <CardDescription>
                    Add everyone who&apos;s part of this trip
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ParticipantManager
                    participants={trip.participants}
                    onChange={(participants) => updateTrip({ participants })}
                  />
                </CardContent>
              </Card>

              {/* Receipts List */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>Receipts</CardTitle>
                    <CardDescription>
                      {trip.receipts.length} receipt
                      {trip.receipts.length !== 1 ? "s" : ""} added
                    </CardDescription>
                  </div>
                  <Button
                    onClick={startNewReceipt}
                    disabled={trip.participants.length < 2}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Receipt
                  </Button>
                </CardHeader>
                <CardContent>
                  {trip.participants.length < 2 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 rounded-xl border border-dashed bg-muted/10 text-center">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Users className="h-6 w-6 text-primary opacity-80" />
                      </div>
                      <p className="font-semibold text-foreground mb-1">Waiting for friends</p>
                      <p className="text-sm text-muted-foreground max-w-xs">Add at least 2 participants to start adding receipts to this trip.</p>
                    </div>
                  ) : trip.receipts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed bg-muted/10 text-center">
                      <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                        <ReceiptIcon className="h-6 w-6 text-accent opacity-80" />
                      </div>
                      <p className="font-semibold text-foreground mb-1">No receipts yet</p>
                      <p className="text-sm text-muted-foreground max-w-sm mb-4">You&rsquo;re all set! Start tracking your trip expenses.</p>
                      <Button onClick={startNewReceipt} size="sm" variant="secondary">
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Receipt
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {trip.receipts.map((receipt) => (
                        <div
                          key={receipt.id}
                          className="flex items-center justify-between gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <ReceiptIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{receipt.title}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="shrink-0">{receipt.items.length} items</span>
                                <span className="shrink-0">•</span>
                                <span className="truncate">
                                  Paid by {getParticipantName(receipt.payerId)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                            <span className="font-semibold whitespace-nowrap">
                              Rp {getReceiptTotal(receipt)}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => editReceipt(receipt.id)}
                                aria-label={`Edit ${receipt.title}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowDeleteDialog(receipt.id)}
                                aria-label={`Delete ${receipt.title}`}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Trip Summary Sidebar */}
            <div>
              <ErrorBoundary label="the trip summary">
                <TripSummaryPanel
                  receipts={trip.receipts}
                  participants={trip.participants}
                  tripName={trip.name}
                  tripId={trip.id}
                />
              </ErrorBoundary>
            </div>
          </div>
        )}

        {viewMode === "edit-receipt" && editingReceipt && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Receipt Edit Form */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    {editingReceipt.isNew ? "New Receipt" : "Edit Receipt"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Receipt Title</Label>
                    <Input
                      value={editingReceipt.receipt.title}
                      onChange={(e) =>
                        updateEditingReceipt({ title: e.target.value })
                      }
                      placeholder="e.g., Lunch at Cafe"
                    />
                  </div>

                  <div className="pt-4 border-t">
                    <h3 className="font-medium mb-4">Add Items</h3>
                    <ReceiptInput
                      onParsed={(result) =>
                        updateEditingReceipt({
                          items: [...editingReceipt.receipt.items, ...result.items],
                          tax: result.tax || editingReceipt.receipt.tax,
                          service: result.service || editingReceipt.receipt.service,
                        })
                      }
                    />
                  </div>

                  <div className="pt-4 border-t">
                    <h3 className="font-medium mb-4">Items & Assignments</h3>
                    <ItemsTable
                      items={editingReceipt.receipt.items}
                      participants={trip.participants}
                      onChange={(items) => updateEditingReceipt({ items })}
                    />
                  </div>

                  <div className="pt-4 border-t">
                    <h3 className="font-medium mb-4">Fees & Payer</h3>
                    <FeesInput
                      tax={editingReceipt.receipt.tax}
                      service={editingReceipt.receipt.service}
                      payerId={editingReceipt.receipt.payerId}
                      participants={trip.participants}
                      onTaxChange={(tax) => updateEditingReceipt({ tax })}
                      onServiceChange={(service) =>
                        updateEditingReceipt({ service })
                      }
                      onPayerChange={(payerId) =>
                        updateEditingReceipt({ payerId })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Save/Cancel Actions — sticky offset respects iOS safe-area (home indicator) */}
              {(() => {
                const editing = editingReceipt.receipt;
                const hasItems = editing.items.length > 0;
                const allAssigned = editing.items.every(
                  (item) => item.total > 0 && item.assignedToIds.length > 0
                );
                const hasPayer = !!editing.payerId;
                const canSave = hasItems && allAssigned && hasPayer;

                let blockMsg: string | null = null;
                if (!hasItems) blockMsg = "Add at least one item.";
                else if (!allAssigned) {
                  const unassigned = editing.items.filter(
                    (i) => i.assignedToIds.length === 0
                  ).length;
                  blockMsg = unassigned > 0
                    ? `Assign ${unassigned} item${unassigned > 1 ? "s" : ""} to at least one person.`
                    : "Every item needs a price.";
                } else if (!hasPayer) blockMsg = "Select who paid the bill.";

                return (
                  <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] mx-2 md:mx-0 p-4 bg-background/80 backdrop-blur-xl border rounded-2xl shadow-premium-lg z-20">
                    {blockMsg && (
                      <p
                        role="status"
                        className="mb-2 text-right text-xs font-medium text-amber-600 dark:text-amber-400"
                      >
                        ⚠️ {blockMsg}
                      </p>
                    )}
                    <div className="flex justify-end gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingReceipt(null);
                          setViewMode("overview");
                        }}
                        className="bg-background/50 hover:bg-muted"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        onClick={saveReceipt}
                        disabled={!canSave || isSaving}
                        className="shadow-md shadow-primary/20"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Save Receipt
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Receipt Preview */}
            <div>
              <ErrorBoundary label="the receipt preview">
                <SummaryPanel
                  receipt={editingReceipt.receipt}
                  participants={trip.participants}
                  title={editingReceipt.receipt.title}
                />
              </ErrorBoundary>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog !== null}
        onOpenChange={() => setShowDeleteDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Receipt?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this receipt? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteDialog && deleteReceipt(showDeleteDialog)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Trip Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset entire trip?</DialogTitle>
            <DialogDescription>
              This will clear all trip details, participants, and receipts. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Yes, reset trip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppFooter />
    </main>
  );
}
