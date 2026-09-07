"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getJapaneseBlock,
  getPlayableBlockNumbers,
  isPlayableJapaneseBlock,
} from "@/lib/japanese/blocks";
import { JAPANESE_ALWAYS_UNLOCKED_BLOCKS } from "@/lib/japanese/config";
import {
  applyMnemonicOverridesToQuestions,
  buildUnknownPracticeQuestions,
  type RevisionQuestion,
  type RevisionWordRef,
} from "@/lib/japanese/revision-quiz-build";
import { wordlistKnownKey } from "@/lib/japanese/wordlist-catalog";
import { isStaff } from "@/lib/portal-access";
import { isPrismaSchemaMissingError } from "@/lib/prisma-errors";

async function requireJapaneseLearner() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role === "STUDENT" || isStaff(session.user.role)) return session;
  return null;
}

export type UnknownPracticePayload = {
  questions: RevisionQuestion[];
  wordCount: number;
  unknownTotal: number;
};

export async function loadUnknownPracticeQuiz(): Promise<
  { error: string } | UnknownPracticePayload
> {
  try {
    const session = await requireJapaneseLearner();
    if (!session) return { error: "Unauthorized" };
    const userId = session.user.id;

    const [knownRows, progressRows] = await Promise.all([
      prisma.japaneseWordStat.findMany({
        where: { userId, known: true },
        select: { blockNumber: true, wordIndex: true },
      }),
      prisma.japaneseBlockProgress.findMany({
        where: { userId },
        select: { unlockedBlocks: true },
      }),
    ]);

    const knownKeys = new Set(
      knownRows.map((r) => wordlistKnownKey(r.blockNumber, r.wordIndex)),
    );

    const unlocked = new Set<number>(
      Array.from({ length: JAPANESE_ALWAYS_UNLOCKED_BLOCKS }, (_, i) => i + 1),
    );
    for (const row of progressRows) {
      for (const b of row.unlockedBlocks) unlocked.add(b);
    }
    // If no progress yet, still allow practice on always-unlocked playable blocks
    for (const b of getPlayableBlockNumbers()) {
      if (b <= JAPANESE_ALWAYS_UNLOCKED_BLOCKS) unlocked.add(b);
    }

    const refs: RevisionWordRef[] = [];
    for (const blockNumber of [...unlocked].sort((a, b) => a - b)) {
      if (!isPlayableJapaneseBlock(blockNumber)) continue;
      const words = getJapaneseBlock(blockNumber);
      words.forEach((word, wordIndex) => {
        if (knownKeys.has(wordlistKnownKey(blockNumber, wordIndex))) return;
        refs.push({ blockNumber, wordIndex, word });
      });
    }

    if (!refs.length) {
      return { error: "No unknown words to practice — mark some Don’t know, or keep learning." };
    }

    const built = buildUnknownPracticeQuestions(refs);

    const overrideMap = new Map<string, string>();
    try {
      const blocks = [...new Set(built.questions.filter((q) => q.kind === "word").map((q) => q.blockNumber))];
      const overrideRows = await prisma.japaneseWordOverride.findMany({
        where: {
          userId,
          blockNumber: { in: blocks },
          mnemonic: { not: null },
        },
        select: { blockNumber: true, wordIndex: true, mnemonic: true },
      });
      for (const row of overrideRows) {
        if (row.mnemonic?.trim()) {
          overrideMap.set(`${row.blockNumber}:${row.wordIndex}`, row.mnemonic.trim());
        }
      }
    } catch (err) {
      if (!isPrismaSchemaMissingError(err)) {
        console.warn("[loadUnknownPracticeQuiz] overrides", err);
      }
    }

    return {
      questions: applyMnemonicOverridesToQuestions(built.questions, overrideMap),
      wordCount: built.wordCount,
      unknownTotal: refs.length,
    };
  } catch (err) {
    if (isPrismaSchemaMissingError(err)) {
      return { error: "Progress storage unavailable." };
    }
    console.error("[loadUnknownPracticeQuiz] failed", err);
    return { error: "Couldn't load unknown practice." };
  }
}
