"use client";

import { useState } from "react";
import { Check, Pencil, Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PlanStep } from "@/types";

type StepCardProps = {
  step: PlanStep;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSaveEdit: (id: string, action: string) => void;
};

export function StepCard({
  step,
  onApprove,
  onReject,
  onSaveEdit,
}: StepCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedAction, setEditedAction] = useState(
    step.editedAction ?? step.action
  );
  const isFinal = step.status === "approved" || step.status === "rejected";
  const isRowEditing = isEditing && !isFinal;
  const currentAction = step.editedAction ?? step.action;

  function handleSave() {
    const nextAction = editedAction.trim();

    if (!nextAction) {
      return;
    }

    onSaveEdit(step.id, nextAction);
    setIsEditing(false);
  }

  return (
    <div
      className={cn(
        "grid h-[60px] grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-l-4 border-border border-l-transparent bg-card px-3 last:border-b-0",
        step.status === "approved" && "border-l-emerald-500",
        step.status === "rejected" && "border-l-red-500 opacity-50"
      )}
    >
      <div className="flex size-7 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
        {step.stepNumber}
      </div>

      <div className="min-w-0">
        {isRowEditing ? (
          <Input
            value={editedAction}
            onChange={(event) => setEditedAction(event.target.value)}
            aria-label={`Edit step ${step.stepNumber} action`}
            className="h-7 text-sm"
          />
        ) : (
          <p className="truncate text-sm font-medium leading-5">
            {currentAction}
          </p>
        )}
        <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs leading-4 text-muted-foreground">
          <span className="max-w-32 shrink-0 truncate font-mono sm:max-w-48">
            {step.file}
          </span>
          <span className="min-w-0 truncate">{step.reason}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1.5">
        {step.status === "approved" ? (
          <span className="text-sm font-medium text-emerald-600">Approved</span>
        ) : step.status === "rejected" ? (
          <span className="text-sm font-medium text-red-600">Rejected</span>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              title="Approve"
              aria-label={`Approve step ${step.stepNumber}`}
              className="h-7 border-emerald-200 px-2 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
              onClick={() => onApprove(step.id)}
            >
              <Check />
              <span className="hidden sm:inline">Approve</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              title={isRowEditing ? "Save" : "Edit"}
              aria-label={`${isRowEditing ? "Save" : "Edit"} step ${
                step.stepNumber
              }`}
              className="h-7 px-2 text-xs"
              onClick={
                isRowEditing
                  ? handleSave
                  : () => {
                      setEditedAction(currentAction);
                      setIsEditing(true);
                    }
              }
            >
              {isRowEditing ? <Save /> : <Pencil />}
              <span className="hidden sm:inline">
                {isRowEditing ? "Save" : "Edit"}
              </span>
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              title="Reject"
              aria-label={`Reject step ${step.stepNumber}`}
              className="h-7 px-2 text-xs"
              onClick={() => onReject(step.id)}
            >
              <X />
              <span className="hidden sm:inline">Reject</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
