import { JAPANESE_TOTAL_BLOCKS } from "./config";

/** Even block numbers (2, 4, 6…) end a pair and trigger a milestone gate. */
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
): number[] {
  const unlocked = new Set<number>([1]);
  for (const row of rows) {
    for (const n of row.unlockedBlocks) unlocked.add(n);
    if (row.blockMastered && row.blockNumber < JAPANESE_TOTAL_BLOCKS) {
      const nextBlock = row.blockNumber + 1;
      if (!isGateBoundaryBlock(row.blockNumber)) {
        unlocked.add(nextBlock);
      }
    }
  }
  for (const milestone of gatesPassed) {
    const block = getBlockUnlockedByMilestone(milestone);
    if (block <= JAPANESE_TOTAL_BLOCKS) unlocked.add(block);
  }
  return [...unlocked].sort((x, y) => x - y);
}