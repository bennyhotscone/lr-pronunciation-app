import { describe, expect, it } from "vitest";
import {
  looksLikeNarrativeProse,
  refuseGhostwritingRequest,
  scrubGuideOutput,
} from "@/lib/story/ghostwriting";
import {
  buildStoryMapSnapshot,
  canEnterStep,
  enabledSteps,
  isPlanningBundleComplete,
  wordBudgetGuidance,
  type StoryAssignmentGateConfig,
} from "@/lib/story/state-machine";
import { runDeterministicStoryChecks } from "@/lib/story/checks";
import { countWords } from "@/lib/story/types";

const fullCfg: StoryAssignmentGateConfig = {
  planningRequired: true,
  storyMapRequired: true,
  cannotDraftUntilPlanComplete: true,
  teacherMustApprovePlan: true,
  revisionRequired: true,
  requireCharacter: true,
  requireSetting: true,
  requireGoal: true,
  requireProblem: true,
  requireChain: true,
  requireComplication: true,
  requireClimax: true,
  requireResolution: true,
};

describe("ghostwriting defence", () => {
  it("flags long narrative prose", () => {
    const prose =
      "Once upon a time a girl walked into the forest and suddenly she saw a wolf. Meanwhile the hunter decided to help her and they began to run toward the village until the end.";
    expect(looksLikeNarrativeProse(prose)).toBe(true);
  });

  it("allows short scaffolding questions", () => {
    expect(looksLikeNarrativeProse("What does your character want in this scene?")).toBe(false);
  });

  it("scrubs rewrite suggestions", () => {
    const r = scrubGuideOutput(
      "You could write: She walked slowly into the dark room and whispered a secret to her friend about the missing key.",
    );
    expect(r.ok).toBe(false);
  });

  it("refuses explicit ghostwriting prompts", () => {
    const msg = refuseGhostwritingRequest("Please write my climax paragraph for me");
    expect(msg).toBeTruthy();
    expect(msg!.toLowerCase()).toContain("can't write");
  });
});

describe("story state machine", () => {
  it("includes numbered wizard steps", () => {
    const steps = enabledSteps(fullCfg);
    expect(steps[0]).toBe("ASSIGNMENT");
    expect(steps).toContain("STORY_MAP");
    expect(steps).toContain("BEGINNING");
    expect(steps.at(-1)).toBe("SUBMIT");
  });

  it("blocks drafting until plan complete and approved", () => {
    const plan = {
      characterName: "Rita",
      characterWant: "find a book",
      settingPlace: "library",
      settingTime: "evening",
      goalType: "Find / recover something",
      goalText: "find the book",
      problemType: "Obstacle / barrier",
      problemText: "door locked",
      complicationText: "lights out",
      climaxIdea: "open the door",
      resolutionText: "find book",
      eventCount: 2,
      planComplete: false,
    };
    const attempt = {
      status: "PLANNING",
      planApproval: "PENDING",
      currentStep: "STORY_MAP",
      sectionWordCounts: {},
      revisionPassesCompleted: [],
    };
    expect(isPlanningBundleComplete(plan, fullCfg)).toBe(false);
    expect(canEnterStep("BEGINNING", fullCfg, plan, attempt).ok).toBe(false);

    const ready = { ...plan, planComplete: true };
    expect(isPlanningBundleComplete(ready, fullCfg)).toBe(true);
    expect(canEnterStep("BEGINNING", fullCfg, ready, attempt).ok).toBe(false);

    const approved = { ...attempt, planApproval: "APPROVED" as const };
    expect(canEnterStep("BEGINNING", fullCfg, ready, approved).ok).toBe(true);
  });

  it("story map only redisplays student input", () => {
    const snap = buildStoryMapSnapshot({
      characterName: "Alex",
      characterWant: "win",
      settingPlace: "park",
      settingTime: "morning",
      goalType: "Win / compete",
      goalText: "win the race",
      problemType: "Time pressure",
      problemText: "late start",
      eventCount: 1,
      planComplete: false,
      events: [{ label: "Starts late", cause: "overslept", effect: "" }],
      climaxIdea: null,
      resolutionText: null,
      complicationText: null,
    });
    expect(snap.character).toContain("Alex");
    expect(snap.gapQuestions.some((q) => /climax/i.test(q))).toBe(true);
    expect(snap.events[0]!.effect).toBeNull();
  });

  it("scales word budget to target", () => {
    const b = wordBudgetGuidance(300);
    expect(b.beginning + b.middle + b.climax + b.ending).toBe(300);
  });
});

describe("deterministic checks", () => {
  it("counts words and flags empty sections", () => {
    expect(countWords("one two three")).toBe(3);
    const issues = runDeterministicStoryChecks({
      sections: { beginning: "Hi", middle: "", climax: "x", ending: "y" },
      wordTarget: 300,
      grammarFocus: ["Past Simple"],
      vocabList: ["suddenly"],
      vocabRequireAll: true,
      plan: {},
    });
    expect(issues.some((i) => i.code === "SECTION_EMPTY")).toBe(true);
    expect(issues.some((i) => i.code === "VOCAB_ALL")).toBe(true);
  });
});
