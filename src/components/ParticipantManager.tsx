"use client";

import { useId, useMemo, useState } from "react";
import { Participant } from "@/types";
import { generateId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useNameSuggestions } from "@/hooks/useNameSuggestions";
import { X, Plus, Users, UserPlus, History } from "lucide-react";

interface ParticipantManagerProps {
  participants: Participant[];
  onChange: (participants: Participant[]) => void;
}

export function ParticipantManager({
  participants,
  onChange,
}: ParticipantManagerProps) {
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
        title: "Already added",
        description: `"${name}" is already in the list.`,
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
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
        </div>
        {participants.length >= 2 && (
          <Badge variant="success-outline" className="text-xs">
            ✓ Ready to continue
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
            placeholder="Enter participant name..."
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
              aria-label="Recent participants"
              className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border bg-popover p-1 shadow-premium-lg"
            >
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <History className="h-3 w-3" />
                Recent
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
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
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
          className="shrink-0"
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
              className="group flex items-center gap-2 py-2 px-4 rounded-full bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 text-sm font-medium transition-all duration-200 hover:shadow-md hover:border-primary/30 animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {participant.name.charAt(0).toUpperCase()}
              </div>
              <span>{participant.name}</span>
              <button
                type="button"
                onClick={() => removeParticipant(participant.id)}
                className="ml-1 h-5 w-5 rounded-full bg-transparent hover:bg-destructive/20 flex items-center justify-center transition-colors group-hover:opacity-100 opacity-70"
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive transition-colors" />
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
            Add at least 2 participants to split the bill
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Type a name and press Enter or click +
          </p>
        </div>
      )}
    </div>
  );
}
