"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Participant, ReceiptItem, Receipt, PaymentInfo, Discount, ReceiptFee } from "@/types";
import { useSearchParams, useRouter } from "next/navigation";
import { useHybridState } from "@/hooks/useHybridState";
import { useAuth } from "@/hooks/useAuth";
import { useSaveSplit } from "@/hooks/useSaveSplit";
import { supabaseDataService } from "@/lib/data/supabase-data-service";
import type { ReceiptDetail } from "@/lib/data/types";
import { receiptsFromDetail } from "@/lib/receipt-detail";
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
  Cloud,
  History,
  RotateCcw,
  Receipt as ReceiptIcon,
  PartyPopper,
  Sparkles,
  AlertTriangle,
  Lightbulb,
} from "@/components/ui/icons";
import { AppFooter } from "@/components/AppFooter";
import { useDictionary } from "@/lib/i18n/use-locale";

const STEPS: Step[] = [
  { id: "participants", labelKey: "participants" },
  { id: "bill", labelKey: "billDetails" },
  { id: "summary", labelKey: "summary" },
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
  const { isLimitReached, incrementCount, splitsRemaining, maxSplits } =
    useGuestLimit();
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  // Timestamp of the last successful scan — bumping it scrolls ItemsTable to
  // the first item that still needs assigning.
  const [scanLandedAt, setScanLandedAt] = useState(0);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated, signIn } = useAuth();
  const dict = useDictionary();
  const t = dict.app;
  const { saving, save, adopt, forget, id: savedId, expiresAt } = useSaveSplit();

  // Mirrors `state` so the resume effect can read the latest value without
  // listing it as a dependency — otherwise every keystroke would re-run it.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const handleSave = useCallback(() => {
    void save({
      type: "single",
      title: state.title,
      participants: state.participants,
      receipts: [
        {
          id: savedId ?? "single-receipt",
          title: state.title,
          date: state.date,
          payerId: state.payerId,
          items: state.items,
          tax: state.tax,
          service: state.service,
          discounts: state.discounts ?? [],
          fees: state.fees ?? [],
        },
      ],
    });
  }, [save, state, savedId]);

  // Resume: /single?resume=<id> loads a saved split back into the editor.
  const searchParams = useSearchParams();
  const router = useRouter();
  const resumeId = searchParams.get("resume");
  const [pendingResume, setPendingResume] = useState<ReceiptDetail | null>(null);

  // ── The wizard's position lives in the URL ─────────────────────────────────
  //
  // It did not, which meant the system back gesture — swipe from the left edge
  // on iOS, the back button on Android — left /single entirely from step 2
  // instead of returning to step 1. That is the same defect the trip and
  // receipt views were fixed for; the wizard was simply missed.
  //
  // It also decides the shape of the visible controls. With the position in
  // history, one back control at the top-left is enough: it reads as "back"
  // because of where it sits, and the ergonomic path — the thumb-zone gesture —
  // is handled by the OS. Two arrows, one of them unlabelled at the bottom of
  // the screen, was solving a problem the platform already solves.
  const stepParam = searchParams.get("step");
  const stepFromUrl = useMemo(() => {
    const i = STEPS.findIndex((step) => step.id === stepParam);
    return i >= 0 ? i : 0;
  }, [stepParam]);

  const stepUrl = useCallback((index: number) => {
    const id = STEPS[index]?.id;
    return index <= 0 || !id ? "/single" : `/single?step=${id}`;
  }, []);

  // How many forward entries in the history stack are ours. A backward move
  // pops one when we have it; after a reload straight onto ?step=bill we own
  // nothing, so it navigates explicitly rather than leaving the site.
  const ownedHistoryRef = useRef(0);

  // URL → state. Only ever writes state; the handlers only ever write the URL.
  useEffect(() => {
    setCurrentStep((prev) => (prev === stepFromUrl ? prev : stepFromUrl));
  }, [stepFromUrl]);

  const applyResume = useCallback(
    (detail: ReceiptDetail) => {
      // Via the shared reader: `detail.receipts?.[0]` was undefined for rows
      // saved before `receipts` existed, and this callback then returned
      // silently — Continue looked broken and said nothing.
      const receipt = receiptsFromDetail(detail)[0];
      if (!receipt) return;
      setState({
        participants: detail.participants ?? [],
        items: receipt.items ?? [],
        title: detail.title ?? "",
        date: receipt.date,
        tax: receipt.tax ?? 0,
        service: receipt.service ?? 0,
        payerId: receipt.payerId ?? "",
        discounts: receipt.discounts ?? [],
        fees: receipt.fees ?? [],
      });
      adopt({
        id: detail.id,
        version: detail.version ?? null,
        expiresAt: detail.expiresAt ?? null,
        shareCode: detail.shareCode ?? null,
      });
      setCurrentStep(1);
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
        // Drop the query param either way so a refresh doesn't re-trigger the
        // load (and re-prompt) after the user has answered.
        router.replace(stepUrl(1));
        // Overwriting unsaved local work without asking is exactly the kind of
        // silent loss this feature is meant to prevent.
        if (stateRef.current.items.length > 0 && stateRef.current.title !== detail.title) {
          setPendingResume(detail);
        } else {
          applyResume(detail);
        }
      } catch {
        if (!cancelled) {
          router.replace("/single");
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
  }, [resumeId, applyResume, router, toast, stepUrl]);

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

  // Whether THIS split has already been counted against the guest allowance.
  // It used to increment on every 1 → 2 transition, so a guest who opened the
  // summary, went Back to fix one price, and opened it again had burned two of
  // their three free splits on a single bill — three taps to lock themselves
  // out of work they had already done. Counted once per split; cleared by
  // Reset, which is what actually starts a new one.
  const countedRef = useRef(false);

  const handleNext = () => {
    if (isTransitioning || currentStep >= STEPS.length - 1) return;
    setIsTransitioning(true);
    try {
      // Check guest limit when moving to summary (step 2)
      if (currentStep === 1 && !countedRef.current) {
        if (isLimitReached) {
          setShowLimitDialog(true);
          return;
        }
        countedRef.current = true;
        incrementCount();
        // Reaching the summary is the "completed a split" moment for this feature.
        logFeatureUsage("single");
      }
      const next = currentStep + 1;
      ownedHistoryRef.current += 1;
      setCurrentStep(next);
      router.push(stepUrl(next));
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

  // The single back control, wired to be indistinguishable from the system
  // back gesture: it pops one step, and popping the first step leaves the split.
  // That is how a nav-bar back behaves in a pushed-view stack, and it is why one
  // control can cover both jobs without either of them being mislabelled.
  const handleBack = () => {
    if (isTransitioning) return;
    if (currentStep === 0) {
      router.push("/");
      return;
    }
    setIsTransitioning(true);
    const target = currentStep - 1;
    setCurrentStep(target);
    if (ownedHistoryRef.current > 0) {
      ownedHistoryRef.current -= 1;
      router.back();
    } else {
      // Arrived here directly (a reload on ?step=bill) — nothing of ours to pop.
      router.replace(stepUrl(target));
    }
    setTimeout(() => setIsTransitioning(false), 0);
  };

  const handleStepClick = (target: number) => {
    if (isTransitioning || target === currentStep) return;
    // The Stepper only allows completed/current steps, so this is always a
    // backward jump — possibly of more than one step, which is why it replaces
    // rather than popping. Our forward entries are no longer reachable after it.
    setIsTransitioning(true);
    setCurrentStep(target);
    ownedHistoryRef.current = 0;
    router.replace(stepUrl(target));
    setTimeout(() => setIsTransitioning(false), 0);
  };

  const handleReset = () => {
    setShowResetDialog(true);
  };

  const confirmReset = () => {
    resetState();
    setCurrentStep(0);
    ownedHistoryRef.current = 0;
    router.replace("/single");
    setShowResetDialog(false);
    // A reset is what actually begins a new split, so the next summary counts.
    countedRef.current = false;
    // Detach from the saved copy: the next Save should create a new split
    // rather than overwrite the one this editor used to hold. The saved split
    // itself is untouched and still resumable from Saved splits.
    forget();
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
      <header className="px-3 sm:px-6 py-3 sm:py-4 glass sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* One back control, and it is here because top-left is where the
              meaning lives: an arrow in this corner reads as "back" with no
              label at all, which the same arrow at the bottom of a button bar
              does not. It pops a step, and popping the first step leaves the
              split — see handleBack. */}
          <button
            type="button"
            onClick={handleBack}
            disabled={isTransitioning}
            aria-label={currentStep === 0 ? t.common.exit : t.common.back}
            className="touch-manipulation -ml-1 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
          >
            <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium hidden sm:inline">
              {currentStep === 0 ? t.common.exit : t.common.back}
            </span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/25">
              <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm sm:text-base">{t.modes.single.title}</span>
              <span className="text-[10px] text-muted-foreground hidden sm:block">{t.modes.single.subtitle}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Saved splits were reachable only via the account menu → Dashboard
                → Receipt history, so the "you can pick this up again from Saved
                splits" toast named a place with no route to it. */}
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

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex-grow">
        {/* Stepper */}
        <div className="mb-10">
          <Stepper
            steps={STEPS}
            currentStep={currentStep}
            onStepClick={handleStepClick}
          />
        </div>

        {/* The guest allowance, on screen from the first split.
            `splitsRemaining` was computed and then never rendered, so the limit
            was invisible right up to the moment it blocked someone — after
            they had added the people, scanned the receipt and assigned every
            item. A wall you can see coming is a different thing entirely. */}
        {!isAuthenticated && Number.isFinite(splitsRemaining) && (
          <div
            className={`mb-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-xs ${
              splitsRemaining <= 1
                ? "border-warning/30 bg-warning/10 text-warning"
                : "border-border bg-muted/40 text-muted-foreground"
            }`}
          >
            <span>
              {splitsRemaining === 0
                ? `You've used all ${maxSplits} free splits.`
                : `${splitsRemaining} of ${maxSplits} free splits left.`}
            </span>
            <button
              type="button"
              onClick={() => signIn(window.location.pathname)}
              className="touch-manipulation font-semibold text-primary underline underline-offset-2"
            >
              Sign in for unlimited
            </button>
          </div>
        )}

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
                        <ReceiptIcon className="h-5 w-5 text-accent-strong" />
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
                      onParsed={(result) => {
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
                        });
                        // Scanned items land in the card below, out of sight.
                        // Take the user there — assigning them is the next task.
                        setScanLandedAt(Date.now());
                      }}
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
                      scrollToUnassignedKey={scanLandedAt}
                    />
                  </CardContent>
                </Card>

                {/* Fees & Payer */}
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-success/15 flex items-center justify-center">
                        <ReceiptIcon className="h-5 w-5 text-success" />
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
                {/* Celebration header, reined in. This sat above the settlement
                    at 80px with an infinite float animation and text-3xl — a
                    moving object directly on top of the information the user
                    opened the screen for. */}
                <div className="text-center space-y-2 py-3">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center mx-auto">
                    <PartyPopper className="h-7 w-7 text-accent-strong" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Split complete</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-semibold text-foreground">{state.title}</span>
                    </p>
                  </div>
                </div>

                {/* Main Summary Panel - Centered */}
                <ErrorBoundary label="the summary">
                  <SummaryPanel
                    receipt={receipt}
                    participants={state.participants}
                    title={state.title}
                    savedSplitId={savedId}
                    onUpdatePaymentInfo={updatePaymentInfo}
                  />
                </ErrorBoundary>

                {/* Quick stats, below the panel. Measured on a 375x667 viewport,
                    the settlement heading landed 10px past the fold with these
                    above it — the answer was still one scroll away after being
                    moved to the top of the card. They are context; the panel is
                    the deliverable.
                    Participants and Items were also the two biggest
                    numbers on this screen at text-2xl — a count nobody needs,
                    rendered larger than the settlement amounts below. The total
                    leads now; the counts are context, at context size. */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                  <Card className="col-span-2 text-center p-3 sm:p-4 bg-emerald-500/5 border-emerald-500/20">
                    <p className="text-2xl font-bold text-success break-all sm:break-normal">
                      Rp {formatCurrency(summary.grandTotal)}
                    </p>
                    <p className="text-xs text-muted-foreground">Total bill</p>
                  </Card>
                  <Card className="text-center p-3 sm:p-4 bg-primary/5 border-primary/20">
                    <p className="text-base font-semibold text-primary">{state.participants.length}</p>
                    <p className="text-xs text-muted-foreground">Participants</p>
                  </Card>
                  <Card className="text-center p-3 sm:p-4 bg-accent/5 border-accent/20">
                    <p className="text-base font-semibold text-accent-strong">{state.items.length}</p>
                    <p className="text-xs text-muted-foreground">Items</p>
                  </Card>
                </div>

                {/* Export Tip */}
                <Card className="border-dashed border-muted-foreground/30 bg-muted/30">
                  <CardContent className="py-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      <Lightbulb className="mr-1 inline h-4 w-4 align-[-3px] text-accent-strong" aria-hidden="true" /><span className="font-medium">Tip:</span> Use the <span className="font-semibold text-primary">Export</span> button above to copy & share via WhatsApp or other apps
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Action bar.
                Sticky at the bottom on mobile, where most of the traffic is: the
                step actions sit in the thumb zone instead of the top-right
                corner. Save lives here rather than in the header because the
                header is navigation, and because it used to sit next to Reset —
                "save my work" one tap away from "erase everything", on a
                cramped bar. Static from `sm:` up, where a fixed bar would just
                eat vertical space on a mouse-driven screen. */}
            <div
              className="
                sticky bottom-0 z-10 -mx-3 mt-6 space-y-2 border-t
                bg-background/95 px-3 pt-3 backdrop-blur
                pb-[max(0.75rem,env(safe-area-inset-bottom))]
                md:static md:mx-0 md:border-0 md:bg-transparent md:px-0
                md:pb-0 md:backdrop-blur-none
              "
            >
              {blockingMessage && (
                <p
                  role="status"
                  className="text-xs font-medium text-warning sm:text-right"
                >
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5 shrink-0 align-[-2px]" aria-hidden="true" />{blockingMessage}
                </p>
              )}
              {/* Forward motion only. Back used to live here too, as a bare
                  unlabelled arrow on mobile — the control most in need of being
                  recognised was the one with no label. It moved to the header,
                  where its position carries the meaning, and the ~80px that
                  freed is spent on showing the Save label instead. Net: two
                  controls got clearer, not one. */}
              <div className="flex items-center gap-2">
                <span className="flex-1" aria-hidden="true" />

                {isAuthenticated && (
                  <Button
                    variant="outline"
                    onClick={handleSave}
                    disabled={saving || state.items.length === 0}
                    size="lg"
                    className="min-h-[44px] touch-manipulation"
                  >
                    <Cloud className="h-4 w-4 mr-2" />
                    {saving ? t.common.saving : t.common.save}
                  </Button>
                )}

                {currentStep < STEPS.length - 1 && (
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed || isTransitioning}
                    size="lg"
                    variant={currentStep === 1 ? "accent" : "default"}
                    className="min-h-[44px] touch-manipulation"
                  >
                    {currentStep === 1 ? "View Summary" : "Next"}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>

            {/* Reset lives here, not in the header: the header is navigation,
                and this is the most destructive control on the screen. Same
                placement TravelSpendView already uses for "Delete trip". */}
            <div className="flex justify-end pt-2">
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

      {/* Resuming replaces whatever is in the editor. Local work is only in this
          browser, so overwriting it without asking would destroy the one copy. */}
      <Dialog
        open={pendingResume !== null}
        onOpenChange={(open) => !open && setPendingResume(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace what&rsquo;s in the editor?</DialogTitle>
            <DialogDescription>
              You have a split in progress here ({state.items.length}{" "}
              item{state.items.length === 1 ? "" : "s"}). Opening
              &ldquo;{pendingResume?.title}&rdquo; will replace it, and anything
              you haven&rsquo;t saved will be lost.
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
