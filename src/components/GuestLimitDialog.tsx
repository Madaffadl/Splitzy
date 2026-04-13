"use client";

import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, Lock } from "lucide-react";

interface GuestLimitDialogProps {
  open: boolean;
  onClose: () => void;
}

export function GuestLimitDialog({ open, onClose }: GuestLimitDialogProps) {
  const { signIn } = useAuth();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">
            Free Split Limit Reached
          </DialogTitle>
          <DialogDescription className="text-center">
            You&apos;ve used all 3 free splits. Sign in with Google to get
            unlimited splits, trip management, and receipt history.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            onClick={() => {
              signIn(window.location.pathname);
              onClose();
            }}
            className="w-full gap-2"
          >
            <LogIn className="h-4 w-4" />
            Sign in with Google
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
