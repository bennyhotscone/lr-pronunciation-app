import type { JapaneseWord } from "../types";
import {
  JAPANESE_TEST_WORD_INDICES,
  JAPANESE_TEST_WORD_LIMIT,
  JAPANESE_TOTAL_BLOCKS,
} from "../config";
import block1 from "./block1.json";
import block2 from "./block2.json";
import block3 from "./block3.json";

/** Blocks with full Japanese learning content (JSON). Blocks 4-100 are scaffolded. */
const BLOCKS: Record<number, JapaneseWord[]> = {
  1: block1 as JapaneseWord[],
  2: block2 as JapaneseWord[],
  3: block3 as JapaneseWord[],
};

export function isPlayableJapaneseBlock(blockNumber: number): boolean {
  return blockNumber in BLOCKS && BLOCKS[blockNumber].length > 0;
}

export function getJapaneseBlock(blockNumber: number): JapaneseWord[] {
  const words = BLOCKS[blockNumber];
  if (!words) {
    throw new Error(
      `Japanese block ${blockNumber} has no content yet (curriculum slot only)`,
    );
  }

  if (JAPANESE_TEST_WORD_LIMIT !== null) {
    return words.slice(0, JAPANESE_TEST_WORD_LIMIT);
  }

  return words;
}

/** QA-only: curated subset including shiru (18) and suki (33) in block 1. */
export function getJapaneseTestBlock(blockNumber: number): JapaneseWord[] {
  const words = BLOCKS[blockNumber];
  if (!words) throw new Error(`Japanese block ${blockNumber} not loaded`);
  return JAPANESE_TEST_WORD_INDICES.map((i) => words[i]).filter(Boolean);
}

/** Block numbers that have playable JSON content. */
export function getPlayableBlockNumbers(): number[] {
  return Object.keys(BLOCKS)
    .map(Number)
    .filter((n) => isPlayableJapaneseBlock(n))
    .sort((a, b) => a - b);
}

/** All curriculum block slots (1-100), including future content. */
export function getAvailableBlockNumbers(): number[] {
  return Array.from({ length: JAPANESE_TOTAL_BLOCKS }, (_, i) => i + 1);
}