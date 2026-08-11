"use client";

import { useState, useTransition } from "react";
import { adminCreateTeacher } from "@/lib/portal-actions";

export function AddTeacherForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(
    null,
  );

  return (
    <div className="card mt-8 rounded-2xl p-5">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
        Create teacher
      </h2>
      <p className="mt-1 text-sm text-muted">
        New accounts are always TEACHER — only you remain ADMIN.
      </p>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        id="add-teacher-form"
        action={(fd) => {
          setError(null);
          setCreated(null);
          startTransition(async () => {
            const res = await adminCreateTeacher(fd);
            if (res?.error) setError(res.error);
            else if (res?.ok) {
              setCreated({ email: res.email, tempPassword: res.tempPassword });
              (document.getElementById("add-teacher-form") as HTMLFormElement | null)?.reset();
            }
          });
        }}
      >
        <input
          name="email"
          type="email"
          required
          placeholder="teacher@example.com"
          className="rounded-xl border border-border bg-background/60 px-3 py-2"
        />
        <input
          name="fullName"
          required
          placeholder="Full name"
          className="rounded-xl border border-border bg-background/60 px-3 py-2"
        />
        <input
          name="preferredName"
          placeholder="Preferred name"
          className="rounded-xl border border-border bg-background/60 px-3 py-2"
        />
        <input
          name="tempPassword"
          placeholder="Temp password (optional)"
          className="rounded-xl border border-border bg-background/60 px-3 py-2"
        />
        {error ? <p className="sm:col-span-2 text-sm font-semibold text-danger">{error}</p> : null}
        {created ? (
          <p className="sm:col-span-2 rounded-xl bg-success/10 px-3 py-2 text-sm font-semibold text-success">
            Created teacher {created.email} — temp password: <code>{created.tempPassword}</code>
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="btn-secondary rounded-xl px-4 py-2.5 text-sm font-bold sm:col-span-2 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create teacher account"}
        </button>
      </form>
    </div>
  );
}
