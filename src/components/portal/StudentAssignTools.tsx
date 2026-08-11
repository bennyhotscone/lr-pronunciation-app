"use client";

import { useState, useTransition } from "react";
import { teacherAddGoal } from "@/lib/portal-actions";

/**
 * Classroom-first: goals/checklists for a student.
 * Individual "just-for-you lessons/files" removed from the main path — those belong in a Classroom.
 */
export function StudentAssignTools({
  studentId,
  studentLabel,
}: {
  studentId: string;
  studentLabel: string;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-8 space-y-6">
      <p className="text-sm text-muted">
        Goals for <strong>{studentLabel}</strong>. Put shared materials in their{" "}
        <strong>Classroom</strong> (stream / lesson / files), not as one-off assignments here.
      </p>
      {msg ? (
        <p className="rounded-xl bg-coral/15 px-3 py-2 text-sm font-semibold" role="status">
          {msg}
        </p>
      ) : null}

      <section className="card rounded-2xl p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Add goal</h2>
        <p className="mt-1 text-xs text-muted">
          Checklist steps (one per line). Only you can check them off — for accountability.
        </p>
        <form
          className="mt-3 grid gap-3"
          action={(fd) => {
            setMsg(null);
            startTransition(async () => {
              const res = await teacherAddGoal(fd);
              if (res?.error) setMsg(res.error);
              else setMsg("Goal created.");
            });
          }}
        >
          <input type="hidden" name="studentId" value={studentId} />
          <input
            name="title"
            required
            placeholder="Goal title"
            className="rounded-xl border border-border bg-white px-3 py-2"
          />
          <textarea
            name="description"
            rows={2}
            placeholder="Description"
            className="rounded-xl border border-border bg-white px-3 py-2"
          />
          <textarea
            name="checklistItems"
            rows={4}
            placeholder={
              "Checklist steps (one per line)\ne.g. Practice /r/ in isolation\nRecord 5 words\nUse in a sentence"
            }
            className="rounded-xl border border-border bg-white px-3 py-2"
          />
          <button
            type="submit"
            disabled={pending}
            className="btn-secondary rounded-xl px-4 py-2 text-sm font-bold"
          >
            Add goal
          </button>
        </form>
      </section>
    </div>
  );
}
