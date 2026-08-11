import Link from "next/link";
import { JoinCodeForm } from "@/components/classroom/JoinCodeForm";

export default async function PortalJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const sp = await searchParams;
  const initialCode = (sp.code || "").trim();

  return (
    <div className="desk-shell mx-auto max-w-md">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
        Join a classroom
      </h1>
      <p className="mt-2 text-sm text-ink/60">
        Type the invite code your teacher gave you (or from their invite link / QR). You&apos;ll open
        that classroom right away.
      </p>
      <div className="desk-panel mt-6 rounded-2xl p-5">
        <JoinCodeForm initialCode={initialCode} loginCallbackBase="/portal/join" />
      </div>
      <p className="mt-4 text-sm text-ink/50">
        <Link
          href="/portal"
          className="font-semibold text-desk-accent underline-offset-2 hover:underline"
        >
          ← Back to My Desk
        </Link>
      </p>
    </div>
  );
}
