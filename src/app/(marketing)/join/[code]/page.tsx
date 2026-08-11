import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { normalizeInviteCode } from "@/lib/invite-code";
import { studentJoinClassroomByCode } from "@/lib/classroom-actions";
import { redirect } from "next/navigation";
import { JoinCodeForm } from "@/components/classroom/JoinCodeForm";

export const metadata: Metadata = {
  title: "Join classroom",
};

export default async function JoinByCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = normalizeInviteCode(raw);
  const session = await auth();

  const klass = await prisma.class.findFirst({
    where: { inviteCode: code, archivedAt: null },
    select: { id: true, name: true, inviteCode: true },
  });

  if (session?.user && session.user.role !== "STUDENT") {
    return (
      <div className="mx-auto max-w-md pt-16 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          Student join link
        </h1>
        <p className="mt-3 text-muted">
          This invite is for students. Sign out of your staff account, or open the link in a private
          window after signing up as a student.
        </p>
        <Link href="/teacher" className="mt-6 inline-block font-bold text-sand-accent underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!klass) {
    return (
      <div className="mx-auto max-w-md pt-16 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          Invite not found
        </h1>
        <p className="mt-3 text-muted">Check the code with your teacher and try again.</p>
        <div className="mt-6 text-left">
          <JoinCodeForm />
        </div>
      </div>
    );
  }

  if (!session?.user) {
    const callback = `/join/${code}`;
    return (
      <div className="mx-auto max-w-md pt-16">
        <p className="chip bg-teal/20">Join classroom</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold">
          {klass.name}
        </h1>
        <p className="mt-2 text-muted">
          Create a free student account (or log in), then you&apos;ll join this classroom
          automatically.
        </p>
        <div className="mt-8 grid gap-3">
          <Link
            href={`/signup?callbackUrl=${encodeURIComponent(callback)}`}
            className="btn-primary rounded-xl px-4 py-3 text-center text-sm font-bold"
          >
            Sign up as student
          </Link>
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(callback)}`}
            className="btn-secondary rounded-xl px-4 py-3 text-center text-sm font-bold"
          >
            I already have an account — log in
          </Link>
        </div>
        <p className="mt-6 text-center text-xs text-muted">Code: {code}</p>
      </div>
    );
  }

  // Logged-in student: join in this request, then hard-navigate
  const fd = new FormData();
  fd.set("code", code);
  const result = await studentJoinClassroomByCode(fd);
  if (result && "ok" in result && result.ok && result.classId) {
    redirect(`/portal/classrooms/${result.classId}`);
  }

  return (
    <div className="mx-auto max-w-md pt-16 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
        Couldn&apos;t join
      </h1>
      <p className="mt-3 text-muted">
        {"error" in (result || {}) ? (result as { error?: string }).error : "Something went wrong."}
      </p>
      <div className="mt-6 text-left">
        <JoinCodeForm initialCode={code} />
      </div>
      <Link href="/portal" className="mt-6 inline-block font-bold underline">
        Back to My Desk
      </Link>
    </div>
  );
}
