"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { JAPANESE_MILESTONE_PASS_THRESHOLD } from "@/lib/japanese/config";
import {
  generateJapaneseMilestoneStory,
  type GeneratedMilestoneStory,
  type MilestoneComprehensionQ,
  type MilestoneProductionQ,
} from "@/lib/japanese/milestone-story";
import {
  getBlockUnlockedByMilestone,
  getMilestoneForBlock,
  milestoneLabel,
} from "@/lib/japanese/milestone";
import { fuzzyMatchEnglishText, fuzzyMatchRomaji } from "@/lib/japanese/matching";
import { getJapaneseBlock } from "@/lib/japanese/blocks";
import { isStaff } from "@/lib/portal-access";
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
    comprehension: MilestoneComprehensionQ[];
    production: MilestoneProductionQ[];
    vocabUsed: string[];
    provider: string | null;
  };
};

function storyFromRow(row: {
  title: string;
  paragraphs: unknown;
  comprehensionQs: unknown;
  productionQs: unknown;
  vocabUsed: unknown;
  provider: string | null;
}): MilestoneStoryPayload["story"] {
  return {
    title: row.title,
    paragraphs: Array.isArray(row.paragraphs) ? row.paragraphs.map(String) : [],
    comprehension: Array.isArray(row.comprehensionQs)
      ? (row.comprehensionQs as MilestoneComprehensionQ[])
      : [],
    production: Array.isArray(row.productionQs)
      ? (row.productionQs as MilestoneProductionQ[])
      : [],
    vocabUsed: Array.isArray(row.vocabUsed) ? row.vocabUsed.map(String) : [],
    provider: row.provider,
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
      comprehensionQs: pack.comprehension,
      productionQs: pack.production,
      vocabUsed: pack.vocabUsed,
      provider: pack.provider,
    },
    update: {
      title: pack.title,
      paragraphs: pack.paragraphs,
      comprehensionQs: pack.comprehension,
      productionQs: pack.production,
      vocabUsed: pack.vocabUsed,
      provider: pack.provider,
    },
  });
}

export async function loadMilestoneGate(
  milestoneNumber: number,
): Promise<{ error: string } | MilestoneStoryPayload> {
  const session = await requireJapaneseLearner();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;

  const [cached, progress] = await Promise.all([
    prisma.japaneseMilestoneStory.findUnique({
      where: { userId_milestoneNumber: { userId, milestoneNumber } },
    }),
    prisma.japaneseMilestoneProgress.findUnique({
      where: { userId_milestoneNumber: { userId, milestoneNumber } },
    }),
  ]);

  let storyRow = cached;
  if (!storyRow) {
    const generated = await generateJapaneseMilestoneStory(milestoneNumber);
    storyRow = await cacheStory(userId, milestoneNumber, generated);
  }

  return {
    milestoneNumber,
    label: milestoneLabel(milestoneNumber),
    unlocksBlock: getBlockUnlockedByMilestone(milestoneNumber),
    passed: progress?.passed ?? false,
    attempts: progress?.attempts ?? 0,
    story: storyFromRow(storyRow),
  };
}

export type MilestoneAnswerSubmission = {
  comprehension: Record<string, string>;
  production: Record<string, string>;
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
};

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
  let comprehensionCorrect = 0;
  for (const q of gate.story.comprehension) {
    const input = answers.comprehension[q.id] ?? "";
    const ok = fuzzyMatchEnglishText(input, q.answer);
    comprehensionResults[q.id] = ok;
    if (ok) comprehensionCorrect += 1;
  }

  const productionResults: Record<string, boolean> = {};
  let productionCorrect = 0;
  for (const q of gate.story.production) {
    const input = answers.production[q.id] ?? "";
    const word = getJapaneseBlock(q.blockNumber)[q.wordIndex];
    const ok = word ? fuzzyMatchRomaji(input, word) : false;
    productionResults[q.id] = ok;
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
  };
}

export async function getGatesPassed(): Promise<number[]> {
  const session = await requireJapaneseLearner();
  if (!session) return [];

  const rows = await prisma.japaneseMilestoneProgress.findMany({
    where: { userId: session.user.id, passed: true },
    select: { milestoneNumber: true },
  });
  return rows.map((r) => r.milestoneNumber).sort((a, b) => a - b);
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
    required: true,
    milestoneNumber: milestone,
    passed,
    unlocksBlock: getBlockUnlockedByMilestone(milestone),
  };
}