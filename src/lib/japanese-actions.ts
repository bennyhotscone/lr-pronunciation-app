"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getJapaneseBlock } from "@/lib/japanese/blocks";
import { JAPANESE_MASTERY_THRESHOLD } from "@/lib/japanese/config";
import { mergeUnlockedBlocks } from "@/lib/japanese/milestone";
import { loadRevisionGatesPassed } from "@/lib/japanese-revision-actions";
import {
  createInitialBlockMeta,
  createInitialSessionState,
  metaFromDb,
  sessionFromDb,
  syncMasteryFromCompletedRound5,
  updateMetaAfterRound,
} from "@/lib/japanese/engine";
import { getKnownIndices, statsToKnownWordsMap } from "@/lib/japanese/known-words";
import type { JapaneseBlockMeta, JapaneseSessionState } from "@/lib/japanese/types";
import {
  applyAnswerToKnownProgress,
  EMPTY_KNOWN_PROGRESS,
  knownProgressFromDb,
} from "@/lib/japanese/known-words";
import { wordlistKnownKey } from "@/lib/japanese/wordlist-catalog";
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

export type JapaneseWordStatSnapshot = {
  timesSeen: number;
  timesCorrect: number;
  timesMissed: number;
  known?: boolean;
  missedEarlyRounds?: boolean;
  round4CorrectCount?: number;
  round5CorrectCount?: number;
  consecutiveCorrect?: number;
};

export type JapaneseProgressPayload = {
  session: JapaneseSessionState;
  meta: JapaneseBlockMeta;
  gatesPassed: number[];
  revisionGatesPassed: number[];
  overrides: Record<
    number,
    { mnemonic?: string | null; pronunciationCue?: string | null; ttsInput?: string | null }
  >;
  stats: Record<number, JapaneseWordStatSnapshot>;
  /** Cross-block learning flags used to skip re-teaching and label R4/R5 review. */
  priorLearning: {
    knownKeys: string[];
    seenKeys: string[];
    masteredBlocks: number[];
  };
};


async function loadGatesPassed(userId: string): Promise<number[]> {
  try {
    const gateRows = await prisma.japaneseMilestoneProgress.findMany({
      where: { userId, passed: true },
      select: { milestoneNumber: true },
    });
    return gateRows.map((g) => g.milestoneNumber).sort((a, b) => a - b);
  } catch (err) {
    if (isPrismaSchemaMissingError(err)) {
      console.warn(
        "[loadJapaneseProgress] JapaneseMilestoneProgress table missing; skipping milestone gates",
      );
      return [];
    }
    throw err;
  }
}

