import {
  DRAFT_STEPS,
  PLAN_STEPS,
  type StoryMapSnapshot,
  type StoryWizardStep,
  countWords,
} from "./types";

export type StoryAssignmentGateConfig = {
  planningRequired: boolean;
  storyMapRequired: boolean;
  cannotDraftUntilPlanComplete: boolean;
  teacherMustApprovePlan: boolean;
  revisionRequired: boolean;
  requireCharacter: boolean;
  requireSetting: boolean;
  requireGoal: boolean;
  requireProblem: boolean;
  requireChain: boolean;
  requireComplication: boolean;
  requireClimax: boolean;
  requireResolution: boolean;
};

export type StoryPlanGateState = {
  characterName?: string | null;
  characterTraits?: string | null;
  characterWant?: string | null;
  settingPlace?: string | null;
  settingTime?: string | null;
  settingMood?: string | null;
  goalType?: string | null;
  goalText?: string | null;
  problemType?: string | null;
  problemText?: string | null;
  complicationText?: string | null;
  climaxIdea?: string | null;
  resolutionText?: string | null;
  eventCount: number;
  planComplete: boolean;
};

export type StoryAttemptGateState = {
  status: string;
  planApproval: string;
  currentStep: string;
  sectionWordCounts: Partial<Record<"BEGINNING" | "MIDDLE" | "CLIMAX" | "ENDING", number>>;
  revisionPassesCompleted: string[];
};

/** Ordered steps enabled for this assignment (always includes ASSIGNMENT/REVIEW/SUBMIT). */
export function enabledSteps(cfg: StoryAssignmentGateConfig): StoryWizardStep[] {
  const steps: StoryWizardStep[] = ["ASSIGNMENT"];
  if (cfg.requireCharacter) steps.push("CHARACTER");
  if (cfg.requireSetting) steps.push("SETTING");
  if (cfg.requireGoal) steps.push("GOAL");
  if (cfg.requireProblem) steps.push("PROBLEM");
  if (cfg.requireChain) steps.push("STORY_CHAIN");
  if (cfg.requireComplication) steps.push("COMPLICATION");
  if (cfg.requireClimax) steps.push("CLIMAX");
  if (cfg.requireResolution) steps.push("RESOLUTION");
  if (cfg.storyMapRequired || cfg.planningRequired) steps.push("STORY_MAP");
  steps.push("BEGINNING", "MIDDLE", "CLIMAX_PARAGRAPH", "ENDING", "REVIEW", "SUBMIT");
  return steps;
}

export function isPlanStepComplete(
  step: StoryWizardStep,
  plan: StoryPlanGateState,
  cfg: StoryAssignmentGateConfig,
): boolean {
  const filled = (s?: string | null) => Boolean(s && s.trim());
  switch (step) {
    case "CHARACTER":
      return !cfg.requireCharacter || (filled(plan.characterName) && filled(plan.characterWant));
    case "SETTING":
      return !cfg.requireSetting || (filled(plan.settingPlace) && filled(plan.settingTime));
    case "GOAL":
      return !cfg.requireGoal || (filled(plan.goalType) && filled(plan.goalText));
    case "PROBLEM":
      return !cfg.requireProblem || (filled(plan.problemType) && filled(plan.problemText));
    case "STORY_CHAIN":
      return !cfg.requireChain || plan.eventCount >= 2;
    case "COMPLICATION":
      return !cfg.requireComplication || filled(plan.complicationText);
    case "CLIMAX":
      return !cfg.requireClimax || filled(plan.climaxIdea);
    case "RESOLUTION":
      return !cfg.requireResolution || filled(plan.resolutionText);
    case "STORY_MAP":
      // Map step is complete only after the student marks it (or map not required).
      return !cfg.storyMapRequired || plan.planComplete;
    default:
      return true;
  }
}

/** All required planning fields filled; when storyMapRequired, also needs planComplete flag. */
export function isPlanningBundleComplete(
  plan: StoryPlanGateState,
  cfg: StoryAssignmentGateConfig,
): boolean {
  for (const step of PLAN_STEPS) {
    if (step === "STORY_MAP") continue;
    if (!isPlanStepComplete(step, plan, cfg)) return false;
  }
  if (cfg.storyMapRequired && !plan.planComplete) return false;
  return true;
}

export function canEnterStep(
  target: StoryWizardStep,
  cfg: StoryAssignmentGateConfig,
  plan: StoryPlanGateState,
  attempt: StoryAttemptGateState,
): { ok: boolean; reason?: string } {
  if (attempt.status === "SUBMITTED" || attempt.status === "REVIEWED") {
    // Read-only browse allowed.
    return { ok: true };
  }

  const steps = enabledSteps(cfg);
  if (!steps.includes(target)) {
    return { ok: false, reason: "This step is not part of your assignment." };
  }

  const targetIdx = steps.indexOf(target);
  // Must complete earlier plan steps in order when planning is required.
  if (cfg.planningRequired) {
    for (let i = 0; i < targetIdx; i++) {
      const prev = steps[i]!;
      if (PLAN_STEPS.includes(prev) && !isPlanStepComplete(prev, plan, cfg)) {
        return {
          ok: false,
          reason: `Finish the ${prev.toLowerCase().replace(/_/g, " ")} step first.`,
        };
      }
    }
  }

  const isDraft = DRAFT_STEPS.includes(target) || target === "REVIEW" || target === "SUBMIT";
  if (isDraft) {
    if (cfg.cannotDraftUntilPlanComplete && !isPlanningBundleComplete(plan, cfg)) {
      return {
        ok: false,
        reason: "Complete your plan (and Story Map) before drafting paragraphs.",
      };
    }
    if (cfg.teacherMustApprovePlan) {
      if (attempt.planApproval === "PENDING" || attempt.planApproval === "CHANGES_REQUESTED") {
        return {
          ok: false,
          reason:
            attempt.planApproval === "CHANGES_REQUESTED"
              ? "Your teacher asked for plan changes before drafting."
              : "Wait for your teacher to approve your plan before drafting.",
        };
      }
      if (
        attempt.planApproval !== "APPROVED" &&
        attempt.planApproval !== "NOT_REQUIRED"
      ) {
        return { ok: false, reason: "Plan approval is required before drafting." };
      }
    }
  }

  if (target === "SUBMIT") {
    for (const kind of ["BEGINNING", "MIDDLE", "CLIMAX", "ENDING"] as const) {
      if ((attempt.sectionWordCounts[kind] || 0) < 1) {
        return { ok: false, reason: "Write all four story sections before submitting." };
      }
    }
    if (cfg.revisionRequired) {
      const needed = ["structure", "logic", "timeline", "language", "requirements"];
      const missing = needed.filter((p) => !attempt.revisionPassesCompleted.includes(p));
      if (missing.length) {
        return {
          ok: false,
          reason: `Complete revision passes first: ${missing.join(", ")}.`,
        };
      }
    }
  }

  return { ok: true };
}

