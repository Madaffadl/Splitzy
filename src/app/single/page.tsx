"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Participant, ReceiptItem, Receipt } from "@/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { generateId } from "@/lib/utils";
import { Stepper, Step } from "@/components/Stepper";
import { ParticipantManager } from "@/components/ParticipantManager";
import { ReceiptInput } from "@/components/ReceiptInput";
import { ItemsTable } from "@/components/ItemsTable";
import { FeesInput } from "@/components/FeesInput";
import { SummaryPanel } from "@/components/SummaryPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  RotateCcw,
  Receipt as ReceiptIcon,
  PartyPopper,
  Sparkles,
  Mail,
  Instagram,
  Linkedin,
  Phone,
} from "lucide-react";

const STEPS: Step[] = [
  { id: "participants", title: "Participants" },
  { id: "bill", title: "Bill Details" },
  { id: "summary", title: "Summary" },
];

interface SingleState {
  participants: Participant[];
  items: ReceiptItem[];
  title: string;
  tax: number;
  service: number;
  payerId: string;
}

const DEFAULT_STATE: SingleState = {
  participants: [],
  items: [],
  title: "Dinner",
  tax: 0,
  service: 0,
  payerId: "",
};

export default function SinglePage() {
  const [state, setState, resetState] = useLocalStorage<SingleState>(
    "splitbill-single",
    DEFAULT_STATE
  );
  const [currentStep, setCurrentStep] = useState(0);

  const receipt: Receipt = useMemo(
    () => ({
      id: "single-receipt",
      title: state.title,
      payerId: state.payerId,
      items: state.items,
      tax: state.tax,
      service: state.service,
    }),
    [state]
  );

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0: // Participants
        return state.participants.length >= 2;
      case 1: // Bill Details (combined receipt, assign, fees)
        return (
          state.items.length > 0 &&
          state.items.some((item) => item.assignedToIds.length > 0) &&
          state.payerId !== ""
        );
      default:
        return true;
    }
  }, [currentStep, state]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset everything?")) {
      resetState();
      setCurrentStep(0);
    }
  };

  const updateState = (updates: Partial<SingleState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-3 sm:px-6 py-3 sm:py-4 glass sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/"
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
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground hover:text-destructive px-2 sm:px-3">
            <RotateCcw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex-grow">
        {/* Stepper */}
        <div className="mb-10">
          <Stepper
            steps={STEPS}
            currentStep={currentStep}
            onStepClick={setCurrentStep}
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
                      <CardTitle>Who's splitting the bill?</CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">Add at least 2 people to continue</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ParticipantManager
                    participants={state.participants}
                    onChange={(participants) => updateState({ participants })}
                  />
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
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Receipt Title</Label>
                      <Input
                        value={state.title}
                        onChange={(e) => updateState({ title: e.target.value })}
                        placeholder="e.g., Dinner at Restaurant"
                      />
                    </div>
                    <ReceiptInput
                      onParsed={(result) =>
                        updateState({
                          items: [...state.items, ...result.items],
                          tax: result.tax || state.tax,
                          service: result.service || state.service,
                        })
                      }
                    />
                  </CardContent>
                </Card>

                {/* Items Table with Inline Assignment */}
                {state.items.length > 0 && (
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
                )}

                {/* Fees & Payer */}
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                        <ReceiptIcon className="h-5 w-5 text-emerald-600" />
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
                    />
                  </CardContent>
                </Card>
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
                      Here's the complete breakdown for <span className="font-semibold text-foreground">{state.title}</span>
                    </p>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="text-center p-4 bg-primary/5 border-primary/20">
                    <p className="text-2xl font-bold text-primary">{state.participants.length}</p>
                    <p className="text-xs text-muted-foreground">Participants</p>
                  </Card>
                  <Card className="text-center p-4 bg-accent/5 border-accent/20">
                    <p className="text-2xl font-bold text-accent">{state.items.length}</p>
                    <p className="text-xs text-muted-foreground">Items</p>
                  </Card>
                  <Card className="text-center p-4 bg-emerald-500/5 border-emerald-500/20">
                    <p className="text-2xl font-bold text-emerald-600">Rp {((state.items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0)) + state.tax + state.service).toLocaleString('id-ID')}</p>
                    <p className="text-xs text-muted-foreground">Total Bill</p>
                  </Card>
                </div>

                {/* Main Summary Panel - Centered */}
                <SummaryPanel
                  receipt={receipt}
                  participants={state.participants}
                  title={state.title}
                />

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
            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0}
                size="lg"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              {currentStep < STEPS.length - 1 && (
                <Button 
                  onClick={handleNext} 
                  disabled={!canProceed}
                  size="lg"
                  variant={currentStep === 1 ? "accent" : "default"}
                >
                  {currentStep === 1 ? "View Summary" : "Next"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>

          {/* Sticky Summary Sidebar (Desktop) - Hidden on Summary Step */}
          {currentStep !== 2 && (
            <div className="hidden lg:block">
              <SummaryPanel
                receipt={receipt}
                participants={state.participants}
                title={state.title}
              />
            </div>
          )}
        </div>
      </div>

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
