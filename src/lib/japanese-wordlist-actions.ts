"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { wordlistKnownKey } from "@/lib/japanese/wordlist-catalog";
import { isStaff } from "@/lib/portal-access";
import { isPrismaSchemaMissingError } from "@/lib/prisma-errors";

async function requireJapaneseLearner() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role === "STUDENT" || isStaff(session.user.role)) return session;
  return null;
}

/** Known-word flags across every block, for the reference wordlist filters. */
export async function loadJapaneseKnownFlags(): Promise<
  { error: string } | { knownKeys: string[] }
> {
  try {
    const session = await requireJapaneseLearner();
    if (!session) return { error: "Unauthorized" };

    const rows = await prisma.japaneseWordStat.findMany({
      where: { userId: session.user.id, known: true },
      select: { blockNumber: true, wordIndex: true },
    });
    return {
      knownKeys: rows.map((row) => wordlistKnownKey(row.blockNumber, row.wordIndex)),
    };
  } catch (err) {
    if (isPrismaSchemaMissingError(err)) return { knownKeys: [] };
    console.error("[loadJapaneseKnownFlags] failed", err);
    return { error: "Couldn't load known words." };
  }
}
