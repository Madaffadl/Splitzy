"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Participant, ReceiptItem, Receipt, PaymentInfo, Discount, ReceiptFee } from "@/types";
import { useHybridState } from "@/hooks/useHybridState";
import { usePersistErrorToast } from "@/hooks/usePersistErrorToast";
import { useGuestLimit } from "@/hooks/useGuestLimit";
import { formatCurrency, generateId, todayDateString } from "@/lib/utils";
import { getReceiptSummary } from "@/lib/calculations";
import { logFeatureUsage } from "@/lib/activity-client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";
import { GuestLimitDialog } from "@/components/GuestLimitDialog";
import { useToast } from "@/components/ui/toast";
import { Stepper, Step } from "@/components/Stepper";
import { ParticipantManager } from "@/components/ParticipantManager";
import { ReceiptInput } from "@/components/ReceiptInput";
import { ItemsTable } from "@/components/ItemsTable";
import { FeesInput } from "@/components/FeesInput";
import { DiscountsInput } from "@/components/DiscountsInput";
import { SummaryPanel } from "@/components/SummaryPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  RotateCcw,
  Receipt as ReceiptIcon,
  PartyPopper,
  Sparkles,
} from "@/components/ui/icons";
import { AppFooter } from "@/components/AppFooter";

const STEPS: Step[] = [
  { id: "participants", title: "Participants" },
  { id: "bill", title: "Bill Details" },
  { id: "summary", title: "Summary" },
];

interface SingleState {
  participants: Participant[];
  items: ReceiptItem[];
  title: string;
  date?: string;
  tax: number;
  service: number;
  payerId: string;
  discounts: Discount[];
  fees: ReceiptFee[];
}

const DEFAULT_STATE: SingleState = {
  participants: [],
  items: [],
  title: "Dinner",
  date: todayDateString(),
  tax: 0,
  service: 0,
  payerId: "",
  discounts: [],
  fees: [],
};

