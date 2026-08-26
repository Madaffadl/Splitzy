"use client";

import { useId, useMemo, useState } from "react";
import { Participant } from "@/types";
import { generateId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useNameSuggestions } from "@/hooks/useNameSuggestions";
import { fill, useDictionary } from "@/lib/i18n/use-locale";
import { X, Plus, Users, UserPlus, History, Check,} from "@/components/ui/icons";

interface ParticipantManagerProps {
  participants: Participant[];
  onChange: (participants: Participant[]) => void;
}

export function ParticipantManager({
  participants,
  onChange,
}: ParticipantManagerProps) {
  const t = useDictionary().app.participants;
  const [newName, setNewName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { toast } = useToast();
  const currentNames = useMemo(
    () => participants.map((p) => p.name),
    [participants]
  );
  const { recordName, suggestionsFor } = useNameSuggestions(currentNames);
  const suggestions = useMemo(
    () => (showSuggestions ? suggestionsFor(newName, 6) : []),
    [showSuggestions, newName, suggestionsFor]
  );

  // Stable IDs for the WAI-ARIA combobox wiring. The input owns the listbox
  // via aria-controls + aria-activedescendant; each option uses the same id
  // so the screen reader can announce it as selected.
  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const isOpen = suggestions.length > 0;
  const activeOptionId = activeIndex >= 0 ? optionId(activeIndex) : undefined;

  const addByName = (rawName: string) => {
    const name = rawName.trim();
    if (!name) return;

    if (participants.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      toast({
        title: t.duplicateTitle,
        description: fill(t.duplicateBody, { name }),
        variant: "error",
      });
      return;
    }

    onChange([...participants, { id: generateId(), name }]);
    recordName(name);
    setNewName("");
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  const addParticipant = () => addByName(newName);

  const removeParticipant = (id: string) => {
    onChange(participants.filter((p) => p.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Enter selects the highlighted suggestion if any, otherwise adds the
      // typed text. Mirrors the platform combobox idiom users expect.
      if (isOpen && activeIndex >= 0 && suggestions[activeIndex]) {
        addByName(suggestions[activeIndex]);
      } else {
        addParticipant();
      }
      return;
    }
    if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
      return;
    }
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        i <= 0 ? suggestions.length - 1 : i - 1
      );
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(suggestions.length - 1);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold">
            {fill(t.count, { count: participants.length })}
          </span>
        </div>
        {participants.length >= 2 && (
          <Badge variant="success-outline" className="text-xs">
            <Check className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden="true" />
            {t.ready}
          </Badge>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-3">
        {/* WAI-ARIA combobox pattern (1.2): the wrapper carries role=combobox
            with the required aria-controls + aria-expanded, while the input
            carries aria-activedescendant so the screen reader announces the
            keyboard-highlighted option without moving DOM focus off the input. */}
        <div
          className="relative flex-1"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
        >
          <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.placeholder}
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setShowSuggestions(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              // Delay so click on a suggestion can register before the list hides.
              window.setTimeout(() => {
                setShowSuggestions(false);
                setActiveIndex(-1);
              }, 150);
            }}
            onKeyDown={handleKeyDown}
            className="pl-10"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
          />
          {isOpen && (
            <div
              id={listboxId}
              role="listbox"
              aria-label={t.recentListAria}
              className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border bg-popover p-1 shadow-premium-lg"
            >
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <History className="h-3 w-3" />
                {t.recent}
              </div>
              {suggestions.map((s, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={s}
                    id={optionId(index)}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(e) => {
                      // Prevent input blur firing first and hiding the list.
                      e.preventDefault();
                      addByName(s);
                    }}
                    className={`touch-manipulation flex min-h-[44px] w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      isActive ? "bg-muted" : "hover:bg-muted"
                    }`}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {s.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate">{s}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <Button
          type="button"
          onClick={addParticipant}
          disabled={!newName.trim()}
          size="icon"
          className="touch-manipulation h-11 w-11 shrink-0"
          aria-label={t.addAria}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Participant Tags */}
      {participants.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {participants.map((participant, index) => (
            <div
              key={participant.id}
              className="group flex min-h-[44px] items-center gap-2 py-1.5 px-4 rounded-full bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 text-sm font-medium transition-all duration-200 hover:shadow-md hover:border-primary/30 animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="h-6 w-6 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {participant.name.charAt(0).toUpperCase()}
              </div>
              <span>{participant.name}</span>
              <button
                type="button"
                onClick={() => removeParticipant(participant.id)}
                aria-label={fill(t.removeAria, { name: participant.name })}
                // 28px and permanently at 42% effective alpha on a phone:
                // `opacity-60` only lifted on hover, and a touch screen has no
                // hover, so the one control that removes a person measured
                // about 1.6:1 against the chip. 44px, always fully visible.
                className="touch-manipulation -mr-2 ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-transparent text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {participants.length === 0 && (
        <div className="text-center py-8 rounded-xl border-2 border-dashed border-muted">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            {t.emptyTitle}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{t.emptyHint}</p>
        </div>
      )}
    </div>
  );
}
