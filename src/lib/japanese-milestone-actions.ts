"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { JAPANESE_MILESTONE_PASS_THRESHOLD } from "@/lib/japanese/config";
import { getDefaultGrammarBlockId } from "@/lib/japanese/grammar";
import {
  generateJapaneseMilestoneStory,
  MILESTONE_STORY_CACHE_VERSION,
  MILESTONE_STORY_VOCAB_ONLY,
  parseMilestoneStoryCacheVersion,
  storyCacheIsStale,
  type GeneratedMilestoneStory,
  type MilestoneComprehensionQ,
  type MilestoneProductionQ,
  type MilestoneTtsToken,
} from "@/lib/japanese/milestone-story";
import {
  getBlockUnlockedByMilestone,
  getBlocksForMilestone,
  getMilestoneForBlock,
  milestoneLabel,
} from "@/lib/japanese/milestone";
import { fuzzyMatchEnglishText, fuzzyMatchRomaji, formatAcceptedEnglishAnswers, parseComprehensionRomaji } from "@/lib/japanese/matching";
import { getJapaneseBlock } from "@/lib/japanese/blocks";
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

export type MilestoneStoryPayload = {
  milestoneNumber: number;
  label: string;
  unlocksBlock: number;
  passed: boolean;
  attempts: number;
  story: {
    title: string;
    paragraphs: string[];
    ttsLines: MilestoneTtsToken[][];
    comprehension: MilestoneComprehensionQ[];
    production: MilestoneProductionQ[];
    vocabUsed: string[];
    vocabOnly: boolean;
    provider: string | null;
  };
};

function parseTtsLines(raw: unknown): MilestoneTtsToken[][] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((line) => Array.isArray(line))
    .map((line) =>
      (line as unknown[])
        .map((token) => {
          if (!token || typeof token !== "object") return null;
          const t = token as Record<string, unknown>;
          const romaji = String(t.romaji ?? t.r ?? "").trim();
          const audio = String(t.audio ?? t.romaji ?? t.r ?? "").trim();
          if (!romaji || !audio) return null;
          return { romaji, audio };
        })
        .filter((t): t is MilestoneTtsToken => t !== null),
    )
    .filter((line) => line.length > 0);
}

function storyFromRow(row: {
  title: string;
  paragraphs: unknown;
  ttsParagraphs?: unknown;
  vocabOnly?: boolean;
  comprehensionQs: unknown;
  productionQs: unknown;
  vocabUsed: unknown;
  provider: string | null;
}): MilestoneStoryPayload["story"] {
  return {
    title: row.title,
    paragraphs: Array.isArray(row.paragraphs) ? row.paragraphs.map(String) : [],
    ttsLines: parseTtsLines(row.ttsParagraphs),
    comprehension: Array.isArray(row.comprehensionQs)
      ? (row.comprehensionQs as MilestoneComprehensionQ[])
      : [],
    production: Array.isArray(row.productionQs)
      ? (row.productionQs as MilestoneProductionQ[])
      : [],
    vocabUsed: Array.isArray(row.vocabUsed) ? row.vocabUsed.map(String) : [],
    vocabOnly: row.vocabOnly ?? false,
    provider: row.provider,
  };
}

function storyFromGenerated(pack: GeneratedMilestoneStory): MilestoneStoryPayload["story"] {
  return {
    title: pack.title,
    paragraphs: pack.paragraphs,
    ttsLines: pack.ttsLines,
    comprehension: pack.comprehension,
    production: pack.production,
    vocabUsed: pack.vocabUsed,
    vocabOnly: pack.vocabOnly,
    provider: pack.provider,
  };
}

async function cacheStory(userId: string, milestoneNumber: number, pack: GeneratedMilestoneStory) {
  return prisma.japaneseMilestoneStory.upsert({
    where: { userId_milestoneNumber: { userId, milestoneNumber } },
    create: {
      userId,
      milestoneNumber,
      title: pack.title,
      paragraphs: pack.paragraphs,
      ttsParagraphs: pack.ttsLines,
      vocabOnly: pack.vocabOnly,
      comprehensionQs: pack.comprehension,
      productionQs: pack.production,
      vocabUsed: pack.vocabUsed,
      provider: pack.provider,
    },
    update: {
      title: pack.title,
      paragraphs: pack.paragraphs,
      ttsParagraphs: pack.ttsLines,
      vocabOnly: pack.vocabOnly,
      comprehensionQs: pack.comprehension,
      productionQs: pack.production,
      vocabUsed: pack.vocabUsed,
      provider: pack.provider,
    },
  });
}

async function getGrammarContext(userId: string) {
  const grammarBlockId = getDefaultGrammarBlockId();
  try {
    const row = await prisma.grammarBlockProgress.findUnique({
      where: { userId_blockId: { userId, blockId: grammarBlockId } },
      select: { mastered: true, blockId: true },
    });
    return {
      hasCompletedGrammar: Boolean(row?.mastered),
      masteredGrammarIds: row?.mastered ? [row.blockId] : [],
    };
  } catch {
    return { hasCompletedGrammar: false, masteredGrammarIds: [] as string[] };
  }
}

