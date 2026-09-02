import { describe, expect, it } from "vitest";
import {
  getBlockUnlockedByMilestone,
  getBlocksForMilestone,
  getMilestoneForBlock,
  isGateBoundaryBlock,
  mergeUnlockedBlocks,
} from "./milestone";
import { updateMetaAfterRound, createInitialBlockMeta } from "./engine";

describe("milestone gates", () => {
  it("treats even blocks as gate boundaries", () => {
    expect(isGateBoundaryBlock(2)).toBe(true);
    expect(isGateBoundaryBlock(4)).toBe(true);
    expect(isGateBoundaryBlock(1)).toBe(false);
    expect(isGateBoundaryBlock(3)).toBe(false);
  });

  it("maps completed even blocks to milestone numbers", () => {
    expect(getMilestoneForBlock(2)).toBe(1);
    expect(getMilestoneForBlock(4)).toBe(2);
    expect(getMilestoneForBlock(3)).toBeNull();
  });

  it("pairs blocks for each milestone", () => {
    expect(getBlocksForMilestone(1)).toEqual([1, 2]);
    expect(getBlocksForMilestone(2)).toEqual([3, 4]);
  });

  it("unlocks the next odd block after a passed gate", () => {
    expect(getBlockUnlockedByMilestone(1)).toBe(3);
    expect(getBlockUnlockedByMilestone(2)).toBe(5);
  });

  it("auto-unlocks block 3 when block 2 is mastered without gate pass", () => {
    const rows = [
      { blockNumber: 1, unlockedBlocks: [1, 2], blockMastered: true },
      { blockNumber: 2, unlockedBlocks: [1, 2], blockMastered: true },
    ];
    expect(mergeUnlockedBlocks(rows, [])).toEqual([1, 2, 3]);
    expect(mergeUnlockedBlocks(rows, [1])).toEqual([1, 2, 3]);
  });

  it("unlocks next block when mastering an even block", () => {
    let meta = createInitialBlockMeta();
    meta = updateMetaAfterRound(meta, 2, 5, 95);
    expect(meta.blockMastered).toBe(true);
    expect(meta.unlockedBlocks).toContain(3);
  });
});
