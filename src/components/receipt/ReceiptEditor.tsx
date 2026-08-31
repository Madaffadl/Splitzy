"use client";

import { useState, useCallback, useRef } from "react";
import { Receipt, Participant, PaymentInfo } from "@/types";
import { ReceiptInput } from "@/components/receipt/ReceiptInput";
import { ItemsTable } from "@/components/receipt/ItemsTable";
import { FeesInput } from "@/components/receipt/FeesInput";
import { DiscountsInput } from "@/components/receipt/DiscountsInput";
import { nativeSelectClass } from "@/components/ui/select";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { SummaryPanel } from "@/components/receipt/SummaryPanel";
import { ErrorBoundary } from "@/components/providers/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, Loader2, RefreshCw, CheckCircle2, AlertCircle, Globe, AlertTriangle,} from "@/components/ui/icons";
import { fill, useDictionary } from "@/lib/i18n/use-locale";
import { TRAVEL_CURRENCIES, getCurrencyMeta } from "@/lib/currencies";

interface ScanDetection {
  currency: string;
  status: "fetching" | "fetched" | "error";
}

// Coarse relative time for FX-rate freshness ("just now", "2h ago", "3d ago").
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "recently";
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ReceiptEditorProps {
  receipt: Receipt;
  participants: Participant[];
  isNew: boolean;
  onChange: (updates: Partial<Receipt>) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  onUpdatePaymentInfo?: (participantId: string, info: PaymentInfo | undefined) => void;
  /** When true, shows the currency picker (Travel Spend only). */
  isTravelMode?: boolean;
}

