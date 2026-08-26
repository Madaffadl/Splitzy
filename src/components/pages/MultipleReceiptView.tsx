"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Participant, ReceiptItem, Receipt, Trip, PaymentInfo } from "@/types";
import { useSearchParams, useRouter } from "next/navigation";
import { useHybridState } from "@/hooks/useHybridState";
import { useAuth } from "@/hooks/useAuth";
import { useSaveSplit } from "@/hooks/useSaveSplit";
import { supabaseDataService } from "@/lib/data/supabase-data-service";
import type { ReceiptDetail } from "@/lib/data/types";
import { usePersistErrorToast } from "@/hooks/usePersistErrorToast";
import { formatCurrency, generateId, todayDateString } from "@/lib/utils";
import { logFeatureUsage } from "@/lib/activity-client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";
import { ParticipantManager } from "@/components/ParticipantManager";
import { useToast } from "@/components/ui/toast";
import { ReceiptEditor } from "@/components/ReceiptEditor";
import { MultipleReceiptSummaryPanel } from "@/components/SummaryPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Cloud,
  History,
  RotateCcw,
  Plus,
  Layers,
  Receipt as ReceiptIcon,
  Trash2,
  Edit2,
  Users,
  Info,
} from "@/components/ui/icons";
import { AppFooter } from "@/components/AppFooter";

// A "split" here is one named group of receipts shared by the same people and
// settled together. It reuses the Trip domain shape (id/name/participants/
// receipts) internally.
interface MultipleState {
  split: Trip;
}

const DEFAULT_SPLIT: Trip = {
  id: generateId(),
  name: "My Split",
  participants: [],
  receipts: [],
};

const DEFAULT_STATE: MultipleState = {
  split: DEFAULT_SPLIT,
};

type ViewMode = "overview" | "edit-receipt";

interface EditingReceipt {
  receipt: Receipt;
  isNew: boolean;
}

