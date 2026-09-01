import type { JapaneseWord } from "../types";
import {
  JAPANESE_TEST_WORD_INDICES,
  JAPANESE_TEST_WORD_LIMIT,
} from "../config";
import block1 from "./block1.json";

const BLOCKS: Record<number, JapaneseWord[]> = {
  1: block1 as JapaneseWord[],
};

export function getJapaneseBlock(blockNumber: number): JapaneseWord[] {
  const words = BLOCKS[blockNumber];
  if (!words) throw new Error(`Japanese block ${blockNumber} not loaded`);

  if (JAPANESE_TEST_WORD_LIMIT !== null) {
    return words.slice(0, JAPANESE_TEST_WORD_LIMIT);
  }

  return words;
}

/** QA-only: curated subset including shiru (18) and suki (33). */
export function getJapaneseTestBlock(blockNumber: number): JapaneseWord[] {
  const words = BLOCKS[blockNumber];
  if (!words) throw new Error(`Japanese block ${blockNumber} not loaded`);
  return JAPANESE_TEST_WORD_INDICES.map((i) => words[i]).filter(Boolean);
}

export function getAvailableBlockNumbers(): number[] {
  return Object.keys(BLOCKS)
    .map(Number)
    .sort((a, b) => a - b);
}
