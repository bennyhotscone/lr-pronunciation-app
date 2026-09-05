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
import { getBlocksForRevisionGate } from "../revision-gate";
import { getRevisionSentencesForGate } from "../revision-sentences";
import {
  matchAcceptedSentenceAnswers,
  matchRevisionSentence,
} from "../revision-sentence-match";

describe("japanese block curriculum", () => {
  it("defines 50 words per block across 100 blocks", () => {
    expect(JAPANESE_WORDS_PER_BLOCK).toBe(50);
    expect(JAPANESE_TOTAL_BLOCKS).toBe(100);
    expect(getAvailableBlockNumbers().length).toBe(100);
  });

  it("loads playable blocks 1–20 with 50 words each", () => {
    const playable = getPlayableBlockNumbers();
    expect(playable).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
    for (const n of playable) {
      expect(getJapaneseBlock(n).length).toBe(50);
      expect(isPlayableJapaneseBlock(n)).toBe(true);
    }
    expect(isPlayableJapaneseBlock(21)).toBe(false);
  });

  it("blocks 6–20 start at audited #251 and end at #1000", () => {
    expect(getJapaneseBlock(6)[0].r).toBe("ore");
    expect(getJapaneseBlock(6)[0].globalRank).toBe(251);
    expect(getJapaneseBlock(20)[49].r).toBe("kayou");
    expect(getJapaneseBlock(20)[49].globalRank).toBe(1000);
  });

  it("blocks 5–20 have mnemonics on every word", () => {
    for (const n of [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
      const missing = getJapaneseBlock(n).filter((w) => !w.m?.trim());
      expect(missing.map((w) => w.r)).toEqual([]);
    }
  });

  it("revision gates cover exactly 250 unique words", () => {
    for (const gate of [1, 2, 3, 4]) {
      const blocks = getBlocksForRevisionGate(gate);
      expect(blocks.length).toBe(5);
      const ids = new Set<string>();
      for (const b of blocks) {
        getJapaneseBlock(b).forEach((w, i) => {
          ids.add(w.id ?? `b${b}-i${i}`);
        });
      }
      expect(ids.size).toBe(250);
    }
  });

  it("revision sentences load for gates 1–4", () => {
    for (const gate of [1, 2, 3, 4]) {
      const sentences = getRevisionSentencesForGate(gate);
      expect(sentences.length).toBeGreaterThanOrEqual(8);
      for (const s of sentences) {
        expect(s.preferredAnswer.length).toBeGreaterThan(0);
        expect(s.tiles.length).toBeGreaterThanOrEqual(s.preferredAnswer.length);
      }
    }
  });

  it("accepts natural and caveman sentence answers", () => {
    const preferred = ["gakkou", "ni", "iku"];
    const accepted = [["gakkou", "iku"]];
    expect(matchAcceptedSentenceAnswers("gakkou ni iku", preferred, accepted).ok).toBe(true);
    expect(matchAcceptedSentenceAnswers("gakkou iku", preferred, accepted).preferred).toBe(false);
    expect(matchAcceptedSentenceAnswers("gakkou iku", preferred, accepted).caveman).toBe(true);
    expect(matchAcceptedSentenceAnswers("gakkou ni iku", preferred, accepted).preferred).toBe(true);
    expect(matchRevisionSentence("watashi wa mizu o nomu", ["watashi", "mizu", "nomu"])).toBe(
      true,
    );
  });

  it("slices spoken-English frequency ranks for block 1 and 2", () => {
    expect(getFrequencyRankRangeForBlock(1)).toEqual({ start: 1, end: 50 });
    expect(getFrequencyRankRangeForBlock(2)).toEqual({ start: 51, end: 100 });
    expect(getFrequencyWordsForBlock(1).length).toBe(50);
    expect(getBlockCurriculumLabel(1)).toBe("Ranks 1-50");
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
});
