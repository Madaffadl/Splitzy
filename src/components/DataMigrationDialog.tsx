"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, CheckCircle2 } from "lucide-react";
import { localDataService } from "@/lib/data/local-data-service";
import { supabaseDataService } from "@/lib/data/supabase-data-service";

interface DataMigrationDialogProps {
  open: boolean;
  onClose: () => void;
}

export function DataMigrationDialog({
  open,
  onClose,
}: DataMigrationDialogProps) {
  const [status, setStatus] = useState<
    "idle" | "importing" | "success" | "error"
  >("idle");
  const [importedCount, setImportedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const handleImport = async () => {
    setStatus("importing");
    try {
      const { single, trip } = localDataService.getLocalDataForImport();

      const result = await supabaseDataService.importLocalData({
        single,
        trip,
      });

      setImportedCount(result.imported);
      localDataService.clearImportedData();
      setStatus("success");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Import failed"
      );
      setStatus("error");
    }
  };

  const handleClose = () => {
    setStatus("idle");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {status === "success" ? (
            <>
              <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <DialogTitle className="text-center">
                Import Successful
              </DialogTitle>
              <DialogDescription className="text-center">
                {importedCount} receipt{importedCount !== 1 ? "s" : ""}{" "}
                imported to your account. You can find them in your Receipt
                History.
              </DialogDescription>
            </>
          ) : (
            <>
              <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-center">
                Import Existing Data
              </DialogTitle>
              <DialogDescription className="text-center">
                We found existing bill-splitting data on this device. Would you
                like to import it to your account?
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        {status === "error" && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          {status === "success" ? (
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          ) : (
            <>
              <Button
                onClick={handleImport}
                disabled={status === "importing"}
                className="w-full gap-2"
              >
                {status === "importing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {status === "importing"
                  ? "Importing..."
                  : "Import to My Account"}
              </Button>
              <Button
                variant="ghost"
                onClick={handleClose}
                disabled={status === "importing"}
                className="w-full"
              >
                Skip
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
