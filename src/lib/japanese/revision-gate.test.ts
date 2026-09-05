import { describe, expect, it } from "vitest";
import { mergeUnlockedBlocks } from "./milestone";
import {
  getBlocksForRevisionGate,
  getRequiredRevisionGate,
  getRevisionGateForCompletedBlock,
  isBlockBehindRevisionGate,
  isLiveRevisionGate,
  revisionGateWordCount,
} from "./revision-gate";
import { updateMetaAfterRound, createInitialBlockMeta } from "./engine";

describe("revision gates", () => {
  it("maps block 5 completion to revision gate 1", () => {
    expect(getRevisionGateForCompletedBlock(5)).toBe(1);
    expect(getRevisionGateForCompletedBlock(4)).toBeNull();
  });

  it("requires gate 1 before blocks 6–10", () => {
    expect(getRequiredRevisionGate(6)).toBe(1);
    expect(getRequiredRevisionGate(10)).toBe(1);
    expect(getRequiredRevisionGate(11)).toBe(2);
    expect(getRequiredRevisionGate(5)).toBeNull();
  });

  it("collects the five blocks in each revision segment", () => {
    expect(getBlocksForRevisionGate(1)).toEqual([1, 2, 3, 4, 5]);
    expect(getBlocksForRevisionGate(2)).toEqual([6, 7, 8, 9, 10]);
    expect(revisionGateWordCount(1)).toBe(250);
    expect(revisionGateWordCount(2)).toBe(250);
  });

  it("does not block blocks 1–20 behind revision gates (always unlocked)", () => {
    expect(isBlockBehindRevisionGate(6, [])).toBe(false);
    expect(isBlockBehindRevisionGate(10, [])).toBe(false);
    expect(isBlockBehindRevisionGate(11, [])).toBe(false);
    expect(isBlockBehindRevisionGate(20, [])).toBe(false);
    expect(isBlockBehindRevisionGate(21, [])).toBe(true);
    expect(isBlockBehindRevisionGate(21, [4])).toBe(false);
  });

  it("unlocks block 4 when block 3 is mastered", () => {
    const rows = [
      { blockNumber: 3, unlockedBlocks: [1, 2, 3], blockMastered: true },
    ];
    expect(mergeUnlockedBlocks(rows, [], [])).toContain(4);
  });

  it("unlocks block 6 after block 5 mastery (blocks 1–20 always open)", () => {
    const rows = [
      { blockNumber: 5, unlockedBlocks: [1, 2, 3, 4, 5], blockMastered: true },
    ];
    expect(mergeUnlockedBlocks(rows, [], [])).toContain(6);
  });

  it("unlocks block 6 in meta after block 5 mastery without revision gate", () => {
    let meta = createInitialBlockMeta();
    meta = updateMetaAfterRound(meta, 5, 5, 95, []);
    expect(meta.blockMastered).toBe(true);
    expect(meta.unlockedBlocks).toContain(6);
  });

  it("marks revision gates 1–4 as live", () => {
    expect(isLiveRevisionGate(1)).toBe(true);
    expect(isLiveRevisionGate(2)).toBe(true);
    expect(isLiveRevisionGate(3)).toBe(true);
    expect(isLiveRevisionGate(4)).toBe(true);
    expect(isLiveRevisionGate(5)).toBe(false);
  });
});

describe("revision quiz size", () => {
  it("builds at least 350 questions with full 250-word coverage per live gate", async () => {
    const { getRevisionQuestionCountsForGate } = await import(
      "./revision-quiz-build"
    );
    for (const gate of [1, 2, 3, 4]) {
      const counts = getRevisionQuestionCountsForGate(gate);
      expect(counts.poolSize).toBe(250);
      expect(counts.wordCoverage).toBe(250);
      expect(counts.questionTotal).toBeGreaterThanOrEqual(350);
      expect(counts.sentenceCount).toBeGreaterThanOrEqual(8);
    }
  });
});
