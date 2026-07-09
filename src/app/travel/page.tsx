"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TravelTrip, Receipt, Participant, PaymentInfo } from "@/types";
import { useHybridState } from "@/hooks/useHybridState";
import { generateId, formatCurrency } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";
import { ParticipantManager } from "@/components/ParticipantManager";
import { ReceiptEditor } from "@/components/ReceiptEditor";
import { MultipleReceiptSummaryPanel, ReceiptBreakdown } from "@/components/SummaryPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, Plane, Plus, Trash2, Users, Info, Target, Receipt as ReceiptIcon } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";

interface TravelStore {
  trips: TravelTrip[];
  activeId: string | null;
}

const DEFAULT_STATE: TravelStore = { trips: [], activeId: null };

type ViewMode = "overview" | "edit-receipt" | "summary";

interface EditingReceipt {
  receipt: Receipt;
  isNew: boolean;
}

function parseAmount(s: string): number {
  const v = parseFloat(s.replace(/\./g, "").replace(/,/g, "."));
  return isNaN(v) || v < 0 ? 0 : v;
}

// Drop removed participants from receipts so no dangling payer/assignee refs
// break the balance math. Receipts whose payer was removed, or that end up with
// an unassigned item, are dropped.
function reconcileReceipts(
  receipts: Receipt[],
  validIds: Set<string>
): { receipts: Receipt[]; dropped: number } {
  let dropped = 0;
  const out: Receipt[] = [];
  for (const r of receipts) {
    if (!validIds.has(r.payerId)) {
      dropped++;
      continue;
    }
    const items = r.items.map((it) => ({
      ...it,
      assignedToIds: it.assignedToIds.filter((id) => validIds.has(id)),
      ...(it.assignments
        ? { assignments: it.assignments.filter((a) => validIds.has(a.participantId)) }
        : {}),
    }));
    if (items.some((it) => it.assignedToIds.length === 0)) {
      dropped++;
      continue;
    }
    out.push({ ...r, items });
  }
  return { receipts: out, dropped };
}

