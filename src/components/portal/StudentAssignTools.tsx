"use client";

import { useState, useTransition } from "react";
import {
  teacherAddGoal,
  teacherAddHomework,
  teacherAddLesson,
  teacherUploadResource,
} from "@/lib/portal-actions";

export function StudentAssignTools({
  studentId,
  studentLabel,
}: {
  studentId: string;
  studentLabel: string;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: (fd: FormData) => Promise<{ error?: string; ok?: boolean }>, fd: FormData, okMsg: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await action(fd);
      if (res?.error) setMsg(res.error);
      else setMsg(okMsg);
    });
  }

  return (
    <div className="mt-8 space-y-6">
      <p className="text-sm text-muted">
        Just-for-you items go only to <strong>{studentLabel}</strong>, independent of class membership.
      </p>
      {msg ? (
        <p className="rounded-xl bg-coral/15 px-3 py-2 text-sm font-semibold" role="status">
          {msg}
        </p>
      ) : null}

      <section className="card rounded-2xl p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Just-for-you lesson</h2>
        <form className="mt-3 grid gap-3" action={(fd) => run(teacherAddLesson, fd, "Individual lesson added.")}>
          <input type="hidden" name="studentId" value={studentId} />
          <input name="title" required placeholder="Title" className="rounded-xl border border-border bg-white px-3 py-2" />
          <input name="date" type="date" className="rounded-xl border border-border bg-white px-3 py-2" />
          <textarea name="summary" rows={3} placeholder="Summary" className="rounded-xl border border-border bg-white px-3 py-2" />
          <button type="submit" disabled={pending} className="btn-primary rounded-xl px-4 py-2 text-sm font-bold">
            Save
          </button>
        </form>
      </section>

      <section className="card rounded-2xl p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Just-for-you file</h2>
        <form className="mt-3 grid gap-3" action={(fd) => run(teacherUploadResource, fd, "File assigned to student.")}>
          <input type="hidden" name="studentId" value={studentId} />
          <input name="title" placeholder="Title" className="rounded-xl border border-border bg-white px-3 py-2" />
          <input name="file" type="file" required className="rounded-xl border border-border bg-white px-3 py-2" />
          <button type="submit" disabled={pending} className="btn-primary rounded-xl px-4 py-2 text-sm font-bold">
            Upload
          </button>
        </form>
      </section>

      <section className="card rounded-2xl p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Individual homework</h2>
        <form className="mt-3 grid gap-3" action={(fd) => run(teacherAddHomework, fd, "Homework assigned.")}>
          <input type="hidden" name="studentId" value={studentId} />
          <input name="title" required placeholder="Title" className="rounded-xl border border-border bg-white px-3 py-2" />
          <textarea name="instructions" required rows={3} placeholder="Instructions" className="rounded-xl border border-border bg-white px-3 py-2" />
          <input name="dueAt" type="date" className="rounded-xl border border-border bg-white px-3 py-2" />
          <button type="submit" disabled={pending} className="btn-primary rounded-xl px-4 py-2 text-sm font-bold">
            Assign
          </button>
        </form>
      </section>

      <section className="card rounded-2xl p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Add goal</h2>
        <p className="mt-1 text-xs text-muted">
          Add checklist steps (one per line). Only you can check them off — student sees progress.
        </p>
        <form className="mt-3 grid gap-3" action={(fd) => run(teacherAddGoal, fd, "Goal created.")}>
          <input type="hidden" name="studentId" value={studentId} />
          <input name="title" required placeholder="Goal title" className="rounded-xl border border-border bg-white px-3 py-2" />
          <textarea name="description" rows={2} placeholder="Description" className="rounded-xl border border-border bg-white px-3 py-2" />
          <textarea
            name="checklistItems"
            rows={4}
            placeholder={"Checklist steps (one per line)\ne.g. Practice /r/ in isolation\nRecord 5 words\nUse in a sentence"}
            className="rounded-xl border border-border bg-white px-3 py-2"
          />
          <button type="submit" disabled={pending} className="btn-secondary rounded-xl px-4 py-2 text-sm font-bold">
            Add goal
          </button>
        </form>
      </section>
    </div>
  );
}
