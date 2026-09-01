import { describe, expect, it } from "vitest";
import {
  getBlockUnlockedByMilestone,
  getBlocksForMilestone,
  getMilestoneForBlock,
  isGateBoundaryBlock,
  mergeUnlockedBlocks,
} from "./milestone";
import { updateMetaAfterRound } from "./engine";

describe("japanese milestone gates", () => {
  it("maps even blocks to milestones", () => {
    expect(isGateBoundaryBlock(2)).toBe(true);
    expect(isGateBoundaryBlock(3)).toBe(false);
    expect(getMilestoneForBlock(2)).toBe(1);
    expect(getBlocksForMilestone(1)).toEqual([1, 2]);
    expect(getBlockUnlockedByMilestone(1)).toBe(3);
  });

  it("does not auto-unlock past gate boundary blocks", () => {
    const meta = updateMetaAfterRound(
      { roundScores: {}, bestRound5Score: 0, blockMastered: false, unlockedBlocks: [1, 2] },
      2,
      5,
      92,
    );
    expect(meta.blockMastered).toBe(true);
    expect(meta.unlockedBlocks).not.toContain(3);
  });

  it("unlocks odd blocks when milestone gate passed", () => {
    const unlocked = mergeUnlockedBlocks(
      [
        { blockNumber: 1, unlockedBlocks: [1, 2], blockMastered: true },
        { blockNumber: 2, unlockedBlocks: [1, 2], blockMastered: true },
      ],
      [1],
    );
    expect(unlocked).toContain(3);
  });
});