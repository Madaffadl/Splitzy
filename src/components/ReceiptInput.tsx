"use client";

import { useState, useRef, useCallback } from "react";
import type { ReceiptItem, Discount, ReceiptFee } from "@/types";
import type { ParseResult } from "@/lib/parser";
import { formatCurrency, generateId, roundTo2 } from "@/lib/utils";
import { EVENTS, capture } from "@/lib/analytics";
import { ScanQuotaPaywall } from "@/components/billing/ScanQuotaPaywall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  Camera,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ImageIcon,
  Sparkles,
  ShieldCheck,
} from "@/components/ui/icons";

interface ReceiptInputProps {
  onParsed: (result: ParseResult) => void;
}

type UploadStatus = "idle" | "uploading" | "processing" | "success" | "error";

interface GeminiItem {
  name: string;
  qty: number;
  price: number;
}

interface GeminiDiscount {
  label: string;
  type: "amount" | "percent";
  value: number;
  scope: "receipt" | "item";
  itemName?: string;
}

interface GeminiFee {
  label: string;
  amount: number;
  splitMethod: "equal" | "proportional";
}

interface GeminiResponse {
  items: GeminiItem[];
  tax: number;
  service: number;
  currency?: string;
  error?: string;
  discounts?: GeminiDiscount[];
  fees?: GeminiFee[];
}