export function SingleSplitView() {
  const [state, setState, resetState, persistError] = useHybridState<SingleState>(
    "splitbill-single",
    DEFAULT_STATE
  );
  usePersistErrorToast(persistError);
  const [currentStep, setCurrentStep] = useState(0);
  // Guards rapid double-clicks on Next/Stepper. Without it, two clicks within
  // the same render frame could fire `incrementCount()` twice and skip a step.
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { isLimitReached, incrementCount, splitsRemaining } = useGuestLimit();
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const { toast } = useToast();

  const receipt: Receipt = useMemo(
    () => ({
      id: "single-receipt",
      title: state.title,
      date: state.date,
      payerId: state.payerId,
      items: state.items,
      tax: state.tax,
      service: state.service,
      discounts: state.discounts ?? [],
      fees: state.fees ?? [],
    }),
    [state]
  );

  // Headline total for the Quick Stats card. Derived from the SAME helper the
  // SummaryPanel below uses, so the two figures on this screen can never drift
  // (a hand-rolled sum here previously omitted fees and read unitPrice × qty
  // instead of item.total).
  const summary = useMemo(
    () => getReceiptSummary(receipt, state.participants.map((p) => p.id)),
    [receipt, state.participants]
  );

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0: // Participants
        return state.participants.length >= 2;
      case 1:
        // Every item must have a positive total AND at least one assignee.
        // Unassigned items break ledger balance (sum of balances ≠ 0) and
        // produce phantom credits in the settlement.
        return (
          state.items.length > 0 &&
          state.items.every(
            (item) => item.total > 0 && item.assignedToIds.length > 0
          ) &&
          state.payerId !== ""
        );
      default:
        return true;
    }
  }, [currentStep, state]);

  const blockingMessage = useMemo(() => {
    if (currentStep !== 1) return null;
    if (state.items.length === 0) return "Add at least one item to continue.";
    const unassigned = state.items.filter((i) => i.assignedToIds.length === 0).length;
    if (unassigned > 0) {
      return `Assign ${unassigned} item${unassigned > 1 ? "s" : ""} to at least one person.`;
    }
    const zeroTotal = state.items.filter((i) => i.total <= 0).length;
    if (zeroTotal > 0) {
      return `${zeroTotal} item${zeroTotal > 1 ? "s have" : " has"} no price.`;
    }
    if (!state.payerId) return "Select who paid the bill.";
    return null;
  }, [currentStep, state]);

  const handleNext = () => {
    if (isTransitioning || currentStep >= STEPS.length - 1) return;
    setIsTransitioning(true);
    try {
      // Check guest limit when moving to summary (step 2)
      if (currentStep === 1) {
        if (isLimitReached) {
          setShowLimitDialog(true);
          return;
        }
        incrementCount();
        // Reaching the summary is the "completed a split" moment for this feature.
        logFeatureUsage("single");
      }
      setCurrentStep((s) => s + 1);
    } finally {
      // Release on next tick so rapid clicks during the same paint are dropped.
      setTimeout(() => setIsTransitioning(false), 0);
    }
  };

  // Warn browser before unload when user is mid-fill (step 1 with items)
  useEffect(() => {
    if (currentStep !== 1 || state.items.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [currentStep, state.items.length]);

  const handleBack = () => {
    if (isTransitioning || currentStep === 0) return;
    setIsTransitioning(true);
    setCurrentStep((s) => s - 1);
    setTimeout(() => setIsTransitioning(false), 0);
  };

  const handleStepClick = (target: number) => {
    if (isTransitioning) return;
    // Stepper only allows clicking completed/current steps, so this is always
    // a backward jump or a no-op.
    setIsTransitioning(true);
    setCurrentStep(target);
    setTimeout(() => setIsTransitioning(false), 0);
  };

  const handleReset = () => {
    setShowResetDialog(true);
  };

  const confirmReset = () => {
    resetState();
    setCurrentStep(0);
    setShowResetDialog(false);
    toast({
      title: "Split reset",
      description: "All participants and items were cleared.",
      variant: "success",
    });
  };

  const updateState = (updates: Partial<SingleState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  // Attach/update/clear a participant's bank details from the summary. Passing
  // `undefined` clears it (JSON serialization drops the empty key).
  const updatePaymentInfo = (participantId: string, info: PaymentInfo | undefined) => {
    setState((prev) => ({
      ...prev,
      participants: prev.participants.map((p) =>
        p.id === participantId ? { ...p, paymentInfo: info } : p
      ),
    }));
  };

  const loadSampleData = () => {
    const a = generateId();
    const b = generateId();
    const c = generateId();
    setState({
      title: "Friday Dinner",
      participants: [
        { id: a, name: "Alex" },
        { id: b, name: "Bella" },
        { id: c, name: "Cara" },
      ],
      items: [
        { id: generateId(), name: "Margherita Pizza", qty: 1, unitPrice: 95000, total: 95000, assignedToIds: [a, b, c] },
        { id: generateId(), name: "Carbonara", qty: 1, unitPrice: 75000, total: 75000, assignedToIds: [a] },
        { id: generateId(), name: "Iced Tea x3", qty: 3, unitPrice: 15000, total: 45000, assignedToIds: [a, b, c] },
        { id: generateId(), name: "Tiramisu", qty: 1, unitPrice: 25000, total: 25000, assignedToIds: [b, c] },
      ],
      tax: 22000,
      service: 18000,
      payerId: a,
      discounts: [],
      fees: [],
    });
    toast({
      title: "Sample data loaded",
      description: "Click Next to walk through the rest of the flow.",
      variant: "success",
    });
  };

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-3 sm:px-6 py-3 sm:py-4 glass sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            aria-label="Back to home"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium hidden sm:inline">Back</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/25">
              <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm sm:text-base">Single Receipt</span>
              <span className="text-[10px] text-muted-foreground hidden sm:block">Split one bill</span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <AuthButton />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              aria-label="Reset"
              className="text-muted-foreground hover:text-destructive px-2 sm:px-3 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
            >
              <RotateCcw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex-grow">
        {/* Stepper */}
        <div className="mb-10">
          <Stepper
            steps={STEPS}
            currentStep={currentStep}
            onStepClick={handleStepClick}
          />
        </div>

        <div className={`grid gap-8 ${currentStep === 2 ? 'lg:grid-cols-1 max-w-4xl mx-auto' : 'lg:grid-cols-3'}`}>
          {/* Main Content */}
          <div className={`space-y-6 ${currentStep === 2 ? '' : 'lg:col-span-2'}`}>
            {/* Step 0: Participants */}
            {currentStep === 0 && (
              <Card className="animate-fade-in">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Who&rsquo;s splitting the bill?</CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">Add at least 2 people to continue</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ParticipantManager
                    participants={state.participants}
                    onChange={(participants) => updateState({ participants })}
                  />
                  {/* First-time helper: pre-load a small dinner scenario so users
                      can see the whole flow end-to-end without typing. */}
                  {state.participants.length === 0 && state.items.length === 0 && (
                    <button
                      type="button"
                      onClick={loadSampleData}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      <Sparkles className="h-4 w-4" />
                      Try with sample data (3 friends, dinner for Rp 240k)
                    </button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 1: Bill Details (Combined) */}
            {currentStep === 1 && (
              <div className="animate-fade-in space-y-6">
                {/* Receipt Title */}
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-accent/15 flex items-center justify-center">
                        <ReceiptIcon className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <CardTitle>Receipt Details</CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">Scan or add items manually</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Receipt Title</Label>
                        <Input
                          value={state.title}
                          onChange={(e) => updateState({ title: e.target.value })}
                          placeholder="e.g., Dinner at Restaurant"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Date</Label>
                        <Input
                          type="date"
                          value={state.date ? state.date.slice(0, 10) : ""}
                          onChange={(e) => updateState({ date: e.target.value || undefined })}
                          className="w-full sm:w-44"
                        />
                      </div>
                    </div>
                    <ReceiptInput
                      onParsed={(result) =>
                        updateState({
                          items: [...state.items, ...result.items],
                          tax: result.tax || state.tax,
                          service: result.service || state.service,
                          ...(result.discounts?.length
                            ? { discounts: [...(state.discounts ?? []), ...result.discounts] }
                            : {}),
                          ...(result.fees?.length
                            ? { fees: [...(state.fees ?? []), ...result.fees] }
                            : {}),
                        })
                      }
                    />
                  </CardContent>
                </Card>

                {/* Items Table with Inline Assignment */}
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Calculator className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle>Items & Assignments</CardTitle>
                          <p className="text-sm text-muted-foreground mt-0.5">{state.items.length} items added</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ItemsTable
                      items={state.items}
                      participants={state.participants}
                      onChange={(items) => updateState({ items })}
                    />
                  </CardContent>
                </Card>

                {/* Fees & Payer */}
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                        <ReceiptIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <CardTitle>Fees & Payer</CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">Add tax, service, and select who paid</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <FeesInput
                      tax={state.tax}
                      service={state.service}
                      payerId={state.payerId}
                      participants={state.participants}
                      onTaxChange={(tax) => updateState({ tax })}
                      onServiceChange={(service) => updateState({ service })}
                      onPayerChange={(payerId) => updateState({ payerId })}
                      fees={state.fees ?? []}
                      onFeesChange={(fees) => updateState({ fees })}
                    />
                  </CardContent>
                </Card>

                {/* Discounts — optional, collapsed behind a trigger by default */}
                <DiscountsInput
                  discounts={state.discounts ?? []}
                  items={state.items}
                  participants={state.participants}
                  onChange={(discounts) => updateState({ discounts })}
                />
              </div>
            )}

            {/* Step 2: Summary */}
            {currentStep === 2 && (
              <div className="animate-fade-in space-y-6">
                {/* Celebration Header */}
                <div className="text-center space-y-4 py-6">
                  <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center mx-auto animate-float shadow-lg shadow-accent/20">
                    <PartyPopper className="h-10 w-10 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold gradient-text">🎉 Split Complete!</h2>
                    <p className="text-muted-foreground mt-2">
                      Here&rsquo;s the complete breakdown for <span className="font-semibold text-foreground">{state.title}</span>
                    </p>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                  <Card className="text-center p-3 sm:p-4 bg-primary/5 border-primary/20">
                    <p className="text-2xl font-bold text-primary">{state.participants.length}</p>
                    <p className="text-xs text-muted-foreground">Participants</p>
                  </Card>
                  <Card className="text-center p-3 sm:p-4 bg-accent/5 border-accent/20">
                    <p className="text-2xl font-bold text-accent-strong">{state.items.length}</p>
                    <p className="text-xs text-muted-foreground">Items</p>
                  </Card>
                  <Card className="col-span-2 sm:col-span-1 text-center p-3 sm:p-4 bg-emerald-500/5 border-emerald-500/20">
                    <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 break-all sm:break-normal">
                      Rp {formatCurrency(summary.grandTotal)}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Bill</p>
                  </Card>
                </div>

                {/* Main Summary Panel - Centered */}
                <ErrorBoundary label="the summary">
                  <SummaryPanel
                    receipt={receipt}
                    participants={state.participants}
                    title={state.title}
                    onUpdatePaymentInfo={updatePaymentInfo}
                  />
                </ErrorBoundary>

                {/* Export Tip */}
                <Card className="border-dashed border-muted-foreground/30 bg-muted/30">
                  <CardContent className="py-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      💡 <span className="font-medium">Tip:</span> Use the <span className="font-semibold text-primary">Export</span> button above to copy & share via WhatsApp or other apps
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Navigation */}
            <div className="space-y-2 pt-6">
              {blockingMessage && (
                <p
                  role="status"
                  className="text-right text-xs font-medium text-amber-600 dark:text-amber-400"
                >
                  ⚠️ {blockingMessage}
                </p>
              )}
              <div className="flex justify-between">
                {/* Step 0 already has the header "Back" (to home); a second,
                    disabled Back here just adds a dead control — so on the first
                    step we render a spacer instead to keep Next right-aligned. */}
                {currentStep > 0 ? (
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={isTransitioning}
                    size="lg"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                ) : (
                  <span aria-hidden="true" />
                )}
                {currentStep < STEPS.length - 1 && (
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed || isTransitioning}
                    size="lg"
                    variant={currentStep === 1 ? "accent" : "default"}
                  >
                    {currentStep === 1 ? "View Summary" : "Next"}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Sticky Summary Sidebar (Desktop) - Hidden on Summary Step */}
          {currentStep !== 2 && (
            <div className="hidden lg:block">
              <ErrorBoundary label="the summary">
                <SummaryPanel
                  receipt={receipt}
                  participants={state.participants}
                  title={state.title}
                  onUpdatePaymentInfo={updatePaymentInfo}
                />
              </ErrorBoundary>
            </div>
          )}
        </div>
      </div>

      <AppFooter />

      <GuestLimitDialog
        open={showLimitDialog}
        onClose={() => setShowLimitDialog(false)}
      />

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset everything?</DialogTitle>
            <DialogDescription>
              This will clear all participants, items, fees, and the payer for this split. This action cannot be undone.
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
    </main>
  );
}
