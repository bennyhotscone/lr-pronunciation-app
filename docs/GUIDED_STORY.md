# Guided Story Writer

## Modes

- **Mode A — Free Story Practice**: Student Desk card → same wizard, no teacher assignment.
- **Mode B — Teacher Guided Story**: Classroom (or student) homework form → creates normal `Homework` plus linked `StoryAssignment`.

## Wizard steps

Assignment → Character → Setting → Goal → Problem → Story Chain → Complication → Climax → Resolution → Story Map → Beginning → Middle → Climax paragraph → Ending → Review → Submit.

Server-side state machine (`src/lib/story/state-machine.ts`) + auth on every save/submit prevent URL/step bypass.

## Models (Prisma)

`StoryAssignment`, `StoryAttempt`, `StoryPlan`, `StoryPlanEvent`, `StoryDraftSection`, `StoryRevision`, `StoryIntegrityEvent`, `StoryTeacherFeedback`.

Optional 1:1: `Homework.storyAssignment`.

## Ghostwriting safeguards

- UI: Story Guide is a small question panel; category buttons are types only; Story Map redisplays student input; gap detection is questions only.
- Server: `STORY_GUIDE_SYSTEM_PROMPT` forbids prose; `refuseGhostwritingRequest` + `scrubGuideOutput` / `looksLikeNarrativeProse` discard narrative or rewrite-like model output (`GUIDE_BLOCKED` integrity events).
- Checks never rewrite student text.

## Optional AI checks

Deterministic checks always run (`src/lib/story/checks.ts`).

Optional LLM issues: `src/lib/story/ai-check.ts` when `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set.

**Disable model checks (keep deterministic):**

```bash
STORY_AI_CHECKS=0
```

Optional models: `OPENAI_STORY_MODEL`, `ANTHROPIC_STORY_MODEL`.

## Process integrity

Paste events store metadata like `Large paste attempt: N words`. Optional block around the configured threshold (default 25). No AI-probability / cheating score in teacher UI.

## Teacher review

`/teacher/stories/[attemptId]` tabs: Final Story, Plan, Process, Revision History, Requirements, Feedback.

## Student routes

- `/portal/stories/open?homeworkId=…` — open/create attempt for assigned Guided Story
- `/portal/stories/[attemptId]` — wizard
- Free practice card on `/portal`

## Deploy / schema

```bash
npx prisma db push
npm run build
npx vercel --prod --yes
```
