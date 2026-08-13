import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/portal-access";
import { DeskVocabPracticeCard } from "@/components/portal/DeskVocabPracticeCard";
import { VOCAB_PRACTICE_DAILY_CAP, utcDayBounds } from "@/lib/vocab-practice";

export default async function VocabPracticeIndexPage() {
  const session = await requireRole("STUDENT");
  const studentId = session.user.id;
  const { start, end } = utcDayBounds();

  const [packsToday, recentPacks, vocabCount] = await Promise.all([
    prisma.vocabPracticePack.count({
      where: { studentId, createdAt: { gte: start, lt: end } },
    }),
    prisma.vocabPracticePack.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        createdAt: true,
        completedAt: true,
        vocabUsed: true,
      },
    }),
    prisma.vocabEntry.count({ where: { studentId } }),
  ]);

  return (
    <div>
      <Link href="/portal" className="text-sm font-bold text-desk-accent hover:underline">
        ← My Desk
      </Link>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold">
        Daily vocab practice
      </h1>
      <p className="mt-2 text-muted">
        Up to {VOCAB_PRACTICE_DAILY_CAP} generated packs per day. Adult workplace/study tone — not
        Guided Story homework.
      </p>
      <div className="mt-6 max-w-xl">
        <DeskVocabPracticeCard
          packsToday={packsToday}
          vocabCount={vocabCount}
          recentPacks={recentPacks.map((p) => ({
            id: p.id,
            title: p.title,
            createdAt: p.createdAt.toISOString(),
            completedAt: p.completedAt?.toISOString() ?? null,
            vocabUsed: p.vocabUsed,
          }))}
        />
      </div>
    </div>
  );
}