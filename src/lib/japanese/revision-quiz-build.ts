import {
  getJapaneseBlock,
  getJapaneseWordId,
  isPlayableJapaneseBlock,
} from "./blocks";
import { getBlocksForRevisionGate } from "./revision-gate";
import { formatPreferredRomaji } from "./revision-sentence-match";
import batchBank from "./revision-sentence-batches.json";
import type { JapaneseWord } from "./types";

export type RevisionWordQuestion = {
  kind: "word";
  id: string;
  wordId: string;
  blockNumber: number;
  wordIndex: number;
  mode: "type-english" | "type-romaji";
  prompt: string;
  romaji: string;
  english: string;
  mnemonic: string;
  audio: string;
  /** 1 = first pass (reveal mnemonic allowed); 2 = second pass */
  round: 1 | 2;
  /** Round-2 batch id (sentence follows every 5 words in the batch). */
  batchId?: string;
};

export type RevisionSentenceQuestion = {
  kind: "sentence";
  id: string;
  promptEnglish: string;
  tiles: string[];
  preferredAnswer: string[];
  acceptedAnswers: string[][];
  canonicalRomaji: string;
  requiredWords: string[];
  wordBank: string[];
  round: 2;
  batchId: string;
  /** The five word ids this sentence drills. */
  batchWordIds: string[];
};

export type RevisionQuestion = RevisionWordQuestion | RevisionSentenceQuestion;

type RevisionWordRef = {
  blockNumber: number;
  wordIndex: number;
  word: JapaneseWord;
};

type BatchTemplate = {
  id: string;
  blockNumber: number;
  wordIndices: number[];
  wordRomaji: string[];
  english: string;
  preferredAnswer: string[];
  acceptedAnswers: string[][];
  tiles: string[];
};

function shuffle<T>(items: T[]): T[] {
  const x = [...items];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

export function collectRevisionWords(gateNumber: number): RevisionWordRef[] {
  const out: RevisionWordRef[] = [];
  for (const blockNumber of getBlocksForRevisionGate(gateNumber)) {
    if (!isPlayableJapaneseBlock(blockNumber)) continue;
    const block = getJapaneseBlock(blockNumber);
    block.forEach((word, wordIndex) => {
      out.push({ blockNumber, wordIndex, word });
    });
  }
  return out;
}

function buildWordQuestion(
  ref: RevisionWordRef,
  mode: RevisionWordQuestion["mode"],
  round: 1 | 2,
  opts?: { idSuffix?: string; batchId?: string },
): RevisionWordQuestion {
  const { blockNumber, wordIndex, word } = ref;
  return {
    kind: "word",
    id: `${round}-${blockNumber}-${wordIndex}${opts?.idSuffix ?? ""}`,
    wordId: getJapaneseWordId(blockNumber, wordIndex, word),
    blockNumber,
    wordIndex,
    mode,
    prompt: mode === "type-english" ? word.r : word.en,
    romaji: word.r,
    english: word.en,
    mnemonic: word.m,
    audio: word.audio || word.jp,
    round,
    batchId: opts?.batchId,
  };
}

function batchesForGate(gateNumber: number): BatchTemplate[] {
  const raw = (batchBank as Record<string, BatchTemplate[]>)[String(gateNumber)] ?? [];
  return raw;
}

/**
 * Two-round revision:
 * Round 1 — all 250 words (shuffled), reveal-mnemonic allowed.
 * Round 2 — same words in curated batches of 5; after each batch, a sentence using those words.
 */
export function buildRevisionQuestions(gateNumber: number): {
  questions: RevisionQuestion[];
  sampleSize: number;
  coverageWordIds: string[];
  round1Count: number;
  round2Count: number;
} {
  const pool = collectRevisionWords(gateNumber);
  const byKey = new Map<string, RevisionWordRef>(
    pool.map((ref) => [`${ref.blockNumber}:${ref.wordIndex}`, ref]),
  );

  const coverageWordIds = pool.map(({ blockNumber, wordIndex, word }) =>
    getJapaneseWordId(blockNumber, wordIndex, word),
  );

  // Round 1: shuffle all words once
  const round1Refs = shuffle([...pool]);
  const round1: RevisionWordQuestion[] = round1Refs.map((ref, i) =>
    buildWordQuestion(ref, i % 3 === 0 ? "type-english" : "type-romaji", 1),
  );

  // Round 2: curated batches of 5 in curriculum order, sentence after each batch
  const round2: RevisionQuestion[] = [];
  const batches = batchesForGate(gateNumber);
  const used = new Set<string>();

  for (const batch of batches) {
    const refs: RevisionWordRef[] = [];
    for (const idx of batch.wordIndices) {
      const key = `${batch.blockNumber}:${idx}`;
      const ref = byKey.get(key);
      if (ref) {
        refs.push(ref);
        used.add(key);
      }
    }
    if (refs.length < 5) continue;

    const batchWordIds = refs.map((r) =>
      getJapaneseWordId(r.blockNumber, r.wordIndex, r.word),
    );

    refs.forEach((ref, i) => {
      round2.push(
        buildWordQuestion(ref, i % 2 === 0 ? "type-romaji" : "type-english", 2, {
          batchId: batch.id,
        }),
      );
    });

    const tiles = shuffle([...batch.tiles]);
    round2.push({
      kind: "sentence",
      id: batch.id,
      promptEnglish: batch.english,
      tiles,
      preferredAnswer: [...batch.preferredAnswer],
      acceptedAnswers: batch.acceptedAnswers.map((a) => [...a]),
      canonicalRomaji: formatPreferredRomaji(batch.preferredAnswer),
      requiredWords: [...batch.wordRomaji],
      wordBank: tiles,
      round: 2,
      batchId: batch.id,
      batchWordIds,
    });
  }

  // Any words not covered by batches (shouldn't happen) go at end of round 2
  for (const ref of pool) {
    const key = `${ref.blockNumber}:${ref.wordIndex}`;
    if (used.has(key)) continue;
    round2.push(buildWordQuestion(ref, "type-romaji", 2));
  }

  const questions: RevisionQuestion[] = [...round1, ...round2];

  return {
    questions,
    sampleSize: pool.length,
    coverageWordIds,
    round1Count: round1.length,
    round2Count: round2.length,
  };
}

export function getRevisionQuestionCountsForGate(gateNumber: number) {
  const built = buildRevisionQuestions(gateNumber);
  return {
    poolSize: collectRevisionWords(gateNumber).length,
    questionTotal: built.questions.length,
    wordCoverage: built.coverageWordIds.length,
    sentenceCount: built.questions.filter((q) => q.kind === "sentence").length,
    round1Count: built.round1Count,
    round2Count: built.round2Count,
  };
}
