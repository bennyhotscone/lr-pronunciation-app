import { describe, expect, it } from "vitest";
import {
  buildLearnQueue,
  buildReviewQueue,
  decodeExternalReview,
  encodeExternalReview,
  earliestPriorHeadwordBlock,
  isPriorTaughtHeadword,
  learnSkipIndices,
  priorLearningFromArrays,
  priorSameHeadwords,
  reviewBadgeLabel,
} from "./round-queue";
import { catalogEntriesForBlock } from "./blocks/catalog";

describe("round-queue skip / review", () => {
  it("tolerates missing priorLearning payload from older server actions", () => {
    expect(priorLearningFromArrays(undefined).knownKeys.size).toBe(0);
    expect(priorLearningFromArrays(null).seenKeys.size).toBe(0);
    expect(priorLearningFromArrays({}).masteredBlocks.size).toBe(0);
  });

  it("finds earlier mada headwords for later blocks", () => {
    const block4 = catalogEntriesForBlock(4);
    const mada = block4.find((e) => e.romajiKey === "mada");
    expect(mada).toBeTruthy();
    const prior = priorSameHeadwords(4, mada!.wordIndex);
    expect(prior.map((p) => p.blockNumber)).toContain(2);
    expect(earliestPriorHeadwordBlock(4, mada!.wordIndex)).toBe(2);
  });

  it("skips known and prior-taught headwords from learn queues", () => {
    const block4 = catalogEntriesForBlock(4);
    const mada = block4.find((e) => e.romajiKey === "mada")!;
    const learning = priorLearningFromArrays({
      knownKeys: [`2:${mada.wordIndex}`],
      seenKeys: [`2:${mada.wordIndex}`],
      masteredBlocks: [2],
    });
    // Use the real prior entry's word index from block 2.
    const prior = priorSameHeadwords(4, mada.wordIndex)[0];
    const learningReal = priorLearningFromArrays({
      knownKeys: [`${prior.blockNumber}:${prior.wordIndex}`],
      seenKeys: [`${prior.blockNumber}:${prior.wordIndex}`],
      masteredBlocks: [2],
    });
    expect(isPriorTaughtHeadword(4, mada.wordIndex, learningReal)).toBe(true);
    const skip = learnSkipIndices(4, 50, [], learningReal);
    expect(skip).toContain(mada.wordIndex);
    expect(buildLearnQueue(50, skip)).not.toContain(mada.wordIndex);
  });

  it("does not treat romaji-clash different words as already taught", () => {
    const blockEntries = catalogEntriesForBlock(1);
    const sanClash = blockEntries.find((e) => e.romajiKey === "san" && e.romajiClash);
    if (!sanClash) return;
    const learning = priorLearningFromArrays({
      masteredBlocks: [1],
      knownKeys: [],
      seenKeys: [],
    });
    // A later-block clash with different meaning should not auto-skip unless same headword.
    const laterSan = catalogEntriesForBlock(5).find(
      (e) => e.romajiKey === "san" && e.englishKey !== sanClash.englishKey,
    );
    if (!laterSan) return;
    // masteredBlocks alone should not skip a clash with a different meaning/writing.
    const prior = priorSameHeadwords(laterSan.blockNumber, laterSan.wordIndex);
    const sameMeaning = prior.some(
      (p) => p.englishKey === laterSan.englishKey && p.word.jp === laterSan.word.jp,
    );
    if (!sameMeaning) {
      expect(isPriorTaughtHeadword(laterSan.blockNumber, laterSan.wordIndex, learning)).toBe(
        false,
      );
    }
  });

  it("builds R4/R5 review queue with capped prior items and a clear label", () => {
    const block4 = catalogEntriesForBlock(4);
    const mada = block4.find((e) => e.romajiKey === "mada")!;
    const prior = priorSameHeadwords(4, mada.wordIndex)[0];
    const learning = priorLearningFromArrays({
      knownKeys: [`${prior.blockNumber}:${prior.wordIndex}`],
      seenKeys: [`${prior.blockNumber}:${prior.wordIndex}`],
      masteredBlocks: [2],
    });
    const skip = learnSkipIndices(4, 50, [0, 1, 2], learning);
    const queue = buildReviewQueue(4, 50, skip, learning, 8);
    expect(queue).toContain(mada.wordIndex);
    expect(queue.filter((id) => skip.includes(id) || id >= 10_000).length).toBeLessThanOrEqual(8);
    expect(reviewBadgeLabel(2)).toBe("Review · Block 2");
  });

  it("encodes and decodes external review order ids", () => {
    const id = encodeExternalReview(3, 12);
    expect(decodeExternalReview(id)).toEqual({ blockNumber: 3, wordIndex: 12 });
    expect(decodeExternalReview(7)).toBeNull();
  });
});
