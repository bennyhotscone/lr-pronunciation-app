import { describe, expect, it } from "vitest";
import {
  advanceFormalQuestion,
  buildRoundView,
  createInitialBlockMeta,
  createInitialSessionState,
  getActiveRound,
  getHighestRoundReached,
  jumpToRound,
  repairSessionState,
  retryRound,
  startFormalRound,
  transitionRound1ToRound2,
} from "./engine";
import type { JapaneseWord } from "./types";

const words: JapaneseWord[] = Array.from({ length: 10 }, (_, i) => ({
  jp: `w${i}`,
  audio: `a${i}`,
  r: `r${i}`,
  en: `e${i}`,
  m: `m${i}`,
}));

describe("buildRoundView state machine", () => {
  it("reaches typed english round 4", () => {
    let state = transitionRound1ToRound2(
      { ...createInitialSessionState(), introIndex: 10 },
      10,
    );
    state = startFormalRound(state, 4, 10);
    const view = buildRoundView(state, words);
    expect(view?.kind).toBe("formal");
    if (view?.kind === "formal") {
      expect(view.round).toBe(4);
      expect(view.mode).toBe("type-english");
      expect(view.instruction).toBe("LISTEN AND TYPE THE MEANING");
    }
  });

  it("reaches typed romaji round 5", () => {
    let state = startFormalRound(createInitialSessionState(), 5, 10);
    const view = buildRoundView(state, words);
    expect(view?.kind).toBe("formal");
    if (view?.kind === "formal") {
      expect(view.round).toBe(5);
      expect(view.mode).toBe("type-romaji");
      expect(view.instruction).toBe("TYPE THE JAPANESE WORD");
    }
  });

  it("shows round-complete after final formal question", () => {
    let state = startFormalRound(createInitialSessionState(), 4, 10);
    state = { ...state, qIndex: 10, score: 8 };
    const view = buildRoundView(state, words);
    expect(view?.kind).toBe("round-complete");
    if (view?.kind === "round-complete") {
      expect(view.nextRound).toBe(5);
      expect(view.retryRound).toBe(4);
    }
  });

  it("offers retry when round 4 score is below mastery", () => {
    let state = startFormalRound(createInitialSessionState(), 4, 10);
    state = { ...state, qIndex: 10, score: 3, missed: [0, 1, 2] };
    const view = buildRoundView(state, words);
    expect(view?.kind).toBe("round-complete");
    if (view?.kind === "round-complete") {
      expect(view.passed).toBe(false);
      expect(view.retryRound).toBe(4);
      expect(view.nextRound).toBe(5);
    }
  });

  it("offers retry on round 5 complete", () => {
    let state = startFormalRound(createInitialSessionState(), 5, 10);
    state = { ...state, qIndex: 10, score: 5 };
    const view = buildRoundView(state, words);
    expect(view?.kind).toBe("round-complete");
    if (view?.kind === "round-complete") {
      expect(view.retryRound).toBe(5);
      expect(view.nextRound).toBeUndefined();
    }
  });

  it("shows round-complete when round 1 learn phase is finished", () => {
    const completed = { ...createInitialSessionState(), introIndex: 10 };
    const view = buildRoundView(completed, words);
    expect(view?.kind).toBe("round-complete");
    if (view?.kind === "round-complete") {
      expect(view.round).toBe(1);
      expect(view.nextRound).toBe(2);
    }
  });

  it("does not refill order when advancing questions", () => {
    let state = startFormalRound(createInitialSessionState(), 3, 10);
    const originalOrder = [...state.order];
    state = advanceFormalQuestion(state);
    expect(state.order).toEqual(originalOrder);
  });
});