export async function loadJapaneseProgress(
  blockNumber = 1,
): Promise<{ error: string } | JapaneseProgressPayload> {
  try {
    const session = await requireJapaneseLearner();
    if (!session) return { error: "Unauthorized" };

    const userId = session.user.id;

    const [progress, allProgress, overrideRows, statRows, allStatKeys, gatesPassed, revisionGatesPassed] =
      await Promise.all([
      prisma.japaneseBlockProgress.findUnique({
        where: { userId_blockNumber: { userId, blockNumber } },
      }),
      prisma.japaneseBlockProgress.findMany({
        where: { userId },
        select: { blockNumber: true, unlockedBlocks: true, blockMastered: true },
      }),
      prisma.japaneseWordOverride.findMany({
        where: { userId, blockNumber },
      }),
      prisma.japaneseWordStat.findMany({
        where: { userId, blockNumber },
      }),
      prisma.japaneseWordStat.findMany({
        where: { userId },
        select: { blockNumber: true, wordIndex: true, known: true, timesSeen: true },
      }),
      loadGatesPassed(userId),
      loadRevisionGatesPassed(userId),
    ]);

    const sessionState = progress ? sessionFromDb(progress) : createInitialSessionState();
    let baseMeta = progress ? metaFromDb(progress) : createInitialBlockMeta();

    const stats: JapaneseProgressPayload["stats"] = {};
    for (const row of statRows) {
      stats[row.wordIndex] = {
        timesSeen: row.timesSeen,
        timesCorrect: row.timesCorrect,
        timesMissed: row.timesMissed,
        ...knownProgressFromDb(row),
      };
    }

    const knownKeys: string[] = [];
    const seenKeys: string[] = [];
    for (const row of allStatKeys) {
      const key = wordlistKnownKey(row.blockNumber, row.wordIndex);
      if (row.known) knownKeys.push(key);
      if (row.timesSeen > 0) seenKeys.push(key);
    }
    const masteredBlocks = allProgress
      .filter((row) => row.blockMastered)
      .map((row) => row.blockNumber);
    // Always include priorLearning so older/newer clients never crash on missing field.
    const priorLearning: JapaneseProgressPayload["priorLearning"] = {
      knownKeys,
      seenKeys,
      masteredBlocks,
    };

    const wordCount = getJapaneseBlock(blockNumber).length;
    const knownIndices = [...getKnownIndices(statsToKnownWordsMap(stats))];
    const syncedMeta = syncMasteryFromCompletedRound5(
      sessionState,
      baseMeta,
      blockNumber,
      wordCount,
      knownIndices,
      revisionGatesPassed,
    );

    if (
      progress &&
      (syncedMeta.blockMastered !== baseMeta.blockMastered ||
        syncedMeta.bestRound5Score !== baseMeta.bestRound5Score ||
        syncedMeta.unlockedBlocks.length !== baseMeta.unlockedBlocks.length ||
        syncedMeta.unlockedBlocks.some((n, i) => n !== baseMeta.unlockedBlocks[i]))
    ) {
      await prisma.japaneseBlockProgress.update({
        where: { userId_blockNumber: { userId, blockNumber } },
        data: {
          blockMastered: syncedMeta.blockMastered,
          bestRound5Score: syncedMeta.bestRound5Score,
          unlockedBlocks: syncedMeta.unlockedBlocks,
          roundScores: syncedMeta.roundScores as object,
        },
      });
      baseMeta = syncedMeta;
      const row = allProgress.find((r) => r.blockNumber === blockNumber);
      if (row) {
        row.blockMastered = syncedMeta.blockMastered;
        row.unlockedBlocks = syncedMeta.unlockedBlocks;
      }
    } else {
      baseMeta = syncedMeta;
    }

    const meta: JapaneseBlockMeta = {
      ...baseMeta,
      unlockedBlocks: mergeUnlockedBlocks(allProgress, gatesPassed, revisionGatesPassed),
    };

    const overrides: JapaneseProgressPayload["overrides"] = {};
    for (const o of overrideRows) {
      overrides[o.wordIndex] = {
        mnemonic: o.mnemonic,
        pronunciationCue: o.pronunciationCue,
        ttsInput: o.ttsInput,
      };
    }

    return {
      session: sessionState,
      meta,
      gatesPassed,
      revisionGatesPassed,
      overrides,
      stats,
      priorLearning,
    };
  } catch (err) {
    console.error("[loadJapaneseProgress] failed", err);
    return { error: "Couldn't load progress. Please try again." };
  }
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
      roundIsRetry: sessionState.roundIsRetry,
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
      roundIsRetry: sessionState.roundIsRetry,
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
  round: 1 | 2 | 3 | 4 | 5,
): Promise<{ ok: true; stat: JapaneseWordStatSnapshot } | { error: string }> {
  const session = await requireJapaneseLearner();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  getJapaneseBlock(blockNumber);

  const existing = await prisma.japaneseWordStat.findUnique({
    where: {
      userId_blockNumber_wordIndex: { userId, blockNumber, wordIndex },
    },
  });

  const prior = existing
    ? knownProgressFromDb(existing)
    : { ...EMPTY_KNOWN_PROGRESS };
  const nextKnown = applyAnswerToKnownProgress(prior, round, correct);

  const row = await prisma.japaneseWordStat.upsert({
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
      known: nextKnown.known,
      missedEarlyRounds: nextKnown.missedEarlyRounds,
      consecutiveCorrect: nextKnown.consecutiveCorrect,
      round4CorrectCount: nextKnown.round4CorrectCount,
      round5CorrectCount: nextKnown.round5CorrectCount,
      lastSeenAt: new Date(),
    },
    update: {
      timesSeen: { increment: 1 },
      timesCorrect: correct ? { increment: 1 } : undefined,
      timesMissed: correct ? undefined : { increment: 1 },
      known: nextKnown.known,
      missedEarlyRounds: nextKnown.missedEarlyRounds,
      consecutiveCorrect: nextKnown.consecutiveCorrect,
      round4CorrectCount: nextKnown.round4CorrectCount,
      round5CorrectCount: nextKnown.round5CorrectCount,
      lastSeenAt: new Date(),
    },
  });

  return {
    ok: true,
    stat: {
      timesSeen: row.timesSeen,
      timesCorrect: row.timesCorrect,
      timesMissed: row.timesMissed,
      ...knownProgressFromDb(row),
    },
  };
}

export async function completeJapaneseRound(
  blockNumber: number,
  sessionState: JapaneseSessionState,
  meta: JapaneseBlockMeta,
  round: 2 | 3 | 4 | 5,
  scorePct: number,
): Promise<{ ok: true; meta: JapaneseBlockMeta } | { error: string }> {
  const session = await requireJapaneseLearner();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  const revisionGatesPassed = await loadRevisionGatesPassed(userId);
  const nextMeta = updateMetaAfterRound(
    meta,
    blockNumber,
    round,
    scorePct,
    revisionGatesPassed,
  );

  if (round === 5 && scorePct >= JAPANESE_MASTERY_THRESHOLD) {
    await prisma.japaneseWordStat.updateMany({
      where: {
        userId,
        blockNumber,
        missedEarlyRounds: false,
        consecutiveCorrect: { gte: 3 },
        known: false,
      },
      data: { known: true },
    });
  }

  const save = await saveJapaneseProgress(blockNumber, sessionState, nextMeta);
  if ("error" in save) return save;

  const allProgress = await prisma.japaneseBlockProgress.findMany({
    where: { userId },
    select: { blockNumber: true, unlockedBlocks: true, blockMastered: true },
  });
  const gatesPassed = await loadGatesPassed(userId);
  const mergedMeta: JapaneseBlockMeta = {
    ...nextMeta,
    unlockedBlocks: mergeUnlockedBlocks(allProgress, gatesPassed, revisionGatesPassed),
  };

  return { ok: true, meta: mergedMeta };
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
