"use client";

import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileCode2, Loader2, UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useIntentifyStore } from "@/store/useIntentifyStore";
import type { PlanStep } from "@/types";

const ACCEPTED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".py"];

function isAcceptedFile(file: File) {
  return ACCEPTED_EXTENSIONS.some((extension) =>
    file.name.toLowerCase().endsWith(extension)
  );
}

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const {
    file,
    intent,
    status,
    setFile,
    setIntent,
    setPlan,
    setStatus,
  } = useIntentifyStore();

  const isPlanning = status === "planning";
  const canSubmit = Boolean(file?.content && intent.trim()) && !isPlanning;

  async function readSelectedFile(selectedFile: File) {
    setError("");

    if (!isAcceptedFile(selectedFile)) {
      setError("Upload a .ts, .tsx, .js, .jsx, or .py file.");
      return;
    }

    try {
      const content = await selectedFile.text();
      setFile({ name: selectedFile.name, content });
    } catch {
      setError("Could not read that file. Try uploading it again.");
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      void readSelectedFile(selectedFile);
    }
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);

    const selectedFile = event.dataTransfer.files?.[0];

    if (selectedFile) {
      void readSelectedFile(selectedFile);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file || !intent.trim()) {
      return;
    }

    setError("");
    setStatus("planning");

    try {
      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileContent: file.content,
          fileName: file.name,
          intent: intent.trim(),
        }),
      });

      const payload = (await response.json()) as
        | { plan: PlanStep[] }
        | { error: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload ? payload.error : "Could not generate a plan."
        );
      }

      if (!("plan" in payload) || !Array.isArray(payload.plan)) {
        throw new Error("The plan response was not valid.");
      }

      setPlan(payload.plan);
      setStatus("awaiting-approval");
      router.push("/plan");
    } catch (requestError) {
      setStatus("idle");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not generate a plan."
      );
    }
  }

  return (
    <main className="h-[calc(100vh-4rem)] overflow-hidden bg-background px-4 py-4 text-foreground sm:px-6 lg:px-8">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex h-full w-full max-w-6xl flex-col justify-center gap-4"
      >
        <Card className="rounded-lg">
          <CardHeader>
            <Badge variant="outline" className="mb-2 w-fit">
              Screen 1
            </Badge>
            <CardTitle className="text-3xl">Intent Input</CardTitle>
            <CardDescription className="max-w-2xl">
              Upload one source file, describe the change, and generate a plan
              before anything touches code.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Code File</CardTitle>
              <CardDescription>
                Drag a supported file here or choose one from your machine.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                ref={fileInputRef}
                type="file"
                accept="*"
                className="hidden"
                onChange={handleFileInputChange}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`h-56 w-full flex-col border-dashed p-6 text-center ${
                  isDragging ? "border-primary bg-muted" : "bg-background"
                }`}
              >
                {file ? (
                  <>
                    <FileCode2 className="mb-4 size-10 text-primary" />
                    <span className="max-w-full truncate text-base font-medium">
                      {file.name}
                    </span>
                    <span className="mt-2 text-sm text-muted-foreground">
                      Click or drop a different file to replace it
                    </span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="mb-4 size-10 text-muted-foreground" />
                    <span className="text-base font-medium">
                      Drop your source file here
                    </span>
                    <Badge variant="secondary" className="mt-3">
                      .ts .tsx .js .jsx .py
                    </Badge>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Developer Intent</CardTitle>
              <CardDescription>
                Tell Codex exactly what outcome you want from this file.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={intent}
                onChange={(event) => setIntent(event.target.value)}
                placeholder="What do you want to do? e.g. add dark mode support"
                className="h-56 resize-none text-base leading-6"
              />
            </CardContent>
          </Card>
        </div>

        <Separator />

        <Card className="rounded-lg">
          <CardContent className="space-y-3">
            {error ? (
              <Badge variant="destructive" className="h-auto justify-start p-2">
                {error}
              </Badge>
            ) : null}
            <Button
              type="submit"
              size="lg"
              className="h-11 w-full"
              disabled={!canSubmit}
            >
              {isPlanning ? (
                <>
                  <Loader2 className="animate-spin" />
                  Generating Plan
                </>
              ) : (
                "Generate Plan"
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
    </main>
  );
}