describe("retryRound", () => {
  it("resets round 1 learn phase from scratch", () => {
    const completed = { ...createInitialSessionState(), introIndex: 10, score: 8, missed: [1] };
    const retried = retryRound(completed, 10);
    expect(retried.phase).toBe("round1");
    expect(retried.roundIsRetry).toBe(true);
    expect(retried.order).toHaveLength(10);
    expect(retried.introIndex).toBe(0);
  });

  it("skips known words on round 1 retry", () => {
    const completed = { ...createInitialSessionState(), introIndex: 10 };
    const retried = retryRound(completed, 10, [0, 2, 4]);
    expect(retried.order).toHaveLength(7);
    expect(retried.order).not.toContain(0);
    expect(retried.order).not.toContain(2);
    expect(retried.order).not.toContain(4);
  });

  it("reshuffles and resets round 2", () => {
    let state = startFormalRound(createInitialSessionState(), 2, 10);
    state = { ...state, qIndex: 10, score: 7, missed: [1, 2] };
    const retried = retryRound(state, 10);
    expect(retried.phase).toBe("round2");
    expect(retried.qIndex).toBe(0);
    expect(retried.score).toBe(0);
    expect(retried.missed).toEqual([]);
    expect(retried.order.length).toBe(10);
    expect(retried.roundIsRetry).toBe(true);
  });

  it("reshuffles and resets round 3", () => {
    let state = startFormalRound(createInitialSessionState(), 3, 10);
    state = { ...state, qIndex: 10, score: 7, missed: [1, 2] };
    const retried = retryRound(state, 10);
    expect(retried.phase).toBe("round3");
    expect(retried.qIndex).toBe(0);
    expect(retried.score).toBe(0);
    expect(retried.missed).toEqual([]);
    expect(retried.order.length).toBe(10);
  });

  it("reshuffles and resets round 4", () => {
    let state = startFormalRound(createInitialSessionState(), 4, 10);
    state = { ...state, qIndex: 10, score: 7, missed: [1, 2] };
    const retried = retryRound(state, 10);
    expect(retried.phase).toBe("round4");
    expect(retried.qIndex).toBe(0);
    expect(retried.score).toBe(0);
    expect(retried.missed).toEqual([]);
    expect(retried.order.length).toBe(10);
  });

  it("reshuffles and resets round 5", () => {
    let state = startFormalRound(createInitialSessionState(), 5, 10);
    state = { ...state, qIndex: 10, score: 7, missed: [1, 2] };
    const retried = retryRound(state, 10);
    expect(retried.phase).toBe("round5");
    expect(retried.qIndex).toBe(0);
    expect(retried.score).toBe(0);
    expect(retried.missed).toEqual([]);
    expect(retried.order.length).toBe(10);
  });
});

describe("getHighestRoundReached", () => {
  it("returns 2 when round 1 learn phase is complete", () => {
    const state = { ...createInitialSessionState(), introIndex: 10 };
    const meta = createInitialBlockMeta();
    expect(getHighestRoundReached(state, meta, 10)).toBe(2);
  });

  it("uses meta round scores to unlock later rounds", () => {
    const state = startFormalRound(createInitialSessionState(), 2, 10);
    const meta = { ...createInitialBlockMeta(), roundScores: { "2": 80, "3": 70 } };
    expect(getHighestRoundReached(state, meta, 10)).toBe(4);
  });

  it("keeps all five rounds selectable after round 5 completes below mastery", () => {
    let state = startFormalRound(createInitialSessionState(), 5, 10);
    state = { ...state, qIndex: 10, score: 6, missed: [0, 1] };
    const meta = {
      ...createInitialBlockMeta(),
      roundScores: { "2": 90, "3": 85, "4": 70, "5": 64 },
      bestRound5Score: 64,
    };
    expect(getHighestRoundReached(state, meta, 10)).toBe(5);
  });

  it("keeps round 5 reachable from meta after session reload mid-block", () => {
    const state = startFormalRound(createInitialSessionState(), 2, 10);
    const meta = {
      ...createInitialBlockMeta(),
      roundScores: { "5": 64 },
      bestRound5Score: 64,
    };
    expect(getHighestRoundReached(state, meta, 10)).toBe(5);
  });
});

