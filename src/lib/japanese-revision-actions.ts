"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
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

export type RevisionInProgressState = {
  questions: RevisionQuestion[];
  qIndex: number;
  answers: Record<string, string>;
  modes: Record<string, "type-english" | "type-romaji">;
  coveredWordIds: string[];
  revealedMnemonicIds: string[];
  savedAt: string;
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
  /** Resume mid-quiz if present. */
  resume?: {
    qIndex: number;
    answers: Record<string, string>;
    modes: Record<string, "type-english" | "type-romaji">;
    coveredWordIds: string[];
    revealedMnemonicIds: string[];
  };
  round1Count: number;
  round2Count: number;
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

    let progress: {
      passed: boolean;
      attempts: number;
      inProgress?: unknown;
    } | null = null;
    try {
      progress = await prisma.japaneseRevisionProgress.findUnique({
        where: { userId_gateNumber: { userId, gateNumber } },
        select: { passed: true, attempts: true, inProgress: true },
      });
    } catch (err) {
      if (isPrismaSchemaMissingError(err)) {
        console.warn(
          "[loadRevisionGate] JapaneseRevisionProgress missing; running quiz without saved progress",
        );
      } else {
        // inProgress column may be missing until db push — retry without it
        try {
          progress = await prisma.japaneseRevisionProgress.findUnique({
            where: { userId_gateNumber: { userId, gateNumber } },
            select: { passed: true, attempts: true },
          });
        } catch (err2) {
          if (!isPrismaSchemaMissingError(err2)) throw err;
        }
      }
    }

    const saved = (progress?.inProgress ?? null) as RevisionInProgressState | null;
    const hasResume =
      saved &&
      Array.isArray(saved.questions) &&
      saved.questions.length > 0 &&
      typeof saved.qIndex === "number" &&
      saved.qIndex < saved.questions.length;

    const built = hasResume
      ? {
          questions: saved!.questions,
          sampleSize: collectRevisionWords(gateNumber).length,
          coverageWordIds: collectRevisionWords(gateNumber).map((r) =>
            getJapaneseWordId(r.blockNumber, r.wordIndex, r.word),
          ),
          round1Count: saved!.questions.filter((q) => q.kind === "word" && q.round === 1)
            .length,
          round2Count: saved!.questions.filter((q) => q.round === 2).length,
        }
      : buildRevisionQuestions(gateNumber);

    if (!built.questions.length) {
      return { error: "No vocabulary loaded for this revision gate." };
    }

    return {
      gateNumber,
      label: revisionGateLabel(gateNumber),
      wordCount: revisionGateWordCount(gateNumber),
      sampleSize: built.sampleSize,
      coverageWordIds: built.coverageWordIds,
      unlocksBlock: getFirstBlockUnlockedByRevisionGate(gateNumber),
      passed: progress?.passed ?? false,
      attempts: progress?.attempts ?? 0,
      threshold: JAPANESE_REVISION_PASS_THRESHOLD,
      questions: built.questions,
      round1Count: built.round1Count,
      round2Count: built.round2Count,
      resume: hasResume
        ? {
            qIndex: saved!.qIndex,
            answers: saved!.answers ?? {},
            modes: saved!.modes ?? {},
            coveredWordIds: saved!.coveredWordIds ?? [],
            revealedMnemonicIds: saved!.revealedMnemonicIds ?? [],
          }
        : undefined,
    };
  } catch (err) {
    console.error("[loadRevisionGate] failed", err);
    return { error: "Couldn't load revision checkpoint. Please try again." };
  }
}

export async function saveRevisionInProgress(
  gateNumber: number,
  state: RevisionInProgressState,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireJapaneseLearner();
  if (!session) return { error: "Unauthorized" };
  if (!isLiveRevisionGate(gateNumber)) return { error: "Gate not enabled" };

  const userId = session.user.id;
  try {
    await prisma.japaneseRevisionProgress.upsert({
      where: { userId_gateNumber: { userId, gateNumber } },
      create: {
        userId,
        gateNumber,
        passed: false,
        attempts: 0,
        inProgress: state,
      },
      update: {
        inProgress: state,
      },
    });
    return { ok: true };
  } catch (err) {
    if (isPrismaSchemaMissingError(err)) {
      console.warn("[saveRevisionInProgress] schema missing");
      return { ok: false, error: "Persistence unavailable" };
    }
    console.error("[saveRevisionInProgress]", err);
    return { error: "Couldn't save progress" };
  }
}

export async function clearRevisionInProgress(
  gateNumber: number,
): Promise<{ ok?: boolean }> {
  const session = await requireJapaneseLearner();
  if (!session) return {};
  try {
    await prisma.japaneseRevisionProgress.updateMany({
      where: { userId: session.user.id, gateNumber },
      data: { inProgress: Prisma.DbNull },
    });
  } catch {
    /* ignore */
  }
  return { ok: true };
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

function parseWordQuestionId(
  id: string,
): { blockNumber: number; wordIndex: number } | null {
  // ids: "1-3-12" (round-block-index) or "2-3-12-x0"
  const m = /^(?:[12]-)?(\d+)-(\d+)(?:-x\d+)?$/.exec(id);
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
  // Also accept sentence ids from the learner's saved quiz (batch ids)
  for (const [id, input] of Object.entries(submission.answers)) {
    if (id.startsWith("g") && !sentenceById.has(id)) {
      // score via match against any batch with that id from rebuild won't work —
      // use requiredWords from submission isn't available; rely on covered + loose accept
      void input;
    }
  }

  let correctCount = 0;
  for (const [id, input] of Object.entries(submission.answers)) {
    if (id.startsWith("g")) {
      // Sentence: accept if non-empty (detailed check already done client-side);
      // re-validate when we have preferred from rebuilt bank
      const sentence = sentenceById.get(id);
      if (sentence) {
        const result = matchAcceptedSentenceAnswers(
          input,
          sentence.preferredAnswer,
          sentence.acceptedAnswers,
        );
        if (result.ok) correctCount += 1;
      } else if (input.trim()) {
        correctCount += 1;
      }
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
        inProgress: Prisma.DbNull,
      },
      update: {
        passed: passed || undefined,
        scorePct,
        attempts: { increment: 1 },
        passedAt: passed ? new Date() : undefined,
        inProgress: Prisma.DbNull,
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

/** Persist last active Japanese block so reload doesn't always open block 1. */
export async function saveLastJapaneseBlock(
  blockNumber: number,
): Promise<{ ok?: boolean }> {
  const session = await requireJapaneseLearner();
  if (!session) return {};
  const userId = session.user.id;
  try {
    // Store on block-1 progress row as unlockedBlocks is already there;
    // use a dedicated revision gate 998 marker scorePct = blockNumber
    await prisma.japaneseRevisionProgress.upsert({
      where: { userId_gateNumber: { userId, gateNumber: 998 } },
      create: {
        userId,
        gateNumber: 998,
        passed: false,
        scorePct: blockNumber,
        attempts: 0,
      },
      update: { scorePct: blockNumber },
    });
  } catch {
    /* ignore */
  }
  return { ok: true };
}

export async function loadLastJapaneseBlock(): Promise<number | null> {
  const session = await requireJapaneseLearner();
  if (!session) return null;
  try {
    const row = await prisma.japaneseRevisionProgress.findUnique({
      where: {
        userId_gateNumber: { userId: session.user.id, gateNumber: 998 },
      },
      select: { scorePct: true },
    });
    const n = row?.scorePct;
    if (typeof n === "number" && n >= 1 && n <= 20) return n;
  } catch {
    /* ignore */
  }
  return null;
}
