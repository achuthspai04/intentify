import { create } from "zustand";

import type {
  DiffChange,
  IntentifyState,
  PlanStep,
  ProductReview,
} from "@/types";

type IntentifyActions = {
  setFile: (file: IntentifyState["file"]) => void;
  setIntent: (intent: string) => void;
  setPlan: (plan: PlanStep[]) => void;
  updatePlanStep: (id: string, updates: Partial<PlanStep>) => void;
  approveAllPlanSteps: () => void;
  setDiff: (diff: DiffChange[]) => void;
  setProductReview: (productReview: ProductReview[]) => void;
  updateDiffChange: (id: string, updates: Partial<DiffChange>) => void;
  setStatus: (status: IntentifyState["status"]) => void;
  setLiveLog: (messages: string[]) => void;
  addLiveLog: (message: string) => void;
  reset: () => void;
};

const initialState: IntentifyState = {
  file: null,
  intent: "",
  plan: [],
  diff: [],
  productReview: [],
  status: "idle",
  liveLog: [],
};

export const useIntentifyStore = create<IntentifyState & IntentifyActions>(
  (set) => ({
    ...initialState,
    setFile: (file) => set({ file }),
    setIntent: (intent) => set({ intent }),
    setPlan: (plan) => set({ plan }),
    updatePlanStep: (id, updates) =>
      set((state) => ({
        plan: state.plan.map((step) =>
          step.id === id ? { ...step, ...updates } : step
        ),
      })),
    approveAllPlanSteps: () =>
      set((state) => ({
        plan: state.plan.map((step) => ({ ...step, status: "approved" })),
      })),
    setDiff: (diff) => set({ diff }),
    setProductReview: (productReview) => set({ productReview }),
    updateDiffChange: (id, updates) =>
      set((state) => ({
        diff: state.diff.map((change) =>
          change.id === id ? { ...change, ...updates } : change
        ),
      })),
    setStatus: (status) => set({ status }),
    setLiveLog: (messages) => set({ liveLog: messages }),
    addLiveLog: (message) =>
      set((state) => ({ liveLog: [...state.liveLog, message] })),
    reset: () => set(initialState),
  })
);
