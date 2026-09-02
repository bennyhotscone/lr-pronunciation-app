import type { JapaneseWord } from "../types";
import {
  JAPANESE_TEST_WORD_INDICES,
  JAPANESE_TEST_WORD_LIMIT,
  JAPANESE_TOTAL_BLOCKS,
} from "../config";
import block1 from "./block1.json";
import block2 from "./block2.json";
import block3 from "./block3.json";
import block4 from "./block4.json";
import block5 from "./block5.json";
import block6 from "./block6.json";
import block7 from "./block7.json";
import block8 from "./block8.json";
import block9 from "./block9.json";
import block10 from "./block10.json";

/** Blocks with full Japanese learning content (JSON). */
const BLOCKS: Record<number, JapaneseWord[]> = {
  1: block1 as JapaneseWord[],
  2: block2 as JapaneseWord[],
  3: block3 as JapaneseWord[],
  4: block4 as JapaneseWord[],
  5: block5 as JapaneseWord[],
  6: block6 as JapaneseWord[],
  7: block7 as JapaneseWord[],
  8: block8 as JapaneseWord[],
  9: block9 as JapaneseWord[],
  10: block10 as JapaneseWord[],
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