export function nextEnabledStep(
  current: StoryWizardStep,
  cfg: StoryAssignmentGateConfig,
): StoryWizardStep | null {
  const steps = enabledSteps(cfg);
  const idx = steps.indexOf(current);
  if (idx < 0 || idx >= steps.length - 1) return null;
  return steps[idx + 1]!;
}

export function prevEnabledStep(
  current: StoryWizardStep,
  cfg: StoryAssignmentGateConfig,
): StoryWizardStep | null {
  const steps = enabledSteps(cfg);
  const idx = steps.indexOf(current);
  if (idx <= 0) return null;
  return steps[idx - 1]!;
}

/** Build Story Map from student input only — organize/redisplay, never invent. */
export function buildStoryMapSnapshot(
  plan: StoryPlanGateState & {
    events: { label: string; cause?: string | null; effect?: string | null }[];
  },
): StoryMapSnapshot {
  const gapQuestions: string[] = [];
  const character = [plan.characterName, plan.characterTraits, plan.characterWant]
    .filter((s) => s && s.trim())
    .join(" — ");
  const setting = [plan.settingPlace, plan.settingTime, plan.settingMood]
    .filter((s) => s && s.trim())
    .join(" · ");
  const goal = [plan.goalType, plan.goalText].filter((s) => s && s.trim()).join(": ");
  const problem = [plan.problemType, plan.problemText].filter((s) => s && s.trim()).join(": ");

  if (!character) gapQuestions.push("Who is your main character, and what do they want?");
  if (!setting) gapQuestions.push("Where and when does your story happen?");
  if (!goal) gapQuestions.push("What is your character trying to achieve?");
  if (!problem) gapQuestions.push("What problem stands in the way?");
  if (plan.events.length < 2) {
    gapQuestions.push("Can you add at least two events in your story chain?");
  }
  for (let i = 0; i < plan.events.length; i++) {
    const e = plan.events[i]!;
    if (!e.cause?.trim() || !e.effect?.trim()) {
      gapQuestions.push(
        `For event “${e.label || i + 1}”: what caused it, and what happened because of it?`,
      );
    }
    if (i > 0) {
      const prev = plan.events[i - 1]!;
      if (prev.effect?.trim() && e.cause?.trim()) {
        // Only ask if student left a clear disconnect note empty — never invent the link.
        const prevEff = prev.effect.trim().toLowerCase();
        const cause = e.cause.trim().toLowerCase();
        if (prevEff && cause && prevEff !== cause && !cause.includes(prevEff.slice(0, 12))) {
          gapQuestions.push(
            `How does “${prev.label}” lead to “${e.label}”? (Answer in your own words on the chain.)`,
          );
        }
      }
    }
  }
  if (!plan.complicationText?.trim()) {
    gapQuestions.push("What complication makes things harder?");
  }
  if (!plan.climaxIdea?.trim()) {
    gapQuestions.push("What is the most intense moment (climax)?");
  }
  if (!plan.resolutionText?.trim()) {
    gapQuestions.push("How does the story end / get resolved?");
  }

  return {
    character: character || null,
    setting: setting || null,
    goal: goal || null,
    problem: problem || null,
    events: plan.events.map((e) => ({
      label: e.label,
      cause: e.cause?.trim() || null,
      effect: e.effect?.trim() || null,
    })),
    complication: plan.complicationText?.trim() || null,
    climax: plan.climaxIdea?.trim() || null,
    resolution: plan.resolutionText?.trim() || null,
    gapQuestions,
  };
}

export function wordBudgetGuidance(target: number): {
  beginning: number;
  middle: number;
  climax: number;
  ending: number;
  tip: string;
} {
  const t = Math.max(80, target || 300);
  const beginning = Math.round(t * 0.2);
  const middle = Math.round(t * 0.35);
  const climax = Math.round(t * 0.25);
  const ending = Math.max(20, t - beginning - middle - climax);
  return {
    beginning,
    middle,
    climax,
    ending,
    tip: `Aim for about ${t} words total: ~${beginning} beginning, ~${middle} middle, ~${climax} climax, ~${ending} ending.`,
  };
}

export function totalDraftWords(
  sections: Partial<Record<"BEGINNING" | "MIDDLE" | "CLIMAX" | "ENDING", string>>,
): number {
  return (
    countWords(sections.BEGINNING || "") +
    countWords(sections.MIDDLE || "") +
    countWords(sections.CLIMAX || "") +
    countWords(sections.ENDING || "")
  );
}
