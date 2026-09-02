"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getJapaneseBlock, isPlayableJapaneseBlock } from "@/lib/japanese/blocks";
import { JAPANESE_REVISION_PASS_THRESHOLD } from "@/lib/japanese/config";
import { fuzzyMatchEnglish, fuzzyMatchRomaji } from "@/lib/japanese/matching";
import {
  getBlocksForRevisionGate,
  getFirstBlockUnlockedByRevisionGate,
  revisionGateLabel,
  revisionGateWordCount,
} from "@/lib/japanese/revision-gate";
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

export type RevisionQuestion = {
  id: string;
  blockNumber: number;
  wordIndex: number;
  mode: "type-english" | "type-romaji";
  prompt: string;
};

export type RevisionGatePayload = {
  gateNumber: number;
  label: string;
  wordCount: number;
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

function buildRevisionQuestions(gateNumber: number): RevisionQuestion[] {
  const words = shuffle(collectRevisionWords(gateNumber));
  return words.map(({ blockNumber, wordIndex, word }, i) => {
    const mode: RevisionQuestion["mode"] = i % 2 === 0 ? "type-english" : "type-romaji";
    return {
      id: `${blockNumber}-${wordIndex}`,
      blockNumber,
      wordIndex,
      mode,
      prompt: mode === "type-english" ? word.r : word.en,
    };
  });
}

export async function loadRevisionGatesPassed(userId: string): Promise<number[]> {
  try {
    const rows = await prisma.japaneseRevisionProgress.findMany({
      where: { userId, passed: true },
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
    const questions = buildRevisionQuestions(gateNumber);
    if (!questions.length) {
      return { error: "Revision content is not available yet for this gate." };
    }

    let progress = null;
    try {
      progress = await prisma.japaneseRevisionProgress.findUnique({
        where: { userId_gateNumber: { userId, gateNumber } },
      });
    } catch (err) {
      if (isPrismaSchemaMissingError(err)) {
        return { error: "Revision checkpoints are not available yet. Please try again later." };
      }
      throw err;
    }

    return {
      gateNumber,
      label: revisionGateLabel(gateNumber),
      wordCount: revisionGateWordCount(gateNumber),
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
};

export type RevisionSubmitResult = {
  passed: boolean;
  scorePct: number;
  threshold: number;
  correctCount: number;
  total: number;
  unlocksBlock: number;
};

export async function submitRevisionAnswers(
  gateNumber: number,
  submission: RevisionAnswerSubmission,
): Promise<{ error: string } | RevisionSubmitResult> {
  const session = await requireJapaneseLearner();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  const playable = collectRevisionWords(gateNumber);
  if (!playable.length) {
    return { error: "Revision content is not available yet for this gate." };
  }

  let correctCount = 0;
  for (const [id, input] of Object.entries(submission.answers)) {
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
      return { error: "Revision checkpoints are not available yet. Please try again later." };
    }
    throw err;
  }

  revalidatePath(LEARN_PATH);

  return {
    passed,
    scorePct,
    threshold: JAPANESE_REVISION_PASS_THRESHOLD,
    correctCount,
    total,
    unlocksBlock: getFirstBlockUnlockedByRevisionGate(gateNumber),
  };
}
