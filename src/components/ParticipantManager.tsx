"use client";

import { useState } from "react";
import { Participant } from "@/types";
import { generateId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Users } from "lucide-react";

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
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Users className="h-4 w-4" />
        <span className="text-sm font-medium">
          {participants.length} participant{participants.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Enter name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button
          type="button"
          onClick={addParticipant}
          disabled={!newName.trim()}
          size="icon"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {participants.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {participants.map((participant) => (
            <Badge
              key={participant.id}
              variant="secondary"
              className="py-1.5 px-3 text-sm flex items-center gap-2 hover:bg-secondary/80"
            >
              {participant.name}
              <button
                type="button"
                onClick={() => removeParticipant(participant.id)}
                className="hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {participants.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Add at least 2 participants to split the bill
        </p>
      )}
    </div>
  );
}
