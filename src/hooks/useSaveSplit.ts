"use client";

import { useCallback, useState } from "react";
import { supabaseDataService } from "@/lib/data/supabase-data-service";
import { useToast } from "@/components/ui/toast";
import type { SavedSplitPayload } from "@/lib/data/types";

/**
 * Save-and-resume for the Single and Multiple editors.
 *
 * These modes stay local-first: localStorage remains the working state and the
 * server is touched only when the user presses Save. That keeps typing instant
 * and the app usable offline, at the cost of the split living on one device
 * until they choose otherwise.
 *
 * The hook remembers the saved row's id and version for the rest of the
 * session, so the second press updates the same split instead of creating a
 * duplicate, and a save from another device is caught as a conflict rather than
 * silently overwriting.
 */
export interface SaveState {
  /** Row id once saved; null while the split has never been saved. */
  id: string | null;
  version: number | null;
  /** ISO timestamp when the saved copy lapses. */
  expiresAt: string | null;
  /** Short code of the read-only link, when one exists. */
  shareCode: string | null;
}

const EMPTY: SaveState = { id: null, version: null, expiresAt: null, shareCode: null };

export function useSaveSplit(initial: SaveState = EMPTY) {
  const { toast } = useToast();
  const [state, setState] = useState<SaveState>(initial);
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (payload: SavedSplitPayload): Promise<boolean> => {
      setSaving(true);
      try {
        const result = await supabaseDataService.saveSplit({
          ...(state.id ? { id: state.id, expectedVersion: state.version ?? undefined } : {}),
          payload,
        });

        setState({
          id: result.id,
          version: result.version,
          expiresAt: result.expiresAt,
          shareCode: result.shareCode ?? state.shareCode,
        });

        toast({
          title: "Split saved",
          description: `You can pick this up again from Saved splits for ${result.ttlDays} days.`,
          variant: "success",
        });
        return true;
      } catch (err) {
        const code = (err as { code?: string }).code;
        // A conflict is not a failure the user caused, and retrying blindly
        // would clobber whichever copy is newer — send them to reload instead.
        toast({
          title: code === "VERSION_CONFLICT" ? "Saved somewhere else" : "Couldn't save",
          description:
            err instanceof Error ? err.message : "Something went wrong. Please try again.",
          variant: "error",
          duration: 8000,
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [state.id, state.version, state.shareCode, toast]
  );

  /** Adopt the identity of a split that was just loaded from the server. */
  const adopt = useCallback((next: SaveState) => setState(next), []);

  /** Forget the server copy — used when the editor is reset to a blank split. */
  const forget = useCallback(() => setState(EMPTY), []);

  return { ...state, saving, save, adopt, forget };
}
