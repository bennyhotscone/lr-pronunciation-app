import { describe, expect, it } from "vitest";
import { mergeUnlockedBlocks } from "./milestone";
import {
  getBlocksForRevisionGate,
  getRequiredRevisionGate,
  getRevisionGateForCompletedBlock,
  isBlockBehindRevisionGate,
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

  it("collects all blocks in a revision group", () => {
    expect(getBlocksForRevisionGate(1)).toEqual([1, 2, 3, 4, 5]);
    expect(revisionGateWordCount(1)).toBe(250);
  });

  it("blocks the next group until revision is passed", () => {
    expect(isBlockBehindRevisionGate(6, [])).toBe(true);
    expect(isBlockBehindRevisionGate(6, [1])).toBe(false);
  });

  it("unlocks block 4 when block 3 is mastered", () => {
    const rows = [
      { blockNumber: 3, unlockedBlocks: [1, 2, 3], blockMastered: true },
    ];
    expect(mergeUnlockedBlocks(rows, [], [])).toContain(4);
  });

  it("does not unlock block 6 after block 5 mastery without revision", () => {
    const rows = [
      { blockNumber: 5, unlockedBlocks: [1, 2, 3, 4, 5], blockMastered: true },
    ];
    expect(mergeUnlockedBlocks(rows, [], [])).not.toContain(6);
    expect(mergeUnlockedBlocks(rows, [], [1])).toContain(6);
  });

  it("respects revision gate when updating meta after block 5", () => {
    let meta = createInitialBlockMeta();
    meta = {
      ...meta,
      unlockedBlocks: [1, 2, 3, 4, 5],
      blockMastered: false,
    };
    meta = updateMetaAfterRound(meta, 5, 5, 95, []);
    expect(meta.blockMastered).toBe(true);
    expect(meta.unlockedBlocks).not.toContain(6);
    meta = updateMetaAfterRound(meta, 5, 5, 95, [1]);
    expect(meta.unlockedBlocks).toContain(6);
  });
});
