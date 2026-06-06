# Intentify — Project Context for Codex

## What we are building
Intentify is an intent-first agentic coding interface built on top of OpenAI Codex. The core idea: instead of an AI agent silently editing your code, Intentify makes the agent's reasoning visible and gives the developer control at every step.

## The problem
AI coding tools like Codex are powerful but opaque. They act on your intent — but they also add unplanned changes, touch files you didn't expect, and make decisions you never approved. Developers either blindly trust the output or spend 45 minutes reviewing a diff they don't understand. There is no middle ground today.

## The solution — 3-screen core loop

### Screen 1: Intent Input
- User pastes or uploads a code file
- User types their intent in plain English (e.g. "add dark mode support to this component")
- Codex reads both the file and the intent before doing anything

### Screen 2: Plan Approval
- Before touching any code, Codex returns a numbered step-by-step plan
- Each step shows: what it will do, which file it will touch, why
- User can approve all, approve individual steps, edit a step, or reject a step
- Nothing executes until the user approves the plan

### Screen 3: Diff Review
- After execution, every change is classified into 3 columns:
  - **Planned** — matches what the user asked for exactly (green)
  - **Unplanned** — changes the agent made that were not in the original intent (yellow)
  - **Risky** — potential bugs, security issues, breaking changes (red)
- User can approve or reject each change cluster
- On rejection, agent revises and returns a new diff

## Tech stack
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui components
- **AI:** OpenAI Codex API (gpt-4o for diff classification, gpt-4o-mini for plan generation and revisions)
- **Realtime:** Server-Sent Events (SSE) for live execution feed
- **State:** Zustand
- **Deploy:** Vercel

## Folder structure
```
intentify/
├── app/
│   ├── page.tsx                  # Screen 1: Intent input
│   ├── plan/
│   │   └── page.tsx              # Screen 2: Plan approval
│   ├── diff/
│   │   └── page.tsx              # Screen 3: Diff review
│   └── api/
│       ├── generate-plan/
│       │   └── route.ts          # POST: takes file + intent, returns plan steps
│       ├── execute-plan/
│       │   └── route.ts          # POST: executes approved steps, streams output via SSE
│       └── classify-diff/
│           └── route.ts          # POST: takes diff, returns planned/unplanned/risky classification
├── components/
│   ├── IntentInput.tsx           # File upload + intent textarea + submit
│   ├── PlanApproval.tsx          # Numbered steps with approve/edit/reject per step
│   ├── DiffViewer.tsx            # 3-column diff display
│   ├── LiveFeed.tsx              # SSE-powered execution activity feed
│   └── StepCard.tsx              # Individual plan step component
├── store/
│   └── useIntentifyStore.ts      # Zustand store — file, intent, plan, diff, status
├── lib/
│   ├── openai.ts                 # OpenAI client + helper functions
│   ├── diff.ts                   # Diff parsing and classification helpers
│   └── prompts.ts                # All system prompts in one place
└── types/
    └── index.ts                  # Shared TypeScript types
```

## Shared TypeScript types
```typescript
type PlanStep = {
  id: string
  stepNumber: number
  action: string        // what it will do
  file: string          // which file it touches
  reason: string        // why
  status: 'pending' | 'approved' | 'rejected' | 'edited'
  editedAction?: string
}

type DiffChange = {
  id: string
  file: string
  before: string
  after: string
  category: 'planned' | 'unplanned' | 'risky'
  reason: string        // why it was classified this way
  status: 'pending' | 'approved' | 'rejected'
}

type IntentifyState = {
  file: { name: string; content: string } | null
  intent: string
  plan: PlanStep[]
  diff: DiffChange[]
  status: 'idle' | 'planning' | 'awaiting-approval' | 'executing' | 'reviewing' | 'done'
  liveLog: string[]
}
```

## Key prompts (in lib/prompts.ts)

### Plan generation prompt
```
You are Intentify's planning agent. Given a code file and a developer's intent, 
produce a numbered plan of discrete steps you will take to fulfil the intent.

Rules:
- Maximum 6 steps
- Each step must specify: what you will do, which file, and why
- Do NOT include steps that go beyond the stated intent
- Return JSON only, no prose

Format:
[{ "stepNumber": 1, "action": "...", "file": "...", "reason": "..." }]
```

### Diff classification prompt
```
You are Intentify's diff classifier. Given the original intent and a code diff, 
classify each change as:
- "planned": directly implements what the developer asked for
- "unplanned": change was made but not requested in the intent
- "risky": potential bug, security issue, breaking change, or unexpected side effect

Return JSON only.
Format:
[{ "file": "...", "before": "...", "after": "...", "category": "planned|unplanned|risky", "reason": "..." }]
```

## App flow (state machine)
```
idle
  → user uploads file + types intent → planning
  → plan returned → awaiting-approval
  → user approves plan → executing (SSE stream starts)
  → execution done → reviewing
  → user approves/rejects all diff changes → done
```

## Demo scenario (for demo video)
1. Upload a simple React component (e.g. a Button component, ~40 lines)
2. Intent: "add dark mode support using a CSS class toggle"
3. Plan surfaces 3 steps — all reasonable
4. Execution runs — diff comes back with:
   - 2 planned changes (the dark mode class additions)
   - 1 unplanned change (agent also refactored the prop types)
   - 1 risky change (agent modified a shared utility function)
5. User rejects the unplanned + risky changes
6. Agent revises — returns clean diff with only dark mode changes
7. User approves — done

## What makes this win the hackathon
- Codex is the centrepiece — visible, explainable, controllable
- The 3-column diff is the wow moment judges will remember
- Problem is validated: 30% of developers don't trust AI-generated code (DORA 2025)
- Demo is self-contained and takes 90 seconds to show
- Connects to the bigger narrative: this is the trust layer every agentic system needs

## Judging criteria alignment
| Criterion | How Intentify scores |
|---|---|
| Functionality | Core loop works end to end |
| Creativity | Planned/unplanned/risky classifier is novel |
| Practical impact | Every Codex user has this problem today |
| Technical soundness | Next.js + SSE + typed state machine |
| Codex usage | Codex is the star, not a background call |
| Demo clarity | 3-act script, 90 seconds, judges feel the pain |

## Build order tonight
1. Scaffold + API wired (Hr 1)
2. Screen 1: Intent input UI (Hr 2)
3. Screen 2: Plan approval UI + generate-plan API route (Hr 3-4)
4. Screen 3: Diff viewer + classify-diff API route (Hr 5-6)
5. SSE live feed during execution (Hr 7)
6. Approve/reject + agent revision loop (Hr 8)
7. Polish + bug fixes (Hr 9)
8. Record demo video (Hr 10)
9. GitHub + README + submission docs (Hr 11)
10. Pitch deck (Hr 12)

## Constraints
- Solo build
- 12 hours (8 PM → 8 AM)
- Submission-based (no live demo round — recorded video is everything)
- OpenAI API credits: $50
- Codex credits: 5000
- Use gpt-4o-mini wherever possible to save credits
- Mock the Codex execution in early hours, swap real calls in later
