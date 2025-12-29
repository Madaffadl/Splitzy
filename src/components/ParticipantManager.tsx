"use client";

import { useState } from "react";
import { Participant } from "@/types";
import { generateId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Users, UserPlus } from "lucide-react";

interface ParticipantManagerProps {
  participants: Participant[];
  onChange: (participants: Participant[]) => void;
}

export function ParticipantManager({
  participants,
  onChange,
}: ParticipantManagerProps) {
  const [newName, setNewName] = useState("");

  const addParticipant = () => {
    const name = newName.trim();
    if (!name) return;

    // Prevent duplicates
    if (participants.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return;
    }

    onChange([...participants, { id: generateId(), name }]);
    setNewName("");
  };

  const removeParticipant = (id: string) => {
    onChange(participants.filter((p) => p.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addParticipant();
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
        <div className="relative flex-1">
          <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Enter participant name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
          />
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
