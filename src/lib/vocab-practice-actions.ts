"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { compareVocabEntries } from "@/lib/vocab-sort";
import {
  VOCAB_PRACTICE_DAILY_CAP,
  generateVocabPracticePack,
  utcDayBounds,
} from "@/lib/vocab-practice";
import { revalidatePath } from "next/cache";

async function requireStudent() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") return null;
  return session;
}

export async function generateDailyVocabPractice() {
  const session = await requireStudent();
  if (!session) return { error: "Unauthorized" };

  const { start, end } = utcDayBounds();
  const todayCount = await prisma.vocabPracticePack.count({
    where: {
      studentId: session.user.id,
      createdAt: { gte: start, lt: end },
    },
  });
  if (todayCount >= VOCAB_PRACTICE_DAILY_CAP) {
    return {
      error: `Daily limit reached (${VOCAB_PRACTICE_DAILY_CAP} practice packs per day). Reopen a pack you already started.`,
    };
  }

  const vocabRaw = await prisma.vocabEntry.findMany({
    where: { studentId: session.user.id },
  });
  const words = [...vocabRaw]
    .sort(compareVocabEntries)
    .slice(0, 10)
    .map((v) => v.word);

  const pack = await generateVocabPracticePack(words);
  const created = await prisma.vocabPracticePack.create({
    data: {
      studentId: session.user.id,
      title: pack.title,
      story: pack.story,
      vocabUsed: pack.vocabUsed,
      activities: pack.activities as object,
      answers: {},
      provider: pack.provider,
    },
    select: { id: true },
  });

  revalidatePath("/portal");
  revalidatePath("/portal/vocab-practice");
  return { ok: true as const, id: created.id };
}

export async function saveVocabPracticeAnswers(formData: FormData) {
  const session = await requireStudent();
  if (!session) return { error: "Unauthorized" };
  const packId = String(formData.get("packId") || "").trim();
  const answersRaw = String(formData.get("answers") || "").trim();
  const markComplete = String(formData.get("complete") || "") === "1";
  if (!packId) return { error: "Missing pack." };

  let answers: object = {};
  try {
    answers = JSON.parse(answersRaw || "{}") as object;
  } catch {
    return { error: "Invalid answers payload." };
  }

  const pack = await prisma.vocabPracticePack.findFirst({
    where: { id: packId, studentId: session.user.id },
  });
  if (!pack) return { error: "Pack not found." };

  await prisma.vocabPracticePack.update({
    where: { id: packId },
    data: {
      answers,
      completedAt: markComplete ? new Date() : pack.completedAt,
    },
  });
  revalidatePath("/portal");
  revalidatePath("/portal/vocab-practice");
  revalidatePath(`/portal/vocab-practice/${packId}`);
  return { ok: true as const };
}