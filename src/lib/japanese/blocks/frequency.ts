import frequencyWords from "@/data/spoken-english-frequency-5000.json";
import {
  JAPANESE_CURRICULUM_WORD_COUNT,
  JAPANESE_TOTAL_BLOCKS,
  JAPANESE_WORDS_PER_BLOCK,
} from "../config";

export function getFrequencyRankRangeForBlock(blockNumber: number): {
  start: number;
  end: number;
} {
  if (blockNumber < 1 || blockNumber > JAPANESE_TOTAL_BLOCKS) {
    return { start: 0, end: 0 };
  }
  const start = (blockNumber - 1) * JAPANESE_WORDS_PER_BLOCK + 1;
  const listEnd =
    (blockNumber - 1) * JAPANESE_WORDS_PER_BLOCK + JAPANESE_WORDS_PER_BLOCK;
  const end = Math.min(
    listEnd,
    frequencyWords.length,
    JAPANESE_CURRICULUM_WORD_COUNT,
  );
  return { start, end };
}

export function getFrequencyWordsForBlock(blockNumber: number): string[] {
  if (blockNumber < 1 || blockNumber > JAPANESE_TOTAL_BLOCKS) return [];
  const start = (blockNumber - 1) * JAPANESE_WORDS_PER_BLOCK;
  const end = start + JAPANESE_WORDS_PER_BLOCK;
  return frequencyWords.slice(start, end).map((word) => String(word));
}

export function getBlockCurriculumLabel(blockNumber: number): string {
  const { start, end } = getFrequencyRankRangeForBlock(blockNumber);
  if (start === 0) return `Block ${blockNumber}`;
  return `Ranks ${start}-${end}`;
}
