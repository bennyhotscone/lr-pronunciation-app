"use client";

import { useState, useTransition } from "react";
import {
  teacherIssueStudentResetLink,
  teacherSetStudentPassword,
} from "@/lib/portal-actions";

export function StudentPasswordTools({ studentId }: { studentId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [setResult, setSetResult] = useState<{ email: string; newPassword: string } | null>(
    null,
  );
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  return (
    <section className="card mt-6 rounded-2xl p-5">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
        Password help
      </h2>
      <p className="mt-1 text-sm text-muted">
        Set a new password for this student, or mint a one-time reset link they can open.
      </p>

      <form
        className="mt-4 flex flex-wrap gap-2"
        action={(fd) => {
          setError(null);
          setSetResult(null);
          setResetUrl(null);
          startTransition(async () => {
            const res = await teacherSetStudentPassword(fd);
            if (res?.error) setError(res.error);
            else if (res?.ok) setSetResult({ email: res.email, newPassword: res.newPassword });
          });
        }}
      >
        <input type="hidden" name="studentId" value={studentId} />
        <input
          name="newPassword"
          placeholder="New password (blank = auto)"
          className="min-w-[200px] flex-1 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-primary rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-60"
        >
          Set password
        </button>
      </form>

      <form
        className="mt-3"
        action={(fd) => {
          setError(null);
          setSetResult(null);
          setResetUrl(null);
          startTransition(async () => {
            const res = await teacherIssueStudentResetLink(fd);
            if (res?.error) setError(res.error);
            else if (res?.ok) setResetUrl(res.resetUrl);
          });
        }}
      >
        <input type="hidden" name="studentId" value={studentId} />
        <button
          type="submit"
          disabled={pending}
          className="btn-secondary rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-60"
        >
          Generate reset link
        </button>
      </form>

      {error ? <p className="mt-3 text-sm font-semibold text-danger">{error}</p> : null}
      {setResult ? (
        <p className="mt-3 rounded-xl bg-success/10 px-3 py-2 text-sm font-semibold text-success">
          Password set for {setResult.email}: <code>{setResult.newPassword}</code>
        </p>
      ) : null}
      {resetUrl ? (
        <div className="mt-3 rounded-xl bg-sand-accent/10 px-3 py-2 text-sm">
          <p className="font-semibold">One-time reset link (1 hour):</p>
          <p className="mt-1 break-all font-mono text-xs">{resetUrl}</p>
        </div>
      ) : null}
    </section>
  );
}
