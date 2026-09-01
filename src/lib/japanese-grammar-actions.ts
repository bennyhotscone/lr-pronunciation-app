"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  createInitialGrammarMeta,
  createInitialGrammarSession,
} from "@/lib/japanese/grammar/engine";
import type { GrammarBlockMeta, GrammarSessionState } from "@/lib/japanese/grammar/types";
import { isStaff } from "@/lib/portal-access";
import { revalidatePath } from "next/cache";

const LEARN_GRAMMAR_PATH = "/portal/learn-grammar";

async function requireGrammarLearner() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role === "STUDENT" || isStaff(session.user.role)) return session;
  return null;
}

export type GrammarProgressPayload = {
  session: GrammarSessionState;
  meta: GrammarBlockMeta;
};

export async function loadGrammarProgress(
  blockId: string,
): Promise<{ error: string } | GrammarProgressPayload> {
  const session = await requireGrammarLearner();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  const row = await prisma.grammarBlockProgress.findUnique({
    where: { userId_blockId: { userId, blockId } },
  });

  const baseMeta = createInitialGrammarMeta(blockId);
  if (!row) {
    return { session: createInitialGrammarSession(), meta: baseMeta };
  }

  return {
    session: row.sessionState as unknown as GrammarSessionState,
    meta: {
      teachCompleted: row.teachCompleted,
      guidedCompleted: row.guidedCompleted,
      recallJtoECompleted: row.recallJtoECompleted,
      recallEtoJCompleted: row.recallEtoJCompleted,
      mastered: row.mastered,
      unlockedBlocks: row.unlockedBlocks.length ? row.unlockedBlocks : [blockId],
    },
  };
}

export async function saveGrammarProgress(
  blockId: string,
  sessionState: GrammarSessionState,
  meta: GrammarBlockMeta,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireGrammarLearner();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  await prisma.grammarBlockProgress.upsert({
    where: { userId_blockId: { userId, blockId } },
    create: {
      userId,
      blockId,
      sessionState: sessionState as object,
      teachCompleted: meta.teachCompleted,
      guidedCompleted: meta.guidedCompleted,
      recallJtoECompleted: meta.recallJtoECompleted,
      recallEtoJCompleted: meta.recallEtoJCompleted,
      mastered: meta.mastered,
      unlockedBlocks: meta.unlockedBlocks,
    },
    update: {
      sessionState: sessionState as object,
      teachCompleted: meta.teachCompleted,
      guidedCompleted: meta.guidedCompleted,
      recallJtoECompleted: meta.recallJtoECompleted,
      recallEtoJCompleted: meta.recallEtoJCompleted,
      mastered: meta.mastered,
      unlockedBlocks: meta.unlockedBlocks,
    },
  });

  revalidatePath(LEARN_GRAMMAR_PATH);
  return { ok: true };
}

export async function resetGrammarBlockProgress(
  blockId: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireGrammarLearner();
  if (!session) return { error: "Unauthorized" };

  await prisma.grammarBlockProgress.deleteMany({
    where: { userId: session.user.id, blockId },
  });

  revalidatePath(LEARN_GRAMMAR_PATH);
  return { ok: true };
}
