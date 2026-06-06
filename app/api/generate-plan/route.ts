import { NextResponse } from "next/server";

import { getOpenAIClient } from "@/lib/openai";
import { PLAN_GENERATION_PROMPT } from "@/lib/prompts";
import type { PlanStep } from "@/types";

type GeneratePlanRequest = {
  fileContent?: unknown;
  fileName?: unknown;
  intent?: unknown;
};

type RawPlanStep = {
  stepNumber?: unknown;
  action?: unknown;
  file?: unknown;
  reason?: unknown;
};

function extractJsonArray(content: string) {
  const trimmed = content.trim();

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");

  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

function toPlanSteps(value: unknown): PlanStep[] {
  if (!Array.isArray(value)) {
    throw new Error("Plan response must be a JSON array.");
  }

  return value.map((rawStep, index) => {
    const step = rawStep as RawPlanStep;

    if (
      typeof step !== "object" ||
      step === null ||
      typeof step.action !== "string" ||
      typeof step.file !== "string" ||
      typeof step.reason !== "string"
    ) {
      throw new Error("Plan response contains an invalid step.");
    }

    const stepNumber =
      typeof step.stepNumber === "number" && Number.isFinite(step.stepNumber)
        ? step.stepNumber
        : index + 1;

    return {
      id: crypto.randomUUID(),
      stepNumber,
      action: step.action,
      file: step.file,
      reason: step.reason,
      status: "pending",
    };
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GeneratePlanRequest;
    const fileContent =
      typeof body.fileContent === "string" ? body.fileContent.trim() : "";
    const fileName =
      typeof body.fileName === "string" ? body.fileName.trim() : "";
    const intent = typeof body.intent === "string" ? body.intent.trim() : "";

    if (!fileContent || !fileName || !intent) {
      return NextResponse.json(
        { error: "fileContent, fileName, and intent are required." },
        { status: 400 }
      );
    }

    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: PLAN_GENERATION_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify({
            fileName,
            fileContent,
            intent,
          }),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "The model returned an empty plan." },
        { status: 502 }
      );
    }

    let parsedPlan: unknown;

    try {
      parsedPlan = JSON.parse(extractJsonArray(content));
    } catch {
      return NextResponse.json(
        { error: "The model returned invalid JSON." },
        { status: 502 }
      );
    }

    const plan = toPlanSteps(parsedPlan);

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("generate-plan failed", error);

    return NextResponse.json(
      { error: "Could not generate a plan. Try again in a moment." },
      { status: 500 }
    );
  }
}