describe("jumpToRound", () => {
  it("returns round 1 complete state when learn is done", () => {
    const state = { ...createInitialSessionState(), introIndex: 10 };
    const jumped = jumpToRound(state, 1, 10);
    expect(jumped.phase).toBe("round1");
    expect(jumped.introIndex).toBe(10);
    expect(buildRoundView(jumped, words)?.kind).toBe("round-complete");
  });

  it("starts formal round 3 from mid-block session", () => {
    let state = { ...createInitialSessionState(), introIndex: 10 };
    state = jumpToRound(state, 3, 10);
    expect(state.phase).toBe("round3");
    expect(state.order).toHaveLength(10);
    expect(getActiveRound(state, 10)).toBe(3);
  });
});

describe("known words in formal rounds", () => {
  it("auto-passes when all words are known", () => {
    const knownIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const state = startFormalRound(createInitialSessionState(), 4, 10, {
      isRetry: true,
      knownIndices,
    });
    expect(state.order).toEqual([]);
    const knownWords = Object.fromEntries(knownIndices.map((i) => [i, { known: true }]));
    const view = buildRoundView(state, words, {}, knownWords);
    expect(view?.kind).toBe("round-complete");
    if (view?.kind === "round-complete") {
      expect(view.scorePct).toBe(100);
      expect(view.passed).toBe(true);
    }
  });

  it("counts known words toward round mastery percentage", () => {
    const knownIndices = [0, 1, 2, 3, 4, 5, 6, 7];
    let state = startFormalRound(createInitialSessionState(), 4, 10, {
      isRetry: true,
      knownIndices,
    });
    state = { ...state, qIndex: 2, score: 1, missed: [9] };
    const knownWords = Object.fromEntries(knownIndices.map((i) => [i, { known: true }]));
    const view = buildRoundView(state, words, {}, knownWords);
    expect(view?.kind).toBe("round-complete");
    if (view?.kind === "round-complete") {
      expect(view.scorePct).toBe(90);
      expect(view.passed).toBe(true);
    }
  });

  it("includes full queue on a new formal round", () => {
    const state = startFormalRound(createInitialSessionState(), 3, 10, {
      isRetry: false,
      knownIndices: [0, 1, 2],
    });
    expect(state.order).toHaveLength(10);
    expect(state.roundIsRetry).toBe(false);
  });
});

describe("repairSessionState", () => {
  it("preserves stuck round1 completion for the round-complete interstitial", () => {
    const stuck = { ...createInitialSessionState(), introIndex: 10 };
    const fixed = repairSessionState(stuck, 10);
    expect(fixed.phase).toBe("round1");
    expect(fixed.introIndex).toBe(10);
    const view = buildRoundView(fixed, words);
    expect(view?.kind).toBe("round-complete");
  });

  it("keeps completed formal round at round-complete", () => {
    const done = startFormalRound(createInitialSessionState(), 4, 10);
    const stuck = { ...done, qIndex: 10, score: 7 };
    const fixed = repairSessionState(stuck, 10);
    expect(fixed.phase).toBe("round4");
    expect(fixed.qIndex).toBe(10);
  });

  it("rebuilds empty formal order", () => {
    const broken = { ...createInitialSessionState(), phase: "round4" as const, order: [] };
    const fixed = repairSessionState(broken, 10);
    expect(fixed.phase).toBe("round4");
    expect(fixed.order.length).toBe(10);
  });

  it("preserves completed round 5 for round-complete navigation", () => {
    let done = startFormalRound(createInitialSessionState(), 5, 10);
    done = { ...done, qIndex: 10, score: 6 };
    const fixed = repairSessionState(done, 10);
    expect(fixed.qIndex).toBe(10);
    const view = buildRoundView(fixed, words);
    expect(view?.kind).toBe("round-complete");
    if (view?.kind === "round-complete") {
      expect(view.retryRound).toBe(5);
    }
  });
});