"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  createInitialParticleMeta,
  createInitialParticleSession,
} from "@/lib/japanese/particles/engine";
import type { ParticleBlockMeta, ParticleSessionState } from "@/lib/japanese/particles/types";
import { isStaff } from "@/lib/portal-access";
import { revalidatePath } from "next/cache";

const LEARN_GRAMMAR_PATH = "/portal/learn-grammar";

async function requireParticleLearner() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role === "STUDENT" || isStaff(session.user.role)) return session;
  return null;
}

export type ParticleProgressPayload = {
  session: ParticleSessionState;
  meta: ParticleBlockMeta;
};

function parseParticleMeta(row: {
  teachCompleted: boolean;
  mastered: boolean;
  sessionState: unknown;
}): ParticleBlockMeta {
  const stored = row.sessionState as Partial<{ particleMeta?: ParticleBlockMeta }> | null;
  if (stored?.particleMeta) return stored.particleMeta;
  return {
    mastered: row.mastered,
    teachSeen: row.teachCompleted,
    roundsCompleted: [],
  };
}

function wrapSessionState(
  session: ParticleSessionState,
  meta: ParticleBlockMeta,
): object {
  return { ...session, particleMeta: meta };
}

export async function loadParticleProgress(
  lessonId: string,
): Promise<{ error: string } | ParticleProgressPayload> {
  const session = await requireParticleLearner();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  const row = await prisma.grammarBlockProgress.findUnique({
    where: { userId_blockId: { userId, blockId: lessonId } },
  });

  if (!row) {
    return { session: createInitialParticleSession(), meta: createInitialParticleMeta() };
  }

  const stored = row.sessionState as Partial<ParticleSessionState> | null;
  const particleSession: ParticleSessionState = {
    round: stored?.round ?? "teach",
    questionIndex: stored?.questionIndex ?? 0,
    score: stored?.score ?? 0,
    verbTabIndex: stored?.verbTabIndex ?? 0,
  };

  return {
    session: particleSession,
    meta: parseParticleMeta(row),
  };
}

export async function saveParticleProgress(
  lessonId: string,
  sessionState: ParticleSessionState,
  meta: ParticleBlockMeta,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireParticleLearner();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  await prisma.grammarBlockProgress.upsert({
    where: { userId_blockId: { userId, blockId: lessonId } },
    create: {
      userId,
      blockId: lessonId,
      sessionState: wrapSessionState(sessionState, meta),
      teachCompleted: meta.teachSeen,
      guidedCompleted: meta.roundsCompleted.includes("build"),
      recallJtoECompleted: meta.roundsCompleted.includes("listenType"),
      recallEtoJCompleted: meta.roundsCompleted.includes("typeRomaji"),
      mastered: meta.mastered,
      unlockedBlocks: [lessonId],
    },
    update: {
      sessionState: wrapSessionState(sessionState, meta),
      teachCompleted: meta.teachSeen,
      guidedCompleted: meta.roundsCompleted.includes("build"),
      recallJtoECompleted: meta.roundsCompleted.includes("listenType"),
      recallEtoJCompleted: meta.roundsCompleted.includes("typeRomaji"),
      mastered: meta.mastered,
    },
  });

  revalidatePath(LEARN_GRAMMAR_PATH);
  return { ok: true };
}

export async function resetParticleProgress(
  lessonId: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireParticleLearner();
  if (!session) return { error: "Unauthorized" };

  await prisma.grammarBlockProgress.deleteMany({
    where: { userId: session.user.id, blockId: lessonId },
  });

  revalidatePath(LEARN_GRAMMAR_PATH);
  return { ok: true };
}

export async function loadAllParticleMastery(): Promise<
  { error: string } | { masteredByLesson: Record<string, boolean>; block3Mastered: boolean }
> {
  const session = await requireParticleLearner();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  const rows = await prisma.grammarBlockProgress.findMany({
    where: { userId },
    select: { blockId: true, mastered: true },
  });

  const masteredByLesson: Record<string, boolean> = {};
  for (const row of rows) {
    masteredByLesson[row.blockId] = row.mastered;
  }

  const block3 = await prisma.japaneseBlockProgress.findUnique({
    where: { userId_blockNumber: { userId, blockNumber: 3 } },
    select: { blockMastered: true },
  });

  return {
    masteredByLesson,
    block3Mastered: block3?.blockMastered ?? false,
  };
}

export async function loadBlock3Mastered(): Promise<boolean> {
  const session = await requireParticleLearner();
  if (!session) return false;

  const row = await prisma.japaneseBlockProgress.findUnique({
    where: {
      userId_blockNumber: {
        userId: session.user.id,
        blockNumber: 3,
      },
    },
    select: { blockMastered: true },
  });
  return row?.blockMastered ?? false;
}