function storyNeedsRegeneration(
  cached: {
    vocabOnly?: boolean;
    paragraphs?: unknown;
    provider?: string | null;
    ttsParagraphs?: unknown;
  } | null,
): boolean {
  if (!cached) return true;
  const paragraphs = Array.isArray(cached.paragraphs) ? cached.paragraphs.map(String) : [];
  if (
    storyCacheIsStale(cached.provider ?? null, paragraphs, cached.vocabOnly) ||
    parseMilestoneStoryCacheVersion(cached.provider ?? null) < MILESTONE_STORY_CACHE_VERSION
  ) {
    return true;
  }
  if (!cached.vocabOnly || cached.vocabOnly !== MILESTONE_STORY_VOCAB_ONLY) return true;
  const ttsLines = parseTtsLines(cached.ttsParagraphs);
  if (!ttsLines.length) return true;
  return false;
}

async function deleteStaleMilestoneStoriesForUser(userId: string): Promise<void> {
  try {
    const rows = await prisma.japaneseMilestoneStory.findMany({
      where: { userId },
      select: { milestoneNumber: true, provider: true },
    });
    const staleMilestones = rows
      .filter(
        (row) =>
          parseMilestoneStoryCacheVersion(row.provider) < MILESTONE_STORY_CACHE_VERSION,
      )
      .map((row) => row.milestoneNumber);
    if (!staleMilestones.length) return;
    await prisma.japaneseMilestoneStory.deleteMany({
      where: { userId, milestoneNumber: { in: staleMilestones } },
    });
  } catch (err) {
    if (isPrismaSchemaMissingError(err)) return;
    throw err;
  }
}

export async function loadMilestoneGate(
  milestoneNumber: number,
): Promise<{ error: string } | MilestoneStoryPayload> {
  try {
    const session = await requireJapaneseLearner();
    if (!session) return { error: "Unauthorized" };

    const userId = session.user.id;

    let cached = null;
    let progress = null;
    try {
      [cached, progress] = await Promise.all([
        prisma.japaneseMilestoneStory.findUnique({
          where: { userId_milestoneNumber: { userId, milestoneNumber } },
        }),
        prisma.japaneseMilestoneProgress.findUnique({
          where: { userId_milestoneNumber: { userId, milestoneNumber } },
        }),
      ]);
    } catch (err) {
      if (isPrismaSchemaMissingError(err)) {
        console.warn(
          "[loadMilestoneGate] milestone tables missing; gate unavailable",
          err,
        );
        return { error: "Vocab checkpoints are not available yet. Please try again later." };
      }
      throw err;
    }

    await deleteStaleMilestoneStoriesForUser(userId);
    if (
      cached &&
      parseMilestoneStoryCacheVersion(cached.provider ?? null) < MILESTONE_STORY_CACHE_VERSION
    ) {
      cached = null;
    }

    let storyRow = cached;
    if (storyNeedsRegeneration(cached)) {
      const grammarContext = await getGrammarContext(userId);
      const generated = await generateJapaneseMilestoneStory(milestoneNumber, grammarContext);
      try {
        storyRow = await cacheStory(userId, milestoneNumber, generated);
      } catch (err) {
        if (isPrismaSchemaMissingError(err)) {
          console.warn("[loadMilestoneGate] cannot cache story; tables missing", err);
          return {
            milestoneNumber,
            label: milestoneLabel(milestoneNumber),
            unlocksBlock: getBlockUnlockedByMilestone(milestoneNumber),
            passed: progress?.passed ?? false,
            attempts: progress?.attempts ?? 0,
            story: storyFromGenerated(generated),
          };
        }
        throw err;
      }
    }

    return {
      milestoneNumber,
      label: milestoneLabel(milestoneNumber),
      unlocksBlock: getBlockUnlockedByMilestone(milestoneNumber),
      passed: progress?.passed ?? false,
      attempts: progress?.attempts ?? 0,
      story: storyFromRow(storyRow!),
    };
  } catch (err) {
    console.error("[loadMilestoneGate] failed", err);
    return { error: "Couldn't load vocab checkpoint. Please try again." };
  }
}

export type MilestoneAnswerSubmission = {
  comprehension: Record<string, string>;
  production: Record<string, string>;
};

export type MilestoneQuestionFeedback = {
  userAnswer: string;
  expected: string;
  accepted: string;
  correct: boolean;
};

export type MilestoneSubmitResult = {
  passed: boolean;
  comprehensionScore: number;
  productionScore: number;
  combinedScore: number;
  threshold: number;
  unlocksBlock: number;
  comprehensionResults: Record<string, boolean>;
  productionResults: Record<string, boolean>;
  comprehensionFeedback: Record<string, MilestoneQuestionFeedback>;
  productionFeedback: Record<string, MilestoneQuestionFeedback>;
};

