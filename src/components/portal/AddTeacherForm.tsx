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
    <div
      id="create-teacher"
      className="card mt-8 scroll-mt-6 rounded-2xl border border-sand-accent/40 p-5"
    >
      <p className="chip bg-sand-accent/25 text-sand-accent">Admin only</p>
      <h2 className="mt-3 font-[family-name:var(--font-display)] text-xl font-semibold">
        Invite a teacher
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Public signup is for <strong className="text-foreground">students only</strong>. To give
        someone a teacher login: create their account here, then share the email and password.
        New accounts are always role <code className="text-xs">TEACHER</code> — they get the
        teacher dashboard, not Mandarin Studio (Studio stays admin-only).
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        You (admin) already have full teacher powers on this same account — you do{" "}
        <strong className="text-foreground">not</strong> need a second teacher login to teach.
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
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">Teacher email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="colleague@example.com"
            className="w-full rounded-xl border border-border bg-background/60 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Full name</span>
          <input
            name="fullName"
            required
            placeholder="Full name"
            className="w-full rounded-xl border border-border bg-background/60 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Preferred name</span>
          <input
            name="preferredName"
            placeholder="Optional"
            className="w-full rounded-xl border border-border bg-background/60 px-3 py-2"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">
            Password (leave blank to auto-generate)
          </span>
          <input
            name="tempPassword"
            type="text"
            autoComplete="new-password"
            placeholder="Choose a password or leave blank"
            className="w-full rounded-xl border border-border bg-background/60 px-3 py-2"
          />
        </label>
        {error ? <p className="sm:col-span-2 text-sm font-semibold text-danger">{error}</p> : null}
        {created ? (
          <div className="sm:col-span-2 rounded-xl bg-success/10 px-3 py-3 text-sm font-semibold text-success">
            <p>
              Teacher account created. Share these credentials — they log in at{" "}
              <code className="text-xs">/login</code>:
            </p>
            <p className="mt-2">
              Email: <code>{created.email}</code>
            </p>
            <p>
              Password: <code>{created.tempPassword}</code>
            </p>
          </div>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="btn-primary rounded-xl px-4 py-2.5 text-sm font-bold sm:col-span-2 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create teacher account"}
        </button>
      </form>
    </div>
  );
}
