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
import { LogIn, Lock } from "@/components/ui/icons";
import { MAX_GUEST_SPLITS } from "@/hooks/useGuestLimit";

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
          {/* The count came from a hardcoded "3" while the real limit lived in
              MAX_GUEST_SPLITS. And the old copy said nothing about the work the
              user had just done, which is the first thing they worry about. */}
          <DialogDescription className="text-center">
            You&apos;ve used all {MAX_GUEST_SPLITS} free splits. Nothing is lost —
            this split is still here, and signing in with Google unlocks it plus
            unlimited splits and receipt history.
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
