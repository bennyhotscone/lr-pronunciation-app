import { JAPANESE_TOTAL_BLOCKS } from "./config";
import {
  getFirstBlockUnlockedByRevisionGate,
  isBlockBehindRevisionGate,
} from "./revision-gate";

/** Even block numbers (2, 4, 6…) end a pair and offer optional milestone practice. */
export function isGateBoundaryBlock(blockNumber: number): boolean {
  return blockNumber > 0 && blockNumber % 2 === 0;
}

/** Milestone index for a completed even block (block 2 → 1, block 4 → 2). */
export function getMilestoneForBlock(blockNumber: number): number | null {
  if (!isGateBoundaryBlock(blockNumber)) return null;
  return blockNumber / 2;
}

/** Block numbers whose vocab feeds this milestone (e.g. milestone 1 → [1, 2]). */
export function getBlocksForMilestone(milestoneNumber: number): [number, number] {
  const first = milestoneNumber * 2 - 1;
  return [first, first + 1];
}

/** Odd block unlocked when a milestone gate is passed (milestone 1 → block 3). */
export function getBlockUnlockedByMilestone(milestoneNumber: number): number {
  return milestoneNumber * 2 + 1;
}

export function milestoneLabel(milestoneNumber: number): string {
  const [a, b] = getBlocksForMilestone(milestoneNumber);
  return `Blocks ${a}–${b}`;
}

export function mergeUnlockedBlocks(
  rows: Array<{ blockNumber: number; unlockedBlocks: number[]; blockMastered: boolean }>,
  gatesPassed: number[],
  revisionGatesPassed: number[] = [],
): number[] {
  const unlocked = new Set<number>([1]);
  for (const row of rows) {
    for (const n of row.unlockedBlocks) unlocked.add(n);
    if (row.blockMastered && row.blockNumber < JAPANESE_TOTAL_BLOCKS) {
      const next = row.blockNumber + 1;
      if (!isBlockBehindRevisionGate(next, revisionGatesPassed)) {
        unlocked.add(next);
      }
    }
  }
  for (const milestone of gatesPassed) {
    const block = getBlockUnlockedByMilestone(milestone);
    if (block <= JAPANESE_TOTAL_BLOCKS && !isBlockBehindRevisionGate(block, revisionGatesPassed)) {
      unlocked.add(block);
    }
  }
  for (const gate of revisionGatesPassed) {
    const first = getFirstBlockUnlockedByRevisionGate(gate);
    if (first <= JAPANESE_TOTAL_BLOCKS) unlocked.add(first);
  }
  return [...unlocked]
    .filter((n) => !isBlockBehindRevisionGate(n, revisionGatesPassed))
    .sort((x, y) => x - y);
}
