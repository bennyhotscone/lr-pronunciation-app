import { describe, expect, it } from "vitest";
import {
  advanceFormalQuestion,
  buildRoundView,
  createInitialSessionState,
  repairSessionState,
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
    }
  });

  it("does not refill order when advancing questions", () => {
    let state = startFormalRound(createInitialSessionState(), 3, 10);
    const originalOrder = [...state.order];
    state = advanceFormalQuestion(state);
    expect(state.order).toEqual(originalOrder);
  });
});

describe("repairSessionState", () => {
  it("transitions stuck round1 completion to round2", () => {
    const stuck = { ...createInitialSessionState(), introIndex: 10 };
    const fixed = repairSessionState(stuck, 10);
    expect(fixed.phase).toBe("round2");
    expect(fixed.order.length).toBe(10);
  });

  it("rebuilds empty formal order", () => {
    const broken = { ...createInitialSessionState(), phase: "round4" as const, order: [] };
    const fixed = repairSessionState(broken, 10);
    expect(fixed.phase).toBe("round4");
    expect(fixed.order.length).toBe(10);
  });
});
