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
} from "lucide-react";

const STEPS: Step[] = [
  { id: "participants", title: "Participants" },
  { id: "receipt", title: "Receipt" },
  { id: "assign", title: "Assign Items" },
  { id: "fees", title: "Fees & Payer" },
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
      case 1: // Receipt input
        return state.items.length > 0;
      case 2: // Assign items
        return state.items.some((item) => item.assignedToIds.length > 0);
      case 3: // Fees & Payer
        return state.payerId !== "";
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
    <main className="min-h-screen">
      {/* Header */}
      <header className="px-6 py-4 border-b glass sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Calculator className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">Single Receipt</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stepper */}
        <div className="mb-8">
          <Stepper
            steps={STEPS}
            currentStep={currentStep}
            onStepClick={setCurrentStep}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 0: Participants */}
            {currentStep === 0 && (
              <Card className="animate-fade-in">
                <CardHeader>
                  <CardTitle>Who&apos;s splitting the bill?</CardTitle>
                </CardHeader>
                <CardContent>
                  <ParticipantManager
                    participants={state.participants}
                    onChange={(participants) => updateState({ participants })}
                  />
                </CardContent>
              </Card>
            )}

            {/* Step 1: Receipt Input */}
            {currentStep === 1 && (
              <Card className="animate-fade-in">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ReceiptIcon className="h-5 w-5" />
                    Enter Receipt Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Receipt Title</Label>
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
                  {state.items.length > 0 && (
                    <div className="pt-4 border-t">
                      <ItemsTable
                        items={state.items}
                        participants={state.participants}
                        onChange={(items) => updateState({ items })}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 2: Assign Items */}
            {currentStep === 2 && (
              <Card className="animate-fade-in">
                <CardHeader>
                  <CardTitle>Assign Items to Participants</CardTitle>
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

            {/* Step 3: Fees & Payer */}
            {currentStep === 3 && (
              <Card className="animate-fade-in">
                <CardHeader>
                  <CardTitle>Add Fees & Select Payer</CardTitle>
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
            )}

            {/* Step 4: Summary */}
            {currentStep === 4 && (
              <div className="animate-fade-in space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>🎉 Bill Split Complete!</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Here&apos;s the breakdown for {state.title}. Use the Export
                      button to copy the summary for WhatsApp or any messaging app.
                    </p>
                  </CardContent>
                </Card>
                <div className="lg:hidden">
                  <SummaryPanel
                    receipt={receipt}
                    participants={state.participants}
                    title={state.title}
                  />
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              {currentStep < STEPS.length - 1 && (
                <Button onClick={handleNext} disabled={!canProceed}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>

          {/* Sticky Summary Sidebar (Desktop) */}
          <div className="hidden lg:block">
            <SummaryPanel
              receipt={receipt}
              participants={state.participants}
              title={state.title}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
