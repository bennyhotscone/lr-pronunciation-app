import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { JoinCodeForm } from "@/components/classroom/JoinCodeForm";

export const metadata: Metadata = {
  title: "Join with code",
};

export default async function JoinPage() {
  const session = await auth();
  const isStudent = session?.user?.role === "STUDENT";
  const isStaff =
    session?.user?.role === "ADMIN" || session?.user?.role === "TEACHER";

  return (
    <div className="mx-auto max-w-md pt-16">
      <p className="chip bg-teal/20">Student</p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold">
        Join a classroom
      </h1>
      <p className="mt-2 text-muted">
        Enter the invite code from your teacher. You&apos;ll land in that classroom right away.
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
        <JoinCodeForm />
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
      ) : isStudent ? (
        <p className="mt-6 text-sm text-muted">
          Signed in as a student.{" "}
          <Link href="/portal" className="font-semibold underline-offset-2 hover:underline">
            Back to My Desk
          </Link>
        </p>
      ) : null}
    </div>
  );
}
