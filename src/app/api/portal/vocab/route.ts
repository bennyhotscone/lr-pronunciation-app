import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { compareVocabEntries } from "@/lib/vocab-sort";

export const runtime = "nodejs";

/** GET target vocabulary for the signed-in student. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await prisma.vocabEntry.findMany({
    where: { studentId: session.user.id },
  });
  entries.sort(compareVocabEntries);

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      word: e.word,
      normalizedWord: e.normalizedWord,
      translation: e.translation,
      targetLang: e.targetLang,
      lookupCount: e.lookupCount,
      frequencyRank: e.frequencyRank,
      lastLookupAt: e.lastLookupAt.toISOString(),
      sourceResourceId: e.sourceResourceId,
    })),
  });
}
