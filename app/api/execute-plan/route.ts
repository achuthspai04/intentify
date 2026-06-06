import { NextResponse } from "next/server";
import type OpenAI from "openai";

import { getOpenAIClient } from "@/lib/openai";
import {
  DIFF_CLASSIFICATION_PROMPT,
  EXECUTION_AGENT_PROMPT,
} from "@/lib/prompts";
import type { DiffChange, PlanStep, ProductReview } from "@/types";

type ExecutePlanRequest = {
  steps?: unknown;
  fileContent?: unknown;
  fileName?: unknown;
  intent?: unknown;
};

type ToolArgs = {
  fileName?: string;
  content?: string;
};

type RawDiffChange = {
  file?: unknown;
  before?: unknown;
  after?: unknown;
  category?: unknown;
  reason?: unknown;
};

type RawProductReview = {
  concern?: unknown;
  description?: unknown;
  severity?: unknown;
  suggestion?: unknown;
};

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the uploaded source file content.",
      parameters: {
        type: "object",
        properties: {
          fileName: {
            type: "string",
            description: "The uploaded source file name.",
          },
        },
        required: ["fileName"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Replace the uploaded source file with the full updated file content.",
      parameters: {
        type: "object",
        properties: {
          fileName: {
            type: "string",
            description: "The uploaded source file name.",
          },
          content: {
            type: "string",
            description: "The complete updated file content.",
          },
        },
        required: ["fileName", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verify_output",
      description:
        "Verify whether the updated content satisfies the approved steps.",
      parameters: {
        type: "object",
        properties: {
          fileName: {
            type: "string",
            description: "The uploaded source file name.",
          },
        },
        required: ["fileName"],
        additionalProperties: false,
      },
    },
  },
];

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

function parseToolArgs(rawArgs: string): ToolArgs {
  try {
    return JSON.parse(rawArgs) as ToolArgs;
  } catch {
    return {};
  }
}

function validateSteps(value: unknown): PlanStep[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((step): step is PlanStep => {
    return (
      typeof step === "object" &&
      step !== null &&
      "id" in step &&
      "stepNumber" in step &&
      "action" in step &&
      "file" in step &&
      "reason" in step &&
      "status" in step &&
      typeof step.id === "string" &&
      typeof step.stepNumber === "number" &&
      typeof step.action === "string" &&
      typeof step.file === "string" &&
      typeof step.reason === "string" &&
      ["pending", "approved", "rejected", "edited"].includes(
        String(step.status)
      )
    );
  });
}

function normalizeDiff(value: unknown, fallback: DiffChange): DiffChange[] {
  if (!Array.isArray(value)) {
    return [fallback];
  }

  const changes = value
    .map((rawChange): DiffChange | null => {
      const change = rawChange as RawDiffChange;

      if (
        typeof change !== "object" ||
        change === null ||
        typeof change.file !== "string" ||
        typeof change.before !== "string" ||
        typeof change.after !== "string" ||
        typeof change.reason !== "string" ||
        !["planned", "unplanned", "risky"].includes(String(change.category))
      ) {
        return null;
      }

      return {
        id: crypto.randomUUID(),
        file: change.file,
        before: change.before,
        after: change.after,
        category: change.category as DiffChange["category"],
        reason: change.reason,
        status: "pending",
      };
    })
    .filter((change): change is DiffChange => change !== null);

  return changes.length > 0 ? changes : [fallback];
}

function normalizeProductReview(value: unknown): ProductReview[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((rawConcern): ProductReview | null => {
      const concern = rawConcern as RawProductReview;

      if (
        typeof concern !== "object" ||
        concern === null ||
        typeof concern.concern !== "string" ||
        typeof concern.description !== "string" ||
        typeof concern.suggestion !== "string" ||
        !["low", "medium", "high"].includes(String(concern.severity))
      ) {
        return null;
      }

      return {
        concern: concern.concern,
        description: concern.description,
        severity: concern.severity as ProductReview["severity"],
        suggestion: concern.suggestion,
      };
    })
    .filter((concern): concern is ProductReview => concern !== null);
}

function createSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function createDiffSummary(diff: DiffChange[]) {
  return JSON.stringify(
    diff.map((change) => ({
      file: change.file,
      before: change.before,
      after: change.after,
      category: change.category,
      reason: change.reason,
    }))
  );
}

async function classifyDiff({
  fileName,
  intent,
  approvedStepActions,
  before,
  after,
}: {
  fileName: string;
  intent: string;
  approvedStepActions: string[];
  before: string;
  after: string;
}) {
  const fallback: DiffChange = {
    id: crypto.randomUUID(),
    file: fileName,
    before,
    after,
    category: before === after ? "unplanned" : "planned",
    reason:
      before === after
        ? "The execution completed without changing the uploaded file."
        : "The execution changed the uploaded file in response to the approved plan.",
    status: "pending",
  };

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: DIFF_CLASSIFICATION_PROMPT.replace(
          "{APPROVED_STEPS}",
          JSON.stringify(approvedStepActions)
        ),
      },
      {
        role: "user",
        content: JSON.stringify({
          intent,
          approvedSteps: approvedStepActions,
          diff: {
            file: fileName,
            before,
            after,
          },
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    return [fallback];
  }

  try {
    return normalizeDiff(JSON.parse(extractJsonArray(content)), fallback);
  } catch {
    return [fallback];
  }
}

async function reviewProductChanges({
  intent,
  diff,
}: {
  intent: string;
  diff: DiffChange[];
}) {
  try {
    const prompt = `You are a senior product engineer reviewing code changes.

The developer's original intent was: ${intent}

These are the changes that were made: ${createDiffSummary(diff)}

Review this from a product perspective and flag:

1. Anything that could break the user experience

2. Missing edge cases the developer probably didn't think about

3. Accessibility or performance concerns

4. Anything that looks incomplete

Return JSON array only:

[{ 

  'concern': 'short title',

  'description': 'what the issue is',

  'severity': 'low|medium|high',

  'suggestion': 'what to do about it'

}]`;

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      return [];
    }

    return normalizeProductReview(JSON.parse(extractJsonArray(content)));
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  let body: ExecutePlanRequest;

  try {
    body = (await request.json()) as ExecutePlanRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const steps = validateSteps(body.steps);
  const fileContent =
    typeof body.fileContent === "string" ? body.fileContent : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const intent = typeof body.intent === "string" ? body.intent.trim() : "";

  if (!fileContent || !fileName || !intent || steps.length === 0) {
    return NextResponse.json(
      { error: "steps, fileContent, fileName, and intent are required." },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(createSseEvent(event, data)));
      }

      try {
        const approvedSteps = steps.filter(
          (step) => step.status === "approved"
        );
        const approvedStepActions = approvedSteps.map(
          (step) => step.editedAction ?? step.action
        );

        send("progress", { message: "Execution started." });
        send("progress", {
          message: `${approvedSteps.length} approved steps.`,
        });

        if (approvedSteps.length === 0) {
          const diff = await classifyDiff({
            fileName,
            intent,
            approvedStepActions,
            before: fileContent,
            after: fileContent,
          });
          send("progress", { message: "Product review running." });
          const productReview = await reviewProductChanges({ intent, diff });

          send("complete", { diff, productReview });
          controller.close();
          return;
        }

        const openai = getOpenAIClient();
        let currentContent = fileContent;
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          {
            role: "system",
            content: EXECUTION_AGENT_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify({
              fileName,
              intent,
              approvedStepActions,
            }),
          },
        ];

        for (let iteration = 0; iteration < 8; iteration += 1) {
          send("progress", { message: `Agent loop ${iteration + 1} running.` });

          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            temperature: 0,
            messages,
            tools,
            tool_choice: "auto",
          });

          const message = completion.choices[0]?.message;

          if (!message) {
            throw new Error("The execution agent returned an empty response.");
          }

          messages.push(message);

          if (!message.tool_calls || message.tool_calls.length === 0) {
            send("progress", { message: "Agent loop completed." });
            break;
          }

          for (const toolCall of message.tool_calls) {
            if (toolCall.type !== "function") {
              continue;
            }

            const args = parseToolArgs(toolCall.function.arguments);
            let result = "";

            if (toolCall.function.name === "read_file") {
              result = currentContent;
              send("progress", { message: `read_file(${fileName})` });
            }

            if (toolCall.function.name === "write_file") {
              if (!args.content) {
                throw new Error("write_file was called without content.");
              }

              currentContent = args.content;
              result = "File content updated in memory.";
              send("progress", { message: `write_file(${fileName})` });
            }

            if (toolCall.function.name === "verify_output") {
              result = JSON.stringify({
                fileName,
                changed: currentContent !== fileContent,
                approvedStepCount: approvedSteps.length,
              });
              send("progress", { message: `verify_output(${fileName})` });
            }

            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: result,
            });
          }
        }

        send("progress", { message: "Classifying diff." });

        const diff = await classifyDiff({
          fileName,
          intent,
          approvedStepActions,
          before: fileContent,
          after: currentContent,
        });

        send("progress", { message: "Product review running." });

        const productReview = await reviewProductChanges({ intent, diff });

        send("complete", { diff, productReview });
        controller.close();
      } catch (error) {
        console.error("execute-plan failed", error);
        send("error", {
          error:
            error instanceof Error
              ? error.message
              : "Could not execute the plan.",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
