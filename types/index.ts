export type PlanStep = {
  id: string;
  stepNumber: number;
  action: string;
  file: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "edited";
  editedAction?: string;
};

export type DiffChange = {
  id: string;
  file: string;
  before: string;
  after: string;
  category: "planned" | "unplanned" | "risky";
  reason: string;
  status: "pending" | "approved" | "rejected";
};

export type ProductReview = {
  concern: string;
  description: string;
  severity: "low" | "medium" | "high";
  suggestion: string;
};

export type IntentifyState = {
  file: { name: string; content: string } | null;
  intent: string;
  plan: PlanStep[];
  diff: DiffChange[];
  productReview: ProductReview[];
  status:
    | "idle"
    | "planning"
    | "awaiting-approval"
    | "executing"
    | "reviewing"
    | "done";
  liveLog: string[];
};
