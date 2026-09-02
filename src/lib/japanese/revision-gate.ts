import { JAPANESE_TOTAL_BLOCKS, JAPANESE_WORDS_PER_BLOCK } from "./config";

/** Blocks per revision gate (after block 5, 10, 15…). */
export const JAPANESE_REVISION_GROUP_SIZE = 5;

/** Revision gate index for a completed block (block 5 → gate 1). */
export function getRevisionGateForCompletedBlock(blockNumber: number): number | null {
  if (blockNumber <= 0 || blockNumber % JAPANESE_REVISION_GROUP_SIZE !== 0) return null;
  return blockNumber / JAPANESE_REVISION_GROUP_SIZE;
}

/** First block in the next group unlocked when a revision gate is passed (gate 1 → block 6). */
export function getFirstBlockUnlockedByRevisionGate(gateNumber: number): number {
  return gateNumber * JAPANESE_REVISION_GROUP_SIZE + 1;
}

/** Block numbers whose vocab is tested at this revision gate (gate 1 → blocks 1–5). */
export function getBlocksForRevisionGate(gateNumber: number): number[] {
  const end = gateNumber * JAPANESE_REVISION_GROUP_SIZE;
  return Array.from({ length: end }, (_, i) => i + 1);
}

export function revisionGateWordCount(gateNumber: number): number {
  return getBlocksForRevisionGate(gateNumber).length * JAPANESE_WORDS_PER_BLOCK;
}

export function revisionGateLabel(gateNumber: number): string {
  const blocks = getBlocksForRevisionGate(gateNumber);
  const wordCount = revisionGateWordCount(gateNumber);
  return `Blocks ${blocks[0]}–${blocks[blocks.length - 1]} (${wordCount} words)`;
}

/** Revision gate required before accessing this block (null for blocks 1–5). */
export function getRequiredRevisionGate(blockNumber: number): number | null {
  if (blockNumber <= JAPANESE_REVISION_GROUP_SIZE) return null;
  return Math.floor((blockNumber - 1) / JAPANESE_REVISION_GROUP_SIZE);
}

export function isBlockBehindRevisionGate(
  blockNumber: number,
  revisionGatesPassed: readonly number[],
): boolean {
  const required = getRequiredRevisionGate(blockNumber);
  if (required === null) return false;
  return !revisionGatesPassed.includes(required);
}

export function filterBlocksByRevisionGates(
  blockNumbers: readonly number[],
  revisionGatesPassed: readonly number[],
): number[] {
  return blockNumbers.filter((n) => !isBlockBehindRevisionGate(n, revisionGatesPassed));
}
