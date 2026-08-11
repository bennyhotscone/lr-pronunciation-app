"use client";

import { useState, useTransition } from "react";
import { teacherCreateStudent } from "@/lib/portal-actions";

export function AddStudentForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(
    null,
  );

  return (
    <div className="card rounded-2xl p-5">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
        Add Student
      </h2>
      <p className="mt-1 text-sm text-muted">
        Creates a login. Share the temporary password with the student.
      </p>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        action={(fd) => {
          setError(null);
          setCreated(null);
          startTransition(async () => {
            const res = await teacherCreateStudent(fd);
            if (res?.error) setError(res.error);
            else if (res?.ok) {
              setCreated({ email: res.email, tempPassword: res.tempPassword });
              (document.getElementById("add-student-form") as HTMLFormElement | null)?.reset();
            }
          });
        }}
        id="add-student-form"
      >
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">Email</span>
          <input name="email" type="email" required className="w-full rounded-xl border border-border bg-background/60 px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Full name</span>
          <input name="fullName" required className="w-full rounded-xl border border-border bg-background/60 px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Preferred name</span>
          <input name="preferredName" className="w-full rounded-xl border border-border bg-background/60 px-3 py-2" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">
            Temp password (optional — auto-generated if blank)
          </span>
          <input name="tempPassword" className="w-full rounded-xl border border-border bg-background/60 px-3 py-2" />
        </label>
        {error ? <p className="sm:col-span-2 text-sm font-semibold text-danger">{error}</p> : null}
        {created ? (
          <p className="sm:col-span-2 rounded-xl bg-success/10 px-3 py-2 text-sm font-semibold text-success">
            Created {created.email} — temp password: <code>{created.tempPassword}</code>
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="btn-primary touch-target rounded-xl px-4 py-2.5 text-sm font-bold sm:col-span-2 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create student account"}
        </button>
      </form>
    </div>
  );
}
