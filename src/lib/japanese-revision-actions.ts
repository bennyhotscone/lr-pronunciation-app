"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getJapaneseBlock, getJapaneseWordId } from "@/lib/japanese/blocks";
import { JAPANESE_REVISION_PASS_THRESHOLD } from "@/lib/japanese/config";
import { fuzzyMatchEnglish, fuzzyMatchRomaji } from "@/lib/japanese/matching";
import {
  getFirstBlockUnlockedByRevisionGate,
  isLiveRevisionGate,
  revisionGateLabel,
  revisionGateWordCount,
} from "@/lib/japanese/revision-gate";
import { matchAcceptedSentenceAnswers } from "@/lib/japanese/revision-sentence-match";
import {
  buildRevisionQuestions,
  collectRevisionWords,
  type RevisionQuestion,
  type RevisionSentenceQuestion,
  type RevisionWordQuestion,
} from "@/lib/japanese/revision-quiz-build";
import { isStaff } from "@/lib/portal-access";
import { isPrismaSchemaMissingError } from "@/lib/prisma-errors";
import { revalidatePath } from "next/cache";

const LEARN_PATH = "/portal/learn-japanese";

export type {
  RevisionQuestion,
  RevisionSentenceQuestion,
  RevisionWordQuestion,
};

async function requireJapaneseLearner() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role === "STUDENT" || isStaff(session.user.role)) return session;
  return null;
}

export type RevisionGatePayload = {
  gateNumber: number;
  label: string;
  wordCount: number;
  sampleSize: number;
  coverageWordIds: string[];
  unlocksBlock: number;
  passed: boolean;
  attempts: number;
  threshold: number;
  questions: RevisionQuestion[];
};

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

function parseWordQuestionId(id: string): { blockNumber: number; wordIndex: number } | null {
  // ids: "3-12" or "3-12-x0"
  const m = /^(\d+)-(\d+)(?:-x\d+)?$/.exec(id);
  if (!m) return null;
  return { blockNumber: Number(m[1]), wordIndex: Number(m[2]) };
}

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
  for (const id of Object.keys(submission.answers)) {
    const parsed = parseWordQuestionId(id);
    if (!parsed) continue;
    const word = getJapaneseBlock(parsed.blockNumber)?.[parsed.wordIndex];
    if (word) covered.add(getJapaneseWordId(parsed.blockNumber, parsed.wordIndex, word));
  }

  const missingCoverage = [...expectedCoverage].filter((id) => !covered.has(id));
  if (missingCoverage.length > 0) {
    return {
      error: `Review incomplete — ${missingCoverage.length} words still untested.`,
    };
  }

  const built = buildRevisionQuestions(gateNumber);
  const sentenceById = new Map(
    built.questions
      .filter((q): q is RevisionSentenceQuestion => q.kind === "sentence")
      .map((q) => [q.id, q] as const),
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
    const parsed = parseWordQuestionId(id);
    if (!parsed) continue;
    const word = getJapaneseBlock(parsed.blockNumber)[parsed.wordIndex];
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
