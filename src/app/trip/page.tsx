"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Participant, ReceiptItem, Receipt, Trip } from "@/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { generateId } from "@/lib/utils";
import { ParticipantManager } from "@/components/ParticipantManager";
import { ReceiptInput } from "@/components/ReceiptInput";
import { ItemsTable } from "@/components/ItemsTable";
import { FeesInput } from "@/components/FeesInput";
import { SummaryPanel, TripSummaryPanel } from "@/components/SummaryPanel";
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
  Calculator,
  RotateCcw,
  Plus,
  Plane,
  Receipt as ReceiptIcon,
  Trash2,
  Edit2,
  Check,
  X,
  Mail,
  Instagram,
  Linkedin,
  Phone,
} from "lucide-react";

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
  const [state, setState, resetState] = useLocalStorage<TripState>(
    "splitbill-trips",
    DEFAULT_STATE
  );
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [editingReceipt, setEditingReceipt] = useState<EditingReceipt | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);

  const trip = state.trip;

  const updateTrip = (updates: Partial<Trip>) => {
    setState((prev) => ({
      trip: { ...prev.trip, ...updates },
    }));
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset the entire trip?")) {
      resetState();
      setViewMode("overview");
      setEditingReceipt(null);
    }
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
    if (!editingReceipt) return;

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
  };

  const deleteReceipt = (receiptId: string) => {
    updateTrip({ receipts: trip.receipts.filter((r) => r.id !== receiptId) });
    setShowDeleteDialog(null);
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
      <header className="px-6 py-4 border-b glass sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {viewMode === "overview" ? (
            <Link
              href="/"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          ) : (
            <button
              onClick={() => {
                setEditingReceipt(null);
                setViewMode("overview");
              }}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Trip
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Plane className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">Trip Mode</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 flex-grow">
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
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Add at least 2 participants to start adding receipts
                    </p>
                  ) : trip.receipts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No receipts yet. Click &quot;Add Receipt&quot; to start.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {trip.receipts.map((receipt) => (
                        <div
                          key={receipt.id}
                          className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <ReceiptIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{receipt.title}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{receipt.items.length} items</span>
                                <span>•</span>
                                <span>
                                  Paid by {getParticipantName(receipt.payerId)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-semibold">
                              Rp {getReceiptTotal(receipt)}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => editReceipt(receipt.id)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowDeleteDialog(receipt.id)}
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
              <TripSummaryPanel
                receipts={trip.receipts}
                participants={trip.participants}
                tripName={trip.name}
              />
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

                  {editingReceipt.receipt.items.length > 0 && (
                    <div className="pt-4 border-t">
                      <h3 className="font-medium mb-4">Items & Assignments</h3>
                      <ItemsTable
                        items={editingReceipt.receipt.items}
                        participants={trip.participants}
                        onChange={(items) => updateEditingReceipt({ items })}
                      />
                    </div>
                  )}

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

              {/* Save/Cancel Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingReceipt(null);
                    setViewMode("overview");
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={saveReceipt}
                  disabled={
                    !editingReceipt.receipt.payerId ||
                    editingReceipt.receipt.items.length === 0
                  }
                >
                  <Check className="h-4 w-4 mr-2" />
                  Save Receipt
                </Button>
              </div>
            </div>

            {/* Receipt Preview */}
            <div>
              <SummaryPanel
                receipt={editingReceipt.receipt}
                participants={trip.participants}
                title={editingReceipt.receipt.title}
              />
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
          <DialogFooter>
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

      {/* Minimalist Footer */}
      <footer className="px-6 py-4 border-t bg-card/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
              <Calculator className="h-3 w-3 text-primary" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Splitzy by Madaffadl</span>
          </div>
          <div className="flex items-center gap-1.5">
            <a href="mailto:m.daffafadhil26@gmail.com" target="_blank" rel="noopener noreferrer" className="h-6 w-6 rounded-md bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200" aria-label="Email">
              <Mail className="h-3 w-3" />
            </a>
            <a href="https://www.instagram.com/mdaffa_fdl?igsh=ajJ3Y3Y0Nzd3OXZn&utm_source=qr" target="_blank" rel="noopener noreferrer" className="h-6 w-6 rounded-md bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-pink-500 hover:bg-pink-500/10 transition-all duration-200" aria-label="Instagram">
              <Instagram className="h-3 w-3" />
            </a>
            <a href="https://www.linkedin.com/in/madaffadl" target="_blank" rel="noopener noreferrer" className="h-6 w-6 rounded-md bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:bg-blue-600/10 transition-all duration-200" aria-label="LinkedIn">
              <Linkedin className="h-3 w-3" />
            </a>
            <a href="https://wa.me/6285365360955" target="_blank" rel="noopener noreferrer" className="h-6 w-6 rounded-md bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-green-500 hover:bg-green-500/10 transition-all duration-200" aria-label="WhatsApp">
              <Phone className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
