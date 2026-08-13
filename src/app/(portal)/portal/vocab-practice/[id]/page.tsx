import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/portal-access";
import { VocabPracticePlayer } from "@/components/portal/VocabPracticePlayer";
import type { VocabPracticeActivities } from "@/lib/vocab-practice";

export default async function VocabPracticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("STUDENT");
  const { id } = await params;
  const pack = await prisma.vocabPracticePack.findFirst({
    where: { id, studentId: session.user.id },
  });
  if (!pack) notFound();

  const activities = (pack.activities || {
    comprehension: [],
    vocabActivities: [],
  }) as VocabPracticeActivities;
  const initialAnswers =
    pack.answers && typeof pack.answers === "object" && !Array.isArray(pack.answers)
      ? (pack.answers as { comprehension?: Record<string, number>; vocab?: Record<string, string> })
      : {};

  return (
    <div>
      <Link
        href="/portal/vocab-practice"
        className="text-sm font-bold text-desk-accent hover:underline"
      >
        ← All practice packs
      </Link>
      <div className="mt-4">
        <VocabPracticePlayer
          packId={pack.id}
          title={pack.title}
          story={pack.story}
          vocabUsed={pack.vocabUsed}
          activities={activities}
          initialAnswers={initialAnswers}
          completedAt={pack.completedAt?.toISOString() ?? null}
        />
      </div>
    </div>
  );
}