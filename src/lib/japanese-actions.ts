"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getJapaneseBlock } from "@/lib/japanese/blocks";
import {
  createInitialBlockMeta,
  createInitialSessionState,
  metaFromDb,
  sessionFromDb,
  updateMetaAfterRound,
} from "@/lib/japanese/engine";
import type { JapaneseBlockMeta, JapaneseSessionState } from "@/lib/japanese/types";
import { isStaff } from "@/lib/portal-access";
import { revalidatePath } from "next/cache";

const LEARN_PATH = "/portal/learn-japanese";

async function requireJapaneseLearner() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role === "STUDENT" || isStaff(session.user.role)) return session;
  return null;
}

export type JapaneseProgressPayload = {
  session: JapaneseSessionState;
  meta: JapaneseBlockMeta;
  overrides: Record<
    number,
    { mnemonic?: string | null; pronunciationCue?: string | null; ttsInput?: string | null }
  >;
  stats: Record<number, { timesSeen: number; timesCorrect: number; timesMissed: number }>;
};

export async function loadJapaneseProgress(
  blockNumber = 1,
): Promise<{ error: string } | JapaneseProgressPayload> {
  const session = await requireJapaneseLearner();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;

  const [progress, overrideRows, statRows] = await Promise.all([
    prisma.japaneseBlockProgress.findUnique({
      where: { userId_blockNumber: { userId, blockNumber } },
    }),
    prisma.japaneseWordOverride.findMany({
      where: { userId, blockNumber },
    }),
    prisma.japaneseWordStat.findMany({
      where: { userId, blockNumber },
    }),
  ]);

  const sessionState = progress ? sessionFromDb(progress) : createInitialSessionState();
  const meta = progress ? metaFromDb(progress) : createInitialBlockMeta();

  const overrides: JapaneseProgressPayload["overrides"] = {};
  for (const o of overrideRows) {
    overrides[o.wordIndex] = {
      mnemonic: o.mnemonic,
      pronunciationCue: o.pronunciationCue,
      ttsInput: o.ttsInput,
    };
  }

  const stats: JapaneseProgressPayload["stats"] = {};
  for (const s of statRows) {
    stats[s.wordIndex] = {
      timesSeen: s.timesSeen,
      timesCorrect: s.timesCorrect,
      timesMissed: s.timesMissed,
    };
  }

  return { session: sessionState, meta, overrides, stats };
}

export async function saveJapaneseProgress(
  blockNumber: number,
  sessionState: JapaneseSessionState,
  meta: JapaneseBlockMeta,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireJapaneseLearner();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;

  await prisma.japaneseBlockProgress.upsert({
    where: { userId_blockNumber: { userId, blockNumber } },
    create: {
      userId,
      blockNumber,
      phase: sessionState.phase,
      introIndex: sessionState.introIndex,
      inMini: sessionState.inMini,
      miniIndex: sessionState.miniIndex,
      miniQueue: sessionState.miniQueue,
      qIndex: sessionState.qIndex,
      score: sessionState.score,
      order: sessionState.order,
      missed: sessionState.missed,
      roundScores: meta.roundScores as object,
      bestRound5Score: meta.bestRound5Score,
      blockMastered: meta.blockMastered,
      unlockedBlocks: meta.unlockedBlocks,
    },
    update: {
      phase: sessionState.phase,
      introIndex: sessionState.introIndex,
      inMini: sessionState.inMini,
      miniIndex: sessionState.miniIndex,
      miniQueue: sessionState.miniQueue,
      qIndex: sessionState.qIndex,
      score: sessionState.score,
      order: sessionState.order,
      missed: sessionState.missed,
      roundScores: meta.roundScores as object,
      bestRound5Score: meta.bestRound5Score,
      blockMastered: meta.blockMastered,
      unlockedBlocks: meta.unlockedBlocks,
    },
  });

  revalidatePath(LEARN_PATH);
  return { ok: true };
}

export async function recordJapaneseWordResult(
  blockNumber: number,
  wordIndex: number,
  correct: boolean,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireJapaneseLearner();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  getJapaneseBlock(blockNumber);

  await prisma.japaneseWordStat.upsert({
    where: {
      userId_blockNumber_wordIndex: { userId, blockNumber, wordIndex },
    },
    create: {
      userId,
      blockNumber,
      wordIndex,
      timesSeen: 1,
      timesCorrect: correct ? 1 : 0,
      timesMissed: correct ? 0 : 1,
      lastSeenAt: new Date(),
    },
    update: {
      timesSeen: { increment: 1 },
      timesCorrect: correct ? { increment: 1 } : undefined,
      timesMissed: correct ? undefined : { increment: 1 },
      lastSeenAt: new Date(),
    },
  });

  return { ok: true };
}

export async function completeJapaneseRound(
  blockNumber: number,
  sessionState: JapaneseSessionState,
  meta: JapaneseBlockMeta,
  round: 2 | 3 | 4 | 5,
  scorePct: number,
): Promise<{ ok: true; meta: JapaneseBlockMeta } | { error: string }> {
  const nextMeta = updateMetaAfterRound(meta, round, scorePct);
  const save = await saveJapaneseProgress(blockNumber, sessionState, nextMeta);
  if ("error" in save) return save;
  return { ok: true, meta: nextMeta };
}

export async function saveJapaneseWordOverride(
  blockNumber: number,
  wordIndex: number,
  field: "mnemonic" | "pronunciationCue" | "ttsInput",
  value: string | null,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireJapaneseLearner();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  const words = getJapaneseBlock(blockNumber);
  if (wordIndex < 0 || wordIndex >= words.length) return { error: "Invalid word." };

  const trimmed = value?.trim() || null;

  const existing = await prisma.japaneseWordOverride.findUnique({
    where: { userId_blockNumber_wordIndex: { userId, blockNumber, wordIndex } },
  });

  const data = {
    mnemonic: existing?.mnemonic ?? null,
    pronunciationCue: existing?.pronunciationCue ?? null,
    ttsInput: existing?.ttsInput ?? null,
    [field]: trimmed,
  };

  const allNull = !data.mnemonic && !data.pronunciationCue && !data.ttsInput;

  if (allNull) {
    await prisma.japaneseWordOverride.deleteMany({
      where: { userId, blockNumber, wordIndex },
    });
  } else {
    await prisma.japaneseWordOverride.upsert({
      where: { userId_blockNumber_wordIndex: { userId, blockNumber, wordIndex } },
      create: { userId, blockNumber, wordIndex, ...data },
      update: data,
    });
  }

  revalidatePath(LEARN_PATH);
  return { ok: true };
}

export async function resetJapaneseBlockProgress(
  blockNumber: number,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireJapaneseLearner();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;

  await prisma.japaneseBlockProgress.deleteMany({
    where: { userId, blockNumber },
  });

  revalidatePath(LEARN_PATH);
  return { ok: true };
}

export async function resetJapaneseWordOverrideField(
  blockNumber: number,
  wordIndex: number,
  field: "mnemonic" | "pronunciationCue" | "ttsInput",
): Promise<{ ok: true } | { error: string }> {
  return saveJapaneseWordOverride(blockNumber, wordIndex, field, null);
}