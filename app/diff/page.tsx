"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

import { DiffViewer } from "@/components/DiffViewer";
import { LiveFeed } from "@/components/LiveFeed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useIntentifyStore } from "@/store/useIntentifyStore";
import type { DiffChange, ProductReview } from "@/types";

type ExecuteEvent =
  | { message: string }
  | { diff: DiffChange[]; productReview?: ProductReview[]; currentContent: string }
  | { error: string };

function parseSseEvents(buffer: string) {
  const rawEvents = buffer.split("\n\n");
  const remainder = rawEvents.pop() ?? "";

  return {
    events: rawEvents
      .map((eventText) => {
        const lines = eventText.split("\n");
        const event = lines
          .find((line) => line.startsWith("event:"))
          ?.replace("event:", "")
          .trim();
        const data = lines
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.replace("data:", "").trim())
          .join("");

        return { event, data };
      })
      .filter(({ data }) => data),
    remainder,
  };
}

function TiSparkles() {
  return (
    <svg
      aria-hidden="true"
      data-icon="ti-sparkles"
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z" />
      <path d="M8 6a4 4 0 0 1 4 4a4 4 0 0 1 4 -4a4 4 0 0 1 -4 -4a4 4 0 0 1 -4 4z" />
      <path d="M3 12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z" />
    </svg>
  );
}