async function resizeImage(dataUrl: string, maxDimension = 1920, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      let targetWidth = width;
      let targetHeight = height;
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          targetWidth = maxDimension;
          targetHeight = Math.round((height / width) * maxDimension);
        } else {
          targetHeight = maxDimension;
          targetWidth = Math.round((width / height) * maxDimension);
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function ReceiptInput({ onParsed }: ReceiptInputProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [quotaHit, setQuotaHit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processWithGemini = useCallback(async (imageData: string): Promise<GeminiResponse> => {
    const response = await fetch("/api/parse-receipt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image: imageData }),
    });

    if (!response.ok) {
      // Surface quota-exceeded errors with a friendly upsell message.
      const errBody = await response.json().catch(() => null) as { code?: string; error?: string } | null;
      if (errBody?.code === "QUOTA_EXCEEDED") {
        throw new Error("__QUOTA__");
      }
      // A timeout says nothing about the photo, so don't imply it was bad —
      // "couldn't read the image" would send the user off re-cropping a
      // perfectly good receipt.
      if (errBody?.code === "UPSTREAM_TIMEOUT") {
        throw new Error("__TIMEOUT__");
      }
      throw new Error("Failed to process image");
    }

    return response.json();
  }, []);

  const processImage = useCallback(async (imageData: string) => {
    setStatus("processing");
    setErrorMessage("");
    setQuotaHit(false);
    capture(EVENTS.scanStarted);

    try {
      const geminiResult = await processWithGemini(imageData);
      
      if (geminiResult.error) {
        setErrorMessage(geminiResult.error);
        setStatus("error");
        return;
      }

      if (geminiResult.items.length === 0) {
        setErrorMessage("No items found. Try a clearer photo.");
        setStatus("error");
        return;
      }

      // Convert Gemini response to ParseResult format
      const items: ReceiptItem[] = geminiResult.items.map((item) => ({
        id: generateId(),
        name: item.name,
        qty: item.qty,
        unitPrice: roundTo2(item.price / item.qty),
        total: roundTo2(item.price),
        assignedToIds: [],
      }));

      // Build Discount[] — item-scope discounts need itemName→UUID matching
      const discounts: Discount[] = (geminiResult.discounts ?? []).map((d) => {
        let targetId: string | undefined;
        if (d.scope === "item" && d.itemName) {
          const nameLower = d.itemName.toLowerCase();
          const match = items.find(
            (i) =>
              i.name.toLowerCase().includes(nameLower) ||
              nameLower.includes(i.name.toLowerCase())
          );
          targetId = match?.id;
        }
        return {
          id: generateId(),
          scope: targetId ? "item" : "receipt",
          type: d.type,
          value: d.value,
          label: d.label,
          ...(targetId ? { targetId } : {}),
        } satisfies Discount;
      });

      // Build ReceiptFee[]
      const fees: ReceiptFee[] = (geminiResult.fees ?? []).map((f) => ({
        id: generateId(),
        label: f.label,
        amount: f.amount,
        splitMethod: f.splitMethod,
      }));

      const detectedCurrency =
        typeof geminiResult.currency === "string" && geminiResult.currency !== "IDR"
          ? geminiResult.currency
          : undefined;

      const parseResult: ParseResult = {
        items,
        tax: roundTo2(geminiResult.tax),
        service: roundTo2(geminiResult.service),
        ...(detectedCurrency ? { currency: detectedCurrency } : {}),
        ...(discounts.length > 0 ? { discounts } : {}),
        ...(fees.length > 0 ? { fees } : {}),
      };

      setParsedResult(parseResult);
      setStatus("success");
      capture(EVENTS.scanCompleted, {
        items: items.length,
        currency: detectedCurrency ?? "IDR",
      });

      // Auto-add items after a short delay
      setTimeout(() => {
        onParsed(parseResult);
      }, 500);
    } catch (error) {
      console.error("Processing error:", error);
      const msg = error instanceof Error ? error.message : "";
      if (msg === "__QUOTA__") {
        setQuotaHit(true);
        capture(EVENTS.quotaHit);
      } else if (msg === "__TIMEOUT__") {
        // Nothing was wrong with the photo — say so, or the user will waste
        // time re-shooting a receipt that would have scanned fine.
        setErrorMessage("Scanning took too long. Please try again.");
      } else {
        setErrorMessage("Failed to process image. Please try again.");
      }
      setStatus("error");
    }
  }, [processWithGemini, onParsed]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const rawData = reader.result as string;
      setImagePreview(rawData);
      const imageData = await resizeImage(rawData);
      await processImage(imageData);
    };
    reader.readAsDataURL(file);
  };

  const resetUpload = () => {
    setStatus("idle");
    setImagePreview(null);
    setParsedResult(null);
    setErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const retryProcessing = () => {
    if (imagePreview) {
      processImage(imagePreview);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {status === "idle" && (
        <div className="space-y-4">
          {/* Main Upload Button */}
          <div 
            className="relative border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 text-center hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="space-y-3">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <ImageIcon className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-medium text-lg">Upload Receipt Photo</p>
                <p className="text-sm text-muted-foreground">
                  Click or drag receipt photo here
                </p>
              </div>
            </div>
          </div>

          {/* Camera Button for Mobile */}
          <Input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-12"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose File
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-4 w-4 mr-2" />
              Take Photo
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            ✨ AI will read the receipt and extract all items automatically
          </p>

          {/* Privacy disclosure — be transparent that the image is sent to a third party.
              Important for trust on a finance-related app. */}
          <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <p>
              Your photo is sent to Google Gemini for parsing and is not stored by Splitzy.
              Avoid uploading receipts with sensitive personal data.
            </p>
          </div>
        </div>
      )}

      {/* Processing State */}
      {(status === "uploading" || status === "processing") && (
        <div className="space-y-4">
          {imagePreview && (
            <div className="relative rounded-xl overflow-hidden border-2 border-primary/30">
              {/* User-uploaded data URL preview — next/image isn't a fit
                  (no width/height known, no remote optimization needed). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Receipt"
                className="w-full max-h-[250px] object-contain bg-muted/30"
              />
              <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                  <Sparkles className="h-5 w-5 text-primary absolute -top-1 -right-1 animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-semibold text-lg">
                    {status === "uploading" ? "Uploading..." : "AI Reading Receipt..."}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Gemini is analyzing the image
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success State */}
      {status === "success" && parsedResult && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                Success! {parsedResult.items.length} item{parsedResult.items.length !== 1 ? 's' : ''} found
              </p>
              <p className="text-sm text-muted-foreground">
                Items have been added to the list
              </p>
            </div>
          </div>

          {/* Preview of parsed items */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <Label className="text-sm text-muted-foreground">Items found:</Label>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {parsedResult.items.map((item, i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-2">
                    {item.qty > 1 && (
                      <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                        {item.qty}x
                      </span>
                    )}
                    <span className="font-medium truncate">{item.name}</span>
                  </div>
                  <span className="text-muted-foreground whitespace-nowrap">
                    Rp {formatCurrency(item.total)}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Receipt Summary */}
            <div className="pt-3 border-t space-y-1.5 mt-4">
              <div className="flex justify-between text-sm font-medium text-foreground">
                <span>Subtotal Items</span>
                <span>Rp {formatCurrency(parsedResult.items.reduce((sum, item) => sum + (item.total || 0), 0))}</span>
              </div>
              
              {parsedResult.service > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Service</span>
                  <span>Rp {formatCurrency(parsedResult.service)}</span>
                </div>
              )}
              
              {parsedResult.tax > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Tax/PB1</span>
                  <span>Rp {formatCurrency(parsedResult.tax)}</span>
                </div>
              )}
              
              <div className="flex justify-between text-base font-bold text-foreground pt-3 mt-2 border-t border-dashed">
                <span>Total Detected</span>
                <span>Rp {formatCurrency(
                  parsedResult.items.reduce((sum, item) => sum + (item.total || 0), 0) + 
                  (parsedResult.tax || 0) + 
                  (parsedResult.service || 0)
                )}</span>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={resetUpload}
            className="touch-manipulation h-11 w-full"
          >
            Upload Another Receipt
          </Button>
        </div>
      )}

      {/* Error State */}
      {status === "error" && (
        <div className="space-y-4 animate-fade-in">
          {imagePreview && (
            <div className="rounded-xl overflow-hidden border">
              {/* User-uploaded data URL preview — next/image isn't a fit. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Receipt"
                className="w-full max-h-[200px] object-contain bg-muted/30"
              />
            </div>
          )}
          
          {quotaHit ? (
            <ScanQuotaPaywall />
          ) : (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-600 dark:text-amber-400">
                  Failed to read receipt
                </p>
                <p className="text-sm text-muted-foreground">
                  {errorMessage || "Make sure the photo is clear and try again."}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={resetUpload}
              className="touch-manipulation h-11"
            >
              Upload New
            </Button>
            {!quotaHit && (
              <Button
                type="button"
                onClick={retryProcessing}
                className="touch-manipulation h-11"
              >
                Try Again
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
