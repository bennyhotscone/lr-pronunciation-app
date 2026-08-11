import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Join with code",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  // Logged-in students should use the desk join page (same native form + theme)
  if (session?.user?.role === "STUDENT") {
    const q = new URLSearchParams();
    if (sp.code) q.set("code", sp.code);
    if (sp.error) q.set("error", sp.error);
    const suffix = q.toString() ? `?${q}` : "";
    redirect(`/portal/join${suffix}`);
  }

  const isStaff =
    session?.user?.role === "ADMIN" || session?.user?.role === "TEACHER";

  return (
    <div className="mx-auto max-w-md pt-16">
      <p className="chip bg-teal/20">Student</p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold">
        Join a classroom
      </h1>
      <p className="mt-2 text-muted">
        Enter the invite code from your teacher. Sign in as a student first if you haven&apos;t.
      </p>

      {isStaff ? (
        <p className="mt-6 rounded-xl border border-border bg-surface/70 px-4 py-3 text-sm text-muted">
          You&apos;re signed in as staff. Log out (or use a private window) and sign in as a{" "}
          <strong>student</strong> to join with a code.{" "}
          <Link href="/teacher" className="font-semibold text-sand-accent underline">
            Teacher dashboard
          </Link>
        </p>
      ) : (
        <form action="/api/portal/join" method="post" className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Invite code</span>
            <input
              name="code"
              required
              defaultValue={sp.code || ""}
              autoCapitalize="characters"
              className="w-full rounded-xl border border-border bg-background/60 px-3 py-3 font-mono text-lg tracking-widest uppercase"
              placeholder="K7M2PQ"
            />
          </label>
          {sp.error ? (
            <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
              {sp.error}
            </p>
          ) : null}
          <button type="submit" className="btn-primary w-full rounded-xl px-4 py-3 text-sm font-bold">
            Join classroom
          </button>
        </form>
      )}

      {!session?.user ? (
        <p className="mt-6 text-sm text-muted">
          No account yet?{" "}
          <Link href="/signup" className="font-semibold underline-offset-2 hover:underline">
            Sign up
          </Link>
          {" · "}
          <Link href="/login" className="font-semibold underline-offset-2 hover:underline">
            Log in
          </Link>
        </p>
      ) : null}
    </div>
  );
}