export function MultipleReceiptView() {
  const [state, setState, resetState, persistError] = useHybridState<MultipleState>(
    "splitbill-multiple",
    DEFAULT_STATE
  );
  usePersistErrorToast(persistError);
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [editingReceipt, setEditingReceipt] = useState<EditingReceipt | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  // Guard rapid double-clicks on Save Receipt — without it, two clicks could
  // append the same new receipt twice before viewMode flips to "overview".
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  // `isSaving` above is about adding a receipt INTO the split; this is about
  // saving the whole split to the server. Different things, distinct names.
  const {
    saving: savingSplit,
    save,
    adopt,
    forget,
    id: savedId,
  } = useSaveSplit();

  const searchParams = useSearchParams();
  const router = useRouter();
  const resumeId = searchParams.get("resume");
  const [pendingResume, setPendingResume] = useState<ReceiptDetail | null>(null);

  // Mirrors `state` so the resume effect can read the latest value without
  // re-running on every edit.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const handleSaveSplit = useCallback(() => {
    void save({
      type: "multiple",
      title: state.split.name,
      participants: state.split.participants,
      receipts: state.split.receipts,
    });
  }, [save, state.split]);

  const applyResume = useCallback(
    (detail: ReceiptDetail) => {
      setState({
        split: {
          id: detail.id,
          name: detail.title ?? "My Split",
          participants: detail.participants ?? [],
          receipts: detail.receipts ?? [],
        },
      });
      adopt({
        id: detail.id,
        version: detail.version ?? null,
        expiresAt: detail.expiresAt ?? null,
        shareCode: detail.shareCode ?? null,
      });
      setViewMode("overview");
    },
    [setState, adopt]
  );

  useEffect(() => {
    if (!resumeId) return;
    let cancelled = false;

    (async () => {
      try {
        const detail = await supabaseDataService.getReceiptDetail(resumeId);
        if (cancelled) return;
        router.replace("/multiple");
        // Never replace unsaved local work without asking — it only exists in
        // this browser, so there is no second copy to fall back on.
        if (stateRef.current.split.receipts.length > 0) {
          setPendingResume(detail);
        } else {
          applyResume(detail);
        }
      } catch {
        if (!cancelled) {
          router.replace("/multiple");
          toast({
            title: "Couldn't open that split",
            description: "It may have expired or been deleted.",
            variant: "error",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resumeId, applyResume, router, toast]);

  useEffect(() => {
    if (viewMode === "edit-receipt") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [viewMode]);

  const split = state.split;

  const updateSplit = (updates: Partial<Trip>) => {
    setState((prev) => ({
      split: { ...prev.split, ...updates },
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
    // Detach from the saved copy so the next Save creates a new split instead
    // of overwriting the one this editor held.
    forget();
    toast({
      title: "Split reset",
      description: "All receipts and participants were cleared.",
      variant: "success",
    });
  };

  const startNewReceipt = () => {
    const newReceipt: Receipt = {
      id: generateId(),
      title: `Receipt ${split.receipts.length + 1}`,
      date: todayDateString(),
      payerId: split.participants[0]?.id || "",
      items: [],
      tax: 0,
      service: 0,
    };
    setEditingReceipt({ receipt: newReceipt, isNew: true });
    setViewMode("edit-receipt");
  };

  const editReceipt = (receiptId: string) => {
    const receipt = split.receipts.find((r) => r.id === receiptId);
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
      updateSplit({ receipts: [...split.receipts, receipt] });
    } else {
      updateSplit({
        receipts: split.receipts.map((r) => (r.id === receipt.id ? receipt : r)),
      });
    }
    // Saving a receipt is the "used this feature" signal (deduped per session).
    logFeatureUsage("multiple");

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
    const removed = split.receipts.find((r) => r.id === receiptId);
    updateSplit({ receipts: split.receipts.filter((r) => r.id !== receiptId) });
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
    split.participants.find((p) => p.id === id)?.name || "Unknown";

  // Attach/update/clear a participant's bank details from the summary.
  // Passing `undefined` clears it (JSON serialization drops the empty key).
  const updateParticipantPaymentInfo = (
    participantId: string,
    info: PaymentInfo | undefined
  ) => {
    updateSplit({
      participants: split.participants.map((p) =>
        p.id === participantId ? { ...p, paymentInfo: info } : p
      ),
    });
  };

  // Calculate receipt total for display (printed bill face value).
  const getReceiptTotal = (receipt: Receipt) => {
    const subtotal = receipt.items.reduce((sum, item) => sum + item.total, 0);
    return formatCurrency(subtotal + receipt.tax + receipt.service);
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-3 sm:px-6 py-3 sm:py-4 border-b glass sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {viewMode === "overview" ? (
            <Link
              href="/"
              aria-label="Back to home"
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
              aria-label="Back to split"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline text-sm font-medium">Back to Split</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Layers className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm sm:text-base">Multiple Receipts</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Save moved to the bottom action bar; the header is navigation.
                This is the route to Saved splits, which previously existed only
                behind the account menu → Dashboard → Receipt history. */}
            {isAuthenticated && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="px-2 sm:px-3 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 touch-manipulation"
              >
                <Link href="/history" aria-label="Saved splits">
                  <History className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Saved</span>
                </Link>
              </Button>
            )}
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
        {/* Local-only notice — sets the right expectation. This split is not yet
            synced to the cloud, so users won't think a phone reset means safety. */}
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-foreground/90">
            <span className="font-semibold text-amber-700 dark:text-amber-300">
              Saved on this device only.
            </span>{" "}
            This split is stored in your browser. Clearing browser data or switching devices will lose it.
          </p>
        </div>
        {viewMode === "overview" && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Split Name */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    Split Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Split name</Label>
                    <Input
                      value={split.name}
                      onChange={(e) => updateSplit({ name: e.target.value })}
                      placeholder="e.g., Weekend Getaway"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Participants */}
              <Card>
                <CardHeader>
                  <CardTitle>Participants</CardTitle>
                  <CardDescription>
                    Add everyone splitting these receipts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ParticipantManager
                    participants={split.participants}
                    onChange={(participants) => updateSplit({ participants })}
                  />
                </CardContent>
              </Card>

              {/* Receipts List */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>Receipts</CardTitle>
                    <CardDescription>
                      {split.receipts.length} receipt
                      {split.receipts.length !== 1 ? "s" : ""} added
                    </CardDescription>
                  </div>
                  <Button
                    onClick={startNewReceipt}
                    disabled={split.participants.length < 2}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Receipt
                  </Button>
                </CardHeader>
                <CardContent>
                  {split.participants.length < 2 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 rounded-xl border border-dashed bg-muted/10 text-center">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Users className="h-6 w-6 text-primary opacity-80" />
                      </div>
                      <p className="font-semibold text-foreground mb-1">Waiting for friends</p>
                      <p className="text-sm text-muted-foreground max-w-xs">Add at least 2 participants to start adding receipts to this split.</p>
                    </div>
                  ) : split.receipts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed bg-muted/10 text-center">
                      <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                        <ReceiptIcon className="h-6 w-6 text-accent opacity-80" />
                      </div>
                      <p className="font-semibold text-foreground mb-1">No receipts yet</p>
                      <p className="text-sm text-muted-foreground max-w-sm mb-4">You&rsquo;re all set! Start tracking your shared expenses.</p>
                      <Button onClick={startNewReceipt} size="sm" variant="secondary">
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Receipt
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {split.receipts.map((receipt) => (
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

            {/* Summary Sidebar */}
            <div>
              <ErrorBoundary label="the summary">
                <MultipleReceiptSummaryPanel
                  receipts={split.receipts}
                  participants={split.participants}
                  splitName={split.name}
                  splitId={split.id}
                  savedSplitId={savedId}
                  onUpdatePaymentInfo={updateParticipantPaymentInfo}
                />
              </ErrorBoundary>
            </div>

            {/* Save action bar.
                Sticky at the bottom on mobile so it sits in the thumb zone —
                this overview scrolls, and an action pinned to the top-right
                corner is the hardest place to reach one-handed. It also used to
                sit beside Reset, which is a bad neighbour for "save my work".
                Spans both grid columns; static from `sm:` up. */}
            {isAuthenticated && (
              <div
                className="
                  sticky bottom-0 z-10 -mx-3 border-t bg-background/95 px-3 pt-3
                  backdrop-blur lg:col-span-2
                  pb-[max(0.75rem,env(safe-area-inset-bottom))]
                  sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0
                  sm:pb-0 sm:backdrop-blur-none
                "
              >
                <Button
                  onClick={handleSaveSplit}
                  disabled={savingSplit || split.receipts.length === 0}
                  size="lg"
                  variant="outline"
                  className="w-full min-h-[44px] touch-manipulation sm:w-auto"
                >
                  <Cloud className="h-4 w-4 mr-2" />
                  {savingSplit ? "Saving…" : "Save split"}
                </Button>
              </div>
            )}
          </div>
        )}

        {viewMode === "edit-receipt" && editingReceipt && (
          <ReceiptEditor
            receipt={editingReceipt.receipt}
            participants={split.participants}
            isNew={editingReceipt.isNew}
            onChange={updateEditingReceipt}
            onSave={saveReceipt}
            onCancel={() => {
              setEditingReceipt(null);
              setViewMode("overview");
            }}
            isSaving={isSaving}
            onUpdatePaymentInfo={updateParticipantPaymentInfo}
          />
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

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset everything?</DialogTitle>
            <DialogDescription>
              This will clear the split name, participants, and all receipts. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Yes, reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppFooter />

      {/* Resuming replaces the editor's contents. Local work lives only in this
          browser, so overwriting it unasked would destroy the only copy. */}
      <Dialog
        open={pendingResume !== null}
        onOpenChange={(open) => !open && setPendingResume(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace what&rsquo;s in the editor?</DialogTitle>
            <DialogDescription>
              You have a split in progress here ({split.receipts.length} receipt
              {split.receipts.length === 1 ? "" : "s"}). Opening &ldquo;
              {pendingResume?.title}&rdquo; will replace it, and anything you
              haven&rsquo;t saved will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingResume(null)}>
              Keep what I have
            </Button>
            <Button
              onClick={() => {
                if (pendingResume) applyResume(pendingResume);
                setPendingResume(null);
              }}
            >
              Open the saved split
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
