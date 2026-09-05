import {
  getJapaneseBlock,
  getJapaneseWordId,
  isPlayableJapaneseBlock,
} from "./blocks";
import { JAPANESE_REVISION_MIN_QUESTIONS } from "./config";
import { getBlocksForRevisionGate } from "./revision-gate";
import { formatPreferredRomaji } from "./revision-sentence-match";
import { getRevisionSentencesForGate } from "./revision-sentences";
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
};

export type RevisionQuestion = RevisionWordQuestion | RevisionSentenceQuestion;

type RevisionWordRef = {
  blockNumber: number;
  wordIndex: number;
  word: JapaneseWord;
};

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

function shuffle<T>(items: T[]): T[] {
  const x = [...items];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

function buildSentenceQuestions(gateNumber: number): RevisionSentenceQuestion[] {
  const templates = getRevisionSentencesForGate(gateNumber);
  return templates.map((sentence) => {
    const tiles = shuffle([...sentence.tiles]);
    return {
      kind: "sentence" as const,
      id: sentence.id,
      promptEnglish: sentence.english,
      tiles,
      preferredAnswer: [...sentence.preferredAnswer],
      acceptedAnswers: sentence.acceptedAnswers.map((a) => [...a]),
      canonicalRomaji: formatPreferredRomaji(sentence.preferredAnswer),
      requiredWords: [...sentence.words],
      wordBank: tiles,
    };
  });
}

function buildWordQuestion(
  ref: RevisionWordRef,
  mode: RevisionWordQuestion["mode"],
  idSuffix = "",
): RevisionWordQuestion {
  const { blockNumber, wordIndex, word } = ref;
  return {
    kind: "word",
    id: `${blockNumber}-${wordIndex}${idSuffix}`,
    wordId: getJapaneseWordId(blockNumber, wordIndex, word),
    blockNumber,
    wordIndex,
    mode,
    prompt: mode === "type-english" ? word.r : word.en,
    romaji: word.r,
    english: word.en,
    mnemonic: word.m,
    audio: word.audio || word.jp,
  };
}

export function buildRevisionQuestions(gateNumber: number): {
  questions: RevisionQuestion[];
  sampleSize: number;
  coverageWordIds: string[];
} {
  const pool = collectRevisionWords(gateNumber);
  // ALWAYS test every word in the gate at least once (full 250 coverage).
  const sampled = shuffle(pool);
  const coverageWordIds = sampled.map(({ blockNumber, wordIndex, word }) =>
    getJapaneseWordId(blockNumber, wordIndex, word),
  );

  const wordQuestions: RevisionWordQuestion[] = sampled.map((ref, i) =>
    buildWordQuestion(ref, i % 3 === 0 ? "type-english" : "type-romaji"),
  );

  const sentenceQuestions = buildSentenceQuestions(gateNumber);
  let questions: RevisionQuestion[] = [...wordQuestions, ...sentenceQuestions];

  // Pad with alternate-mode extras until we hit the minimum question floor (≥350).
  if (questions.length < JAPANESE_REVISION_MIN_QUESTIONS) {
    const extras: RevisionWordQuestion[] = [];
    let i = 0;
    while (
      wordQuestions.length + sentenceQuestions.length + extras.length <
        JAPANESE_REVISION_MIN_QUESTIONS &&
      i < sampled.length * 3
    ) {
      const ref = sampled[i % sampled.length];
      const primary = wordQuestions[i % wordQuestions.length];
      const altMode: RevisionWordQuestion["mode"] =
        primary.mode === "type-english" ? "type-romaji" : "type-english";
      extras.push(buildWordQuestion(ref, altMode, `-x${extras.length}`));
      i += 1;
    }
    questions = [...wordQuestions, ...shuffle(extras), ...sentenceQuestions];
  }

  return {
    questions,
    sampleSize: wordQuestions.length,
    coverageWordIds,
  };
}

export function getRevisionQuestionCountsForGate(gateNumber: number): {
  poolSize: number;
  questionTotal: number;
  wordCoverage: number;
  sentenceCount: number;
} {
  const built = buildRevisionQuestions(gateNumber);
  return {
    poolSize: collectRevisionWords(gateNumber).length,
    questionTotal: built.questions.length,
    wordCoverage: built.coverageWordIds.length,
    sentenceCount: built.questions.filter((q) => q.kind === "sentence").length,
  };
}
