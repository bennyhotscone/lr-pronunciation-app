import { describe, expect, it } from "vitest";
import {
  JAPANESE_TOTAL_BLOCKS,
  JAPANESE_WORDS_PER_BLOCK,
} from "../config";
import {
  getAvailableBlockNumbers,
  getJapaneseBlock,
  getPlayableBlockNumbers,
  isPlayableJapaneseBlock,
} from "./index";
import {
  getBlockCurriculumLabel,
  getFrequencyRankRangeForBlock,
  getFrequencyWordsForBlock,
} from "./frequency";
import { updateMetaAfterRound } from "../engine";

describe("japanese block curriculum", () => {
  it("defines 50 words per block across 100 blocks", () => {
    expect(JAPANESE_WORDS_PER_BLOCK).toBe(50);
    expect(JAPANESE_TOTAL_BLOCKS).toBe(100);
    expect(getAvailableBlockNumbers().length).toBe(100);
  });

  it("slices spoken-English frequency ranks for block 1 and 2", () => {
    expect(getFrequencyRankRangeForBlock(1)).toEqual({ start: 1, end: 50 });
    expect(getFrequencyRankRangeForBlock(2)).toEqual({ start: 51, end: 100 });
    expect(getFrequencyWordsForBlock(1).length).toBe(50);
    expect(getFrequencyWordsForBlock(1).slice(0, 5)).toEqual([
      "you",
      "i",
      "be",
      "the",
      "to",
    ]);
    expect(getBlockCurriculumLabel(1)).toBe("Ranks 1-50");
  });

  it("loads playable blocks with 50 words each", () => {
    const playable = getPlayableBlockNumbers();
    expect(playable).toEqual([1, 2, 3, 4]);
    expect(getJapaneseBlock(1).length).toBe(50);
    expect(getJapaneseBlock(2).length).toBe(50);
    expect(getJapaneseBlock(3).length).toBe(50);
    expect(getJapaneseBlock(4).length).toBe(50);
    expect(isPlayableJapaneseBlock(3)).toBe(true);
    expect(isPlayableJapaneseBlock(4)).toBe(true);
    expect(isPlayableJapaneseBlock(5)).toBe(false);
  });

  it("slices spoken-English frequency ranks for block 3", () => {
    expect(getFrequencyRankRangeForBlock(3)).toEqual({ start: 101, end: 150 });
    expect(getFrequencyWordsForBlock(3).length).toBe(50);
    expect(getFrequencyWordsForBlock(3).slice(0, 5)).toEqual([
      "too",
      "never",
      "by",
      "person",
      "over",
    ]);
    expect(getBlockCurriculumLabel(3)).toBe("Ranks 101-150");
  });

  it("unlocks the next block after mastery", () => {
    const meta = updateMetaAfterRound(
      { roundScores: {}, bestRound5Score: 0, blockMastered: false, unlockedBlocks: [1] },
      1,
      5,
      92,
    );
    expect(meta.blockMastered).toBe(true);
    expect(meta.unlockedBlocks).toContain(2);
  });

  it("unlocks block 3 after block 2 mastery without gate", () => {
    const meta = updateMetaAfterRound(
      { roundScores: {}, bestRound5Score: 0, blockMastered: false, unlockedBlocks: [1, 2] },
      2,
      5,
      92,
    );
    expect(meta.blockMastered).toBe(true);
    expect(meta.unlockedBlocks).toContain(3);
  });

  it("unlocks block 4 after block 3 mastery without revision gate", () => {
    const meta = updateMetaAfterRound(
      { roundScores: {}, bestRound5Score: 0, blockMastered: false, unlockedBlocks: [1, 2, 3] },
      3,
      5,
      92,
    );
    expect(meta.blockMastered).toBe(true);
    expect(meta.unlockedBlocks).toContain(4);
  });

  it("slices spoken-English frequency ranks for block 4", () => {
    expect(getFrequencyRankRangeForBlock(4)).toEqual({ start: 151, end: 200 });
    expect(getFrequencyWordsForBlock(4).length).toBe(50);
    expect(getFrequencyWordsForBlock(4).slice(0, 5)).toEqual([
      "again",
      "still",
      "home",
      "kid",
      "girl",
    ]);
    expect(getFrequencyWordsForBlock(4).slice(-5)).toEqual([
      "bring",
      "remember",
      "live",
      "father",
      "hold",
    ]);
    expect(getBlockCurriculumLabel(4)).toBe("Ranks 151-200");
  });
});
