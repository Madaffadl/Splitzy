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
import { receiptsFromDetail } from "@/lib/receipt/receipt-detail";
import { usePersistErrorToast } from "@/hooks/usePersistErrorToast";
import { formatCurrency, generateId, todayDateString } from "@/lib/utils";
import { logFeatureUsage } from "@/lib/activity-client";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { AuthButton } from "@/components/auth/AuthButton";
import { ParticipantManager } from "@/components/receipt/ParticipantManager";
import { useToast } from "@/components/ui/toast";
import { ReceiptEditor } from "@/components/receipt/ReceiptEditor";
import { MultipleReceiptSummaryPanel } from "@/components/receipt/SummaryPanel";
import { ErrorBoundary } from "@/components/providers/ErrorBoundary";
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
  LogIn,
} from "@/components/ui/icons";
import { LoadingState } from "@/components/ui/spinner";
import { AppFooter } from "@/components/layout/AppFooter";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { fill, useDictionary, useLocale } from "@/lib/i18n/use-locale";
import { localePath } from "@/lib/i18n/config";

// A "split" here is one named group of receipts shared by the same people and
// settled together. It reuses the Trip domain shape (id/name/participants/
// receipts) internally.
interface MultipleState {
  split: Trip;
}

const DEFAULT_SPLIT: Trip = {
  id: generateId(),
  name: "My Split", // replaced with the localised default on first render
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
  const { isAuthenticated, isLoading: authLoading, signIn } = useAuth();
  const t = useDictionary().app;
  // Home in the language being read, not always the English root.
  const locale = useLocale();
  const homeHref = localePath(locale, "/");
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
  // Same story as /travel: "overview" and "edit-receipt" were pure state, so
  // the receipt editor had no history entry. Pressing the system back button
  // from inside it left /multiple altogether instead of returning to the split.
  const viewParam = searchParams.get("view");
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
          // `detail.receipts ?? []` handed back an empty split for rows saved
          // before `receipts` existed — Continue opened, and the receipts were
          // just gone. The shared reader synthesises them from the flat columns.
          receipts: receiptsFromDetail(detail),
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
            title: t.cards.resumeFailed,
            description: t.cards.resumeFailedBody,
            variant: "error",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resumeId, applyResume, router, toast, t.cards.resumeFailed, t.cards.resumeFailedBody]);

  useEffect(() => {
    if (viewMode === "edit-receipt") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [viewMode]);

  // URL → state only; the handlers below write the URL. A ?view=receipt with no
  // receipt loaded (stale link) falls back to the overview.
  useEffect(() => {
    const next: ViewMode = viewParam === "receipt" ? "edit-receipt" : "overview";
    setViewMode((prev) => (prev === next ? prev : next));
  }, [viewParam]);
  useEffect(() => {
    if (viewParam === "receipt" && !editingReceipt) {
      router.replace("/multiple", { scroll: false });
    }
  }, [viewParam, editingReceipt, router]);

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
      title: t.multiple.resetDone,
      description: t.multiple.resetDoneBody,
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
    router.push("/multiple?view=receipt");
  };

  const editReceipt = (receiptId: string) => {
    const receipt = split.receipts.find((r) => r.id === receiptId);
    if (receipt) {
      setEditingReceipt({ receipt: { ...receipt }, isNew: false });
      setViewMode("edit-receipt");
      router.push("/multiple?view=receipt");
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
    router.replace("/multiple", { scroll: false });
    toast({
      title: isNew ? t.multiple.receiptAdded : t.multiple.receiptUpdated,
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
      title: t.multiple.receiptDeleted,
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

  // Page-level auth gate. /multiple is listed in proxy.ts's protectedPaths, but
  // a route must not depend on the proxy alone: the proxy fails open when the
  // auth service is unreachable, and it did so for every anonymous request
  // until the AuthSessionMissingError bug was fixed — serving this whole tool
  // to visitors who were never signed in.
  //
  // /history already gates itself this way, which is the only reason it was
  // unaffected. This is that same gate: one screen, two independent locks.
  if (authLoading) {
    return (
      <main className="min-h-screen flex flex-col">
        <LoadingState />
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
          <Layers className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-heading mb-2">{t.modes.multiple.title}</h1>
        <p className="mb-6 max-w-sm text-muted-foreground">{t.loginRequired.body}</p>
        <Button onClick={() => signIn("/multiple")} size="lg" className="gap-2">
          <LogIn className="h-4 w-4" />
          {t.loginRequired.signIn}
        </Button>
        <Link href={homeHref} className="mt-4 text-xs text-primary hover:underline">
          {t.common.back}
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-3 sm:px-6 py-3 sm:py-4 glass sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {viewMode === "overview" ? (
            <Link
              href={homeHref}
              aria-label={t.common.back}
              className="touch-manipulation -ml-1 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline text-sm font-medium">{t.common.back}</span>
            </Link>
          ) : (
            // No back control while editing a receipt: the editor's own
            // Cancel does exactly this, and "Cancel" is the honest label —
            // both discard the edits, only one of them admits it. The system
            // back gesture still returns here (?view= is in the URL).
            <span aria-hidden="true" className="h-11 w-11" />
          )}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Layers className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm sm:text-base">{t.modes.multiple.title}</span>
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
                className="px-2 sm:px-3 min-w-[44px] sm:min-w-0 touch-manipulation"
              >
                <Link href="/history" aria-label={t.common.savedSplitsAria}>
                  <History className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t.common.saved}</span>
                </Link>
              </Button>
            )}
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </header>

      <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex-grow">
        {/* Local-only notice — sets the right expectation. This split is not yet
            synced to the cloud, so users won't think a phone reset means safety. */}
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-foreground/90">
            <span className="font-semibold text-warning">
              {t.multiple.localOnly}
            </span>{" "}
            {t.multiple.localOnlyBody}
          </p>
        </div>
        {viewMode === "overview" && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 min-w-0 space-y-6">
              {/* Split Name */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    {t.multiple.splitDetails}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t.multiple.splitName}</Label>
                    <Input
                      value={split.name}
                      onChange={(e) => updateSplit({ name: e.target.value })}
                      placeholder={t.multiple.splitNamePlaceholder}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Participants */}
              <Card>
                <CardHeader>
                  <CardTitle>{t.multiple.participants}</CardTitle>
                  <CardDescription>{t.multiple.participantsHint}</CardDescription>
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
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                  <div className="min-w-0">
                    <CardTitle>{t.multiple.receipts}</CardTitle>
                    <CardDescription>
                      {fill(t.multiple.receiptsAdded, { count: split.receipts.length })}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={startNewReceipt}
                    disabled={split.participants.length < 2}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t.multiple.addReceipt}
                  </Button>
                </CardHeader>
                <CardContent>
                  {split.participants.length < 2 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 rounded-xl border border-dashed bg-muted/10 text-center">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Users className="h-6 w-6 text-primary opacity-80" />
                      </div>
                      <p className="font-semibold text-foreground mb-1">{t.multiple.waitingTitle}</p>
                      <p className="text-sm text-muted-foreground max-w-xs">{t.multiple.waitingBody}</p>
                    </div>
                  ) : split.receipts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed bg-muted/10 text-center">
                      <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                        <ReceiptIcon className="h-6 w-6 text-accent-strong" />
                      </div>
                      <p className="font-semibold text-foreground mb-1">{t.multiple.noReceiptsTitle}</p>
                      <p className="text-sm text-muted-foreground max-w-sm mb-4">{t.multiple.noReceiptsBody}</p>
                      <Button onClick={startNewReceipt} size="sm" variant="secondary">
                        <Plus className="h-4 w-4 mr-2" />
                        {t.multiple.addFirstReceipt}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {split.receipts.map((receipt) => (
                        <div
                          key={receipt.id}
                          className="flex flex-col gap-3 p-4 rounded-lg border transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <ReceiptIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{receipt.title}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="shrink-0">{fill(t.multiple.itemsCount, { count: receipt.items.length })}</span>
                                <span className="shrink-0">•</span>
                                <span className="truncate">
                                  {fill(t.multiple.paidByName, { name: getParticipantName(receipt.payerId) })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end sm:gap-4">
                            <span className="font-semibold whitespace-nowrap">
                              Rp {getReceiptTotal(receipt)}
                            </span>
                            {/* gap-2, not gap-1: 4px between "edit this" and
                                "delete this" is under the 8px minimum. */}
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => editReceipt(receipt.id)}
                                aria-label={fill(t.multiple.editAria, { title: receipt.title })}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowDeleteDialog(receipt.id)}
                                aria-label={fill(t.multiple.deleteAria, { title: receipt.title })}
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
              <StickyActionBar className="mt-0 lg:col-span-2">
                <Button
                  onClick={handleSaveSplit}
                  disabled={savingSplit || split.receipts.length === 0}
                  size="lg"
                  variant="outline"
                  className="w-full min-h-[44px] touch-manipulation sm:w-auto"
                >
                  <Cloud className="h-4 w-4 mr-2" />
                  {savingSplit ? t.multiple.saving : t.multiple.saveSplit}
                </Button>
              </StickyActionBar>
            )}

            {/* Reset lives here, not in the header: the header is navigation,
                and this is the most destructive control on the screen. */}
            <div className="flex justify-end lg:col-span-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="touch-manipulation text-muted-foreground hover:text-destructive"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {t.common.reset}
              </Button>
            </div>
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
              router.push("/multiple");
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
            <DialogTitle>{t.multiple.deleteTitle}</DialogTitle>
            <DialogDescription>
              {t.multiple.deleteBody}
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
            <DialogTitle>{t.multiple.resetTitle}</DialogTitle>
            <DialogDescription>
              {t.multiple.resetBody}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              {t.summary.cancel}
            </Button>
            <Button variant="destructive" onClick={confirmReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              {t.cards.resetConfirm}
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
            <DialogTitle>{t.multiple.replaceTitle}</DialogTitle>
            <DialogDescription>
              {fill(t.multiple.replaceBody, {
                count: split.receipts.length,
                title: pendingResume?.title ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingResume(null)}>
              {t.multiple.keepMine}
            </Button>
            <Button
              onClick={() => {
                if (pendingResume) applyResume(pendingResume);
                setPendingResume(null);
              }}
            >
              {t.multiple.openSaved}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