// Full itemized receipt editor shared by Multiple Receipts and Travel Spend.
export function ReceiptEditor({
  receipt,
  participants,
  isNew,
  onChange,
  onSave,
  onCancel,
  isSaving = false,
  onUpdatePaymentInfo,
  isTravelMode = false,
}: ReceiptEditorProps) {
  const t = useDictionary().app;
  const [fetchingRate, setFetchingRate] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [scanDetection, setScanDetection] = useState<ScanDetection | null>(null);
  // Provenance of an auto-fetched rate (source host + when the API last updated
  // it) so the number isn't a mystery — builds trust that it's a real rate.
  const [rateMeta, setRateMeta] = useState<{ updatedAt: string } | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isForeignCurrency = !!receipt.currency && receipt.currency !== "IDR";
  const hasRate = !!receipt.fxRate && receipt.fxRate > 0;

  const canSave =
    receipt.items.length > 0 &&
    receipt.items.every((item) => item.total > 0 && item.assignedToIds.length > 0) &&
    !!receipt.payerId &&
    (!isTravelMode || !isForeignCurrency || hasRate);

  let blockMsg: string | null = null;
  if (receipt.items.length === 0) blockMsg = t.editor.needItem;
  else if (!receipt.items.every((item) => item.total > 0 && item.assignedToIds.length > 0)) {
    const unassigned = receipt.items.filter((i) => i.assignedToIds.length === 0).length;
    blockMsg =
      unassigned > 0
        ? fill(t.editor.needAssign, { count: unassigned })
        : t.editor.needPrice;
  } else if (!receipt.payerId) blockMsg = t.editor.needPayer;
  else if (isTravelMode && isForeignCurrency && !hasRate)
    blockMsg = `Enter the exchange rate for ${receipt.currency}.`;

  // Fetch rate from the server proxy; returns true on success.
  const fetchRate = useCallback(
    async (currency: string): Promise<boolean> => {
      if (!currency || currency === "IDR") return true;
      setFetchingRate(true);
      setRateError(null);
      try {
        const res = await fetch(`/api/fx-rate?from=${encodeURIComponent(currency)}`);
        const data = (await res.json()) as { rate?: number; updatedAt?: string; error?: string };
        if (!res.ok || !data.rate) {
          setRateError(data.error ?? t.editor.rateFetchFailed);
          return false;
        }
        onChange({ fxRate: data.rate });
        setRateMeta({ updatedAt: data.updatedAt ?? new Date().toISOString() });
        return true;
      } catch {
        setRateError(t.editor.rateNetworkError);
        return false;
      } finally {
        setFetchingRate(false);
      }
    },
    [onChange, t.editor.rateFetchFailed, t.editor.rateNetworkError]
  );

  const handleCurrencyChange = useCallback(
    (newCurrency: string) => {
      setRateMeta(null);
      if (newCurrency === "IDR") {
        onChange({ currency: undefined, fxRate: undefined });
        setRateError(null);
        setScanDetection(null);
      } else {
        onChange({ currency: newCurrency, fxRate: undefined });
        void fetchRate(newCurrency);
      }
    },
    [onChange, fetchRate]
  );

  // Called by the scan result handler when Gemini detects a foreign currency.
  // Shows an animated banner: "Detecting → Fetching → Locked".
  const handleScanCurrency = useCallback(
    async (currency: string) => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      setScanDetection({ currency, status: "fetching" });
      const ok = await fetchRate(currency);
      setScanDetection({ currency, status: ok ? "fetched" : "error" });
      // Auto-dismiss after 5 s on success; keep visible on error.
      if (ok) {
        dismissTimerRef.current = setTimeout(() => setScanDetection(null), 5000);
      }
    },
    [fetchRate]
  );

  const currencyMeta = getCurrencyMeta(receipt.currency);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 min-w-0 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{isNew ? t.editor.newReceipt : t.editor.editReceipt}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label>{t.editor.receiptTitle}</Label>
                <Input
                  value={receipt.title}
                  onChange={(e) => onChange({ title: e.target.value })}
                  placeholder="e.g., Lunch at Cafe"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={receipt.date ? receipt.date.slice(0, 10) : ""}
                  onChange={(e) => onChange({ date: e.target.value || undefined })}
                  className="w-full sm:w-44"
                />
              </div>
            </div>

            {/* ── Currency section (Travel Spend only) ── */}
            {isTravelMode && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium text-sm">{t.editor.currency}</h3>
                </div>

                {/* Scan detection banner */}
                {scanDetection && (
                  <div
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm
                      ${scanDetection.status === "fetched"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : scanDetection.status === "error"
                        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                      }`}
                  >
                    {scanDetection.status === "fetching" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                        <span>
                          {fill(t.editor.detectedFetching, { name: getCurrencyMeta(scanDetection.currency).name })}
                        </span>
                      </>
                    ) : scanDetection.status === "fetched" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>
                          {fill(t.editor.detectedLocked, { name: getCurrencyMeta(scanDetection.currency).name })}{" "}
                          <strong>
                            1 {getCurrencyMeta(scanDetection.currency).symbol} = Rp{" "}
                            {receipt.fxRate?.toLocaleString("id-ID", { maximumFractionDigits: 4 })}
                          </strong>
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>
                          {fill(t.editor.detectedManual, { name: getCurrencyMeta(scanDetection.currency).name })}
                        </span>
                      </>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <select
                    value={receipt.currency ?? "IDR"}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    className={nativeSelectClass}
                  >
                    {TRAVEL_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.symbol}  {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {isForeignCurrency && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        1 {currencyMeta.symbol} =
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="e.g. 0.67"
                        value={receipt.fxRate ?? ""}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          // Manual edit → the rate is no longer the fetched one.
                          setRateMeta(null);
                          onChange({ fxRate: Number.isFinite(v) && v > 0 ? v : undefined });
                        }}
                        className="min-w-[6rem] flex-1 sm:w-36 sm:flex-none"
                      />
                      <span className="text-sm text-muted-foreground">Rp</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void fetchRate(receipt.currency!)}
                        disabled={fetchingRate}
                        title={t.editor.autoFetchTitle}
                        className="touch-manipulation"
                      >
                        {fetchingRate ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1.5">{t.editor.autoFetch}</span>
                      </Button>
                    </div>

                    {hasRate && !scanDetection && (
                      <p className="text-xs text-muted-foreground">
                        {t.editor.rateLocked}{" "}
                        <span className="font-medium text-foreground">
                          1 {currencyMeta.symbol} = Rp{" "}
                          {receipt.fxRate!.toLocaleString("id-ID", { maximumFractionDigits: 4 })}
                        </span>{" "}
                        · {t.editor.savedWithReceipt}
                      </p>
                    )}

                    {/* Source attribution — only for an auto-fetched rate that
                        hasn't been manually overridden (rateMeta cleared on edit). */}
                    {rateMeta && hasRate && (
                      <p className="text-[11px] text-muted-foreground/80">
                        {t.editor.source}: open.er-api.com · {t.editor.updated} {relativeTime(rateMeta.updatedAt)}
                      </p>
                    )}

                    {rateError && <p className="text-xs text-destructive">{rateError}</p>}
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 border-t">
              <h3 className="font-medium mb-4">{t.editor.addItems}</h3>
              <ReceiptInput
                onParsed={(result) => {
                  const updates: Partial<Receipt> = {
                    items: [...receipt.items, ...result.items],
                    tax: result.tax || receipt.tax,
                    service: result.service || receipt.service,
                    ...(result.discounts?.length
                      ? { discounts: [...(receipt.discounts ?? []), ...result.discounts] }
                      : {}),
                    ...(result.fees?.length
                      ? { fees: [...(receipt.fees ?? []), ...result.fees] }
                      : {}),
                  };
                  if (isTravelMode && result.currency && result.currency !== "IDR") {
                    updates.currency = result.currency;
                    updates.fxRate = undefined;
                    onChange(updates);
                    void handleScanCurrency(result.currency);
                  } else {
                    onChange(updates);
                  }
                }}
              />
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-medium mb-4">{t.editor.itemsAssignments}</h3>
              <ItemsTable
                items={receipt.items}
                participants={participants}
                onChange={(items) => onChange({ items })}
              />
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-medium mb-4">{t.editor.feesPayer}</h3>
              <FeesInput
                tax={receipt.tax}
                service={receipt.service}
                payerId={receipt.payerId}
                participants={participants}
                onTaxChange={(tax) => onChange({ tax })}
                onServiceChange={(service) => onChange({ service })}
                onPayerChange={(payerId) => onChange({ payerId })}
                currency={isTravelMode ? receipt.currency : undefined}
                fees={receipt.fees ?? []}
                onFeesChange={(fees) => onChange({ fees })}
              />
            </div>

            <div className="pt-4 border-t">
              <DiscountsInput
                discounts={receipt.discounts ?? []}
                items={receipt.items}
                participants={participants}
                onChange={(discounts) => onChange({ discounts })}
                currency={isTravelMode ? receipt.currency : undefined}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save/Cancel — the shared bar, so the editor stops speaking a
            different visual language from the split it sits inside. It was a
            floating rounded card with its own blur that kept floating on
            desktop; the previous "Add receipt" tap and this "Save receipt" tap
            happen seconds apart and now look like the same control surface. */}
        <StickyActionBar>
          {blockMsg && (
            <p role="status" className="mb-2 text-right text-xs font-medium text-warning">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />{blockMsg}
            </p>
          )}
          {/* Column-reverse on mobile puts Save above Cancel, so the discard
              action is never the one under the thumb's resting position. */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              className="touch-manipulation h-11 w-full sm:w-auto bg-background/50 hover:bg-muted"
            >
              <X className="h-4 w-4 mr-2" />
              {t.editor.cancel}
            </Button>
            <Button
              onClick={onSave}
              disabled={!canSave || isSaving}
              className="touch-manipulation h-11 w-full sm:w-auto shadow-md shadow-primary/20"
            >
              <Check className="h-4 w-4 mr-2" />
              {t.editor.saveReceipt}
            </Button>
          </div>
        </StickyActionBar>
      </div>

      {/* Live preview */}
      <div>
        <ErrorBoundary label="the receipt preview">
          <SummaryPanel
            receipt={receipt}
            participants={participants}
            title={receipt.title}
            onUpdatePaymentInfo={onUpdatePaymentInfo}
            preview
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
