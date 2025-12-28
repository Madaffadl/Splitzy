"use client";

import { useState, useRef, useCallback } from "react";
import type { ReceiptItem } from "@/types";
import type { ParseResult } from "@/lib/parser";
import { formatCurrency, generateId, roundTo2 } from "@/lib/utils";
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
  Zap
} from "lucide-react";

interface ReceiptInputProps {
  onParsed: (result: ParseResult) => void;
}

type UploadStatus = "idle" | "uploading" | "processing" | "success" | "error";

interface GeminiItem {
  name: string;
  qty: number;
  price: number;
}

interface GeminiResponse {
  items: GeminiItem[];
  tax: number;
  service: number;
  error?: string;
}

export function ReceiptInput({ onParsed }: ReceiptInputProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
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
      throw new Error("Failed to process image");
    }

    return response.json();
  }, []);

  const processImage = useCallback(async (imageData: string) => {
    setStatus("processing");
    setErrorMessage("");

    try {
      const geminiResult = await processWithGemini(imageData);
      
      if (geminiResult.error) {
        setErrorMessage(geminiResult.error);
        setStatus("error");
        return;
      }

      if (geminiResult.items.length === 0) {
        setErrorMessage("Tidak ada item yang ditemukan. Coba foto yang lebih jelas.");
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

      const parseResult: ParseResult = {
        items,
        tax: roundTo2(geminiResult.tax),
        service: roundTo2(geminiResult.service),
      };

      setParsedResult(parseResult);
      setStatus("success");
      
      // Auto-add items after a short delay
      setTimeout(() => {
        onParsed(parseResult);
      }, 500);
    } catch (error) {
      console.error("Processing error:", error);
      setErrorMessage("Gagal memproses gambar. Coba lagi.");
      setStatus("error");
    }
  }, [processWithGemini, onParsed]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const imageData = reader.result as string;
      setImagePreview(imageData);
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
          {/* AI Badge */}
          <div className="flex items-center justify-center gap-2 text-sm text-primary">
            <Zap className="h-4 w-4" />
            <span className="font-medium">Powered by Gemini AI</span>
          </div>

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
                <p className="font-medium text-lg">Upload Foto Struk</p>
                <p className="text-sm text-muted-foreground">
                  Klik atau drag foto struk ke sini
                </p>
              </div>
            </div>
          </div>

          {/* Camera Button for Mobile */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-12"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Pilih File
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 relative"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-4 w-4 mr-2" />
              Ambil Foto
              <Input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="absolute inset-0 opacity-0"
              />
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            ✨ AI akan membaca struk dan mengekstrak semua item secara otomatis
          </p>
        </div>
      )}

      {/* Processing State */}
      {(status === "uploading" || status === "processing") && (
        <div className="space-y-4">
          {imagePreview && (
            <div className="relative rounded-xl overflow-hidden border-2 border-primary/30">
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
                    {status === "uploading" ? "Mengunggah..." : "AI Membaca Struk..."}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Gemini sedang menganalisis gambar
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
              <p className="font-semibold text-emerald-600">
                Berhasil! {parsedResult.items.length} item ditemukan
              </p>
              <p className="text-sm text-muted-foreground">
                Item sudah ditambahkan ke daftar
              </p>
            </div>
          </div>

          {/* Preview of parsed items */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <Label className="text-sm text-muted-foreground">Item yang ditemukan:</Label>
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
            
            {/* Tax & Service if detected */}
            {(parsedResult.tax > 0 || parsedResult.service > 0) && (
              <div className="pt-2 border-t space-y-1">
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
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={resetUpload}
            className="w-full"
          >
            Upload Struk Lain
          </Button>
        </div>
      )}

      {/* Error State */}
      {status === "error" && (
        <div className="space-y-4 animate-fade-in">
          {imagePreview && (
            <div className="rounded-xl overflow-hidden border">
              <img
                src={imagePreview}
                alt="Receipt"
                className="w-full max-h-[200px] object-contain bg-muted/30"
              />
            </div>
          )}
          
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-600">
                Gagal membaca struk
              </p>
              <p className="text-sm text-muted-foreground">
                {errorMessage || "Pastikan foto jelas dan coba lagi."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={resetUpload}
            >
              Upload Baru
            </Button>
            <Button
              type="button"
              onClick={retryProcessing}
            >
              Coba Lagi
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
