/** Guided Story Writer — shared types & constants (no ghostwriting). */

export const STORY_WIZARD_STEPS = [
  "ASSIGNMENT",
  "CHARACTER",
  "SETTING",
  "GOAL",
  "PROBLEM",
  "STORY_CHAIN",
  "COMPLICATION",
  "CLIMAX",
  "RESOLUTION",
  "STORY_MAP",
  "BEGINNING",
  "MIDDLE",
  "CLIMAX_PARAGRAPH",
  "ENDING",
  "REVIEW",
  "SUBMIT",
] as const;

export type StoryWizardStep = (typeof STORY_WIZARD_STEPS)[number];

export const PLAN_STEPS: StoryWizardStep[] = [
  "CHARACTER",
  "SETTING",
  "GOAL",
  "PROBLEM",
  "STORY_CHAIN",
  "COMPLICATION",
  "CLIMAX",
  "RESOLUTION",
  "STORY_MAP",
];

export const DRAFT_STEPS: StoryWizardStep[] = [
  "BEGINNING",
  "MIDDLE",
  "CLIMAX_PARAGRAPH",
  "ENDING",
];

export const REVISION_PASS_KINDS = [
  "structure",
  "logic",
  "timeline",
  "language",
  "requirements",
] as const;

export type RevisionPassKind = (typeof REVISION_PASS_KINDS)[number];

export const GRAMMAR_FOCUS_OPTIONS = [
  "Past Simple",
  "Past Continuous",
  "Past Perfect",
  "Past Perfect Continuous",
] as const;

export const GOAL_TYPE_OPTIONS = [
  "Achieve something",
  "Find / recover something",
  "Help someone",
  "Escape / survive",
  "Learn / understand",
  "Win / compete",
  "Other",
] as const;

export const PROBLEM_TYPE_OPTIONS = [
  "Obstacle / barrier",
  "Conflict with a person",
  "Mistake / misunderstanding",
  "Time pressure",
  "Missing information",
  "Fear / doubt",
  "Other",
] as const;

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export type StoryCheckIssue = {
  code: string;
  severity: "info" | "warn" | "error";
  message: string;
  hint?: string;
  /** Field or section reference — never generated prose. */
  target?: string;
};

export type StoryMapSnapshot = {
  character: string | null;
  setting: string | null;
  goal: string | null;
  problem: string | null;
  events: { label: string; cause: string | null; effect: string | null }[];
  complication: string | null;
  climax: string | null;
  resolution: string | null;
  /** Questions about gaps — never invented plot. */
  gapQuestions: string[];
};

export function isStoryWizardStep(v: string): v is StoryWizardStep {
  return (STORY_WIZARD_STEPS as readonly string[]).includes(v);
}

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function stepLabel(step: StoryWizardStep): string {
  const labels: Record<StoryWizardStep, string> = {
    ASSIGNMENT: "Assignment",
    CHARACTER: "Character",
    SETTING: "Setting",
    GOAL: "Goal",
    PROBLEM: "Problem",
    STORY_CHAIN: "Story Chain",
    COMPLICATION: "Complication",
    CLIMAX: "Climax idea",
    RESOLUTION: "Resolution",
    STORY_MAP: "Story Map",
    BEGINNING: "Beginning",
    MIDDLE: "Middle",
    CLIMAX_PARAGRAPH: "Climax paragraph",
    ENDING: "Ending",
    REVIEW: "Review",
    SUBMIT: "Submit",
  };
  return labels[step];
}
