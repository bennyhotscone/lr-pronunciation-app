import Link from "next/link";

export default async function PortalJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const initialCode = (sp.code || "").trim();
  const error = (sp.error || "").trim();

  return (
    <div className="desk-shell mx-auto max-w-md">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
        Join a classroom
      </h1>
      <p className="mt-2 text-sm text-ink/60">
        Type the invite code from your teacher. You&apos;ll open that classroom right away.
      </p>

      <div className="desk-panel mt-6 rounded-2xl p-5">
        {/* Native HTML form — works even if client JS is stale/broken */}
        <form action="/api/portal/join" method="post" className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">Invite code</span>
            <input
              name="code"
              required
              defaultValue={initialCode}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-wood/30 bg-paper px-3 py-3 font-mono text-lg tracking-widest text-ink uppercase"
              placeholder="K7M2PQ"
            />
          </label>
          {error ? (
            <p
              className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn-desk w-full rounded-xl px-4 py-3 text-sm font-bold">
            Join classroom
          </button>
        </form>
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