function findMilestoneWordByRomaji(
  milestoneNumber: number,
  romaji: string,
): JapaneseWord | null {
  for (const blockNumber of getBlocksForMilestone(milestoneNumber)) {
    const block = getJapaneseBlock(blockNumber);
    const word = block.find((w) => w.r.toLowerCase() === romaji.toLowerCase());
    if (word) return word;
  }
  return null;
}

export async function submitMilestoneAnswers(
  milestoneNumber: number,
  answers: MilestoneAnswerSubmission,
): Promise<{ error: string } | MilestoneSubmitResult> {
  const session = await requireJapaneseLearner();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  const gate = await loadMilestoneGate(milestoneNumber);
  if ("error" in gate) return gate;

  const comprehensionResults: Record<string, boolean> = {};
  const comprehensionFeedback: Record<string, MilestoneQuestionFeedback> = {};
  let comprehensionCorrect = 0;
  for (const q of gate.story.comprehension) {
    const input = answers.comprehension[q.id] ?? "";
    const romaji = parseComprehensionRomaji(q.prompt);
    const word = romaji ? findMilestoneWordByRomaji(milestoneNumber, romaji) : null;
    const ok = fuzzyMatchEnglishText(input, q.answer, word ?? undefined);
    comprehensionResults[q.id] = ok;
    comprehensionFeedback[q.id] = {
      userAnswer: input,
      expected: q.answer,
      accepted: formatAcceptedEnglishAnswers(q.answer, word ?? undefined),
      correct: ok,
    };
    if (ok) comprehensionCorrect += 1;
  }

  const productionResults: Record<string, boolean> = {};
  const productionFeedback: Record<string, MilestoneQuestionFeedback> = {};
  let productionCorrect = 0;
  for (const q of gate.story.production) {
    const input = answers.production[q.id] ?? "";
    const word = getJapaneseBlock(q.blockNumber)[q.wordIndex];
    const ok = word ? fuzzyMatchRomaji(input, word) : false;
    productionResults[q.id] = ok;
    productionFeedback[q.id] = {
      userAnswer: input,
      expected: word?.r ?? q.targetRomaji,
      accepted: word?.r ?? q.targetRomaji,
      correct: ok,
    };
    if (ok) productionCorrect += 1;
  }

  const compTotal = gate.story.comprehension.length || 1;
  const prodTotal = gate.story.production.length || 1;
  const totalQs = compTotal + prodTotal;
  const comprehensionScore = Math.round((comprehensionCorrect / compTotal) * 100);
  const productionScore = Math.round((productionCorrect / prodTotal) * 100);
  const combinedScore = Math.round(
    ((comprehensionCorrect + productionCorrect) / totalQs) * 100,
  );
  const passed = combinedScore >= JAPANESE_MILESTONE_PASS_THRESHOLD;

  try {
    await prisma.japaneseMilestoneProgress.upsert({
      where: { userId_milestoneNumber: { userId, milestoneNumber } },
      create: {
        userId,
        milestoneNumber,
        passed,
        comprehensionScore,
        productionScore,
        combinedScore,
        attempts: 1,
        passedAt: passed ? new Date() : null,
      },
      update: {
        passed: passed || undefined,
        comprehensionScore,
        productionScore,
        combinedScore,
        attempts: { increment: 1 },
        passedAt: passed ? new Date() : undefined,
      },
    });
  } catch (err) {
    if (isPrismaSchemaMissingError(err)) {
      console.warn("[submitMilestoneAnswers] milestone tables missing; cannot save progress");
      return { error: "Vocab checkpoints are not available yet. Please try again later." };
    }
    throw err;
  }

  revalidatePath(LEARN_PATH);

  return {
    passed,
    comprehensionScore,
    productionScore,
    combinedScore,
    threshold: JAPANESE_MILESTONE_PASS_THRESHOLD,
    unlocksBlock: getBlockUnlockedByMilestone(milestoneNumber),
    comprehensionResults,
    productionResults,
    comprehensionFeedback,
    productionFeedback,
  };
}

export async function getGatesPassed(): Promise<number[]> {
  const session = await requireJapaneseLearner();
  if (!session) return [];

  try {
    const rows = await prisma.japaneseMilestoneProgress.findMany({
      where: { userId: session.user.id, passed: true },
      select: { milestoneNumber: true },
    });
    return rows.map((r) => r.milestoneNumber).sort((a, b) => a - b);
  } catch (err) {
    if (isPrismaSchemaMissingError(err)) {
      console.warn("[getGatesPassed] milestone tables missing; returning no gates passed");
      return [];
    }
    throw err;
  }
}

export async function checkGateUnlock(blockNumber: number): Promise<{
  required: boolean;
  milestoneNumber: number | null;
  passed: boolean;
  unlocksBlock: number | null;
}> {
  const milestone = getMilestoneForBlock(blockNumber);
  if (!milestone) {
    return { required: false, milestoneNumber: null, passed: true, unlocksBlock: null };
  }

  const gates = await getGatesPassed();
  const passed = gates.includes(milestone);
  return {
    required: false,
    milestoneNumber: milestone,
    passed,
    unlocksBlock: getBlockUnlockedByMilestone(milestone),
  };
}