export default function TravelPage() {
  const [store, setStore] = useHybridState<TravelStore>("splitzy-travel", DEFAULT_STATE);
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [editingReceipt, setEditingReceipt] = useState<EditingReceipt | null>(null);
  const [newTripName, setNewTripName] = useState("");
  const [budgetDraft, setBudgetDraft] = useState<string | null>(null);
  const [deleteTripId, setDeleteTripId] = useState<string | null>(null);
  const [deleteReceiptId, setDeleteReceiptId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const trips = store.trips ?? [];
  const rawActive = trips.find((t) => t.id === store.activeId) ?? null;
  // Normalize so a legacy/corrupt trip (e.g. missing `receipts`) can't crash the
  // workspace by dereferencing undefined arrays.
  const activeTrip: TravelTrip | null = rawActive
    ? { ...rawActive, participants: rawActive.participants ?? [], receipts: rawActive.receipts ?? [] }
    : null;

  useEffect(() => {
    if (viewMode !== "overview") window.scrollTo({ top: 0, behavior: "instant" });
  }, [viewMode]);

  const updateActiveTrip = (updates: Partial<TravelTrip>) => {
    setStore((prev) => ({
      ...prev,
      trips: prev.trips.map((t) => (t.id === prev.activeId ? { ...t, ...updates } : t)),
    }));
  };

  const createTrip = () => {
    const name = newTripName.trim() || "My Trip";
    const trip: TravelTrip = { id: generateId(), name, participants: [], receipts: [] };
    setStore((prev) => ({ trips: [trip, ...prev.trips], activeId: trip.id }));
    setNewTripName("");
  };

  const deleteTrip = (id: string) => {
    setStore((prev) => ({
      trips: prev.trips.filter((t) => t.id !== id),
      activeId: prev.activeId === id ? null : prev.activeId,
    }));
    setDeleteTripId(null);
    toast({ title: "Trip deleted", variant: "success" });
  };

  const openTrip = (id: string) => {
    setViewMode("overview");
    setStore((prev) => ({ ...prev, activeId: id }));
  };
  const closeTrip = () => setStore((prev) => ({ ...prev, activeId: null }));

  const handleParticipantsChange = (participants: Participant[]) => {
    if (!activeTrip) return;
    const ids = new Set(participants.map((p) => p.id));
    const removedSomeone = activeTrip.participants.some((p) => !ids.has(p.id));
    if (!removedSomeone) {
      updateActiveTrip({ participants });
      return;
    }
    const { receipts, dropped } = reconcileReceipts(activeTrip.receipts, ids);
    updateActiveTrip({ participants, receipts });
    if (dropped > 0) {
      toast({
        title: `${dropped} receipt${dropped > 1 ? "s" : ""} removed`,
        description: "They referenced a traveler you removed.",
        variant: "success",
      });
    }
  };

  const startNewReceipt = () => {
    if (!activeTrip) return;
    const receipt: Receipt = {
      id: generateId(),
      title: `Receipt ${activeTrip.receipts.length + 1}`,
      payerId: activeTrip.participants[0]?.id || "",
      items: [],
      tax: 0,
      service: 0,
    };
    setEditingReceipt({ receipt, isNew: true });
    setViewMode("edit-receipt");
  };

  const editReceipt = (id: string) => {
    const receipt = activeTrip?.receipts.find((r) => r.id === id);
    if (receipt) {
      setEditingReceipt({ receipt: { ...receipt }, isNew: false });
      setViewMode("edit-receipt");
    }
  };

  const updateEditingReceipt = (updates: Partial<Receipt>) => {
    setEditingReceipt((prev) => (prev ? { ...prev, receipt: { ...prev.receipt, ...updates } } : prev));
  };

  const saveReceipt = () => {
    if (!activeTrip || !editingReceipt || isSaving) return;
    setIsSaving(true);
    const { receipt, isNew } = editingReceipt;
    updateActiveTrip({
      receipts: isNew
        ? [...activeTrip.receipts, receipt]
        : activeTrip.receipts.map((r) => (r.id === receipt.id ? receipt : r)),
    });
    setEditingReceipt(null);
    setViewMode("overview");
    toast({ title: isNew ? "Receipt added" : "Receipt updated", description: receipt.title, variant: "success" });
    setTimeout(() => setIsSaving(false), 0);
  };

  const deleteReceipt = (id: string) => {
    if (!activeTrip) return;
    const removed = activeTrip.receipts.find((r) => r.id === id);
    updateActiveTrip({ receipts: activeTrip.receipts.filter((r) => r.id !== id) });
    setDeleteReceiptId(null);
    toast({ title: "Receipt deleted", description: removed?.title, variant: "success" });
  };

  const updateParticipantPaymentInfo = (participantId: string, info: PaymentInfo | undefined) => {
    if (!activeTrip) return;
    updateActiveTrip({
      participants: activeTrip.participants.map((p) =>
        p.id === participantId ? { ...p, paymentInfo: info } : p
      ),
    });
  };

  const canAddReceipt = (activeTrip?.participants.length ?? 0) >= 2;

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-3 sm:px-6 py-3 sm:py-4 border-b glass sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {activeTrip && viewMode !== "overview" ? (
            <button
              onClick={() => { setEditingReceipt(null); setViewMode("overview"); }}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline text-sm font-medium">Back to trip</span>
            </button>
          ) : activeTrip ? (
            <button
              onClick={closeTrip}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline text-sm font-medium">All trips</span>
            </button>
          ) : (
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline text-sm font-medium">Back</span>
            </Link>
          )}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Plane className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sm sm:text-base">Travel Spend</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex-grow w-full">
        {/* Local-only notice */}
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-foreground/90">
            <span className="font-semibold text-amber-700 dark:text-amber-300">Saved on this device only.</span>{" "}
            Trips are stored in your browser. Clearing browser data or switching devices will lose them.
          </p>
        </div>

        {/* --- Trip list --- */}
        {!activeTrip && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plane className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  New trip
                </CardTitle>
                <CardDescription>Start tracking receipts for a trip or event.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={newTripName}
                    onChange={(e) => setNewTripName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createTrip()}
                    placeholder="e.g., Bali 2026"
                  />
                  <Button onClick={createTrip}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create
                  </Button>
                </div>
              </CardContent>
            </Card>

            {trips.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed bg-muted/10 text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                  <Plane className="h-6 w-6 text-emerald-600 dark:text-emerald-400 opacity-80" />
                </div>
                <p className="font-semibold text-foreground mb-1">No trips yet</p>
                <p className="text-sm text-muted-foreground max-w-sm">Create your first trip above to start tracking expenses.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {trips.map((t) => {
                  const total = (t.receipts ?? []).reduce(
                    (s, r) => s + r.items.reduce((x, i) => x + i.total, 0) + r.tax + r.service,
                    0
                  );
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 p-4 rounded-xl border hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => openTrip(t.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.participants.length} people · {(t.receipts ?? []).length} receipt(s)
                          {t.budget ? ` · budget Rp ${formatCurrency(t.budget)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-sm">Rp {formatCurrency(total)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${t.name}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteTripId(t.id); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- Trip workspace: overview --- */}
        {activeTrip && viewMode === "overview" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Trip details + budget */}
              <Card>
                <CardHeader>
                  <CardTitle>Trip details</CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Trip name</Label>
                    <Input
                      value={activeTrip.name}
                      onChange={(e) => updateActiveTrip({ name: e.target.value })}
                      placeholder="e.g., Bali 2026"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Target className="h-4 w-4" />
                      Budget (optional)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">Rp</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="pl-10"
                        placeholder="0"
                        value={budgetDraft !== null ? budgetDraft : activeTrip.budget ? formatCurrency(activeTrip.budget) : ""}
                        onFocus={() => setBudgetDraft(activeTrip.budget ? String(activeTrip.budget) : "")}
                        onChange={(e) => setBudgetDraft(e.target.value)}
                        onBlur={() => {
                          if (budgetDraft !== null) {
                            const val = parseAmount(budgetDraft);
                            updateActiveTrip({ budget: val > 0 ? val : undefined });
                            setBudgetDraft(null);
                          }
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Travelers */}
              <Card>
                <CardHeader>
                  <CardTitle>Travelers</CardTitle>
                  <CardDescription>Everyone sharing expenses on this trip</CardDescription>
                </CardHeader>
                <CardContent>
                  <ParticipantManager
                    participants={activeTrip.participants}
                    onChange={handleParticipantsChange}
                  />
                </CardContent>
              </Card>

              {/* Receipts */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>Receipts</CardTitle>
                    <CardDescription>
                      {activeTrip.receipts.length} receipt{activeTrip.receipts.length !== 1 ? "s" : ""}
                    </CardDescription>
                  </div>
                  <Button onClick={startNewReceipt} disabled={!canAddReceipt}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Receipt
                  </Button>
                </CardHeader>
                <CardContent>
                  {!canAddReceipt ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 rounded-xl border border-dashed bg-muted/10 text-center">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Users className="h-6 w-6 text-primary opacity-80" />
                      </div>
                      <p className="font-semibold text-foreground mb-1">Add travelers first</p>
                      <p className="text-sm text-muted-foreground max-w-xs">Add at least 2 travelers to start adding receipts.</p>
                    </div>
                  ) : activeTrip.receipts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 rounded-xl border border-dashed bg-muted/10 text-center">
                      <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                        <ReceiptIcon className="h-6 w-6 text-accent opacity-80" />
                      </div>
                      <p className="font-semibold text-foreground mb-1">No receipts yet</p>
                      <p className="text-sm text-muted-foreground mb-4">Scan or add a receipt to start tracking.</p>
                      <Button size="sm" variant="secondary" onClick={startNewReceipt}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Receipt
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Tap a receipt to see its breakdown.</p>
                      {activeTrip.receipts.map((r, i) => (
                        <ReceiptBreakdown
                          key={r.id}
                          receipt={r}
                          participants={activeTrip.participants}
                          index={i}
                          onEdit={() => editReceipt(r.id)}
                          onDelete={() => setDeleteReceiptId(r.id)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteTripId(activeTrip.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete trip
                </Button>
              </div>
            </div>

            {/* Summary sidebar — compact; full breakdown lives on the summary view */}
            <div className="space-y-3">
              <ErrorBoundary label="the trip summary">
                <MultipleReceiptSummaryPanel
                  receipts={activeTrip.receipts}
                  participants={activeTrip.participants}
                  splitName={activeTrip.name}
                  splitId={activeTrip.id}
                  budget={activeTrip.budget}
                  compact
                  onUpdatePaymentInfo={updateParticipantPaymentInfo}
                />
              </ErrorBoundary>
              {activeTrip.receipts.length > 0 && (
                <Button variant="outline" className="w-full" onClick={() => setViewMode("summary")}>
                  View summary
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* --- Trip workspace: full summary --- */}
        {activeTrip && viewMode === "summary" && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div>
              <h1 className="text-xl font-bold">{activeTrip.name}</h1>
              <p className="text-sm text-muted-foreground">Full trip summary</p>
            </div>
            <ErrorBoundary label="the trip summary">
              <MultipleReceiptSummaryPanel
                receipts={activeTrip.receipts}
                participants={activeTrip.participants}
                splitName={activeTrip.name}
                splitId={activeTrip.id}
                budget={activeTrip.budget}
                onUpdatePaymentInfo={updateParticipantPaymentInfo}
              />
            </ErrorBoundary>
          </div>
        )}

        {/* --- Trip workspace: edit receipt --- */}
        {activeTrip && viewMode === "edit-receipt" && editingReceipt && (
          <ReceiptEditor
            receipt={editingReceipt.receipt}
            participants={activeTrip.participants}
            isNew={editingReceipt.isNew}
            onChange={updateEditingReceipt}
            onSave={saveReceipt}
            onCancel={() => { setEditingReceipt(null); setViewMode("overview"); }}
            isSaving={isSaving}
            onUpdatePaymentInfo={updateParticipantPaymentInfo}
          />
        )}
      </div>

      {/* Delete trip confirm */}
      <Dialog open={deleteTripId !== null} onOpenChange={() => setDeleteTripId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this trip?</DialogTitle>
            <DialogDescription>
              This permanently removes the trip and all its receipts. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTripId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTripId && deleteTrip(deleteTripId)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete receipt confirm */}
      <Dialog open={deleteReceiptId !== null} onOpenChange={() => setDeleteReceiptId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Receipt?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this receipt? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteReceiptId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteReceiptId && deleteReceipt(deleteReceiptId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppFooter />
    </main>
  );
}
