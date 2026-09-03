import { describe, expect, it } from "vitest";
import {
  applyAnswerToKnownProgress,
  buildPracticeOrder,
  computeFormalRoundScorePct,
  computeRoundScorePct,
  EMPTY_KNOWN_PROGRESS,
  indicesFromKnownStats,
  statsToKnownWordsMap,
} from "./known-words";

describe("known-words", () => {
  it("promotes after three consecutive correct answers in round 4", () => {
    let p = { ...EMPTY_KNOWN_PROGRESS };
    p = applyAnswerToKnownProgress(p, 4, true);
    expect(p.known).toBe(false);
    p = applyAnswerToKnownProgress(p, 4, true);
    expect(p.known).toBe(false);
    p = applyAnswerToKnownProgress(p, 4, true);
    expect(p.known).toBe(true);
    expect(p.consecutiveCorrect).toBe(3);
  });

  it("promotes after correct answers in rounds 4 and 5 without early misses", () => {
    let p = { ...EMPTY_KNOWN_PROGRESS };
    p = applyAnswerToKnownProgress(p, 4, true);
    expect(p.known).toBe(false);
    p = applyAnswerToKnownProgress(p, 5, true);
    expect(p.known).toBe(true);
  });

  it("disqualifies promotion after a miss in round 2", () => {
    let p = { ...EMPTY_KNOWN_PROGRESS };
    p = applyAnswerToKnownProgress(p, 2, false);
    p = applyAnswerToKnownProgress(p, 4, true);
    p = applyAnswerToKnownProgress(p, 4, true);
    p = applyAnswerToKnownProgress(p, 5, true);
    p = applyAnswerToKnownProgress(p, 5, true);
    expect(p.known).toBe(false);
    expect(p.missedEarlyRounds).toBe(true);
  });

  it("removes known status on wrong answer", () => {
    const p = applyAnswerToKnownProgress(
      {
        known: true,
        missedEarlyRounds: false,
        consecutiveCorrect: 4,
        round4CorrectCount: 2,
        round5CorrectCount: 2,
      },
      5,
      false,
    );
    expect(p.known).toBe(false);
    expect(p.round4CorrectCount).toBe(0);
    expect(p.round5CorrectCount).toBe(0);
  });

  it("skips known words on every learn pass, not only retry", () => {
    const known = new Set([0, 2]);
    expect(buildPracticeOrder(5, known, false)).toEqual([1, 3, 4]);
    expect(buildPracticeOrder(5, known, true)).toEqual([1, 3, 4]);
  });

  it("counts known words toward mastery on every formal pass", () => {
    const known = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(computeFormalRoundScorePct(2, 2, 10, known, true)).toBe(100);
    expect(computeFormalRoundScorePct(2, 2, 10, known, false)).toBe(100);
    expect(computeRoundScorePct(1, 10, 8)).toBe(90);
  });

  it("reads known indices from stats", () => {
    expect(indicesFromKnownStats({ 1: { known: true }, 3: { known: true } })).toEqual(
      new Set([1, 3]),
    );
  });

  it("maps word stats into a known-words map for the engine", () => {
    expect(
      statsToKnownWordsMap({
        0: { known: true },
        1: { known: false },
        2: { known: true },
      }),
    ).toEqual({ 0: { known: true }, 2: { known: true } });
  });
});
