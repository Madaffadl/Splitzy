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
import { fill, useDictionary } from "@/lib/i18n/use-locale";

interface GuestLimitDialogProps {
  open: boolean;
  onClose: () => void;
}

export function GuestLimitDialog({ open, onClose }: GuestLimitDialogProps) {
  const { signIn } = useAuth();
  const t = useDictionary().app.guestLimit;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{t.title}</DialogTitle>
          {/* The count came from a hardcoded "3" while the real limit lived in
              MAX_GUEST_SPLITS. And the old copy said nothing about the work the
              user had just done, which is the first thing they worry about. */}
          <DialogDescription className="text-center">
            {fill(t.body, { max: MAX_GUEST_SPLITS })}
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
            {t.signIn}
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            {t.later}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
