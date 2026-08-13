import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/portal-access";
import { openStoryAttemptForHomework } from "@/lib/story/actions";

export default async function PortalStoryOpenPage({
  searchParams,
}: {
  searchParams: Promise<{ homeworkId?: string }>;
}) {
  await requireRole("STUDENT");
  const sp = await searchParams;
  const homeworkId = sp.homeworkId?.trim();

  if (!homeworkId) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">Guided Story</h1>
        <p className="mt-2 text-sm text-muted">
          Missing homework link. Open this from your Desk homework list.
        </p>
        <Link href="/portal" className="mt-4 inline-block text-sm font-bold text-desk-accent">
          ← My Desk
        </Link>
      </main>
    );
  }

  const res = await openStoryAttemptForHomework(homeworkId);
  if (res.error || !("attemptId" in res) || !res.attemptId) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">Guided Story</h1>
        <p className="mt-2 text-sm text-muted">{res.error || "Could not open this story."}</p>
        <Link href="/portal" className="mt-4 inline-block text-sm font-bold text-desk-accent">
          ← My Desk
        </Link>
      </main>
    );
  }

  redirect(`/portal/stories/${res.attemptId}`);
}
