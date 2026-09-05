"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getJapaneseBlock,
  getJapaneseWordId,
  isPlayableJapaneseBlock,
} from "@/lib/japanese/blocks";
import {
  JAPANESE_REVISION_PASS_THRESHOLD,
  JAPANESE_REVISION_WORD_SAMPLE,
} from "@/lib/japanese/config";
import { fuzzyMatchEnglish, fuzzyMatchRomaji } from "@/lib/japanese/matching";
import {
  getBlocksForRevisionGate,
  getFirstBlockUnlockedByRevisionGate,
  isLiveRevisionGate,
  revisionGateLabel,
  revisionGateWordCount,
} from "@/lib/japanese/revision-gate";
import {
  formatPreferredRomaji,
  matchAcceptedSentenceAnswers,
} from "@/lib/japanese/revision-sentence-match";
import { getRevisionSentencesForGate } from "@/lib/japanese/revision-sentences";
import type { JapaneseWord } from "@/lib/japanese/types";
import { isStaff } from "@/lib/portal-access";
import { isPrismaSchemaMissingError } from "@/lib/prisma-errors";
import { revalidatePath } from "next/cache";

const LEARN_PATH = "/portal/learn-japanese";

async function requireJapaneseLearner() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role === "STUDENT" || isStaff(session.user.role)) return session;
  return null;
}

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
  /** @deprecated content words for legacy matchers */
  requiredWords: string[];
  wordBank: string[];
};

export type RevisionQuestion = RevisionWordQuestion | RevisionSentenceQuestion;

export type RevisionGatePayload = {
  gateNumber: number;
  label: string;
  /** Full vocabulary pool for this gate (e.g. 250). */
  wordCount: number;
  /** How many unique word questions are in this quiz (should equal wordCount for full coverage). */
  sampleSize: number;
  /** All vocab ids that must be covered before completion. */
  coverageWordIds: string[];
  unlocksBlock: number;
  passed: boolean;
  attempts: number;
  threshold: number;
  questions: RevisionQuestion[];
};

type RevisionWordRef = {
  blockNumber: number;
  wordIndex: number;
  word: JapaneseWord;
};

