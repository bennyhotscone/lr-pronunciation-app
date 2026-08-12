import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  frequencyRankForWord,
  normalizeVocabWord,
} from "@/lib/vocab-frequency";
import { translateWord, toMyMemoryLang } from "@/lib/vocab-translate";

export const runtime = "nodejs";

/**
 * POST { word, targetLang?, sourceResourceId? }
 * Translates via free providers and upserts VocabEntry (lookupCount++).
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    word?: string;
    targetLang?: string;
    sourceResourceId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const word = String(body.word || "").trim();
  const normalizedWord = normalizeVocabWord(word);
  if (!normalizedWord) {
    return NextResponse.json({ error: "No word selected." }, { status: 400 });
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
  });
  const targetLang = toMyMemoryLang(
    body.targetLang || profile?.targetLang || "zh-CN",
  );

  const translated = await translateWord(word, targetLang);
  if ("error" in translated) {
    return NextResponse.json({ error: translated.error }, { status: 502 });
  }

  const frequencyRank = frequencyRankForWord(normalizedWord);
  const sourceResourceId =
    typeof body.sourceResourceId === "string" && body.sourceResourceId.trim()
      ? body.sourceResourceId.trim()
      : null;

  const existing = await prisma.vocabEntry.findUnique({
    where: {
      studentId_normalizedWord_targetLang: {
        studentId: session.user.id,
        normalizedWord,
        targetLang,
      },
    },
  });

  const entry = existing
    ? await prisma.vocabEntry.update({
        where: { id: existing.id },
        data: {
          word: word.slice(0, 120),
          translation: translated.translation.slice(0, 500),
          lookupCount: { increment: 1 },
          lastLookupAt: new Date(),
          frequencyRank,
          ...(sourceResourceId ? { sourceResourceId } : {}),
        },
      })
    : await prisma.vocabEntry.create({
        data: {
          studentId: session.user.id,
          word: word.slice(0, 120),
          normalizedWord,
          translation: translated.translation.slice(0, 500),
          targetLang,
          lookupCount: 1,
          lastLookupAt: new Date(),
          frequencyRank,
          sourceResourceId,
        },
      });

  return NextResponse.json({
    ok: true,
    translation: translated.translation,
    definition: translated.definition ?? null,
    provider: translated.provider,
    entry: {
      id: entry.id,
      word: entry.word,
      normalizedWord: entry.normalizedWord,
      translation: entry.translation,
      targetLang: entry.targetLang,
      lookupCount: entry.lookupCount,
      frequencyRank: entry.frequencyRank,
      lastLookupAt: entry.lastLookupAt.toISOString(),
    },
  });
}
