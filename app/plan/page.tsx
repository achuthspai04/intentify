"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

import { StepCard } from "@/components/StepCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useIntentifyStore } from "@/store/useIntentifyStore";
import type { DiffChange, ProductReview } from "@/types";

type ExecuteEvent =
  | { message: string }
  | { diff: DiffChange[]; productReview?: ProductReview[] }
  | { error: string };

function parseSseEvents(buffer: string) {
  const rawEvents = buffer.split("\n\n");
  const remainder = rawEvents.pop() ?? "";

  return {
    events: rawEvents
      .map((eventText) => {
        const event = eventText
          .split("\n")
          .find((line) => line.startsWith("event:"))
          ?.replace("event:", "")
          .trim();
        const data = eventText
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.replace("data:", "").trim())
          .join("");

        return { event, data };
      })
      .filter(({ data }) => data),
    remainder,
  };
}

function ProgressStat({
  count,
  label,
  dotClassName,
}: {
  count: number;
  label: string;
  dotClassName: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`size-2 rounded-full ${dotClassName}`} />
      <span className="font-medium text-foreground">{count}</span>
      {label}
    </span>
  );
}

export default function PlanPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    file,
    intent,
    plan,
    status,
    updatePlanStep,
    approveAllPlanSteps,
    setStatus,
    setDiff,
    setProductReview,
    setLiveLog,
    addLiveLog,
  } = useIntentifyStore();

  const isExecuting = status === "executing";
  const isReadyToExecute = useMemo(
    () => plan.length > 0 && plan.every((step) => step.status !== "pending"),
    [plan]
  );
  const approvedCount = plan.filter((step) => step.status === "approved").length;
  const rejectedCount = plan.filter((step) => step.status === "rejected").length;
  const pendingCount = plan.filter((step) => step.status === "pending").length;

  useEffect(() => {
    if (plan.length === 0) {
      router.replace("/");
    }
  }, [plan.length, router]);

  async function handleExecute() {
    if (!file || !intent.trim() || !isReadyToExecute) {
      return;
    }

    setError("");
    setLiveLog([]);
    setProductReview([]);
    setStatus("executing");

    try {
      const response = await fetch("/api/execute-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          steps: plan,
          fileContent: file.content,
          fileName: file.name,
          intent,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;

        throw new Error(payload?.error ?? "Could not execute the plan.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseEvents(buffer);
        buffer = parsed.remainder;

        for (const event of parsed.events) {
          const payload = JSON.parse(event.data) as ExecuteEvent;

          if (event.event === "progress" && "message" in payload) {
            addLiveLog(payload.message);
          }

          if (event.event === "complete" && "diff" in payload) {
            setDiff(payload.diff);
            setProductReview(payload.productReview ?? []);
            setStatus("reviewing");
            router.push("/diff");
            return;
          }

          if (event.event === "error" && "error" in payload) {
            throw new Error(payload.error);
          }
        }
      }

      throw new Error("Execution finished without a classified diff.");
    } catch (executeError) {
      setStatus("awaiting-approval");
      setError(
        executeError instanceof Error
          ? executeError.message
          : "Could not execute the plan."
      );
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-6.5rem)] w-full max-w-6xl flex-col gap-4">
        <Card className="rounded-lg">
          <CardHeader className="py-4">
            <Badge variant="outline" className="mb-2 w-fit">
              Screen 2
            </Badge>
            <CardTitle className="text-2xl">Review the Plan</CardTitle>
            <CardDescription>
              Approve, edit, or reject each step before execution begins.
            </CardDescription>
            {intent ? (
              <Badge
                variant="secondary"
                className="mt-2 h-auto w-fit max-w-full justify-start whitespace-normal text-left"
              >
                {intent}
              </Badge>
            ) : null}
          </CardHeader>
        </Card>

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {plan.map((step) => (
            <StepCard
              key={step.id}
              step={step}
              onApprove={(id) =>
                updatePlanStep(id, {
                  status: "approved",
                  editedAction:
                    plan.find((candidate) => candidate.id === id)
                      ?.editedAction ?? undefined,
                })
              }
              onReject={(id) => updatePlanStep(id, { status: "rejected" })}
              onSaveEdit={(id, action) =>
                updatePlanStep(id, {
                  action,
                  editedAction: action,
                  status: "edited",
                })
              }
            />
          ))}
        </div>

        <div className="sticky bottom-4 mt-auto rounded-lg border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <ProgressStat
                count={approvedCount}
                label="approved"
                dotClassName="bg-emerald-500"
              />
              <ProgressStat
                count={rejectedCount}
                label="rejected"
                dotClassName="bg-red-500"
              />
              <ProgressStat
                count={pendingCount}
                label="pending"
                dotClassName="bg-muted-foreground/40"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {error ? (
                <Badge
                  variant="destructive"
                  className="h-auto justify-start p-2 sm:max-w-md"
                >
                  {error}
                </Badge>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={isExecuting || plan.length === 0}
                onClick={approveAllPlanSteps}
              >
                Approve all
              </Button>
              <Button
                type="button"
                disabled={!isReadyToExecute || isExecuting}
                onClick={handleExecute}
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Executing
                  </>
                ) : (
                  <>
                    Approve & Execute
                    <ArrowRight />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