function collectRevisionWords(gateNumber: number): RevisionWordRef[] {
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

function buildRevisionQuestions(gateNumber: number): {
  questions: RevisionQuestion[];
  sampleSize: number;
  coverageWordIds: string[];
} {
  const pool = collectRevisionWords(gateNumber);
  const take =
    JAPANESE_REVISION_WORD_SAMPLE == null
      ? pool.length
      : Math.min(JAPANESE_REVISION_WORD_SAMPLE, pool.length);
  // Full coverage: every word once (shuffled). Sample mode still shuffles subset.
  const sampled = shuffle(pool).slice(0, take);
  const coverageWordIds = sampled.map(({ blockNumber, wordIndex, word }) =>
    getJapaneseWordId(blockNumber, wordIndex, word),
  );
  const wordQuestions: RevisionWordQuestion[] = sampled.map(
    ({ blockNumber, wordIndex, word }, i) => {
      const mode: RevisionWordQuestion["mode"] = i % 3 === 0 ? "type-english" : "type-romaji";
      return {
        kind: "word" as const,
        id: `${blockNumber}-${wordIndex}`,
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
    },
  );
  return {
    questions: [...wordQuestions, ...buildSentenceQuestions(gateNumber)],
    sampleSize: wordQuestions.length,
    coverageWordIds,
  };
}

export async function loadRevisionGatesPassed(userId: string): Promise<number[]> {
  try {
    const rows = await prisma.japaneseRevisionProgress.findMany({
      where: { userId, passed: true, gateNumber: { lt: 900 } },
      select: { gateNumber: true },
    });
    return rows.map((r) => r.gateNumber).sort((a, b) => a - b);
  } catch (err) {
    if (isPrismaSchemaMissingError(err)) {
      console.warn("[loadRevisionGatesPassed] JapaneseRevisionProgress table missing");
      return [];
    }
    throw err;
  }
}

export async function loadRevisionGate(
  gateNumber: number,
): Promise<{ error: string } | RevisionGatePayload> {
  try {
    const session = await requireJapaneseLearner();
    if (!session) return { error: "Unauthorized" };

    const userId = session.user.id;
    if (!isLiveRevisionGate(gateNumber)) {
      return { error: "This revision gate is not enabled." };
    }
    const { questions, sampleSize, coverageWordIds } = buildRevisionQuestions(gateNumber);
    if (!questions.length) {
      return { error: "No vocabulary loaded for this revision gate." };
    }

    let progress: { passed: boolean; attempts: number } | null = null;
    try {
      progress = await prisma.japaneseRevisionProgress.findUnique({
        where: { userId_gateNumber: { userId, gateNumber } },
        select: { passed: true, attempts: true },
      });
    } catch (err) {
      if (isPrismaSchemaMissingError(err)) {
        console.warn(
          "[loadRevisionGate] JapaneseRevisionProgress missing; running quiz without saved progress",
        );
      } else {
        throw err;
      }
    }

    return {
      gateNumber,
      label: revisionGateLabel(gateNumber),
      wordCount: revisionGateWordCount(gateNumber),
      sampleSize,
      coverageWordIds,
      unlocksBlock: getFirstBlockUnlockedByRevisionGate(gateNumber),
      passed: progress?.passed ?? false,
      attempts: progress?.attempts ?? 0,
      threshold: JAPANESE_REVISION_PASS_THRESHOLD,
      questions,
    };
  } catch (err) {
    console.error("[loadRevisionGate] failed", err);
    return { error: "Couldn't load revision checkpoint. Please try again." };
  }
}

export type RevisionAnswerSubmission = {
  answers: Record<string, string>;
  modes: Record<string, "type-english" | "type-romaji">;
  /** Unique word ids answered at least once (coverage). */
  coveredWordIds?: string[];
  sentenceIds?: string[];
};

export type RevisionSubmitResult = {
  passed: boolean;
  scorePct: number;
  threshold: number;
  correctCount: number;
  total: number;
  coveredCount: number;
  coverageTotal: number;
  unlocksBlock: number;
  error?: string;
};

export async function submitRevisionAnswers(
  gateNumber: number,
  submission: RevisionAnswerSubmission,
): Promise<{ error: string } | RevisionSubmitResult> {
  const session = await requireJapaneseLearner();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  if (!isLiveRevisionGate(gateNumber)) {
    return { error: "This revision gate is not enabled." };
  }
  const playable = collectRevisionWords(gateNumber);
  if (!playable.length) {
    return { error: "No vocabulary loaded for this revision gate." };
  }

  const expectedCoverage = new Set(
    playable.map(({ blockNumber, wordIndex, word }) =>
      getJapaneseWordId(blockNumber, wordIndex, word),
    ),
  );
  const covered = new Set(submission.coveredWordIds ?? []);
  // Also infer coverage from answered word question ids (block-index).
  for (const id of Object.keys(submission.answers)) {
    if (id.includes("-") && !id.startsWith("g")) {
      const [blockPart, indexPart] = id.split("-");
      const blockNumber = Number(blockPart);
      const wordIndex = Number(indexPart);
      const word = getJapaneseBlock(blockNumber)?.[wordIndex];
      if (word) covered.add(getJapaneseWordId(blockNumber, wordIndex, word));
    }
  }

  const missingCoverage = [...expectedCoverage].filter((id) => !covered.has(id));
  if (missingCoverage.length > 0 && JAPANESE_REVISION_WORD_SAMPLE == null) {
    return {
      error: `Review incomplete — ${missingCoverage.length} words still untested.`,
    };
  }

  const sentenceById = new Map(
    buildSentenceQuestions(gateNumber).map((q) => [q.id, q] as const),
  );

  let correctCount = 0;
  for (const [id, input] of Object.entries(submission.answers)) {
    const sentence = sentenceById.get(id);
    if (sentence) {
      const result = matchAcceptedSentenceAnswers(
        input,
        sentence.preferredAnswer,
        sentence.acceptedAnswers,
      );
      if (result.ok) correctCount += 1;
      continue;
    }

    const mode = submission.modes[id];
    if (!mode) continue;
    const [blockPart, indexPart] = id.split("-");
    const blockNumber = Number(blockPart);
    const wordIndex = Number(indexPart);
    const word = getJapaneseBlock(blockNumber)[wordIndex];
    if (!word) continue;
    const ok =
      mode === "type-english"
        ? fuzzyMatchEnglish(input, word)
        : fuzzyMatchRomaji(input, word);
    if (ok) correctCount += 1;
  }

  const total = Object.keys(submission.answers).length;
  const scorePct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const passed = scorePct >= JAPANESE_REVISION_PASS_THRESHOLD;

  try {
    await prisma.japaneseRevisionProgress.upsert({
      where: { userId_gateNumber: { userId, gateNumber } },
      create: {
        userId,
        gateNumber,
        passed,
        scorePct,
        attempts: 1,
        passedAt: passed ? new Date() : null,
      },
      update: {
        passed: passed || undefined,
        scorePct,
        attempts: { increment: 1 },
        passedAt: passed ? new Date() : undefined,
      },
    });
  } catch (err) {
    if (isPrismaSchemaMissingError(err)) {
      console.warn(
        "[submitRevisionAnswers] JapaneseRevisionProgress missing; returning score without save",
      );
    } else {
      throw err;
    }
  }

  revalidatePath(LEARN_PATH);

  return {
    passed,
    scorePct,
    threshold: JAPANESE_REVISION_PASS_THRESHOLD,
    correctCount,
    total,
    coveredCount: covered.size,
    coverageTotal: expectedCoverage.size,
    unlocksBlock: getFirstBlockUnlockedByRevisionGate(gateNumber),
  };
}