function ProductReviewSection({
  productReview,
}: {
  productReview: ProductReview[];
}) {
  return (
    <details
      open
      className="rounded-lg border border-border bg-card text-card-foreground shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <TiSparkles />
          Product insights
        </span>
        <Badge variant="outline">{productReview.length}</Badge>
      </summary>
      <div className="grid gap-3 border-t border-border p-4 md:grid-cols-2 xl:grid-cols-3">
        {productReview.length > 0 ? (
          productReview.map((review, index) => (
            <article
              key={`${review.concern}-${index}`}
              className="rounded-lg border border-border bg-background p-3"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <h3 className="text-sm font-medium">{review.concern}</h3>
                <Badge
                  variant="outline"
                  className={cn(
                    "capitalize",
                    review.severity === "high" &&
                      "border-red-200 bg-red-50 text-red-700",
                    review.severity === "medium" &&
                      "border-amber-200 bg-amber-50 text-amber-700",
                    review.severity === "low" &&
                      "text-muted-foreground"
                  )}
                >
                  {review.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {review.description}
              </p>
              <p className="mt-3 text-sm">
                <span className="font-medium">Suggestion: </span>
                {review.suggestion}
              </p>
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No product concerns flagged.
          </p>
        )}
      </div>
    </details>
  );
}

export default function DiffPage() {
  const router = useRouter();
  const startedExecutionRef = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const {
    file,
    intent,
    plan,
    diff,
    productReview,
    mergedContent,
    status,
    liveLog,
    setDiff,
    setProductReview,
    setMergedContent,
    updateDiffChange,
    setStatus,
    setLiveLog,
    addLiveLog,
    reset,
  } = useIntentifyStore();

  const isLoadingDiff = diff.length === 0 && status !== "done";
  const isExecuting = status === "executing" || isLoadingDiff;
  const allChangesActioned = useMemo(
    () => diff.length > 0 && diff.every((change) => change.status !== "pending"),
    [diff]
  );

  useEffect(() => {
    if (diff.length > 0 || startedExecutionRef.current) {
      return;
    }

    if (!file || !intent.trim() || plan.length === 0) {
      router.replace("/");
      return;
    }

    startedExecutionRef.current = true;

    async function streamExecution() {
      if (!file) {
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

          throw new Error(payload?.error ?? "Could not stream execution.");
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
              setMergedContent(payload.currentContent);
              setStatus("reviewing");
              return;
            }

            if (event.event === "error" && "error" in payload) {
              throw new Error(payload.error);
            }
          }
        }

        throw new Error("Execution ended before a diff was received.");
      } catch (streamError) {
        setStatus("awaiting-approval");
        setError(
          streamError instanceof Error
            ? streamError.message
            : "Could not stream execution."
        );
      }
    }

    void streamExecution();
  }, [
    addLiveLog,
    diff.length,
    file,
    intent,
    plan,
    router,
    setDiff,
    setMergedContent,
    setProductReview,
    setLiveLog,
    setStatus,
  ]);

  function handleMergeApprovedChanges() {
    if (!allChangesActioned || !file) {
      return;
    }

    let content: string;

    if (mergedContent) {
      // Start from the agent's full output, revert rejected hunks to original.
      const rejectedChanges = diff.filter((c) => c.status === "rejected");
      content = mergedContent;
      for (const change of rejectedChanges) {
        if (change.after) {
          content = content.replace(change.after, change.before);
        }
      }
    } else {
      // Fallback: apply approved hunks forward onto the original file.
      const approvedChanges = diff.filter((c) => c.status === "approved");
      content = file.content;
      for (const change of approvedChanges) {
        if (change.before) {
          content = content.replace(change.before, change.after);
        }
      }
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);

    setStatus("done");
    setSuccess(true);
  }

  function handleStartNewSession() {
    reset();
    router.push("/");
  }

  const plannedApprovedCount = diff.filter(
    (change) => change.category === "planned" && change.status === "approved"
  ).length;
  const unplannedRejectedCount = diff.filter(
    (change) => change.category === "unplanned" && change.status === "rejected"
  ).length;

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col gap-5">
        <Card className="rounded-lg">
          <CardHeader>
            <Badge variant="outline" className="mb-2 w-fit">
              Screen 3
            </Badge>
            <CardTitle className="text-3xl">Review the Changes</CardTitle>
            <CardDescription>
              Approve or reject every classified change before merging.
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

        {success ? (
          <Card className="flex flex-1 justify-center rounded-lg border-emerald-200 bg-emerald-50">
            <CardContent className="flex min-h-[520px] flex-col items-center justify-center gap-5 text-center text-emerald-950">
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-600 text-white">
                <CheckCircle2 className="size-9" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-3xl">
                  Changes merged successfully
                </CardTitle>
                <CardDescription className="text-emerald-800">
                  {plannedApprovedCount} planned approved,{" "}
                  {unplannedRejectedCount} unplanned rejected
                </CardDescription>
              </div>
              <Button type="button" onClick={handleStartNewSession}>
                Start New Session
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <LiveFeed
              logs={liveLog}
              isLoading={isExecuting && diff.length === 0}
            />

            {error ? (
              <Card className="rounded-lg border-destructive/30">
                <CardContent>
                  <Badge variant="destructive" className="h-auto p-2">
                    {error}
                  </Badge>
                </CardContent>
              </Card>
            ) : null}

            {diff.length > 0 ? (
              <DiffViewer
                changes={diff}
                onApprove={(id) =>
                  updateDiffChange(id, {
                    status: "approved",
                  })
                }
                onReject={(id) =>
                  updateDiffChange(id, {
                    status: "rejected",
                  })
                }
              />
            ) : (
              <Card className="rounded-lg">
                <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  <CardTitle>Waiting for classified diff</CardTitle>
                  <CardDescription className="max-w-md">
                    Intentify is streaming execution progress and will show the
                    planned, unplanned, and risky changes as soon as
                    classification finishes.
                  </CardDescription>
                </CardContent>
              </Card>
            )}

            {diff.length > 0 ? (
              <ProductReviewSection productReview={productReview} />
            ) : null}

            <Separator />

            <Card className="sticky bottom-4 rounded-lg shadow-sm">
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{diff.length} changes</Badge>
                  <Badge variant="outline">
                    {
                      diff.filter((change) => change.status === "pending")
                        .length
                    }{" "}
                    pending
                  </Badge>
                  <Badge variant="outline">
                    {
                      diff.filter((change) => change.status === "approved")
                        .length
                    }{" "}
                    approved
                  </Badge>
                  <Badge variant="outline">
                    {
                      diff.filter((change) => change.status === "rejected")
                        .length
                    }{" "}
                    rejected
                  </Badge>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  {!allChangesActioned ? (
                    <span className="text-xs text-muted-foreground">
                      Approve or reject every change to continue.
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    disabled={!allChangesActioned || status === "done"}
                    onClick={handleMergeApprovedChanges}
                  >
                    Merge Approved Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
